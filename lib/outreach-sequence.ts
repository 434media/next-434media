import { getResend, OUTREACH_FROM, assertVerifiedSender } from "@/lib/resend"
import { isSuppressed } from "@/lib/firestore-suppression"
import { getMailchimpMemberProfile } from "@/lib/mailchimp-analytics"
import { updateLead, appendLeadActivity } from "@/lib/firestore-leads"
import type { Lead, OutreachSequence, OutreachSequenceStopReason } from "@/types/crm-types"

/**
 * Outreach sequence engine — the single send path for the 3-email cadence,
 * used by both enroll (step 1, immediate) and the cron (steps due). Re-checks
 * stop conditions + consent before every send, so an auto-send never goes to a
 * lead who opted out or was moved out of the active funnel. See
 * docs/outreach-sequence.md.
 */

// Cadence: business days from one step to the next (Day 0 → +4 → +5).
export const STEP_GAP_BIZ_DAYS: Record<1 | 2, number> = { 1: 4, 2: 5 }

// QA test mode: when SEQUENCE_STEP_GAP_MINUTES is set (e.g. "2"), steps are
// spaced that many MINUTES apart (stored as a full timestamp) instead of the
// business-day cadence — so an auditor can watch all three emails arrive and
// test replying mid-campaign. Unset it to restore the normal 0/+4/+5 cadence.
const TEST_GAP_MINUTES = Number(process.env.SEQUENCE_STEP_GAP_MINUTES) || 0

export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) added++ // skip Sat/Sun
  }
  return d
}

const isoDate = (d: Date) => d.toISOString().split("T")[0]

// The next step's send time after sending `currentStep` (1 or 2). Test mode
// returns a full timestamp N minutes out; normal mode a business-day date.
function nextSendAt(from: Date, currentStep: 1 | 2): string {
  if (TEST_GAP_MINUTES > 0) {
    return new Date(from.getTime() + TEST_GAP_MINUTES * 60_000).toISOString()
  }
  return isoDate(addBusinessDays(from, STEP_GAP_BIZ_DAYS[currentStep]))
}

// Reply-to for sequence sends. When a Resend receiving domain is configured
// (SEQUENCE_INBOUND_DOMAIN), use a per-lead plus-address so an inbound reply is
// captured by the email.received webhook and auto-stops the sequence (Phase 2).
// Otherwise fall back to the rep's address (Phase 1 — rep marks the lead engaged
// to stop). See docs/outreach-sequence.md + app/api/webhooks/resend-inbound.
export function sequenceReplyTo(leadId: string, repEmail: string): string {
  const domain = process.env.SEQUENCE_INBOUND_DOMAIN
  return domain ? `reply+${leadId}@${domain}` : repEmail
}

// Status-based stop — the rep moved the lead out of the active funnel. In
// Phase 1 this is also how a reply registers (the rep marks the lead engaged).
export function sequenceStopByStatus(lead: Lead): OutreachSequenceStopReason | null {
  if (lead.status === "engaged") return "engaged"
  if (lead.status === "converted") return "converted"
  if (lead.status === "archived") return "archived"
  return null
}

// Consent gate (cron context — no rep override). Mirrors send-outreach: hard
// bounce or opt-out → stop the sequence. A lookup hiccup doesn't stop a
// legitimate sequence (logged, proceed).
async function consentStop(email: string): Promise<OutreachSequenceStopReason | null> {
  try {
    const [suppressed, mc] = await Promise.all([
      isSuppressed(email),
      getMailchimpMemberProfile(email).catch(() => null),
    ])
    const statuses = (mc?.audiences ?? []).map((a) => a.status)
    if (statuses.includes("cleaned")) return "opted_out" // hard bounce
    if (suppressed || statuses.includes("unsubscribed")) return "opted_out"
    return null
  } catch (err) {
    console.error(`[outreach-sequence] consent lookup failed for ${email}:`, err)
    return null
  }
}

export interface SequenceStepResult {
  action: "sent" | "completed" | "stopped" | "skipped"
  step?: number
  reason?: OutreachSequenceStopReason
  emailId?: string
}

async function stopSequence(
  lead: Lead,
  seq: OutreachSequence,
  reason: OutreachSequenceStopReason,
): Promise<SequenceStepResult> {
  await updateLead(lead.id, {
    outreach_sequence: { ...seq, status: "stopped", stopped_reason: reason, next_step: null, next_send_at: undefined },
  })
  await appendLeadActivity(lead.id, {
    type: "note",
    actor: "system",
    detail: `Outreach sequence stopped: ${reason}`,
  }).catch(() => {})
  return { action: "stopped", reason }
}

/**
 * Send the current step of a lead's sequence, advance it, and persist. Returns
 * what happened. Throws only on a hard Resend failure (caller decides whether
 * to retry next run).
 */
