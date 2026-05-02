import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  pushMembersToMailchimp,
  type MailchimpPushMember,
  type MailchimpMemberStatus,
} from "@/lib/mailchimp-analytics"

export const runtime = "nodejs"
export const maxDuration = 60

const VALID_STATUSES: MailchimpMemberStatus[] = ["subscribed", "pending", "unsubscribed", "transactional"]
const HARD_LIMIT = 5000 // Sanity cap — push more than this in multiple operations

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface PushBody {
  audienceId?: string
  status?: string
  tags?: string[]
  members?: Array<{ email?: string; firstName?: string; lastName?: string }>
}

// POST /api/admin/mailchimp/push-members
//
// body: { audienceId, status, tags: string[], members: [{ email, firstName?, lastName? }] }
//
// Batch-upserts the members into the Mailchimp audience with the given tags.
// Existing members get tag-only updates. Returns counts + per-email errors so
// the UI can show a partial-success summary.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: PushBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const audienceId = typeof body.audienceId === "string" ? body.audienceId.trim() : ""
  const statusRaw = (body.status as MailchimpMemberStatus) || "subscribed"
  const tags = Array.isArray(body.tags) ? body.tags : []
  const members = Array.isArray(body.members) ? body.members : []

  if (!audienceId) {
    return NextResponse.json({ error: "audienceId is required" }, { status: 400 })
  }
  if (!VALID_STATUSES.includes(statusRaw)) {
    return NextResponse.json(
      { error: `status must be one of ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    )
  }
  if (members.length === 0) {
    return NextResponse.json({ error: "members array is empty" }, { status: 400 })
  }
  if (members.length > HARD_LIMIT) {
    return NextResponse.json(
      { error: `Max ${HARD_LIMIT} members per request` },
      { status: 400 },
    )
  }

  // Validate + sanitize members
  const sanitized: MailchimpPushMember[] = []
  for (let i = 0; i < members.length; i++) {
    const m = members[i]
    if (!m.email || typeof m.email !== "string" || !m.email.includes("@")) {
      return NextResponse.json(
        { error: `Invalid email at index ${i}` },
        { status: 400 },
      )
    }
    sanitized.push({
      email: m.email.trim().toLowerCase(),
      firstName: typeof m.firstName === "string" ? m.firstName.trim() : undefined,
      lastName: typeof m.lastName === "string" ? m.lastName.trim() : undefined,
    })
  }

  try {
    const result = await pushMembersToMailchimp(audienceId, sanitized, statusRaw, tags)
    console.log(
      `[push-members] ${auth.session.email} pushed to audience ${audienceId}:`,
      JSON.stringify({
        attempted: result.attempted,
        new: result.newMembers,
        updated: result.updatedMembers,
        failed: result.errors.length,
      }),
    )
    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error("[POST /push-members]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push failed" },
      { status: 500 },
    )
  }
}
