import { type NextRequest, NextResponse } from "next/server"
import { requireSendCapable } from "@/lib/auth"
import { getResend, OUTREACH_FROM, RESEND_DOMAIN, assertVerifiedSender } from "@/lib/resend"
import { recordMessage } from "@/lib/core-model/messages-server"
import { contactFormReplyMessage } from "@/lib/core-model/message-paths"

// POST /api/admin/contact-forms/[id]/reply
// Body: { to, subject, body }
//
// A hand-written answer to a website inquiry, from "Write reply" on an arrival in the People Inbox (used when there is
// no agent draft: the agent is off or stopped, or the founder answers himself). Resend sends from OUTREACH_FROM with
// the sender's name; reply-to is the sender, so the answer comes back to them. The reply is recorded as a message,
// then the arrival leaves the People Inbox exactly as after an approved draft (closeArrivalLive: saved as a contact).
// The close never fails the request: the email has gone, and `closed: false` tells the page to say so.

export const runtime = "nodejs"
export const maxDuration = 30

// Linear-time email check — domain labels exclude '.' to avoid polynomial
// backtracking (the dot is matched only by the literal \.).
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

interface ReplyBody {
  to: string
  subject: string
  body: string
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSendCapable()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: Partial<ReplyBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const to = typeof body.to === "string" ? body.to.trim() : ""
  const subject = typeof body.subject === "string" ? body.subject.trim() : ""
  const emailBody = typeof body.body === "string" ? body.body : ""

  if (!to || !EMAIL_RE.test(to)) {
    return NextResponse.json({ error: "Valid `to` address is required" }, { status: 400 })
  }
  if (!subject) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 })
  }
  if (!emailBody.trim()) {
    return NextResponse.json({ error: "Body cannot be empty" }, { status: 400 })
  }

  // Personalized sender — recipient sees "Jesse Hernandez from 434 Media
  // <hello@…>" rather than a generic "434media" tag. Same verified address
  // (hello@send.434media.com), just a different display name. Falls back to
  // the impersonal OUTREACH_FROM if session.name isn't populated.
  const senderName = auth.session.name?.trim()
  const from = senderName
    ? `${senderName} from 434 Media <hello@${RESEND_DOMAIN}>`
    : OUTREACH_FROM
  assertVerifiedSender(from)
  const replyTo = auth.session.email

  let emailId: string
  try {
    const { data, error } = await getResend().emails.send({
      from,
      to,
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
    console.error(`[POST /api/admin/contact-forms/${id}/reply] Resend error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send reply" },
      { status: 502 },
    )
  }

  // The CRM keeps the full text (V1 item 4): the reply as sent, as its own record linked to the person by address.
  const record = await recordMessage(
    contactFormReplyMessage({ from, to, replyTo, subject, text: emailBody, messageId: emailId, at: new Date().toISOString(), sentBy: auth.session.email }),
  )

  const { closeArrivalLive } = await import("@/lib/agent/review-server")
  const { viewerOf } = await import("@/lib/core-model/route-helpers")
  const closed = await closeArrivalLive({ arrival: { formId: id } }, auth.session.email, await viewerOf(auth.session))

  return NextResponse.json({ success: true, emailId, closed: closed.closed, recorded: record.recorded })
}
