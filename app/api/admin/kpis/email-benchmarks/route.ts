import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeads } from "@/lib/firestore-leads"
import { getMailchimpCampaignPerformance } from "@/lib/mailchimp-analytics"
import { summarizeMailchimpCampaigns, summarizeResendOutreach } from "@/lib/kpis/email-benchmarks"

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

// GET /api/admin/kpis/email-benchmarks?start=YYYY-MM-DD&end=YYYY-MM-DD
// Email-campaign benchmarks for the Funnel KPI surface: Mailchimp bulk ("drop
// campaign") performance + Resend 1:1 outreach engagement. Defaults to the last
// 90 days. Mailchimp is fetched live; if it fails (no key, API error) we still
// return Resend so the page degrades gracefully. Read-only; interns can view.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(req.url)
  const today = new Date()
  const ninetyAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)
  const start = url.searchParams.get("start") || isoDate(ninetyAgo)
  const end = url.searchParams.get("end") || isoDate(today)
  const audienceId = url.searchParams.get("audienceId") || undefined

  try {
    const leads = await getLeads()
    const resend = summarizeResendOutreach(leads)

    let mailchimp: ReturnType<typeof summarizeMailchimpCampaigns> | null = null
    let mailchimpError: string | null = null
    try {
      const perf = await getMailchimpCampaignPerformance(start, end, audienceId)
      mailchimp = summarizeMailchimpCampaigns(perf.data)
    } catch (err) {
      // Non-fatal: surface the Resend half even if Mailchimp is unavailable.
      mailchimpError = err instanceof Error ? err.message : "Mailchimp unavailable"
      console.error("[email-benchmarks] Mailchimp fetch failed:", err)
    }

    return NextResponse.json({
      success: true,
      range: { start, end },
      mailchimp,
      mailchimpError,
      resend,
      generatedAt: today.toISOString(),
    })
  } catch (err) {
    console.error("[GET /api/admin/kpis/email-benchmarks]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute email benchmarks" },
      { status: 500 },
    )
  }
}
