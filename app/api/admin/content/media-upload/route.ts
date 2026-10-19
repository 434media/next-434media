import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import { IMAGE_TYPES, UPLOAD_PREFIX, VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/content-pipeline/create-media"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/content/media-upload — the client-upload token for the Create table's media cell: the file goes from
 * the browser straight to Blob storage, never through a function body (plan v11 Step 2 item 4). A photo (JPEG, PNG) or
 * a video Canva takes, under 500 MB, under content-create/ only. Super-admins only, like the table's other routes.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as HandleUploadBody | null
  if (!body) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 })
  // Blob's upload-completed callback carries no session; only the token request is gated (handleUpload verifies the callback).
  if (body.type === "blob.generate-client-token") {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const json = await handleUpload({
      body, request,
      onBeforeGenerateToken: async pathname => {
        if (!pathname.startsWith(UPLOAD_PREFIX) || pathname.includes("..")) throw new Error("bad_path")
        return { allowedContentTypes: [...IMAGE_TYPES, ...VIDEO_TYPES], maximumSizeInBytes: VIDEO_MAX_BYTES, addRandomSuffix: true }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(json)
  } catch (err) {
    console.error("[POST /api/admin/content/media-upload]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error && err.message === "bad_path" ? "Uploads go under content-create/" : "Upload could not start" }, { status: 400 })
  }
}
