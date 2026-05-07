import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getCreditUsage } from "@/lib/prospecting/credit-log"
import { APOLLO_DAILY_CAP, APOLLO_MONTHLY_CAP } from "@/lib/prospecting/budget"

// GET /api/admin/prospecting/budget
//
// Stage 7 — returns the current Apollo credit usage for the requesting
// user, plus the configured daily/monthly caps. Used by the prospect page
// to display a "X / Y credits this month" indicator and to disable the
// search button when over cap.
//
// Caps come from env vars (APOLLO_DAILY_CAP, APOLLO_MONTHLY_CAP); defaults
// are sized for the Free plan. Adjust when upgrading.

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const usage = await getCreditUsage(auth.session.email)
    const dailyRemaining = Math.max(0, APOLLO_DAILY_CAP - usage.today)
    const monthlyRemaining = Math.max(0, APOLLO_MONTHLY_CAP - usage.thisMonth)

    return NextResponse.json({
      success: true,
      today: usage.today,
      thisMonth: usage.thisMonth,
      thisMonthTeamWide: usage.thisMonthTeamWide,
      dailyCap: APOLLO_DAILY_CAP,
      monthlyCap: APOLLO_MONTHLY_CAP,
      dailyRemaining,
      monthlyRemaining,
      remaining: Math.min(dailyRemaining, monthlyRemaining),
    })
  } catch (err) {
    console.error("[GET /api/admin/prospecting/budget]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load budget" },
      { status: 500 },
    )
  }
}
