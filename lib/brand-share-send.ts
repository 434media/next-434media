import { DAILY_SHARE_CAP, DEFAULT_SHARE_DAYS, MAX_SHARE_DAYS, REPEAT_WINDOW_MS, countryCode, dayStart, expiryFrom, hashShareToken, newShareToken, normalEmail, shareEmail, shareRefusal, shareState, shareUrl } from "./brand-share"
import type { BrandShare, BrandShareStore, ShareVia } from "./firestore-brand-shares"

/**
 * The one send path for a brand-book share (plan v11.2.1 Step 4 items 4 and 5): the brand page's "Share with vendor"
 * button and the "send the [brand] brand book to [name/email]" command both reach it through
 * POST /api/admin/brands/[id]/shares. In order, and nothing is stored or sent until every check passes:
 *   1. the brand has a brand book to share (its published version, which the share pins);
 *   2. outbound compliance: the recipient's jurisdiction (EXCLUDED_COUNTRIES) and the suppression list;
 *   3. the requester's daily cap (DAILY_SHARE_CAP, button and command together);
 *   4. not a repeat of the same share sent minutes ago (a double click, a retried command).
 * Then the share is recorded (token hash only), mailed through Resend, and the record gets the message id. A refused
 * send says why; a failed mail marks the share failed, and a failed share never opens.
 */
export interface ShareRequest {
  brandId: string
  recipientName: string
  recipientEmail: string
  /** The recipient's country, as a code or an English name. */
  country: string
  expiresDays?: number
  via: ShareVia
  sender: { email: string; name: string }
}
export interface ShareBook { label: string; versionId: string; n: number }
export interface ShareDeps {
  shares: BrandShareStore
  /** The brand's shareable book: its published version when that version has a valid book, or why not. */
  book(brandId: string): Promise<{ ok: true; book: ShareBook } | { ok: false; reason: string }>
  isSuppressed(email: string): Promise<boolean>
  sendMail(m: { to: string; replyTo: string; subject: string; text: string; html: string }): Promise<{ id: string }>
  origin: string
  now?: () => Date
  newToken?: () => string
}
export type ShareOutcome =
  | { ok: true; share: BrandShare }
  | { ok: false; status: 400 | 404 | 409 | 429 | 500 | 502; code: "invalid" | "no_book" | "refused" | "cap" | "repeat" | "failed"; error: string }

export async function sendBrandShare(req: ShareRequest, deps: ShareDeps): Promise<ShareOutcome> {
  const now = (deps.now ?? (() => new Date()))()
  const email = normalEmail(req.recipientEmail), name = req.recipientName.trim()
  const days = req.expiresDays ?? DEFAULT_SHARE_DAYS
  if (name.length > 100) return { ok: false, status: 400, code: "invalid", error: "The name is too long." }
  if (!Number.isInteger(days) || days < 1 || days > MAX_SHARE_DAYS) return { ok: false, status: 400, code: "invalid", error: `The link lasts 1 to ${MAX_SHARE_DAYS} days.` }

  const b = await deps.book(req.brandId)
  if (!b.ok) return { ok: false, status: 409, code: "no_book", error: `No brand book to share: ${b.reason}.` }

  const refusal = shareRefusal({ email, country: req.country }, await deps.isSuppressed(email))
  if (refusal) return refusal.invalid ? { ok: false, status: 400, code: "invalid", error: refusal.reason } : { ok: false, status: 409, code: "refused", error: refusal.reason }

  const sender = normalEmail(req.sender.email)
  const today = await deps.shares.sentBySince(sender, dayStart(now).toISOString())
  if (today.length >= DAILY_SHARE_CAP) return { ok: false, status: 429, code: "cap", error: `You have sent ${today.length} brand books today, the daily limit (${DAILY_SHARE_CAP}). Nothing was sent; try again tomorrow.` }

  const recent = (await deps.shares.forBrand(req.brandId)).find(s => s.recipient_email === email && s.version_id === b.book.versionId
    && shareState(s, now) === "active" && now.getTime() - Date.parse(s.created_at) < REPEAT_WINDOW_MS)
  if (recent) return { ok: false, status: 409, code: "repeat", error: `This brand book went to ${email} a few minutes ago (sent by ${recent.sender_email}). Nothing was sent again.` }

  const token = (deps.newToken ?? newShareToken)()
  const expiresAt = expiryFrom(now, days)
  let share: BrandShare
  try {
    share = await deps.shares.create({
      brand_id: req.brandId, brand_label: b.book.label, version_id: b.book.versionId, version_n: b.book.n,
      recipient_name: name, recipient_email: email, recipient_country: countryCode(req.country)!,
      sender_email: sender, sender_name: req.sender.name || sender, via: req.via,
      token_hash: hashShareToken(token), created_at: now.toISOString(), expires_at: expiresAt,
    })
  } catch (e) {
    console.error("[brand-share] could not record the share", e)
    return { ok: false, status: 500, code: "failed", error: "The share could not be recorded. Nothing was sent." }
  }

  const mail = shareEmail({ brand: b.book.label, recipientName: name, senderName: req.sender.name || sender, senderEmail: sender, url: shareUrl(deps.origin, token), expiresAt, versionId: b.book.versionId })
  try {
    const { id } = await deps.sendMail({ to: email, replyTo: sender, ...mail })
    await deps.shares.markSent(share.id, id)
    return { ok: true, share: { ...share, status: "sent", resend_message_id: id } }
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e)
    console.error("[brand-share] the mail was not sent", share.id, why)
    await deps.shares.markFailed(share.id, why).catch(() => {})
    return { ok: false, status: 502, code: "failed", error: "The email service did not accept the message. Nothing was sent; try again." }
  }
}
