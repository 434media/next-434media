import { type NextRequest, NextResponse } from "next/server"
import { createBlogImage, ensureDbInitialized } from "../../../lib/blog-db"
import type { ImageUploadResponse, CreateBlogImageData } from "../../../types/blog-types"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

// File validation constants
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 10

// Clean filename for storage
function cleanFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-") // Replace special chars with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, "") // Remove leading/trailing dashes
}

// Generate clean display name
function generateDisplayName(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "")
  return (
    nameWithoutExt
      .replace(/[-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") || "Uploaded Image"
  )
}

export async function POST(request: NextRequest): Promise<NextResponse<ImageUploadResponse>> {
  try {
    await ensureDbInitialized()

    const formData = await request.formData()
    const images = formData.getAll("images") as File[]

    // Validation
    if (!images || images.length === 0) {
      return NextResponse.json({ success: false, error: "No images provided" }, { status: 400 })
    }

    if (images.length > MAX_FILES) {
      return NextResponse.json({ success: false, error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
    }

    // Validate each file
    for (const image of images) {
      if (!ALLOWED_TYPES.includes(image.type as any)) {
        return NextResponse.json(
          { success: false, error: `Invalid file type: ${image.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
          { status: 400 },
        )
      }

      if (image.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File "${image.name}" is too large. Maximum size: 10MB` },
          { status: 400 },
        )
      }

      if (image.size === 0) {
        return NextResponse.json({ success: false, error: `File "${image.name}" is empty` }, { status: 400 })
      }
    }

    const uploadedImages = []

    // Ensure upload directory exists
    const uploadDir = join(process.cwd(), "public", "uploads", "blog")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    for (const image of images) {
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substr(2, 6)
      const imageId = `img_${timestamp}_${randomId}`

      // Get file extension
      const fileExt = image.name.split(".").pop()?.toLowerCase() || "jpg"

      // Clean the original filename for storage
      const cleanedName = cleanFilename(image.name)
      const storedFilename = `${timestamp}_${randomId}_${cleanedName}`

      // File path for storage
      const filePath = join(uploadDir, storedFilename)
      const publicPath = `/uploads/blog/${storedFilename}`

      try {
        // Convert File to Buffer and save to filesystem
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Write file to public/uploads/blog directory
        await writeFile(filePath, buffer)

        console.log(`✅ File saved: ${filePath}`)

        // Get image dimensions (you could use a library like 'sharp' for this)
        // For now, we'll use default dimensions
        const width = 800
        const height = 600

        const imageData: CreateBlogImageData = {
          id: imageId,
          filename: storedFilename, // Clean filename for storage
          original_name: image.name, // Keep original for reference
          file_path: publicPath, // Public path for serving
          url: publicPath, // URL to access the image
          file_size: image.size,
          mime_type: image.type,
          width: width,
          height: height,
          alt_text: generateDisplayName(image.name),
          uploaded_by: "434 Media Admin",
        }

        // Save metadata to database
        const dbResult = await createBlogImage(imageData)
        uploadedImages.push(dbResult)

        console.log(`✅ Image metadata saved to database: ${imageId}`)
      } catch (fileError) {
        console.error("File processing error:", fileError)
        return NextResponse.json({ success: false, error: `Failed to process image "${image.name}"` }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      message: `Successfully uploaded ${uploadedImages.length} image(s)`,
    })
  } catch (error) {
    console.error("Error uploading images:", error)
    return NextResponse.json({ success: false, error: "Internal server error during upload" }, { status: 500 })
  }
}
