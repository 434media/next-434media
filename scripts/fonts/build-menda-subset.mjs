#!/usr/bin/env node
/**
 * Builds fonts/Menda-Black-subset.woff2, the only Menda file served to browsers.
 *
 * Menda's licence (Corporate License 9653) covers a self-hosted WOFF2 subset
 * for 434media.com headings and social-share images. The source OTF is not in
 * this repository; run this after scripts/fonts/fetch-private-fonts.mjs has put
 * it at fonts/Menda-Black.otf (or pass another path).
 *
 * Kept: Basic Latin and Latin-1 Supplement (English and Spanish, including
 * á é í ó ú ñ ü ¿ ¡), the typographic punctuation the site uses, and ≠.
 * Display headings also render text from Firestore (Feed titles), so the
 * subset covers the alphabet rather than only today's headlines. HarfBuzz keeps
 * the layout features (kerning, ligatures) and the glyphs they need.
 *
 *   node scripts/fonts/build-menda-subset.mjs [path/to/Menda-Black.otf]
 */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import subsetFont from "subset-font"

const src = process.argv[2] ?? "fonts/Menda-Black.otf"
const out = "fonts/Menda-Black-subset.woff2"

const ranges = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0xff], // Latin-1 Supplement
  [0x2013, 0x2014], // en and em dash
  [0x2018, 0x201e], // quotes
  [0x2022, 0x2022], // bullet
  [0x2026, 0x2026], // ellipsis
  [0x2039, 0x203a], // angle quotes
  [0x20ac, 0x20ac], // euro
  [0x2122, 0x2122], // trademark
  [0x2260, 0x2260], // not-equal (performance-marketing)
]
let text = ""
for (const [from, to] of ranges) for (let c = from; c <= to; c++) text += String.fromCodePoint(c)

const woff2 = await subsetFont(readFileSync(src), text, { targetFormat: "woff2" })
writeFileSync(out, woff2)
console.log(`Wrote ${out} (${woff2.length} bytes) from ${src}`)
console.log(`sha256 ${createHash("sha256").update(woff2).digest("hex")}`)
