import { createHash } from "node:crypto"
import type { VideoTiming } from "@/components/crm/types"

/**
 * A Create-table video's length, matched to its clip (2026-11-05: a 21.4 s clip came out of the News Feed template as
 * a 60 s video with a white tail). Canva takes an MP4 export's length from the design's page timing, which an autofill
 * never changes, and the Connect API can neither read nor set it. So every video export is checked against the clip it
 * was made from, by reading both files' own MP4 metadata:
 *
 *  - the export runs as long as the clip (within TIMING_TOLERANCE_SEC): it is used as it is;
 *  - it runs longer (a blank tail): the tail is cut with one ffmpeg stream copy (no re-encode, so nothing before the
 *    cut changes, overlays included), and the cut file is measured again before it is used;
 *  - anything else is held: the export runs shorter than the clip (cut by the page timing), the clip's sound is
 *    missing or ends early, either length can't be read, or the cut didn't land. A held video is still attached, so
 *    the reviewer sees it, but readiness() refuses to approve it until it is made again.
 *
 * The result is kept on the post (VideoTiming), bound to the exact file by its SHA-256, so a file attached any other way
 * is never taken as checked.
 */

/** Within this, the export and the clip are the same length: a frame or two, and Canva's 0.1 s page steps. */
export const TIMING_TOLERANCE_SEC = 0.35
/** A clip longer than this is not a Create-table clip; its length is not trusted. */
export const MAX_CLIP_SEC = 15 * 60

export interface Mp4Timing {
  /** The movie's presentation length (mvhd), seconds. */
  movieSec: number | null
  /** The first video track's presentation length, seconds; null when the file has none. */
  videoSec: number | null
  /** The first sound track's presentation length, seconds; null when the file has none. */
  audioSec: number | null
}

/** The timing kept on a post (content_posts.video_timing), for the file whose SHA-256 it names. */
export type { VideoTiming }

export type TimingDecision = { action: "matched" } | { action: "trim"; toSec: number } | { action: "hold"; why: string }

class Mp4Error extends Error {}

/** m:ss.s for a person: 21.4 → "0:21.4". */
export function clock(sec: number): string {
  const s = Math.round(sec * 10) / 10, m = Math.floor(s / 60), r = s - m * 60
  return `${m}:${r < 10 ? "0" : ""}${r.toFixed(1)}`
}

interface Box { type: string; start: number; end: number }
function boxes(b: Buffer, start: number, end: number): Box[] {
  const out: Box[] = []
  for (let p = start; p < end;) {
    if (p + 8 > end) throw new Mp4Error("truncated box")
    let size = b.readUInt32BE(p), head = 8
    if (size === 1) { if (p + 16 > end) throw new Mp4Error("truncated box"); const big = b.readBigUInt64BE(p + 8); if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new Mp4Error("box too large"); size = Number(big); head = 16 }
    else if (size === 0) size = end - p
    if (size < head || p + size > end) throw new Mp4Error("invalid box")
    out.push({ type: b.subarray(p + 4, p + 8).toString("latin1"), start: p + head, end: p + size })
    p += size
  }
  return out
}
/** version/flags, then (creation, modification, [track id, reserved]) and a 32- or 64-bit duration. */
function fullBoxTimes(b: Buffer, box: Box, kind: "mvhd" | "mdhd" | "tkhd"): { scale?: number; duration: number } {
  const v = b[box.start]
  const need = (n: number) => { if (box.start + n > box.end) throw new Mp4Error(`short ${kind}`) }
  if (kind === "tkhd") {
    // tkhd: no timescale of its own (it is the movie's); duration after the track id and a reserved word.
    const off = v === 1 ? 4 + 8 + 8 + 4 + 4 : 4 + 4 + 4 + 4 + 4
    need(off + (v === 1 ? 8 : 4))
    return { duration: v === 1 ? Number(b.readBigUInt64BE(box.start + off)) : b.readUInt32BE(box.start + off) }
  }
  const scaleOff = v === 1 ? 4 + 8 + 8 : 4 + 4 + 4
  need(scaleOff + 4 + (v === 1 ? 8 : 4))
  const scale = b.readUInt32BE(box.start + scaleOff)
  const duration = v === 1 ? Number(b.readBigUInt64BE(box.start + scaleOff + 4)) : b.readUInt32BE(box.start + scaleOff + 4)
  return { scale, duration }
}
const finite = (n: number) => Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : null

