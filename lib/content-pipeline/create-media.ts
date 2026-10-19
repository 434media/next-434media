/**
 * The Create table's media cell (plan v11 Step 2, item 4). A file goes from the browser straight to Blob storage (never
 * through a function body); optimization starts the moment it lands:
 *  - a photo is turned upright and resized to fit within IMAGE_MAX_PX, as a JPEG;
 *  - a video passes through when it is already an MP4 or MOV container within Canva's limits (under 500 MB; Canva also
 *    takes M4V, MKV, MPEG and WebM, canva.dev read 2026-10-19), so a phone clip needs no work;
 *  - anything else needs one ffmpeg pass (TRANSCODE_ARGS: H.264 MP4, at most 1080 px wide, 30 fps, fast-start).
 * Pure decisions here; the route does the I/O.
 */
export const IMAGE_MAX_PX = 2160
export const IMAGE_MAX_BYTES = 50 * 1024 * 1024
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024
/**
 * The largest clip converted in the function: input and output share /tmp (about 512 MB on Vercel). Real phone clips
 * converted at seconds per minute of video (step-2 evidence); a longer clip is saved as MP4 by the person, which passes
 * through up to VIDEO_MAX_BYTES. A longer-running worker is the plan's next resort, if real use needs it.
 */
export const TRANSCODE_MAX_BYTES = 200 * 1024 * 1024
export const UPLOAD_PREFIX = "content-create/"
export const IMAGE_TYPES = ["image/jpeg", "image/png"] as const
/** Containers Canva imports as video (canva.dev, read 2026-10-19). */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/x-matroska", "video/mpeg", "video/webm"] as const

export type VideoPlan = { action: "passthrough" } | { action: "transcode"; why: string } | { action: "refuse"; why: string }

/** The container from a file's first bytes: an ISO base media file (MP4, MOV, M4V) by its ftyp box, and its brand. */
export function videoContainer(head: Uint8Array): { kind: "isobmff"; brand: string } | { kind: "webm" | "mpeg" | "unknown" } {
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return { kind: "isobmff", brand: String.fromCharCode(...head.slice(8, 12)).trim() }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { kind: "webm" }
  if (head.length >= 4 && head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && (head[3] === 0xba || head[3] === 0xb3)) return { kind: "mpeg" }
  return { kind: "unknown" }
}

/**
 * What a video needs before Canva: an MP4/MOV/M4V file (ftyp brand isom, mp41/42, avc1, qt, M4V, iso*) under 500 MB
 * passes through; WebM, MPEG or an unrecognised container is converted; anything over 500 MB is refused, since the
 * conversion of so long a clip is not what a social card needs (trim it first).
 */
export function videoPlan(head: Uint8Array, bytes: number): VideoPlan {
  if (bytes > VIDEO_MAX_BYTES) return { action: "refuse", why: "Videos must be under 500 MB; trim the clip and drop it again" }
  const c = videoContainer(head)
  if (c.kind === "isobmff" && /^(isom|iso\d|mp4\d|avc1|qt|M4V|M4VH|M4VP|mmp4|f4v|3gp\d|3g2\w)$/i.test(c.brand)) return { action: "passthrough" }
  return { action: "transcode", why: c.kind === "isobmff" ? `an unusual MP4 brand (${c.brand})` : c.kind === "unknown" ? "an unrecognised container" : `a ${c.kind.toUpperCase()} file` }
}

/** The one ffmpeg pass: H.264 MP4, at most 1080 px wide (never upscaled; even height), 30 fps, AAC audio, fast-start. */
export function transcodeArgs(input: string, output: string): string[] {
  return ["-hide_banner", "-y", "-i", input, "-vf", "scale='min(1080,iw)':-2,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output]
}

/**
 * This project's Blob store host: the token is `vercel_blob_rw_<storeId>_<secret>` (as @vercel/blob reads it) and the
 * store serves at `<storeid>.public.blob.vercel-storage.com`. Null when no store is configured.
 */
export function blobStoreHost(token = process.env.BLOB_READ_WRITE_TOKEN): string | null {
  const storeId = token?.split("_")[3]
  return storeId && /^[A-Za-z0-9]+$/.test(storeId) ? `${storeId.toLowerCase()}.public.blob.vercel-storage.com` : null
}

/** Only the table's own uploads are optimized and filled: a public URL on this project's Blob store, under UPLOAD_PREFIX. */
export function isCreateUpload(url: string, host = blobStoreHost()): boolean {
  try {
    const u = new URL(url)
    return !!host && u.protocol === "https:" && u.hostname === host && u.pathname.startsWith(`/${UPLOAD_PREFIX}`)
  } catch { return false }
}

/** The kind of an upload by its declared type, or null when the table doesn't take it. */
export function mediaKind(contentType: string): "image" | "video" | null {
  const t = contentType.split(";")[0].trim().toLowerCase()
  if ((IMAGE_TYPES as readonly string[]).includes(t)) return "image"
  if ((VIDEO_TYPES as readonly string[]).includes(t)) return "video"
  return null
}
