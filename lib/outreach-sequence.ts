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
    replyTo: seq.enrolled_by,
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
        next_send_at: isoDate(addBusinessDays(now, STEP_GAP_BIZ_DAYS[current as 1 | 2])),
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
