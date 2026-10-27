import { NextResponse, type NextRequest } from "next/server"
import { requireStaff } from "../../../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/admin/brands/[id]/shares/[shareId]/revoke — the link refuses from the next opening on (plan v11.2.1 Step 4
 * item 4). 434 staff, as the share itself. Revoking a revoked or expired share changes nothing; the record is kept.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; shareId: string }> }) {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id, shareId } = await ctx.params
  if (!BRAND_ID.test(id) || !/^[A-Za-z0-9]{1,40}$/.test(shareId)) return NextResponse.json({ error: "Unknown share" }, { status: 404 })
  try {
    const { firestoreBrandShares } = await import("@/lib/firestore-brand-shares")
    const store = firestoreBrandShares()
    const share = await store.get(shareId)
    if (!share || share.brand_id !== id) return NextResponse.json({ error: "Unknown share" }, { status: 404 })
    const after = await store.revoke(shareId, auth.session.email, new Date().toISOString())
    console.info("[brands/shares/revoke]", JSON.stringify({ by: auth.session.email, brand: id, share: shareId }))
    return NextResponse.json({ revoked: !!after?.revoked, revokedBy: after?.revoked_by ?? null, revokedAt: after?.revoked_at ?? null })
  } catch (err) {
    console.error("[POST /api/admin/brands/[id]/shares/[shareId]/revoke]", err)
    return NextResponse.json({ error: "Could not revoke the share" }, { status: 500 })
  }
}
