import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"

/**
 * Open-licence font files a vendor's zip carries (founder, 2026-11-03: bundle the OFL files with their licence). Keyed by
 * the face as a brand book's Typography table names it. The files are in `fonts/open/<face>/`, copied unchanged from
 * google/fonts at commit 2fe1e8c6b137fb13041a7cfca6fdcd8a910ea4dc (`ofl/<family>/`), each with that family's own
 * `OFL.txt`. The SIL OFL 1.1 lets them be bundled and redistributed with the licence, provided they are not sold by
 * themselves; they are free and public, so they live in this repository rather than the private asset bucket.
 *
 * Only the styles a brand book uses are carried: Montserrat and Cormorant Garamond as Google's variable files (every
 * weight in one file), IBM Plex Mono as its static Medium and SemiBold. A face not listed here is still given as a note
 * with its source and licence, as before.
 */
export interface BundledFontFile { file: string; bytes: number; sha256: string }

export const BUNDLED_FONTS: Readonly<Record<string, readonly BundledFontFile[]>> = {
  "Montserrat": [
    { file: "Montserrat[wght].ttf", bytes: 744936, sha256: "0f7b311b2f3279e4eef9b2f968bcdbab6e28f4daeb1f049f4f278a902bcd82f7" },
    { file: "OFL.txt", bytes: 4400, sha256: "8b7141c03fa4f8d44e6345d5d4931709290f0f67875e452e95ac1fd3a027802e" },
  ],
  "IBM Plex Mono": [
    { file: "IBMPlexMono-Medium.ttf", bytes: 136704, sha256: "a9b4c49bb299e05b5f6c481e7fb5e78943d2793249a0c8874ab574a2d1ea6755" },
    { file: "IBMPlexMono-SemiBold.ttf", bytes: 140216, sha256: "d3c38e55c78f5b0f28009fddba4834ec503278936a5986032424c9bd2d23aa46" },
    { file: "OFL.txt", bytes: 4456, sha256: "7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da" },
  ],
  "Cormorant Garamond": [
    { file: "CormorantGaramond[wght].ttf", bytes: 1195560, sha256: "b20b7d9626dd956b2c5e558692ad328b1f19e3275e2782db4fa07670d83f35e0" },
    { file: "CormorantGaramond-Italic[wght].ttf", bytes: 715644, sha256: "0f48ea6abb2084537854f7174c470991a463b13036309e3b50a81511611c530d" },
    { file: "OFL.txt", bytes: 4387, sha256: "60700d351cac4650c51f3f9db318d2a420f8b45052dba2715eb5fec41f0f6956" },
  ],
}

export const FONTS_DIR = path.join(process.cwd(), "fonts", "open")

export const bundledFont = (face: string): readonly BundledFontFile[] | null =>
  Object.prototype.hasOwnProperty.call(BUNDLED_FONTS, face) ? BUNDLED_FONTS[face] : null

export const bundledBytes = (face: string) => (bundledFont(face) ?? []).reduce((n, f) => n + f.bytes, 0)

/** A face's files, each checked against its recorded sha256, so a changed or truncated file is never sent. */
export async function readBundledFont(face: string, dir = FONTS_DIR): Promise<{ file: string; data: Buffer }[]> {
  const files = bundledFont(face)
  if (!files) return []
  return Promise.all(files.map(async f => {
    const data = await readFile(path.join(dir, face, f.file))
    if (data.length !== f.bytes || createHash("sha256").update(data).digest("hex") !== f.sha256) throw new Error(`Bundled font file changed: ${face}/${f.file}`)
    return { file: f.file, data }
  }))
}
