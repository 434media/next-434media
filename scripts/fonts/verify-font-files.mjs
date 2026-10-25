#!/usr/bin/env node
/**
 * Fails if a font file is committed that isn't on the allowlist.
 *
 * This repository is public. A licensed font committed here is a standalone
 * download, which Menda's licence does not permit, and GGX88 was never
 * licensed at all. Only these may be committed:
 *
 * - The Menda Black WOFF2 subset served to browsers (licensed for
 *   self-hosting on 434media.com; Corporate License 9653).
 * - Geist and Geist Pixel, which are under the SIL Open Font License.
 *
 * The full Menda OTF is fetched at build time from a private repository
 * (scripts/fonts/fetch-private-fonts.mjs) and is gitignored.
 *
 * Run: node scripts/fonts/verify-font-files.mjs
 */
import { execFileSync } from "node:child_process"

const ALLOWED = new Set([
  "fonts/Menda-Black-subset.woff2",
  "fonts/Geist-Regular.otf",
  "fonts/Geist-SemiBold.otf",
  "fonts/Geist-ExtraBold.otf",
  "public/fonts/GeistPixel-Square.ttf",
])

const FONT = /\.(otf|ttf|ttc|woff2?|eot|pfb|pfm|dfont)$/i

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)
const fonts = tracked.filter((f) => FONT.test(f))
const disallowed = fonts.filter((f) => !ALLOWED.has(f))

if (disallowed.length) {
  console.error("✖ Font files committed outside the allowlist (scripts/fonts/verify-font-files.mjs):")
  for (const f of disallowed) console.error(`  ${f}`)
  process.exit(1)
}
console.log(`✓ ${fonts.length} committed font files, all on the allowlist`)
