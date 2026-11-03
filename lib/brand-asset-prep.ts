import sharp from "sharp"

/**
 * What the publisher makes beside each delivered mark (scripts/brand-profiles/assets.ts): whether it reads on a dark
 * tile, and a small WebP preview for the vendor's page. Raster and SVG files alike: sharp draws an SVG, so a white SVG
 * mark gets a dark tile and a preview like its PNG (the vendor's page never serves an SVG itself). Other formats
 * (`.ai`, `.eps`, `.pdf`) get neither.
 */
export const PREVIEWABLE = new Set(["png", "jpg", "jpeg", "webp", "svg"])
export const extOf = (file: string) => file.split(".").pop()!.toLowerCase()

/** A light mark (mostly white where it is opaque) is shown on a dark tile. */
export async function tileOf(data: Buffer): Promise<"dark" | "light"> {
  const { data: px, info } = await sharp(data).resize(200, 200, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let sum = 0, n = 0
  for (let i = 0; i < px.length; i += info.channels) {
    if (px[i + 3] < 128) continue
    sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; n++
  }
  return n && sum / n > 0.8 ? "dark" : "light"
}

export const previewOf = (data: Buffer) => sharp(data).resize(240, 160, { fit: "inside" }).webp({ quality: 82 }).toBuffer()

/** The tile and preview for a file, or a light tile and no preview for a format that isn't drawn. */
export async function prepare(file: string, data: Buffer): Promise<{ tile: "dark" | "light"; preview: Buffer | null }> {
  if (!PREVIEWABLE.has(extOf(file))) return { tile: "light", preview: null }
  return { tile: await tileOf(data), preview: await previewOf(data) }
}
