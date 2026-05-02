import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getMailchimpSubscriberMap } from "@/lib/mailchimp-analytics"

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

// GET /api/admin/mailchimp/subscriber-map
//
// Returns email→audiences lookup map across every configured Mailchimp
// audience. Used by the Submissions page to flag rows whose email is
// already a Mailchimp subscriber. Up to ~2000 entries (1000 per audience),
// so the response is small enough to cache module-side on the client.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const map = await getMailchimpSubscriberMap()
    return NextResponse.json({ success: true, ...map })
  } catch (err) {
    console.error("[GET /admin/mailchimp/subscriber-map]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load subscriber map" },
      { status: 500 },
    )
  }
}
