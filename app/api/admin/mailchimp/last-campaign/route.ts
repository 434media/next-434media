import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLatestSentCampaign } from "@/lib/mailchimp-analytics"

export const runtime = "nodejs"
export const maxDuration = 30

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/mailchimp/last-campaign
//
// Returns the single most recent sent campaign across all configured Mailchimp
// audiences. Powers the campaign-attribution strip on the Submissions page.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const campaign = await getLatestSentCampaign()
    return NextResponse.json({ success: true, data: campaign })
  } catch (err) {
    console.error("[GET /admin/mailchimp/last-campaign]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load last campaign" },
      { status: 500 },
    )
  }
}
