import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { reconcileMailchimpTaxonomy } from "@/lib/mailchimp-reconcile"

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

// GET /api/admin/mailchimp/reconcile
//
// Reconciles the Mailchimp 434 Media audience against the canonical tag
// taxonomy + reports the consent-status breakdown. `drift` lists any
// non-canonical tag (hand-tagged in the Mailchimp UI) — non-empty means the
// sole-writer policy was bypassed. `statusCounts.totalContacts` explains the
// "total contacts" headline. Complements sync-audit (email presence).
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const report = await reconcileMailchimpTaxonomy()
    return NextResponse.json(report)
  } catch (err) {
    console.error("[GET /admin/mailchimp/reconcile]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed" },
      { status: 500 },
    )
  }
}
