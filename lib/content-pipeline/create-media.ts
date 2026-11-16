/**
 * The Create table's media cell (plan v11 Step 2, item 4). A file goes from the browser straight to Blob storage (never
 * through a function body); optimization starts the moment it lands:
 *  - a photo is turned upright and resized to fit within IMAGE_MAX_PX, as a JPEG;
 *  - a video passes through when it is already an MP4 or MOV container within Canva's limits (under 500 MB; Canva also
 *    takes M4V, MKV, MPEG and WebM, canva.dev read 2026-10-19) and already sized for social (SOCIAL_VIDEO);
 *  - an MP4 or MOV sized beyond social (wider than 1080 px, above 30 fps, or a higher bitrate than a feed needs) is
 *    shrunk, when it is short enough to convert in the function; otherwise it passes through as before, and says so;
 *  - anything else needs one ffmpeg pass (transcodeArgs: H.264 MP4, at most 1080 px wide, 30 fps, fast-start).
 * Pure decisions here; the route does the I/O.
 */
import type { VideoMeta } from "./mp4-probe"

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
/** Photos the table takes; anything but a JPEG is converted to one when it lands (sharp reads all of these). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/tiff"] as const
/** Containers Canva imports as video (canva.dev, read 2026-10-19). */
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/x-matroska", "video/mpeg", "video/webm"] as const

/**
 * What "sized for social" means for the Create table (founder, 2026-11-16: shrink on upload). Instagram and Facebook
 * show feed and Reels video at 1080 px wide and 30 fps at most, and re-encode every upload themselves, so anything
 * larger only makes the file slower to upload, to import into Canva and to export. maxMbps is the overall bitrate a
 * clip may already have and still pass through: transcodeArgs caps its own output near 8 Mbps (video) plus 128 kbps
 * audio, so a clip at or under 10 Mbps would not get meaningfully smaller. A phone records 1080p30 at about 16 Mbps
 * (H.264) and 4K at 45 to 100 Mbps, so a typical phone clip is shrunk; a Canva export (about 5 to 8 Mbps) is not.
 */
export const SOCIAL_VIDEO = { maxWidth: 1080, maxFps: 30, maxMbps: 10 } as const
/** With no readable header, a clip over this size is taken as beyond social (a minute at 10 Mbps is 75 MB). */
export const SHRINK_UNKNOWN_BYTES = 100 * 1024 * 1024
/**
 * The longest clip shrunk in the function. The download and the conversion share one deadline inside maxDuration
 * (300 s, of which 255 s for the work). Measured 2026-11-16 with transcodeArgs on one Apple M2 core, worst-case noisy
 * synthetic clips: 1080p30 at 16 Mbps converted at 0.58 s per second of video, 4K60 at 50 Mbps at 0.52 s. Allowing a
 * function vCPU two to three times slower, two minutes of 1080p is about 175 s; heavier sources hit the 200 MB cap
 * (TRANSCODE_MAX_BYTES, about 30 s of 4K60) first. A longer clip passes through as it is, and the message says to
 * trim it; a shrink that still runs out of time also passes through, with a note.
 */
export const SHRINK_MAX_SECONDS = 120

export type VideoPlan =
  | { action: "passthrough"; note?: string }
  | { action: "transcode"; why: string; shrink?: boolean }
  | { action: "refuse"; why: string }

/** The container from a file's first bytes: an ISO base media file (MP4, MOV, M4V) by its ftyp box, and its brand. */
export function videoContainer(head: Uint8Array): { kind: "isobmff"; brand: string } | { kind: "webm" | "mpeg" | "unknown" } {
  if (head.length >= 12 && head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) return { kind: "isobmff", brand: String.fromCharCode(...head.slice(8, 12)).trim() }
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return { kind: "webm" }
  if (head.length >= 4 && head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && (head[3] === 0xba || head[3] === 0xb3)) return { kind: "mpeg" }
  return { kind: "unknown" }
}

/** Why a clip is larger than social needs, from its header (VideoMeta) or, without one, its size. Empty when it is not. */
export function beyondSocial(bytes: number, meta?: VideoMeta | null): string[] {
  if (!meta) return bytes > SHRINK_UNKNOWN_BYTES ? [`over ${SHRINK_UNKNOWN_BYTES / 1048576} MB`] : []
  const why: string[] = []
  if (meta.width > SOCIAL_VIDEO.maxWidth) why.push(`${meta.width}×${meta.height}`)
  // 30.5 lets 29.97 and a rounded 30.0x through.
  if (meta.fps > SOCIAL_VIDEO.maxFps + 0.5) why.push(`${Math.round(meta.fps)} fps`)
  const mbps = (bytes * 8) / meta.seconds / 1e6
  if (mbps > SOCIAL_VIDEO.maxMbps) why.push(`${Math.round(mbps)} Mbps`)
  return why
}

