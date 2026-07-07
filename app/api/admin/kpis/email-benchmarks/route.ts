import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { summarizeResendOutreach } from "@/lib/kpis/email-benchmarks"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

// GET /api/admin/kpis/email-benchmarks?days=30|90|365|all
//
// Resend 1:1 outreach engagement for the Funnel KPI surface. `days` windows by
// send date (last_contacted_at); "all" (or omitted → default 90) covers the
// whole history. Read-only; interns can view.
//
// Mailchimp is being phased out — Resend (its API + webhooks) is the source of
// truth for email engagement, so this endpoint no longer fetches Mailchimp.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const daysParam = new URL(req.url).searchParams.get("days")
  // null range = all-time. Otherwise a rolling window of N days back from today.
  let range: { start: string; end: string } | null = null
  if (daysParam !== "all") {
    const days = Number(daysParam) > 0 ? Number(daysParam) : 90
    const today = new Date()
    const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
    range = { start: isoDate(start), end: isoDate(today) }
  }

  try {
    const leads = await getLeads()
    const resend = summarizeResendOutreach(leads, range ?? undefined)
    return NextResponse.json({
      success: true,
      range,
      resend,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error("[GET /api/admin/kpis/email-benchmarks]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute email benchmarks" },
      { status: 500 },
    )
  }
}
