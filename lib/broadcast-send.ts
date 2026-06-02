import { getResend, assertVerifiedSender } from "./resend"
import { inviteEmailHtml } from "./email-templates/lead-with-ops"
import { unsubscribeUrl } from "./unsubscribe-token"
import { getDb } from "./firebase-admin"
import type { BroadcastRecipient } from "./broadcast-recipients"

// Phase 3 send engine. Renders the branded invite per-recipient (FNAME + signed
// unsubscribe URL), sends via Resend batch API in throttled chunks to stay under
// rate/daily caps, and logs the run to the `broadcasts` collection.
//
// Compliance: every email carries a working unsubscribe (footer + List-
// Unsubscribe headers). Recipients must already be consent-filtered upstream by
// gatherBroadcastRecipients (opted-in, minus Mailchimp-unsubscribed + suppressed).

const BATCH_SIZE = 100 // Resend batch cap
const DELAY_MS = 1100 // between batches — keeps us under Resend's rate limit

function baseUrl(): string {
  // Canonical www host so unsubscribe links don't bounce through a redirect
  // (which can drop the one-click POST).
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.434media.com"
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface BroadcastSendResult {
  attempted: number
  sent: number
  failed: number
  batches: number
  errors: Array<{ email: string; error: string }>
  broadcastId?: string
}

export interface SendBroadcastOpts {
  recipients: BroadcastRecipient[]
  subject: string
  /** Must be @send.434media.com (verified). */
  from: string
  replyTo: string
  registrationUrl: string
  /** When true, builds + validates every payload but sends nothing. */
  dryRun?: boolean
  label?: string
}

export async function sendBroadcast(opts: SendBroadcastOpts): Promise<BroadcastSendResult> {
  assertVerifiedSender(opts.from)
  const base = baseUrl()

  // Build one payload per recipient. Generating the unsubscribe URL here also
  // validates UNSUBSCRIBE_SECRET is present (it throws if missing) — so a dry-run
  // surfaces that misconfig before a live send.
  const emails = opts.recipients
    .filter((r) => r.email)
    .map((r) => {
      const unsub = unsubscribeUrl(base, r.email)
      return {
        from: opts.from,
        to: r.email,
        replyTo: opts.replyTo,
        subject: opts.subject,
        html: inviteEmailHtml({
          firstName: r.firstName,
          registrationUrl: opts.registrationUrl,
          unsubscribeUrl: unsub,
        }),
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }
    })

  const totalBatches = Math.ceil(emails.length / BATCH_SIZE)

  if (opts.dryRun) {
    return { attempted: emails.length, sent: 0, failed: 0, batches: totalBatches, errors: [] }
  }

  const resend = getResend()
  let sent = 0
  let failed = 0
  let batches = 0
  const errors: Array<{ email: string; error: string }> = []

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE)
    batches++
    try {
      const { error } = await resend.batch.send(chunk)
      if (error) {
        failed += chunk.length
        for (const c of chunk) errors.push({ email: String(c.to), error: error.message || String(error) })
      } else {
        sent += chunk.length
      }
    } catch (e) {
      failed += chunk.length
      const msg = e instanceof Error ? e.message : String(e)
      for (const c of chunk) errors.push({ email: String(c.to), error: msg })
    }
    if (i + BATCH_SIZE < emails.length) await sleep(DELAY_MS)
  }

  const broadcastId = `${opts.label || "broadcast"}-${Date.now()}`
  await getDb()
    .collection("broadcasts")
    .doc(broadcastId)
    .set({
      id: broadcastId,
      label: opts.label || null,
      subject: opts.subject,
      from: opts.from,
      attempted: emails.length,
      sent,
      failed,
      batches,
      errorsCount: errors.length,
      sentAt: new Date().toISOString(),
    })

  return { attempted: emails.length, sent, failed, batches, errors, broadcastId }
}
