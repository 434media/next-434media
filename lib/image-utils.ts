export interface ImageDimensions {
  width: number
  height: number
}

export async function getImageDimensions(buffer: Buffer): Promise<ImageDimensions> {
  try {
    // Simple image dimension detection for common formats
    const dimensions = getImageDimensionsFromBuffer(buffer)
    return {
      width: dimensions.width || 800,
      height: dimensions.height || 600,
    }
  } catch (error) {
    console.warn("Could not determine image dimensions:", error)
    // Return default dimensions if detection fails
    return { width: 800, height: 600 }
  }
}

function getImageDimensionsFromBuffer(buffer: Buffer): { width?: number; height?: number } {
  try {
    // PNG detection
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      const width = buffer.readUInt32BE(16)
      const height = buffer.readUInt32BE(20)
      return { width, height }
    }

    // JPEG detection
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      let offset = 2
      while (offset < buffer.length) {
        if (buffer[offset] === 0xff) {
          const marker = buffer[offset + 1]
          if (marker === 0xc0 || marker === 0xc2) {
            const height = buffer.readUInt16BE(offset + 5)
            const width = buffer.readUInt16BE(offset + 7)
            return { width, height }
          }
          offset += 2 + buffer.readUInt16BE(offset + 2)
        } else {
          offset++
        }
      }
    }

    // GIF detection
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      const width = buffer.readUInt16LE(6)
      const height = buffer.readUInt16LE(8)
      return { width, height }
    }

    // WebP detection
    if (buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP") {
      // Simple WebP VP8 detection
      if (buffer.slice(12, 16).toString() === "VP8 ") {
        const width = buffer.readUInt16LE(26) & 0x3fff
        const height = buffer.readUInt16LE(28) & 0x3fff
        return { width, height }
      }
    }

    return {}
  } catch (error) {
    console.warn("Error parsing image dimensions:", error)
    return {}
  }
}

export function validateImageBuffer(buffer: Buffer, maxSize: number = 10 * 1024 * 1024): boolean {
  if (buffer.length > maxSize) {
    throw new Error(`Image too large: ${buffer.length} bytes (max: ${maxSize})`)
  }

  if (buffer.length === 0) {
    throw new Error("Empty image buffer")
  }

  return true
}

export function generateImageId(): string {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substr(2, 6)
  return `img_${timestamp}_${randomId}`
}

export function cleanImageFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}
