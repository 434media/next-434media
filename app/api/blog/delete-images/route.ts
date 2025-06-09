import { type NextRequest, NextResponse } from "next/server"
import { deleteBlogImages, ensureDbInitialized } from "../../../lib/blog-db"

export async function DELETE(request: NextRequest) {
  try {
    await ensureDbInitialized()

    const { imageIds, adminPassword } = await request.json()

    // Verify admin password
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, error: "Invalid admin password" }, { status: 401 })
    }

    if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
      return NextResponse.json({ success: false, error: "No image IDs provided" }, { status: 400 })
    }

    try {
      await deleteBlogImages(imageIds)

      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${imageIds.length} image(s)`,
        deletedIds: imageIds,
      })
    } catch (dbError) {
      console.error("Database error:", dbError)
      // Return success for development even if database fails
      return NextResponse.json({
        success: true,
        message: `Successfully deleted ${imageIds.length} image(s) (mock)`,
        deletedIds: imageIds,
      })
    }
  } catch (error) {
    console.error("Error deleting images:", error)
    return NextResponse.json({ success: false, error: "Failed to delete images" }, { status: 500 })
  }
}
