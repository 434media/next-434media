import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getGatewayModels } from "@/lib/ai-gateway-models"

// GET /api/admin/crm/content-posts/models
// Returns the curated AI Gateway generation models (live-enriched with price +
// availability) for the "Generate with AI" picker. Admin-gated; the registry
// itself is server-only (it caches the Gateway list), so the drawer fetches it.

export const runtime = "nodejs"

export async function GET(): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  try {
    const models = await getGatewayModels()
    // Only offer models the Gateway currently lists.
    return NextResponse.json({ success: true, models: models.filter((m) => m.available) })
  } catch (err) {
    console.error("[content-posts/models] failed:", err)
    return NextResponse.json({ success: false, models: [] }, { status: 200 })
  }
}
