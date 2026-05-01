import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getResend, OUTREACH_FROM, assertVerifiedSender } from "@/lib/resend"
import { getLeadById, updateLead } from "@/lib/firestore-leads"

export const runtime = "nodejs"
export const maxDuration = 30

// Default follow-up window: if there's no reply in 5 business days, surface
// the lead in the Follow-ups Due chip on the leads tab.
const FOLLOWUP_DAYS = 5

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface SendBody {
  subject: string
  body?: string // optional override; defaults to lead.outreach_draft
}

// POST /api/admin/leads/[id]/send-outreach
// Body: { subject: string, body?: string }
//
// Sends the lead's outreach via Resend, persists tracking metadata, flips
// status to `contacted`, and schedules the follow-up window. Reply-to is
// set to the sending rep so replies route directly to them, not to a
// shared transactional inbox.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: Partial<SendBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : ""
  if (!subject) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 })
  }

  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const emailBody = (typeof body.body === "string" ? body.body : lead.outreach_draft || "").trim()
  if (!emailBody) {
    return NextResponse.json(
      { error: "No outreach draft to send. Generate or write one first." },
      { status: 400 },
    )
  }

  if (!lead.email) {
    return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
  }

  // Cap defensive: don't send to leads we've already converted/archived
  if (lead.status === "converted" || lead.status === "archived") {
    return NextResponse.json(
      { error: `Cannot send to a ${lead.status} lead` },
      { status: 400 },
    )
  }

  // Pick sender: outreach default, validated against verified domain
  const from = process.env.LEAD_OUTREACH_FROM || OUTREACH_FROM
  assertVerifiedSender(from)

  const replyTo = auth.session.email // replies route to the sending rep

  let emailId: string
  try {
    const { data, error } = await getResend().emails.send({
      from,
      to: lead.email,
      replyTo,
      subject,
      text: emailBody,
    })
    if (error) {
      throw new Error(error.message ?? JSON.stringify(error))
    }
    if (!data?.id) {
      throw new Error("Resend returned no email id")
    }
    emailId = data.id
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/send-outreach] Resend error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send outreach" },
      { status: 502 },
    )
  }

  // Schedule the follow-up reminder
  const now = new Date()
  const followUp = new Date(now)
  followUp.setDate(followUp.getDate() + FOLLOWUP_DAYS)
  const followUpDate = followUp.toISOString().split("T")[0]

  try {
    // resend_email_id is the join key for the engagement webhook to find
    // this lead when opens/clicks come back. Set server-side only — the
    // public PATCH route's whitelist intentionally excludes this field.
    const updated = await updateLead(id, {
      status: "contacted",
      last_contacted_at: now.toISOString(),
      next_followup_date: followUpDate,
      resend_email_id: emailId,
    })
    return NextResponse.json({ success: true, lead: updated, emailId })
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/send-outreach] persist error:`, err)
    // Email already went out — surface a clear partial-success error.
    return NextResponse.json(
      {
        error: "Email sent but lead update failed. Manually update the lead to status=contacted.",
        emailId,
      },
      { status: 500 },
    )
  }
}
