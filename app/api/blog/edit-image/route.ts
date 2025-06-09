import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { ensureDbInitialized } from "../../../lib/blog-db"

const sql = neon(process.env.DATABASE_URL!)

export async function PUT(request: NextRequest) {
  try {
    await ensureDbInitialized()

    const data = await request.json()
    const { id, alt_text, filename } = data

    if (!id) {
      return NextResponse.json({ success: false, error: "Image ID is required" }, { status: 400 })
    }

    // Validate admin password if provided
    if (data.adminPassword) {
      const isAdmin = data.adminPassword === process.env.ADMIN_PASSWORD
      if (!isAdmin) {
        return NextResponse.json({ success: false, error: "Invalid admin password" }, { status: 401 })
      }
    }

    // Update the image metadata
    const result = await sql`
      UPDATE blog_images
      SET 
        alt_text = COALESCE(${alt_text}, alt_text),
        filename = COALESCE(${filename}, filename),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: "Image not found" }, { status: 404 })
    }

    // Format the response
    const updatedImage = {
      id: result[0].id,
      filename: result[0].filename,
      original_name: result[0].original_name,
      url: result[0].url,
      file_size: result[0].file_size,
      mime_type: result[0].mime_type,
      alt_text: result[0].alt_text,
      created_at: result[0].created_at ? new Date(result[0].created_at).toISOString() : new Date().toISOString(),
      updated_at: result[0].updated_at ? new Date(result[0].updated_at).toISOString() : new Date().toISOString(),
      width: result[0].width,
      height: result[0].height,
    }

    return NextResponse.json({
      success: true,
      image: updatedImage,
      message: "Image updated successfully",
    })
  } catch (error) {
    console.error("Error updating image:", error)
    return NextResponse.json({ success: false, error: "Failed to update image" }, { status: 500 })
  }
}
