import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextRequest, NextResponse } from "next/server"
import { getSession } from "../../lib/auth"

// Configure route segment for uploads
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout for file uploads

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Check for valid session before allowing upload
        const session = await getSession()

        if (!session) {
          throw new Error("Unauthorized")
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Optional: Log or store blob info after upload completes
        console.log("Upload completed:", blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Error in upload handler:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 }
    )
  }
}
