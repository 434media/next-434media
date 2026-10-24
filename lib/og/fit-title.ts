/**
 * Picks the largest font size at which a title wraps into at most `maxLines`
 * lines of `maxWidth`, measured from the font file's own advance widths.
 *
 * Satori can't measure text before it lays it out, and Menda is wide enough
 * that a fixed size either wastes a short title or overflows a long one. This
 * reads the OpenType `cmap` (format 4) and `hmtx` tables, wraps on spaces the
 * way Satori does, and steps the size down until the title fits or reaches
 * `minSize`.
 */

type Metrics = { unitsPerEm: number; advance: (codePoint: number) => number }

function readMetrics(font: Buffer): Metrics {
  const tables = new Map<string, number>()
  const numTables = font.readUInt16BE(4)
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + 16 * i
    tables.set(font.toString("ascii", rec, rec + 4), font.readUInt32BE(rec + 8))
  }
  const head = tables.get("head")!, hhea = tables.get("hhea")!, hmtx = tables.get("hmtx")!, cmap = tables.get("cmap")!
  const unitsPerEm = font.readUInt16BE(head + 18)
  const numberOfHMetrics = font.readUInt16BE(hhea + 34)

  const glyphs = new Map<number, number>()
  const subtables = font.readUInt16BE(cmap + 2)
  for (let i = 0; i < subtables; i++) {
    const st = cmap + font.readUInt32BE(cmap + 4 + 8 * i + 4)
    if (font.readUInt16BE(st) !== 4) continue
    const segX2 = font.readUInt16BE(st + 6)
    const ends = st + 14, starts = ends + segX2 + 2, deltas = starts + segX2, rangeOffsets = deltas + segX2
    for (let s = 0; s < segX2 / 2; s++) {
      const end = font.readUInt16BE(ends + 2 * s), start = font.readUInt16BE(starts + 2 * s)
      const delta = font.readInt16BE(deltas + 2 * s), ro = font.readUInt16BE(rangeOffsets + 2 * s)
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g = ro === 0 ? (c + delta) & 0xffff : font.readUInt16BE(rangeOffsets + 2 * s + ro + 2 * (c - start))
        if (ro !== 0 && g) g = (g + delta) & 0xffff
        if (g) glyphs.set(c, g)
      }
    }
    break
  }

  const advanceOf = (glyph: number) => font.readUInt16BE(hmtx + 4 * Math.min(glyph, numberOfHMetrics - 1))
  return { unitsPerEm, advance: (c) => advanceOf(glyphs.get(c) ?? 0) }
}

const cache = new WeakMap<Buffer, Metrics>()

export function fitTitleSize(
  font: Buffer,
  text: string,
  { maxSize, minSize, maxWidth, maxLines, letterSpacing = 0, step = 2 }:
    { maxSize: number; minSize: number; maxWidth: number; maxLines: number; letterSpacing?: number; step?: number },
): number {
  let metrics = cache.get(font)
  if (!metrics) cache.set(font, (metrics = readMetrics(font)))
  const m = metrics

  const width = (word: string, size: number) =>
    [...word].reduce((w, ch) => w + (m.advance(ch.codePointAt(0)!) / m.unitsPerEm) * size + letterSpacing, 0)

  const fits = (size: number) => {
    const space = width(" ", size)
    let lines = 1, line = 0
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const w = width(word, size)
      if (w > maxWidth) return false
      if (line === 0) line = w
      else if (line + space + w <= maxWidth) line += space + w
      else { lines++; line = w }
    }
    return lines <= maxLines
  }

  for (let size = maxSize; size > minSize; size -= step) if (fits(size)) return size
  return minSize
}
