import { type NextRequest, NextResponse } from "next/server"
import { createBlogImage, ensureDbInitialized } from "../../../lib/blog-db"
import type { ImageUploadResponse, CreateBlogImageData } from "../../../types/blog-types"
import { getImageDimensions, validateImageBuffer, generateImageId, cleanImageFilename } from "../../../lib/image-utils"

// File validation constants
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"] as const
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILES = 10

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
    const adminPassword = formData.get("adminPassword") as string
    const isInEditor = formData.get("isInEditor") === "true"

    // Only verify admin password if not already in the editor
    if (!isInEditor) {
      // Verify admin password
      if (!adminPassword) {
        return NextResponse.json({ success: false, error: "Admin password is required" }, { status: 401 })
      }
    }

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

    for (const image of images) {
      const imageId = generateImageId()
      const cleanedName = cleanImageFilename(image.name)

      try {
        // Convert File to Buffer
        const bytes = await image.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Validate buffer
        validateImageBuffer(buffer, MAX_FILE_SIZE)

        // Get image dimensions
        const { width, height } = await getImageDimensions(buffer)

        console.log(`📤 Storing image in Neon database: ${imageId}`)

        const imageData: CreateBlogImageData = {
          id: imageId,
          filename: cleanedName,
          original_name: image.name,
          file_size: image.size,
          mime_type: image.type,
          width: width,
          height: height,
          alt_text: generateDisplayName(image.name),
          image_data: buffer, // Store binary data in database
        }

        // Save to Neon database
        const dbResult = await createBlogImage(imageData)
        uploadedImages.push(dbResult)

        console.log(`✅ Image stored in Neon database: ${imageId}`)
      } catch (fileError) {
        console.error("File processing error:", fileError)
        return NextResponse.json(
          {
            success: false,
            error: `Failed to process image "${image.name}": ${fileError instanceof Error ? fileError.message : "Unknown error"}`,
          },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      message: `Successfully uploaded ${uploadedImages.length} image(s) to Neon database`,
    })
  } catch (error) {
    console.error("Error uploading images:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Internal server error during upload: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    )
  }
}
