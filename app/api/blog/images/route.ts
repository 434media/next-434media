import { NextResponse } from "next/server"
import { getBlogImages, ensureDbInitialized } from "../../../lib/blog-db"
import type { BlogImagesResponse } from "../../../types/blog-types"

export async function GET(): Promise<NextResponse<BlogImagesResponse>> {
  try {
    await ensureDbInitialized()
    const images = await getBlogImages()

    return NextResponse.json({
      success: true,
      images,
      total: images.length,
    })
  } catch (error) {
    console.error("Error fetching blog images:", error)

    return NextResponse.json(
      {
        success: false,
        images: [],
        error: "Failed to fetch images from database",
      },
      { status: 500 },
    )
  }
}
