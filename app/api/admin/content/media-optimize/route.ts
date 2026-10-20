import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod4"
import { requireContentRunner } from "../../content-pipeline/auth"
import { IMAGE_MAX_BYTES, IMAGE_MAX_PX, PAGE_LINK_MESSAGE, TRANSCODE_MAX_BYTES, UPLOAD_PREFIX, VIDEO_MAX_BYTES, isCreateUpload, isPageLink, isPageType, mediaKind, videoPlan } from "@/lib/content-pipeline/create-media"

export const runtime = "nodejs"
// A conversion pass streams the clip to disk, converts it and stores the result.
export const maxDuration = 300

const input = z.object({ url: z.string().url().max(2000), name: z.string().trim().max(120).default("media") }).strict()
const MAX_PASTED_VIDEO = 100 * 1024 * 1024

/**
 * POST /api/admin/content/media-optimize — prepares a Create row's media for Canva, the moment it lands (plan v11 Step
 * 2 item 4): a photo (JPEG, PNG, WebP, AVIF, GIF or TIFF) is turned upright, flattened on white and resized to fit IMAGE_MAX_PX as a JPEG; a web-page link gets PAGE_LINK_MESSAGE; a video Canva takes as it is passes
 * through, and any other video gets one ffmpeg pass (lib/content-pipeline/transcode.ts). The url is the table's own upload (content-create/), or a pasted public https link, which is fetched (SSRF-
 * guarded) and stored first. Returns the media the row keeps.
 */
export async function POST(req: NextRequest) {
  // Leaves time inside maxDuration to store the result after a conversion.
  const deadline = Date.now() + (maxDuration - 45) * 1000
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !parsed.data.url.startsWith("https://")) return NextResponse.json({ error: "Give an https link to a photo or video" }, { status: 400 })
  const { url, name } = parsed.data
  if (isPageLink(url)) return NextResponse.json({ error: PAGE_LINK_MESSAGE }, { status: 400 })
  const [{ isSafeRemoteUrl, fetchAllowingSafeRedirects }, { put }] = await Promise.all([import("@/lib/safe-remote-fetch"), import("@vercel/blob")])
  const safe = await isSafeRemoteUrl(url)
  if (!safe) return NextResponse.json({ error: "That link is not a public https address" }, { status: 400 })
  const own = isCreateUpload(url)
  let res: Response
  try { res = await fetchAllowingSafeRedirects(safe.url, safe.addresses) } catch { return NextResponse.json({ error: "The media could not be fetched" }, { status: 502 }) }
  if (!res.ok || !res.body) return NextResponse.json({ error: `The media link answered ${res.status}` }, { status: 502 })
  const type = res.headers.get("content-type") || ""
  const kind = mediaKind(type)
  const declared = Number(res.headers.get("content-length") || 0)
  if (!kind) { await res.body.cancel().catch(() => {}); return NextResponse.json({ error: isPageType(type) ? PAGE_LINK_MESSAGE : "Use a photo (JPEG, PNG, WebP, AVIF, GIF or TIFF) or an MP4 or MOV video" }, { status: 400 }) }

  if (kind === "video") {
    const cap = own ? VIDEO_MAX_BYTES : MAX_PASTED_VIDEO
    if (declared > cap) { await res.body.cancel().catch(() => {}); return NextResponse.json({ error: own ? "Videos must be under 500 MB" : "A pasted video link must be under 100 MB; drop the file instead" }, { status: 400 }) }
    // The container is read from the first bytes, kept for the rest of the stream.
    const reader = res.body.getReader(), first: Uint8Array[] = []
    let seen = 0
    while (seen < 64) { const { done, value } = await reader.read(); if (done) break; first.push(value); seen += value.byteLength }
    const head = Buffer.concat(first), bytes = declared || head.byteLength
    const plan = videoPlan(head.subarray(0, 64), bytes)
    if (plan.action === "refuse") { await reader.cancel().catch(() => {}); return NextResponse.json({ error: plan.why }, { status: 400 }) }
    const rest = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(head) },
      async pull(c) { const { done, value } = await reader.read(); if (done) c.close(); else c.enqueue(value) },
      cancel() { return reader.cancel() },
    })
    const safeName = name.replace(/[^\w.-]+/g, "-").slice(0, 60)
    if (plan.action === "transcode") {
      if (declared > TRANSCODE_MAX_BYTES) { await reader.cancel().catch(() => {}); return NextResponse.json({ error: `This video (${plan.why}) is over ${TRANSCODE_MAX_BYTES / 1048576} MB, too long to convert here; save it as MP4 and drop it again` }, { status: 400 }) }
      try {
        const { transcodeToMp4 } = await import("@/lib/content-pipeline/transcode")
        const out = await transcodeToMp4(rest, { deadline, maxBytes: Math.min(cap, TRANSCODE_MAX_BYTES) })
        const blob = await put(`${UPLOAD_PREFIX}${randomUUID()}-${safeName.replace(/\.[^.]*$/, "")}.mp4`, out.bytes, { access: "public", addRandomSuffix: false, contentType: "video/mp4" })
        console.info("[content/media-optimize] converted", JSON.stringify({ by: auth.session.email, why: plan.why, inBytes: bytes, outBytes: out.bytes.byteLength, ms: out.ms }))
        return NextResponse.json({ media: { url: blob.url, kind: "video", name, bytes: out.bytes.byteLength, optimized: "done" }, action: "converted", ms: out.ms })
      } catch (err) {
        console.error("[POST /api/admin/content/media-optimize] conversion:", err instanceof Error ? err.message : err)
        return NextResponse.json({ error: `This video (${plan.why}) could not be converted: ${err instanceof Error ? err.message : "unknown error"}. Save it as MP4 and drop it again.` }, { status: 422 })
      }
    }
    if (own) { await reader.cancel().catch(() => {}); return NextResponse.json({ media: { url, kind: "video", name, bytes, optimized: "done" }, action: "passthrough" }) }
    // A pasted link that passes through is stored as it is, so Canva fetches it from the table's own storage.
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const c of rest as unknown as AsyncIterable<Uint8Array>) { size += c.byteLength; if (size > cap) return NextResponse.json({ error: "A pasted video link must be under 100 MB; drop the file instead" }, { status: 400 }); chunks.push(c) }
    const stored = await put(`${UPLOAD_PREFIX}${randomUUID()}-${safeName}`, Buffer.concat(chunks), { access: "public", addRandomSuffix: false, contentType: res.headers.get("content-type") || "video/mp4" })
    return NextResponse.json({ media: { url: stored.url, kind: "video", name, bytes: size, optimized: "done" }, action: "passthrough" })
  }

  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    size += chunk.byteLength
    if (size > IMAGE_MAX_BYTES) return NextResponse.json({ error: "Photos must be under 50 MB" }, { status: 400 })
    chunks.push(chunk)
  }
  try {
    const sharp = (await import("sharp")).default
    const out = await sharp(Buffer.concat(chunks), { animated: false }).rotate().flatten({ background: "#ffffff" }).resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true })
    const blob = await put(`${UPLOAD_PREFIX}${randomUUID()}-optimized.jpg`, out.data, { access: "public", addRandomSuffix: false, contentType: "image/jpeg" })
    return NextResponse.json({ media: { url: blob.url, kind: "image", name, bytes: out.data.byteLength, width: out.info.width, height: out.info.height, optimized: "done" }, action: "resized" })
  } catch (err) {
    console.error("[POST /api/admin/content/media-optimize] image:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "That photo could not be read" }, { status: 400 })
  }
}
