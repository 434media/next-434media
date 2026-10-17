import sharp from "sharp"
import type { CropBox } from "./canva-create"

/**
 * Crops a photo to a box given as fractions of the upright image, for the Slack app's MCU cards: Canva's template
 * fill can only centre a photo, so the zoom that keeps the subject clear of the text block is done here, before the
 * upload. EXIF orientation is applied first, so the box matches the photo as people see it. Output is a JPEG.
 */
export async function cropImage(bytes: Uint8Array, box: CropBox): Promise<Uint8Array> {
  const upright = await sharp(bytes).rotate().toBuffer({ resolveWithObject: true })
  const { width, height } = upright.info
  const left = Math.max(0, Math.min(width - 1, Math.round(box.x * width)))
  const top = Math.max(0, Math.min(height - 1, Math.round(box.y * height)))
  const w = Math.max(1, Math.min(width - left, Math.round(box.width * width)))
  const h = Math.max(1, Math.min(height - top, Math.round(box.height * height)))
  return sharp(upright.data).extract({ left, top, width: w, height: h }).jpeg({ quality: 92 }).toBuffer()
}
