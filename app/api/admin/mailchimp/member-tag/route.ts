import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { toggleMailchimpMemberTag } from "@/lib/mailchimp-analytics"

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

interface TagBody {
  audienceId?: string
  email?: string
  tagName?: string
  state?: "active" | "inactive"
}

// POST /api/admin/mailchimp/member-tag
//
// Toggle a single tag on a member. Body: { audienceId, email, tagName, state }.
// state="active" adds the tag, "inactive" removes it.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: TagBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const audienceId = typeof body.audienceId === "string" ? body.audienceId.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const tagName = typeof body.tagName === "string" ? body.tagName.trim() : ""
  const state = body.state === "inactive" ? "inactive" : "active"

  if (!audienceId) return NextResponse.json({ error: "audienceId is required" }, { status: 400 })
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  if (!tagName) return NextResponse.json({ error: "tagName is required" }, { status: 400 })

  try {
    await toggleMailchimpMemberTag({ audienceId, email, tagName, state })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /admin/mailchimp/member-tag]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update tag" },
      { status: 500 },
    )
  }
}