/** Lengths from a moov box's contents. A fragmented file (mvex) keeps its length elsewhere: null, never a guess. */
export function timingFromMoov(b: Buffer, moov: Box): Mp4Timing {
  const kids = boxes(b, moov.start, moov.end)
  const mvhd = kids.find(k => k.type === "mvhd")
  if (!mvhd) throw new Mp4Error("no mvhd")
  if (kids.some(k => k.type === "mvex")) return { movieSec: null, videoSec: null, audioSec: null }
  const movie = fullBoxTimes(b, mvhd, "mvhd")
  if (!movie.scale) throw new Mp4Error("no movie timescale")
  const t: Mp4Timing = { movieSec: finite(movie.duration / movie.scale), videoSec: null, audioSec: null }
  for (const trak of kids.filter(k => k.type === "trak")) {
    const tk = boxes(b, trak.start, trak.end), tkhd = tk.find(k => k.type === "tkhd"), mdia = tk.find(k => k.type === "mdia")
    if (!tkhd || !mdia) continue
    const md = boxes(b, mdia.start, mdia.end), hdlr = md.find(k => k.type === "hdlr"), mdhd = md.find(k => k.type === "mdhd")
    if (!hdlr || hdlr.start + 12 > hdlr.end) continue
    const handler = b.subarray(hdlr.start + 8, hdlr.start + 12).toString("latin1")
    if (handler !== "vide" && handler !== "soun") continue
    // The presentation length (tkhd, in the movie's timescale) counts edit lists; the media length (mdhd) is the fallback.
    let sec = finite(fullBoxTimes(b, tkhd, "tkhd").duration / movie.scale)
    if (sec === null && mdhd) { const m = fullBoxTimes(b, mdhd, "mdhd"); sec = m.scale ? finite(m.duration / m.scale) : null }
    if (handler === "vide" && t.videoSec === null) t.videoSec = sec
    if (handler === "soun" && t.audioSec === null) t.audioSec = sec
  }
  return t
}

/** Lengths from a whole MP4 or MOV file's bytes. */
export function mp4Timing(bytes: Uint8Array): Mp4Timing {
  const b = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (b.length < 12 || b.subarray(4, 8).toString("latin1") !== "ftyp") throw new Mp4Error("not an MP4")
  const moov = boxes(b, 0, b.length).find(x => x.type === "moov")
  if (!moov) throw new Mp4Error("no moov")
  return timingFromMoov(b, moov)
}

/** One HTTP range read: the bytes, and the file's whole size from Content-Range. */
export type RangeReader = (url: string, start: number, end: number) => Promise<{ bytes: Uint8Array; total: number }>
const MAX_MOOV_BYTES = 32 * 1024 * 1024

/**
 * A stored clip's lengths without downloading it: the top-level box headers are walked with range reads and only the
 * moov box is fetched (one or two reads for a fast-start file; a few more when moov sits after the media).
 */
