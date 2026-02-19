import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { put } from "@vercel/blob"
import crypto from "crypto"

// Configure route segment for uploads
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout for file uploads

// IMPORTANT: This config is needed to allow larger file uploads
// Without this, Next.js defaults to 4MB body size limit causing 413 errors
export const fetchCache = 'force-no-store'

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv"
]

// Vercel Blob on Pro plan supports up to 500MB
// We'll allow 50MB for CRM attachments (reasonable for documents)
const MAX_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_SIZE_DISPLAY = "50MB"

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
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)
      return NextResponse.json({ 
        error: `File too large (${fileSizeMB}MB). Maximum size is ${MAX_SIZE_DISPLAY}.` 
      }, { status: 413 })
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
    
    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    
    // Check for body size limit errors
    if (errorMessage.includes("body exceeded") || errorMessage.includes("too large")) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_DISPLAY}.` },
        { status: 413 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