/**
 * What a video needs before Canva: an MP4/MOV/M4V file (ftyp brand isom, mp41/42, avc1, qt, M4V, iso*) under 500 MB
 * passes through when it is already sized for social, and is shrunk when it is not (beyondSocial) and fits the
 * function (TRANSCODE_MAX_BYTES, SHRINK_MAX_SECONDS); one too large to shrink passes through with a note, as before.
 * WebM, MPEG or an unrecognised container is converted; anything over 500 MB is refused, since the conversion of so
 * long a clip is not what a social card needs (trim it first). meta is the clip's header, when it could be read.
 */
export function videoPlan(head: Uint8Array, bytes: number, meta?: VideoMeta | null): VideoPlan {
  if (bytes > VIDEO_MAX_BYTES) return { action: "refuse", why: "Videos must be under 500 MB; trim the clip and drop it again" }
  const c = videoContainer(head)
  if (c.kind === "isobmff" && /^(isom|iso\d|mp4\d|avc1|qt|M4V|M4VH|M4VP|mmp4|f4v|3gp\d|3g2\w)$/i.test(c.brand)) {
    const why = beyondSocial(bytes, meta)
    if (!why.length) return { action: "passthrough" }
    const tooBig = bytes > TRANSCODE_MAX_BYTES, tooLong = !!meta && meta.seconds > SHRINK_MAX_SECONDS
    if (tooBig || tooLong) return { action: "passthrough", note: `Video kept as it is: it is larger than social needs (${why.join(", ")}) but ${tooBig ? `over ${TRANSCODE_MAX_BYTES / 1048576} MB` : `over ${SHRINK_MAX_SECONDS / 60} minutes`}, too long to shrink here. Trim it and drop it again to have it shrunk.` }
    return { action: "transcode", why: why.join(", "), shrink: true }
  }
  return { action: "transcode", why: c.kind === "isobmff" ? `an unusual MP4 brand (${c.brand})` : c.kind === "unknown" ? "an unrecognised container" : `a ${c.kind.toUpperCase()} file` }
}

/**
 * The one ffmpeg pass: H.264 (High profile) MP4, at most 1080 px wide (never upscaled; even height), 30 fps, AAC audio,
 * fast-start. Quality is CRF 23 (x264's default, visually clean at 1080 px), capped at 8 Mbps with a 16 Mb buffer so a
 * busy clip (crowds, confetti, water) cannot balloon: 8 Mbps is above what Instagram and Facebook serve 1080p feed
 * video at after their own re-encode, so the cap costs nothing visible, and it keeps a minute of video near 60 MB.
 */
export function transcodeArgs(input: string, output: string): string[] {
  return ["-hide_banner", "-y", "-i", input, "-vf", "scale='min(1080,iw)':-2,fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-maxrate", "8M", "-bufsize", "16M", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", output]
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

/** What the media cell says when a link is a web page (a YouTube watch page, an article) rather than the file itself. */
export const PAGE_LINK_MESSAGE = "That's a web page, not a media file. Download the clip or photo and drop it in, or paste a direct link to the file itself (.jpg, .png, .webp, .avif, .gif, .tif, .mp4 or .mov)."
/** Video and social sites whose links are pages, never the file: refused before anything is fetched. */
const PAGE_HOSTS = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|instagram\.com|facebook\.com|fb\.watch|tiktok\.com|x\.com|twitter\.com|linkedin\.com)$/i
export function isPageLink(url: string): boolean {
  try { return PAGE_HOSTS.test(new URL(url).hostname) } catch { return false }
}
/** DVIDS's image CDNs, which name the image's id in the path (…/thumbs/photos/2601/9500068/1000w_q95.jpg). */
const DVIDS_MEDIA_HOSTS = ["d1ldvf68ux039x.cloudfront.net", "d34w7g4gy10iej.cloudfront.net"]
/** The DVIDS image page a media link comes from: the page itself, or the one its CDN path names. Null for anything else. */
export function dvidsImagePage(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url), host = u.hostname.toLowerCase()
    const id = /(^|\.)dvidshub\.net$/.test(host) ? /^\/image\/(\d+)/.exec(u.pathname)?.[1]
      : DVIDS_MEDIA_HOSTS.includes(host) ? /\/photos\/\d{4}\/(\d+)\//.exec(u.pathname)?.[1] : undefined
    return u.protocol === "https:" && id ? `https://www.dvidshub.net/image/${id}` : null
  } catch { return null }
}
/** Whether a fetched link answered with a web page rather than a media file. */
export const isPageType = (contentType: string) => /^(text\/html|application\/xhtml\+xml)\b/i.test(contentType.trim())

/** The kind of an upload by its declared type, or null when the table doesn't take it. */
export function mediaKind(contentType: string): "image" | "video" | null {
  const t = contentType.split(";")[0].trim().toLowerCase()
  if ((IMAGE_TYPES as readonly string[]).includes(t)) return "image"
  if ((VIDEO_TYPES as readonly string[]).includes(t)) return "video"
  return null
}
