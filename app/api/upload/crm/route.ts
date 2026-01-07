import { NextRequest, NextResponse } from "next/server"
import { getSession } from "../../../lib/auth"
import { put } from "@vercel/blob"
import crypto from "crypto"

// Configure route segment for uploads
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout for file uploads

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv"
]

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for valid session before allowing upload
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folder = formData.get("folder") as string || "crm-tasks"

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: "File type not supported. Use images, PDF, DOC, XLS, or TXT." 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: "File size must be less than 10MB" 
      }, { status: 400 })
    }

    // Generate unique filename with folder prefix for organization
    const uniqueId = crypto.randomUUID()
    const sanitizedOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `${folder}/${uniqueId}-${sanitizedOriginalName}`
    
    // Upload to Vercel Blob (works in both development and production)
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false, // We already add a unique ID
    })
    
    console.log("CRM file upload completed:", blob.url)
    
    return NextResponse.json({ 
      url: blob.url,
      filename: sanitizedOriginalName,
      originalName: file.name,
      size: file.size,
      type: file.type
    })
  } catch (error) {
    console.error("Error in CRM upload handler:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    )
  }
}
