import { NextResponse } from "next/server"
import { getBlogImages, ensureDbInitialized } from "../../../lib/blog-db"
import type { BlogImagesResponse } from "../../../types/blog-types"

export async function GET(): Promise<NextResponse<BlogImagesResponse>> {
  try {
    console.log("🔍 Starting to fetch blog images...")

    await ensureDbInitialized()
    console.log("✅ Database initialized successfully")

    const images = await getBlogImages()
    console.log(`📸 Found ${images.length} images in database`)

    return NextResponse.json({
      success: true,
      images,
      total: images.length,
    })
  } catch (error) {
    console.error("❌ Error fetching blog images:", error)

    // Provide more detailed error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
    const errorStack = error instanceof Error ? error.stack : "No stack trace available"

    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
    })

    return NextResponse.json(
      {
        success: false,
        images: [],
        error: `Failed to fetch images: ${errorMessage}`,
        details: process.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      { status: 500 },
    )
  }
}