export async function probeMp4Timing(read: RangeReader, url: string): Promise<Mp4Timing> {
  let pos = 0, total = Infinity
  for (let i = 0; i < 64 && pos < total; i++) {
    const head = await read(url, pos, pos + 15)
    total = head.total
    const h = Buffer.from(head.bytes)
    if (h.length < 8) throw new Mp4Error("truncated box header")
    let size = h.readUInt32BE(0), headLen = 8
    const type = h.subarray(4, 8).toString("latin1")
    if (i === 0 && type !== "ftyp") throw new Mp4Error("not an MP4")
    if (size === 1) { if (h.length < 16) throw new Mp4Error("truncated box header"); size = Number(h.readBigUInt64BE(8)); headLen = 16 }
    else if (size === 0) size = total - pos
    if (size < headLen || !Number.isSafeInteger(size)) throw new Mp4Error("invalid box")
    if (type === "moov") {
      if (size > MAX_MOOV_BYTES) throw new Mp4Error("moov too large")
      const whole = Buffer.from((await read(url, pos, pos + size - 1)).bytes)
      if (whole.length !== size) throw new Mp4Error("short moov read")
      return timingFromMoov(whole, { type, start: headLen, end: size })
    }
    pos += size
  }
  throw new Mp4Error("no moov")
}

