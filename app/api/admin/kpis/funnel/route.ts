import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { getClients } from "@/lib/firestore-crm"
import { computeFunnelKpis } from "@/lib/kpis/funnel"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/kpis/funnel — funnel-conversion + velocity KPIs for the Funnel
// KPI surface. Spans both collections: leads (Lead/MQL/SQL) joined to crm_clients
// opportunities (Discovery/Proposal/Closed-Won) via converted_to_client_id.
// Stage is derived, not stored. Read-only; interns can view.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const [leads, clients] = await Promise.all([getLeads(), getClients()])
    const kpis = computeFunnelKpis(leads, clients, new Date().toISOString())
    return NextResponse.json({ success: true, kpis })
  } catch (err) {
    console.error("[GET /api/admin/kpis/funnel]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute funnel KPIs" },
      { status: 500 },
    )
  }
}
