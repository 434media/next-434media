import type { BookBlock, BrandBook } from "./content-pipeline/brand-book"

/**
 * The files a vendor can download from a shared brand book (plan v11.3 Step 4 item 6). Pure: no storage, no network.
 *
 * What is offered comes from the book itself, so a share's pinned version decides it and nothing is listed twice:
 *  - **Logos**: each file the Marks section's tables name in their first column (`MCU-flag-white-v1.png`). The names are
 *    versioned, as delivered media's are (Display and Design Standard §3.0), so a corrected file is a new name in a new
 *    version of the standard, and an old share keeps the files it was sent.
 *  - **Fonts**: one per face in the Typography section's tables. A face under an open licence is given as a link to its
 *    source with its licence named (plan v11.3), never as a font file copied by 434.
 *
 * A logo is downloadable only once its delivered copy is in storage (lib/brand-asset-store.ts); until then the page
 * lists it without a tick box. The download route accepts only ids this function offers for the share's own book, so a
 * request can never name a path.
 */

export interface LogoFile { id: string; file: string; mark: string; use: string; format: string }
export interface FontFace { id: string; face: string; weights: string[]; licence: string; open: boolean; sourceUrl: string | null }
export interface VendorFiles { logos: LogoFile[]; fonts: FontFace[] }

const FILE_CELL = /^`?([A-Za-z0-9][A-Za-z0-9._-]*\.(png|svg|ai|eps|pdf|jpe?g|webp))`?$/i
const MARKS = /\b(marks?|logos?)\b/i
const TYPE = /typograph|\bfonts?\b|\btype\b/i
const OPEN_LICENCE = /\bOFL\b|open font licen[cs]e|apache licen[cs]e/i

const titleOf = (t: string) => t.replace(/^\d+(\.\d+)*\.?\s*/, "")
const tables = (book: Pick<BrandBook, "sections">, re: RegExp): BookBlock[] =>
  book.sections.filter(s => re.test(titleOf(s.title))).flatMap(s => s.blocks.filter(b => b.kind === "table"))
const col = (b: BookBlock, re: RegExp) => (b.head ?? []).findIndex(h => re.test(h.trim()))
const plain = (s: string) => s.replace(/\\\*/g, "").replace(/[`*]/g, "").trim()

/** A face's source, for an open-licence face: Google Fonts carries every OFL face the brands use today. */
export const fontSourceUrl = (face: string) => `https://fonts.google.com/specimen/${encodeURIComponent(face).replace(/%20/g, "+")}`
export const OFL_URL = "https://openfontlicense.org/open-font-license-official-text/"

export function vendorFiles(book: Pick<BrandBook, "sections">): VendorFiles {
  const logos: LogoFile[] = [], seen = new Set<string>()
  for (const t of tables(book, MARKS)) {
    const markCol = col(t, /^mark$/i), useCol = col(t, /^use$/i)
    for (const r of t.rows ?? []) {
      const m = FILE_CELL.exec((r.cells[0] ?? "").trim())
      if (!m || seen.has(m[1])) continue
      seen.add(m[1])
      logos.push({ id: m[1], file: m[1], mark: plain(r.cells[markCol >= 0 ? markCol : 1] ?? ""), use: useCol >= 0 ? plain(r.cells[useCol] ?? "") : "", format: m[2].toUpperCase().replace("JPEG", "JPG") })
    }
  }
  const fonts = new Map<string, FontFace>()
  for (const t of tables(book, TYPE)) {
    const faceCol = col(t, /^(face|typeface|font)$/i), weightCol = col(t, /^weights?$/i), licCol = col(t, /^licen[cs]e$/i)
    if (faceCol < 0) continue
    for (const r of t.rows ?? []) {
      const face = plain(r.cells[faceCol] ?? "")
      if (!face) continue
      const licence = licCol >= 0 ? plain(r.cells[licCol] ?? "").replace(/^✓\s*/, "") : ""
      const f = fonts.get(face) ?? { id: `font:${face}`, face, weights: [], licence, open: OPEN_LICENCE.test(licence), sourceUrl: null }
      const w = weightCol >= 0 ? plain(r.cells[weightCol] ?? "") : ""
      if (w && !f.weights.includes(w)) f.weights.push(w)
      f.sourceUrl = f.open ? fontSourceUrl(face) : null
      fonts.set(face, f)
    }
  }
  // Only a face with a source to point to is offered; a licensed face is named in the book and nothing more.
  return { logos, fonts: [...fonts.values()].filter(f => f.sourceUrl) }
}

/** The ids a download request names, kept only where the book offers them (and the logo is in storage). */
export function pickedFiles(files: VendorFiles, ids: string[], available: (file: string) => boolean): { logos: LogoFile[]; fonts: FontFace[] } {
  const want = new Set(ids)
  return { logos: files.logos.filter(l => want.has(l.id) && available(l.file)), fonts: files.fonts.filter(f => want.has(f.id)) }
}

/** What a ticked font puts in the zip: where to get it and its licence, as text. */
export function fontNote(f: FontFace, brand: string): string {
  return [
    `${f.face}`, "",
    `Used in the ${brand} brand book${f.weights.length ? ` at: ${f.weights.join("; ")}` : ""}.`, "",
    `Licence: ${f.licence || "see the source"}. It is free to use, including commercially.`,
    `Get it from the source: ${f.sourceUrl}`,
    ...(/\bOFL\b/i.test(f.licence) ? [`Licence text (SIL Open Font License 1.1): ${OFL_URL}`] : []),
    "",
  ].join("\n")
}

/** The zip's file name: the brand and the book version, nothing about the recipient. */
export const zipName = (brand: string, versionId: string) => `${brand.replace(/[^A-Za-z0-9]+/g, "-")}-brand-files-${versionId.replace(/[^A-Za-z0-9]+/g, "-")}.zip`

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * A zip of the given files, stored without compression: logos are PNG or vector files that are already compressed, and
 * storing keeps every file byte-identical to its delivered copy. Names are UTF-8 (flag bit 11). Fixed time stamp
 * (1 January 2026), so the same files make the same zip.
 */
export function zipStore(entries: { name: string; data: Uint8Array }[]): Buffer {
  const local: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  const TIME = 0, DATE = ((2026 - 1980) << 9) | (1 << 5) | 1
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8"), data = Buffer.from(e.data), crc = crc32(data)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8)
    h.writeUInt16LE(TIME, 10); h.writeUInt16LE(DATE, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22)
    h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28)
    local.push(h, name, data)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10)
    c.writeUInt16LE(TIME, 12); c.writeUInt16LE(DATE, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24)
    c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42)
    central.push(c, name)
    offset += 30 + name.length + data.length
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, cd, end])
}