export async function runSequenceStep(lead: Lead): Promise<SequenceStepResult> {
  const seq = lead.outreach_sequence
  if (!seq || seq.status !== "active" || seq.next_step == null) {
    return { action: "skipped" }
  }

  // Stop conditions first — status, then consent.
  const stop = sequenceStopByStatus(lead) ?? (await consentStop(lead.email))
  if (stop) return stopSequence(lead, seq, stop)

  const step = seq.steps.find((s) => s.n === seq.next_step)
  if (!step || !lead.email) return { action: "skipped" }

  // Send via Resend — reply-to is the enrolling rep (Phase 1; replies land
  // in their inbox, and they mark the lead engaged to stop the sequence).
  const from = process.env.LEAD_OUTREACH_FROM || OUTREACH_FROM
  assertVerifiedSender(from)
  const { data, error } = await getResend().emails.send({
    from,
    to: lead.email,
    replyTo: sequenceReplyTo(lead.id, seq.enrolled_by),
    subject: step.subject,
    text: step.body,
  })
  if (error || !data?.id) {
    throw new Error(error?.message ?? "Resend returned no email id")
  }
  const emailId = data.id

  // Advance: stamp this step, schedule the next (or complete).
  const now = new Date()
  const steps = seq.steps.map((s) =>
    s.n === step.n ? { ...s, sent_at: now.toISOString(), resend_email_id: emailId } : s,
  )
  const current = seq.next_step
  const nextStep = current < 3 ? ((current + 1) as 2 | 3) : null

  const next: OutreachSequence = nextStep
    ? {
        ...seq,
        steps,
        next_step: nextStep,
        next_send_at: nextSendAt(now, current as 1 | 2),
      }
    : { ...seq, steps, status: "completed", next_step: null, next_send_at: undefined, stopped_reason: "completed" }

  await updateLead(lead.id, {
    status: "contacted",
    last_contacted_at: now.toISOString(),
    resend_email_id: emailId,
    outreach_sequence: next,
  })
  await appendLeadActivity(lead.id, {
    type: "outreach_sent",
    actor: seq.enrolled_by,
    detail: `Sequence email ${step.n}/3 sent: “${step.subject}”${nextStep ? ` · next ${next.next_send_at}` : " · sequence complete"}`,
  }).catch(() => {})

  return { action: nextStep ? "sent" : "completed", step: step.n, emailId }
}

/**
 * A lead replied to its sequence (detected via the Resend inbound webhook).
 * Stop the cadence and advance the lead to `engaged` — a reply is the strongest
 * SQL signal, and it also satisfies the status-based stop on the next run.
 * No-ops if there's no running sequence. Returns whether a sequence was stopped.
 */
export async function markSequenceReplied(
  lead: Lead,
  reply?: { text?: string; subject?: string },
): Promise<boolean> {
  const seq = lead.outreach_sequence
  const running = !!seq && (seq.status === "active" || seq.status === "paused")
  // Don't downgrade a lead that's already moved past engagement.
  const nextStatus = lead.status === "converted" || lead.status === "archived" ? lead.status : "engaged"

  await updateLead(lead.id, {
    status: nextStatus,
    ...(seq
      ? { outreach_sequence: { ...seq, status: "stopped", stopped_reason: "replied", next_step: null, next_send_at: undefined } }
      : {}),
  })
  const body = extractReplyText(reply?.text)
  await appendLeadActivity(lead.id, {
    type: "reply_received",
    actor: "system",
    detail: running ? "Sequence stopped · marked engaged" : "Marked engaged",
    body,
  }).catch(() => {})
  return running
}

/**
 * Reduce a raw inbound reply to just the lead's own words for the timeline:
 * cut the quoted original (client "On … wrote:" headers, Outlook dividers, our
 * own forward separator), drop leading-">" quote lines, and cap the length.
 * Returns undefined when nothing readable remains.
 */
function extractReplyText(raw?: string): string | undefined {
  if (!raw) return undefined
  let text = raw.replace(/\r\n/g, "\n")
  const quoteMarkers = [
    /\nOn .*(?:wrote|schrieb|a écrit):/i, // "On <date>, <name> wrote:"
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n_{5,}\n/, // Outlook divider
    /\n—{3,}\n/, // our own forward separator
    /\nFrom:\s.*\nSent:\s/i, // Outlook quoted header block
  ]
  for (const marker of quoteMarkers) {
    const idx = text.search(marker)
    if (idx > 0) {
      text = text.slice(0, idx)
      break
    }
  }
  text = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n")
    .trim()
  if (!text) return undefined
  const CAP = 1500
  return text.length > CAP ? `${text.slice(0, CAP).trimEnd()}…` : text
}
