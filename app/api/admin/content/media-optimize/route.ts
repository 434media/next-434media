import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod4"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import { IMAGE_MAX_BYTES, IMAGE_MAX_PX, UPLOAD_PREFIX, VIDEO_MAX_BYTES, isCreateUpload, mediaKind, videoPlan } from "@/lib/content-pipeline/create-media"

export const runtime = "nodejs"
export const maxDuration = 120

const input = z.object({ url: z.string().url().max(2000), name: z.string().trim().max(120).default("media") }).strict()
const MAX_PASTED_VIDEO = 100 * 1024 * 1024

/**
 * POST /api/admin/content/media-optimize — prepares a Create row's media for Canva, the moment it lands (plan v11 Step
 * 2 item 4): a photo is turned upright and resized to fit IMAGE_MAX_PX as a JPEG; a video Canva takes as it is passes
 * through. The url is the table's own upload (content-create/), or a pasted public https link, which is fetched (SSRF-
 * guarded) and stored first. Returns the media the row keeps.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success || !parsed.data.url.startsWith("https://")) return NextResponse.json({ error: "Give an https link to a photo or video" }, { status: 400 })
  const { url, name } = parsed.data
  const [{ isSafeRemoteUrl, fetchAllowingSafeRedirects }, { put }] = await Promise.all([import("@/lib/safe-remote-fetch"), import("@vercel/blob")])
  const safe = await isSafeRemoteUrl(url)
  if (!safe) return NextResponse.json({ error: "That link is not a public https address" }, { status: 400 })
  const own = isCreateUpload(url)
  let res: Response
  try { res = await fetchAllowingSafeRedirects(safe.url, safe.addresses) } catch { return NextResponse.json({ error: "The media could not be fetched" }, { status: 502 }) }
  if (!res.ok || !res.body) return NextResponse.json({ error: `The media link answered ${res.status}` }, { status: 502 })
  const kind = mediaKind(res.headers.get("content-type") || "")
  const declared = Number(res.headers.get("content-length") || 0)
  if (!kind) { await res.body.cancel().catch(() => {}); return NextResponse.json({ error: "Use a JPEG or PNG photo, or an MP4 or MOV video" }, { status: 400 }) }

  if (kind === "video") {
    const cap = own ? VIDEO_MAX_BYTES : MAX_PASTED_VIDEO
    if (declared > cap) { await res.body.cancel().catch(() => {}); return NextResponse.json({ error: own ? "Videos must be under 500 MB" : "A pasted video link must be under 100 MB; drop the file instead" }, { status: 400 }) }
    // The container is read from the first bytes; an own upload is not downloaded further.
    const reader = res.body.getReader(), chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value); size += value.byteLength
      if (own && size >= 64 * 1024) { await reader.cancel().catch(() => {}); break }
      if (size > cap) { await reader.cancel().catch(() => {}); return NextResponse.json({ error: "A pasted video link must be under 100 MB; drop the file instead" }, { status: 400 }) }
    }
    const all = Buffer.concat(chunks), bytes = own ? declared : all.byteLength
    const plan = videoPlan(all.subarray(0, 64), bytes)
    if (plan.action === "refuse") return NextResponse.json({ error: plan.why }, { status: 400 })
    // The conversion pass needs an ffmpeg binary on the server, which awaits the founder's approval of a package.
    if (plan.action === "transcode") return NextResponse.json({ error: `This video is ${plan.why}, which Canva may not take. Save it as MP4 (H.264) and drop it again.`, needs: "transcode" }, { status: 422 })
    const stored = own ? url : (await put(`${UPLOAD_PREFIX}${randomUUID()}-${name.replace(/[^\w.-]+/g, "-").slice(0, 60)}`, all, { access: "public", addRandomSuffix: false, contentType: res.headers.get("content-type") || "video/mp4" })).url
    return NextResponse.json({ media: { url: stored, kind: "video", name, bytes, optimized: "done" }, action: "passthrough" })
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
    const out = await sharp(Buffer.concat(chunks)).rotate().resize({ width: IMAGE_MAX_PX, height: IMAGE_MAX_PX, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true })
    const blob = await put(`${UPLOAD_PREFIX}${randomUUID()}-optimized.jpg`, out.data, { access: "public", addRandomSuffix: false, contentType: "image/jpeg" })
    return NextResponse.json({ media: { url: blob.url, kind: "image", name, bytes: out.data.byteLength, width: out.info.width, height: out.info.height, optimized: "done" }, action: "resized" })
  } catch (err) {
    console.error("[POST /api/admin/content/media-optimize] image:", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: "That photo could not be read" }, { status: 400 })
  }
}
