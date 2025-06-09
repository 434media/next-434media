import { type NextRequest, NextResponse } from "next/server"
import { getBlogImageData } from "../../../../lib/blog-db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id: imageId } = await params

    if (!imageId) {
      return new NextResponse("Image ID is required", { status: 400 })
    }

    const imageData = await getBlogImageData(imageId)

    if (!imageData) {
      return new NextResponse("Image not found", { status: 404 })
    }

    // Set appropriate headers for image serving
    const headers = new Headers()
    headers.set("Content-Type", imageData.mimeType)
    headers.set("Cache-Control", "public, max-age=31536000, immutable") // Cache for 1 year
    headers.set("Content-Length", imageData.data.length.toString())

    return new NextResponse(imageData.data, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Error serving image:", error)
    return new NextResponse("Internal server error", { status: 500 })
  }
}
