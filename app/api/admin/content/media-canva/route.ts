import { NextResponse, type NextRequest } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod4"
import { requireContentRunner } from "../../content-pipeline/auth"
import { IMAGE_MAX_BYTES, UPLOAD_PREFIX, VIDEO_MAX_BYTES } from "@/lib/content-pipeline/create-media"
import { resolveCanvaDesignLink } from "@/lib/content-pipeline/row-approval"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Canva renders an MP4 in up to five minutes; the file is then stored.
export const maxDuration = 400

const input = z.object({ designLink: z.string().max(2000), as: z.enum(["video", "photo"]) }).strict()

/**
 * POST /api/admin/content/media-canva — media from a Canva design link (Step 3 part 4), for the Create table's Media
 * cell and the drawer's Replace media: the design is exported (MP4 for a video, JPG of its first page for a photo) and
 * stored under content-create/, so it is used exactly as a dropped file is. Canva's MP4 is already H.264 and its JPG a
 * finished image, so neither needs the optimize pass. Only reads the design; nothing in Canva changes.
 */
export async function POST(req: NextRequest) {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Paste a Canva design link" }, { status: 400 })
  const { designLink, as } = parsed.data
  const designId = await resolveCanvaDesignLink(designLink, fetch).catch(() => null)
  if (!designId) return NextResponse.json({ error: "Paste a Canva design link (canva.com/design/… or a canva.link share link)" }, { status: 400 })
  const [{ canvaDeps }, { exportDesignJpg, exportDesignMp4, CanvaError }, { put }] = await Promise.all([import("@/lib/owned-meta-execution"), import("@/lib/canva-export"), import("@vercel/blob")])
  try {
    const { deps } = await canvaDeps()
    if (!deps) throw new CanvaError("Canva integration is not configured")
    const urls = as === "video" ? await exportDesignMp4(deps, { designId }) : await exportDesignJpg(deps, { designId, pages: [1] })
    const source = urls[0] ? new URL(urls[0]) : null
    if (!source || source.protocol !== "https:") throw new CanvaError("Canva returned no export for this design")
    const res = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(120_000) })
    if (!res.ok || !res.body) throw new CanvaError("Canva's export could not be downloaded")
    const cap = as === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const c of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += c.byteLength
      if (size > cap) return NextResponse.json({ error: as === "video" ? "The design's video is over 500 MB" : "The design's image is over 50 MB" }, { status: 400 })
      chunks.push(c)
    }
    const ext = as === "video" ? "mp4" : "jpg"
    const blob = await put(`${UPLOAD_PREFIX}${randomUUID()}-canva-${designId}.${ext}`, Buffer.concat(chunks), { access: "public", addRandomSuffix: false, contentType: as === "video" ? "video/mp4" : "image/jpeg" })
    console.info("[content/media-canva]", JSON.stringify({ by: auth.session.email, design: designId, as, bytes: size }))
    return NextResponse.json({ media: { url: blob.url, kind: as === "video" ? "video" : "image", name: `Canva ${designId}.${ext}`, bytes: size, optimized: "done" } })
  } catch (err) {
    console.error("[POST /api/admin/content/media-canva]", designId, err)
    // Canva's messages are ours (never its vendor text), so they are safe to show.
    if (err instanceof CanvaError) return NextResponse.json({ error: err.message }, { status: 502 })
    return NextResponse.json({ error: "The design could not be exported; try again" }, { status: 500 })
  }
}
