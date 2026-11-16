/**
 * What an MP4 or MOV says about its picture, read from its header boxes without decoding a frame: the shown width and
 * height (after the track's rotation, so a portrait phone clip reads 1080×1920), the frame rate, the running time and
 * the codec. The Create table uses it to decide whether a clip is already sized for social (create-media videoPlan).
 *
 * The header (moov) sits at the start of a fast-start file and at the end of most phone clips, so the reader walks the
 * top-level boxes by ranged reads (a few small requests) and reads moov alone, never the media. Pure parsing here; the
 * caller supplies the ranged read. Anything it cannot read gives null, and the caller decides from the size alone.
 */
export type VideoMeta = { width: number; height: number; fps: number; seconds: number; codec: string }
/** Reads `length` bytes from `offset` (an HTTP Range request in the route). May return fewer at the end of the file. */
export type RangeRead = (offset: number, length: number) => Promise<Uint8Array>

/** A moov larger than this is not read (a five-minute clip's is well under 1 MB). */
export const MOOV_MAX_BYTES = 16 * 1024 * 1024
const MAX_TOP_LEVEL_BOXES = 32

type Box = { type: string; start: number; header: number; size: number }

function u32(b: Uint8Array, at: number): number { return ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3] }
function i32(b: Uint8Array, at: number): number { return u32(b, at) | 0 }
function u64(b: Uint8Array, at: number): number { return u32(b, at) * 2 ** 32 + u32(b, at + 4) }
function fourcc(b: Uint8Array, at: number): string { return String.fromCharCode(b[at], b[at + 1], b[at + 2], b[at + 3]) }

/** The child boxes inside b[from, to). Stops at the first malformed size. */
function children(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = []
  let at = from
  while (at + 8 <= to) {
    let size = u32(b, at), header = 8
    if (size === 1) { if (at + 16 > to) break; size = u64(b, at + 8); header = 16 } else if (size === 0) size = to - at
    if (size < header || at + size > to) break
    out.push({ type: fourcc(b, at + 4), start: at, header, size })
    at += size
  }
  return out
}
const child = (b: Uint8Array, box: Box, type: string) => children(b, box.start + box.header, box.start + box.size).find(c => c.type === type)

/** The first video track's picture, from a whole moov box (header included). Null when there is none or it is malformed. */
export function parseMoov(moov: Uint8Array): VideoMeta | null {
  try {
    const top = children(moov, 0, moov.length).find(c => c.type === "moov")
    if (!top) return null
    for (const trak of children(moov, top.start + top.header, top.start + top.size).filter(c => c.type === "trak")) {
      const mdia = child(moov, trak, "mdia"), tkhd = child(moov, trak, "tkhd")
      const hdlr = mdia && child(moov, mdia, "hdlr")
      if (!mdia || !tkhd || !hdlr || fourcc(moov, hdlr.start + hdlr.header + 8) !== "vide") continue
      // tkhd ends with the 3×3 matrix (36 bytes) and the 16.16 width and height; a 90° or 270° matrix shows the frame turned.
      const end = tkhd.start + tkhd.size
      let width = u32(moov, end - 8) / 65536, height = u32(moov, end - 4) / 65536
      const a = i32(moov, end - 44), bm = i32(moov, end - 40)
      if (a === 0 && Math.abs(bm) === 65536) [width, height] = [height, width]
      const mdhd = child(moov, mdia, "mdhd")
      if (!mdhd) return null
      const m = mdhd.start + mdhd.header, v1 = moov[m] === 1
      const timescale = u32(moov, m + (v1 ? 20 : 12)), duration = v1 ? u64(moov, m + 24) : u32(moov, m + 16)
      const minf = child(moov, mdia, "minf"), stbl = minf && child(moov, minf, "stbl")
      const stsz = stbl && child(moov, stbl, "stsz"), stsd = stbl && child(moov, stbl, "stsd")
      const frames = stsz ? u32(moov, stsz.start + stsz.header + 8) : 0
      // stsd: version/flags (4), entry count (4), then the first sample entry's size (4) and codec fourcc.
      const codec = stsd ? fourcc(moov, stsd.start + stsd.header + 12) : ""
      const seconds = timescale ? duration / timescale : 0
      if (!(width > 0 && height > 0 && seconds > 0)) return null
      return { width: Math.round(width), height: Math.round(height), fps: frames ? Math.round((frames / seconds) * 100) / 100 : 0, seconds: Math.round(seconds * 100) / 100, codec }
    }
    return null
  } catch { return null }
}

/** Walks the file's top-level boxes by ranged reads to find moov, reads it, and parses it. Null when it cannot. */
export async function probeVideo(read: RangeRead, fileBytes: number): Promise<VideoMeta | null> {
  try {
    let at = 0
    for (let i = 0; i < MAX_TOP_LEVEL_BOXES && at + 8 <= fileBytes; i++) {
      const h = await read(at, 16)
      if (h.length < 8) return null
      let size = u32(h, 0)
      if (size === 1) { if (h.length < 16) return null; size = u64(h, 8) } else if (size === 0) size = fileBytes - at
      if (size < 8) return null
      if (fourcc(h, 4) === "moov") {
        if (size > MOOV_MAX_BYTES) return null
        const moov = await read(at, size)
        return moov.length === size ? parseMoov(moov) : null
      }
      at += size
    }
    return null
  } catch { return null }
}
