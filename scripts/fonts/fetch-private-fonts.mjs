#!/usr/bin/env node
/**
 * Fetches the licensed font files that must not live in this public
 * repository, before `next build`.
 *
 * Menda Black's licence (Corporate License 9653) covers a self-hosted WOFF2
 * subset for headings and social-share images. The browser gets that subset
 * (fonts/Menda-Black-subset.woff2, committed). The social-image routes render
 * with next/og, which reads TTF, OTF or WOFF but not WOFF2, so they read the
 * original OTF. The OTF is kept in the private repository
 * 434media/brand-fonts, fetched here into fonts/ (gitignored), and traced into
 * the server functions. It is never a public asset.
 *
 * Fails the build if the file can't be had. There is no fallback: a missing
 * font would silently render share images in the wrong face.
 *
 *   BRAND_FONTS_TOKEN  read-only, fine-grained GitHub token for
 *                      434media/brand-fonts (Contents: read).
 *
 * A local copy with the right hash is used as is, so a machine that already
 * has the file needs no token.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

const REPO = "434media/brand-fonts"
const FILES = [
  {
    path: "Menda-Black.otf",
    sha256: "115a2d88deef745c4d56dc1229afb29016319fffcf96325796d47d4346e53136",
  },
]

const fontsDir = path.join(process.cwd(), "fonts")
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex")

function fail(message) {
  console.error(`\n✖ fetch-private-fonts: ${message}\n`)
  process.exit(1)
}

for (const file of FILES) {
  const dest = path.join(fontsDir, file.path)

  if (existsSync(dest) && sha256(readFileSync(dest)) === file.sha256) {
    console.log(`✓ ${file.path} present (sha256 ok)`)
    continue
  }

  const token = process.env.BRAND_FONTS_TOKEN
  if (!token) {
    fail(
      `fonts/${file.path} is missing and BRAND_FONTS_TOKEN is not set.\n` +
        `  The social-share images need it. Set BRAND_FONTS_TOKEN (read-only access to ${REPO}),\n` +
        `  or put a copy of the licensed file at fonts/${file.path}.`,
    )
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(file.path)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!res.ok) fail(`GET ${REPO}/${file.path} returned ${res.status} ${res.statusText}.`)

  const buf = Buffer.from(await res.arrayBuffer())
  const got = sha256(buf)
  if (got !== file.sha256) fail(`${file.path} from ${REPO} has sha256 ${got}, expected ${file.sha256}.`)

  writeFileSync(dest, buf)
  console.log(`✓ ${file.path} fetched from ${REPO} (sha256 ok)`)
}
