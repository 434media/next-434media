import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getResend, OUTREACH_FROM, RESEND_DOMAIN, assertVerifiedSender } from "@/lib/resend"
import { setSubmissionState } from "@/lib/firestore-submission-states"

// POST /api/admin/contact-forms/bulk-acknowledge
// Body: { recipients: Array<{ submissionId, email, firstName }> }
//
// Stage 5d — sends a fixed templated acknowledgment ("got it, real reply
// soon") to multiple selected inquiries at once. Distinct from per-row
// Reply (which is custom per-recipient): this is the bulk-acknowledge
// pattern for backlog moments where reps would otherwise stay silent.
//
// Each recipient gets:
//   - Personalized greeting via firstName substitution
//   - Same body otherwise (no per-recipient editing)
//   - From: rep's name (from session) — same personalization as per-row Reply
//   - Reply-to: rep's email — replies thread back to whoever clicked the
//     bulk action. Acceptable at small-team scale; same fragility we noted
//     for per-row Reply applies here too.
//
// On per-recipient send success, auto-flips state to "replied". Each
// recipient is independent — one Resend failure doesn't halt the rest.
// The response surfaces sent / failed counts so the rep sees what happened.

export const runtime = "nodejs"
export const maxDuration = 60

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_RECIPIENTS = 50 // soft cap — anything beyond this should be a campaign, not bulk-ack

interface Recipient {
  submissionId: string
  email: string
  firstName: string
}

interface BulkAckResult {
  submissionId: string
  email: string
  status: "sent" | "send-failed" | "state-failed" | "invalid"
  error?: string
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

function buildBody(firstName: string): string {
  const first = firstName?.trim() || "there"
  return (
    `Hi ${first},\n\n` +
    `Thanks for reaching out — we got your message and will follow up ` +
    `properly within 24 hours.\n\n` +
    `Best,\n434 Media`
  )
}

const SUBJECT = "Re: Your inquiry to 434 Media"

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { recipients?: Recipient[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const recipients = Array.isArray(body.recipients) ? body.recipients : []
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients provided" }, { status: 400 })
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Bulk acknowledge supports up to ${MAX_RECIPIENTS} recipients per request. Split the batch or run a campaign for larger sends.`,
      },
      { status: 400 },
    )
  }

  // Personalized sender — same pattern as per-row Reply route. Recipient
  // sees "Jesse Hernandez from 434 Media <hello@…>" rather than generic.
  const senderName = auth.session.name?.trim()
  const from = senderName
    ? `${senderName} from 434 Media <hello@${RESEND_DOMAIN}>`
    : OUTREACH_FROM
  assertVerifiedSender(from)
  const replyTo = auth.session.email
  const resend = getResend()

  const results: BulkAckResult[] = []

  for (const r of recipients) {
    const submissionId = typeof r.submissionId === "string" ? r.submissionId : ""
    const email = typeof r.email === "string" ? r.email.trim() : ""
    const firstName = typeof r.firstName === "string" ? r.firstName : ""

    if (!submissionId || !email || !EMAIL_RE.test(email)) {
      results.push({
        submissionId,
        email,
        status: "invalid",
        error: "Invalid recipient (missing id or invalid email)",
      })
      continue
    }

    // Send. We sequence (not parallelize) to stay well under Resend's rate
    // limits without complex throttling — at MAX_RECIPIENTS=50 this is
    // ~10–20 seconds worst case, acceptable for a bulk action.
    try {
      const { data, error } = await resend.emails.send({
        from,
        to: email,
        replyTo,
        subject: SUBJECT,
        text: buildBody(firstName),
      })
      if (error) throw new Error(error.message ?? JSON.stringify(error))
      if (!data?.id) throw new Error("Resend returned no email id")
    } catch (err) {
      console.error(`[POST /bulk-acknowledge] Resend send failed for ${email}:`, err)
      results.push({
        submissionId,
        email,
        status: "send-failed",
        error: err instanceof Error ? err.message : "Send failed",
      })
      continue
    }

    // Flip state — non-fatal: email already went out. Surfaces partial
    // success per-recipient via the result status so the rep can act on it.
    try {
      await setSubmissionState("contact_forms", submissionId, "replied", auth.session.email)
      results.push({ submissionId, email, status: "sent" })
    } catch (err) {
      console.error(`[POST /bulk-acknowledge] state update failed for ${submissionId}:`, err)
      results.push({
        submissionId,
        email,
        status: "state-failed",
        error: "Email sent but status didn't save",
      })
    }
  }

  const sent = results.filter((r) => r.status === "sent").length
  const sendFailed = results.filter((r) => r.status === "send-failed").length
  const stateFailed = results.filter((r) => r.status === "state-failed").length
  const invalid = results.filter((r) => r.status === "invalid").length

  return NextResponse.json({
    success: true,
    sent,
    sendFailed,
    stateFailed,
    invalid,
    total: results.length,
    results,
  })
}
