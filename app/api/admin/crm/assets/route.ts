import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { listAssets, deleteAsset } from "@/lib/firestore-assets"

// Reusable media library API.
//   GET    ?cursor=<isoDate>  → { assets, nextCursor }  (newest-first, paginated)
//   DELETE ?id=<id>           → removes the LIBRARY RECORD only (not the Blob,
//                               which a content post may still reference)
// Kind filtering (All/Images/Videos) is done client-side over loaded pages.

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const cursor = req.nextUrl.searchParams.get("cursor") || undefined
  try {
    const { assets, nextCursor } = await listAssets({ cursor })
    return NextResponse.json({ success: true, assets, nextCursor })
  } catch (err) {
    console.error("[assets] list failed:", err)
    return NextResponse.json({ success: false, assets: [], nextCursor: null }, { status: 200 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  try {
    await deleteAsset(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[assets] delete failed:", err)
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 })
  }
}
