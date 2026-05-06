import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getResend, OUTREACH_FROM, RESEND_DOMAIN, assertVerifiedSender } from "@/lib/resend"
import { setSubmissionState } from "@/lib/firestore-submission-states"

// POST /api/admin/contact-forms/[id]/reply
// Body: { to, subject, body }
//
// Stage 5b — single-row reply via Resend. Mirrors the lead outreach pattern
// in /api/admin/leads/[id]/send-outreach: Resend sends from OUTREACH_FROM,
// reply-to is the sending rep's email so replies route directly to them
// rather than to a shared inbox.
//
// On success, auto-flips the submission state to "replied" so the rep doesn't
// have to manually mark it. State update failures are non-fatal — the email
// already went out — but the response surfaces a warning so the rep knows to
// flip it manually.

export const runtime = "nodejs"
export const maxDuration = 30

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ReplyBody {
  to: string
  subject: string
  body: string
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
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

  // Auto-flip state → replied. Non-fatal: email is already sent, rep can
  // manually flip if persistence fails. The response carries `stateUpdated`
  // so the frontend doesn't optimistically lie about local state when the
  // sidecar write actually didn't happen — that's the silent-desync trap.
  let stateUpdated = false
  try {
    await setSubmissionState("contact_forms", id, "replied", auth.session.email)
    stateUpdated = true
  } catch (err) {
    console.error(`[POST /api/admin/contact-forms/${id}/reply] state update failed:`, err)
    // Fall through — email already sent, surface the state-failure to caller.
  }

  return NextResponse.json({ success: true, emailId, stateUpdated })
}
