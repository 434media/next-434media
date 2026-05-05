import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getMailchimpMemberProfile } from "@/lib/mailchimp-analytics"

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

// GET /api/admin/mailchimp/member?email=foo@bar.com
//
// Returns per-audience subscription profile + activity feed for the email.
// Powers the Mailchimp panel inside the lead/client drawer.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  try {
    const profile = await getMailchimpMemberProfile(email)
    return NextResponse.json({ success: true, data: profile })
  } catch (err) {
    console.error("[GET /admin/mailchimp/member]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load member profile" },
      { status: 500 },
    )
  }
}