/** Range reads over fetch: a server that ignores Range (200 with the whole file) is refused, never downloaded. */
export function fetchRangeReader(fetcher: typeof fetch): RangeReader {
  return async (url, start, end) => {
    const res = await fetcher(url, { headers: { range: `bytes=${start}-${end}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30_000) })
    if (res.status !== 206) { await res.body?.cancel().catch(() => {}); throw new Mp4Error(`range read answered ${res.status}`) }
    const total = Number(/\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1])
    if (!Number.isSafeInteger(total)) throw new Mp4Error("no content-range")
    return { bytes: new Uint8Array(await res.arrayBuffer()), total }
  }
}

/** What to do with a video export, given its clip. Pure: the rules the summary above states. */
export function decideTiming(clip: { sec: number; audio: boolean; audioSec?: number | null } | null, exp: Mp4Timing | null): TimingDecision {
  const T = TIMING_TOLERANCE_SEC
  if (!clip || !(clip.sec > 0) || clip.sec > MAX_CLIP_SEC) return { action: "hold", why: "The clip's length couldn't be read, so the video's length can't be checked against it. Replace media with the clip as an MP4 or MOV." }
  if (!exp?.videoSec) return { action: "hold", why: "The exported video's length couldn't be read. Refresh from Canva; if it stays, check the design in Canva." }
  const e = exp.videoSec
  if (e < clip.sec - T) return { action: "hold", why: `Canva cut the clip: the video runs ${clock(e)}, the clip ${clock(clip.sec)}. The template's page timing is shorter than the clip; fix it in Canva, then Replace media.` }
  if (clip.audio && !exp.audioSec) return { action: "hold", why: "The clip has sound but the exported video has none. Check that the template doesn't mute its video, then Replace media." }
  // The sound is held to the clip's own sound, which may end a little before its picture.
  const sound = Math.min(clip.sec, clip.audioSec ?? clip.sec)
  if (clip.audio && exp.audioSec! < sound - T) return { action: "hold", why: `The sound stops early: it runs ${clock(exp.audioSec!)} of the clip's ${clock(sound)}. Check the design in Canva, then Replace media.` }
  if (e > clip.sec + T) return { action: "trim", toSec: clip.sec }
  return { action: "matched" }
}

export interface FitDeps {
  /** The export's bytes (owned-meta-intake fetchExport: SSRF-guarded, size-bounded). */
  fetchExport(url: string): Promise<Uint8Array>
  /** The clip's lengths, read from storage. */
  probeClip(url: string): Promise<Mp4Timing>
  /** The file cut at `sec` (trimTail). */
  trim(bytes: Uint8Array, sec: number): Promise<Uint8Array>
  now(): string
}
/** Where the clip's length comes from: the clip itself, or a check already made against it (Refresh from Canva). */
export type ClipSource = { url: string } | { sec: number; audio: boolean } | null

/** The export, fitted to its clip where that can be done safely, with the timing to keep on the post. */
export async function fitVideoExport(deps: FitDeps, exportUrl: string, source: ClipSource): Promise<{ bytes: Uint8Array; timing: VideoTiming }> {
  const bytes = await deps.fetchExport(exportUrl)
  let clip: { sec: number; audio: boolean; audioSec?: number | null } | null = null
  if (source && "url" in source) {
    const t = await deps.probeClip(source.url).catch(err => { console.warn("[video-timing] clip unreadable:", err instanceof Error ? err.message : err); return null })
    const sec = t?.videoSec ?? t?.movieSec ?? null
    clip = sec ? { sec, audio: !!t?.audioSec, audioSec: t?.audioSec ?? null } : null
  } else if (source) clip = source
  const read = (b: Uint8Array) => { try { return mp4Timing(b) } catch { return null } }
  const exp = read(bytes)
  const base = { clip_sec: clip?.sec ?? null, clip_audio: clip?.audio ?? null, export_sec: exp?.videoSec ?? null, checked_at: deps.now() }
  const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
  const held = (why: string) => ({ bytes, timing: { ...base, final_sec: exp?.videoSec ?? null, action: "held" as const, hold: why, sha256: sha(bytes) } })
  const d = decideTiming(clip, exp)
  if (d.action === "hold") return held(d.why)
  if (d.action === "matched") return { bytes, timing: { ...base, final_sec: exp!.videoSec, action: "matched", sha256: sha(bytes) } }
  let cut: Uint8Array
  try { cut = await deps.trim(bytes, d.toSec) } catch (err) {
    console.error("[video-timing] trim failed:", err instanceof Error ? err.message : err)
    return held(`The video runs ${clock(exp!.videoSec!)} but the clip ${clock(clip!.sec)}, and the blank end couldn't be cut here. Refresh from Canva to try again.`)
  }
  const after = read(cut)
  if (decideTiming(clip, after).action !== "matched") return held(`The video runs ${clock(exp!.videoSec!)} but the clip ${clock(clip!.sec)}; cutting the blank end didn't come out the clip's length (${after?.videoSec ? clock(after.videoSec) : "unreadable"}). Refresh from Canva to try again.`)
  return { bytes: cut, timing: { ...base, final_sec: after!.videoSec, action: "trimmed", sha256: sha(cut) } }
}

/** ffmpeg arguments for the cut: the first video and any sound, copied as they are, ending at `sec`, fast-start. */
export function trimArgs(input: string, output: string, sec: number): string[] {
  return ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", input, "-t", sec.toFixed(3), "-map", "0:v:0", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", "-y", output]
}

/** Cuts an MP4 at `sec` with the ffmpeg-static binary (as transcode.ts runs it), in the function's temporary disk. */
export async function trimTail(bytes: Uint8Array, sec: number, opts: { timeoutMs?: number; ffmpeg?: string } = {}): Promise<Uint8Array> {
  const [{ spawn }, { mkdtemp, rm, writeFile, readFile }, { tmpdir }, { join }] = await Promise.all([import("node:child_process"), import("node:fs/promises"), import("node:os"), import("node:path")])
  const ffmpeg = opts.ffmpeg ?? (await import("ffmpeg-static")).default as unknown as string | null
  if (!ffmpeg) throw new Error("ffmpeg is not available on this server")
  const dir = await mkdtemp(join(tmpdir(), "video-timing-"))
  try {
    const input = join(dir, "in.mp4"), output = join(dir, "out.mp4")
    await writeFile(input, bytes)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpeg, trimArgs(input, output, sec), { stdio: ["ignore", "ignore", "pipe"], timeout: opts.timeoutMs ?? 60_000, killSignal: "SIGKILL" })
      let tail = ""
      child.stderr.on("data", (c: Buffer) => { tail = (tail + c.toString()).slice(-600) })
      child.on("error", reject)
      child.on("close", code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${tail.trim().split("\n").slice(-2).join(" ")}`)))
    })
    const out = await readFile(output)
    if (!out.byteLength) throw new Error("the cut produced an empty file")
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength)
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}) }
}
