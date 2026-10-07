import crypto from "crypto"
import { getResend, OUTREACH_FROM, assertVerifiedSender } from "@/lib/resend"
import { isSuppressed } from "@/lib/firestore-suppression"
import { getMailchimpMemberProfile } from "@/lib/mailchimp-analytics"
import { updateLead, appendLeadActivity, recordResendEmailId, updateLeadSequenceTx } from "@/lib/firestore-leads"
import { sendStepOnce, type StepClaim } from "@/lib/outreach-claim"
import { stepGapMinutes } from "@/lib/outreach-step-gap"
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
// test replying mid-campaign. Ignored in production whatever its value
// (lib/outreach-step-gap.ts, 2b fix 11).
const TEST_GAP_MINUTES = stepGapMinutes(process.env)

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
// Warn once per process when the inbound domain is missing. The fallback below
// is a silent downgrade: sequences still send, but replies go to the rep's own
// inbox and never reach the webhook, so the platform never sees them and the
// cadence is only stopped if a human marks the lead engaged. Nothing about that
// looks like a failure from the outside, hence the warning. Warn-only by
// design — a throw here would take down sending over a degraded-but-working
// path. Once per process rather than per send so a cron batch cannot flood the
// logs; serverless cold starts still surface it regularly.
let warnedMissingInboundDomain = false

export function sequenceReplyTo(leadId: string, repEmail: string): string {
  const domain = process.env.SEQUENCE_INBOUND_DOMAIN
  if (!domain && !warnedMissingInboundDomain) {
    warnedMissingInboundDomain = true
    console.warn(
      "[outreach-sequence] SEQUENCE_INBOUND_DOMAIN is unset — reply-to falls back to the rep. Inbound replies will not reach /api/webhooks/resend-inbound and sequences will not auto-stop.",
    )
  }
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
  /** "stale": a previous run's claim never settled; the sequence was paused. */
  action: "sent" | "completed" | "stopped" | "skipped" | "stale"
  step?: number
  reason?: OutreachSequenceStopReason
  /** Why a step was skipped, e.g. another run holds the claim. */
  skipReason?: string
  emailId?: string
  staleClaim?: StepClaim
}

async function stopSequence(
  lead: Lead,
  seq: OutreachSequence,
  reason: OutreachSequenceStopReason,
): Promise<SequenceStepResult> {
  // In a transaction, and only while no run is sending a step, so a stop can
  // never erase a claim another run is about to settle.
  const stopped = await updateLeadSequenceTx(lead.id, (cur) =>
    cur && cur.status === "active" && !cur.claim
      ? { next: { ...cur, status: "stopped", stopped_reason: reason, next_step: null, next_send_at: undefined }, result: true }
      : { result: false },
  )
  if (!stopped) return { action: "skipped", step: seq.next_step ?? undefined, skipReason: "stop_raced" }
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

  // Send via Resend, at most once per step (lib/outreach-claim.ts): claim the
  // step in a transaction, send with an idempotency key, then advance and
  // release the claim in a second transaction (2b fix 11).
  const from = process.env.LEAD_OUTREACH_FROM || OUTREACH_FROM
  assertVerifiedSender(from)
  const current = step.n
  const nextStep = current < 3 ? ((current + 1) as 2 | 3) : null
  let next: OutreachSequence | undefined

  const outcome = await sendStepOnce<OutreachSequence>({
    leadId: lead.id,
    step: current,
    runId: crypto.randomUUID(),
    now: () => new Date(),
    store: { update: updateLeadSequenceTx },
    sender: {
      async send(idempotencyKey) {
        const { data, error } = await getResend().emails.send(
          {
            from,
            to: lead.email,
            replyTo: sequenceReplyTo(lead.id, seq.enrolled_by),
            subject: step.subject,
            text: step.body,
          },
          { idempotencyKey },
        )
        if (error || !data?.id) throw new Error(error?.message ?? "Resend returned no email id")
        return { id: data.id }
      },
    },
    // Stamp this step, schedule the next (or complete).
    advance(cur, emailId, at) {
      const steps = cur.steps.map((s) =>
        s.n === current ? { ...s, sent_at: at.toISOString(), resend_email_id: emailId } : s,
      )
      next = nextStep
        ? { ...cur, steps, next_step: nextStep, next_send_at: nextSendAt(at, current as 1 | 2) }
        : { ...cur, steps, status: "completed", next_step: null, next_send_at: undefined, stopped_reason: "completed" }
      return { next }
    },
  })

  if (outcome.action === "skipped") return { action: "skipped", step: current, skipReason: outcome.reason }
  if (outcome.action === "stale") {
    await appendLeadActivity(lead.id, {
      type: "note",
      actor: "system",
      detail: `Outreach sequence paused for review: step ${current} was claimed at ${outcome.claim.claimed_at} and never confirmed, so it may already have been sent. Check the Resend log before resuming.`,
    }).catch(() => {})
    return { action: "stale", step: current, staleClaim: outcome.claim }
  }
  const emailId = outcome.emailId
  const now = new Date()

  await updateLead(lead.id, {
    status: "contacted",
    last_contacted_at: now.toISOString(),
    resend_email_id: emailId,
  })
  // Preserve this step's id in the send history so its opens/clicks still match
  // after the next step overwrites resend_email_id.
  await recordResendEmailId(lead.id, emailId)
  await appendLeadActivity(lead.id, {
    type: "outreach_sent",
    actor: seq.enrolled_by,
    detail: `Sequence email ${step.n}/3 sent: “${step.subject}”${nextStep ? ` · next ${next?.next_send_at}` : " · sequence complete"}`,
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
