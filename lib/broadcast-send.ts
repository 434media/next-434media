import { getResend, assertVerifiedSender } from "./resend"
import { inviteEmailHtml } from "./email-templates/lead-with-ops"
import { unsubscribeUrl } from "./unsubscribe-token"
import { getDb } from "./firebase-admin"
import type { BroadcastRecipient } from "./broadcast-recipients"

// Phase 3 send engine. Renders the branded invite per-recipient (FNAME + signed
// unsubscribe URL), sends via Resend batch API in throttled chunks, and logs the
// run to the `broadcasts` collection.
//
// Resilience: malformed addresses are dropped up front, and if a batch is
// rejected (Resend fails the WHOLE batch when any one address is bad), it falls
// back to per-email sends so one bad address can't take down 99 good ones. Only
// successfully-sent emails are returned in `sentEmails` so the caller records
// exactly those to the dedup ledger.

const BATCH_SIZE = 100
const DELAY_MS = 1100 // between batches — keeps us under Resend's rate limit
const PER_EMAIL_DELAY_MS = 550 // during per-email fallback

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.434media.com"
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Conservative email validation — catches the cases Resend rejects (trailing/
 *  leading/double dots, missing parts) so they don't poison a batch. */
function isValidEmail(raw: string): boolean {
  const email = (raw || "").trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  const [local, domain] = email.split("@")
  if (!local || !domain) return false
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false
  return true
}

export interface BroadcastSendResult {
  attempted: number
  sent: number
  failed: number
  /** Dropped before sending — malformed addresses. */
  invalid: number
  batches: number
  errors: Array<{ email: string; error: string }>
  /** Emails that actually sent — record these to the ledger. */
  sentEmails: string[]
  broadcastId?: string
}

export interface SendBroadcastOpts {
  recipients: BroadcastRecipient[]
  subject: string
  from: string
  replyTo: string
  registrationUrl: string
  dryRun?: boolean
  label?: string
}

function buildPayload(r: BroadcastRecipient, opts: SendBroadcastOpts, base: string) {
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
}

export async function sendBroadcast(opts: SendBroadcastOpts): Promise<BroadcastSendResult> {
  assertVerifiedSender(opts.from)
  const base = baseUrl()

  const valid = opts.recipients.filter((r) => r.email && isValidEmail(r.email))
  const invalid = opts.recipients.length - valid.length
  const payloads = valid.map((r) => buildPayload(r, opts, base))
  const totalBatches = Math.ceil(payloads.length / BATCH_SIZE)

  if (opts.dryRun) {
    return {
      attempted: payloads.length,
      sent: 0,
      failed: 0,
      invalid,
      batches: totalBatches,
      errors: [],
      sentEmails: [],
    }
  }

  const resend = getResend()
  let sent = 0
  let failed = 0
  let batches = 0
  const errors: Array<{ email: string; error: string }> = []
  const sentEmails: string[] = []

  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const chunk = payloads.slice(i, i + BATCH_SIZE)
    batches++
    let batchOk = false
    try {
      const { error } = await resend.batch.send(chunk)
      if (!error) {
        batchOk = true
        sent += chunk.length
        for (const c of chunk) sentEmails.push(String(c.to))
      }
    } catch {
      /* fall through to per-email */
    }

    if (!batchOk) {
      // A single bad address fails the whole batch — retry individually to
      // isolate the bad one(s) and still deliver the rest.
      for (const c of chunk) {
        try {
          const { error } = await resend.emails.send(c)
          if (error) {
            failed++
            errors.push({ email: String(c.to), error: error.message || String(error) })
          } else {
            sent++
            sentEmails.push(String(c.to))
          }
        } catch (e) {
          failed++
          errors.push({ email: String(c.to), error: e instanceof Error ? e.message : String(e) })
        }
        await sleep(PER_EMAIL_DELAY_MS)
      }
    }

    if (i + BATCH_SIZE < payloads.length) await sleep(DELAY_MS)
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
      attempted: payloads.length,
      sent,
      failed,
      invalid,
      batches,
      errorsCount: errors.length,
      sentAt: new Date().toISOString(),
    })

  return { attempted: payloads.length, sent, failed, invalid, batches, errors, sentEmails, broadcastId }
}
