import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { computeLeadQualityKpis } from "@/lib/kpis/lead-quality"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/kpis/lead-quality — aggregate lead-quality KPIs for the Funnel
// KPI surface (score distribution, kept vs removed + reasons, conversion by
// score band, per-source performance). Read-only; interns can view.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const leads = await getLeads()
    const kpis = computeLeadQualityKpis(leads, new Date().toISOString())
    return NextResponse.json({ success: true, kpis })
  } catch (err) {
    console.error("[GET /api/admin/kpis/lead-quality]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute lead-quality KPIs" },
      { status: 500 },
    )
  }
}
