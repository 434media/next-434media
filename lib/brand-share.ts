import { createHash, randomBytes } from "node:crypto"
import { EXCLUDED_COUNTRIES, EXCLUDED_COUNTRY_CODES } from "@/lib/prospecting/scorer"

/**
 * "Share with vendor" (plan v11.2.1 Step 4 item 4): the rules of a brand-book share, apart from storage and mail so
 * they run offline. A share is a random token the vendor gets as a link; only its hash is stored. The send path
 * (lib/brand-share-send.ts) is the one the brand page's button and the send command both call.
 */

export const DEFAULT_SHARE_DAYS = 14
export const MAX_SHARE_DAYS = 30
/** Sends per requester per day (America/Chicago), button and command together (Step 4 item 5). */
export const DAILY_SHARE_CAP = 10
/** The same brand, version and recipient sent again this soon is refused as a repeat (a double click, a retried command). */
export const REPEAT_WINDOW_MS = 10 * 60 * 1000

/** 32 random bytes, base64url: the link's only secret. It is shown once, in the email, and never stored. */
export const newShareToken = (): string => randomBytes(32).toString("base64url")
export const hashShareToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex")
/** A token as newShareToken makes it; anything else is refused before a lookup. */
export const isShareToken = (s: string): boolean => /^[A-Za-z0-9_-]{43}$/.test(s)

export const shareUrl = (origin: string, token: string): string => `${origin.replace(/\/$/, "")}/share/brand-book/${token}`

export type ShareState = "active" | "expired" | "revoked" | "failed"
export function shareState(s: { revoked: boolean; status: string; expires_at: string }, now: Date): ShareState {
  if (s.status === "failed") return "failed"
  if (s.revoked) return "revoked"
  return Date.parse(s.expires_at) <= now.getTime() ? "expired" : "active"
}

export function expiryFrom(now: Date, days: number = DEFAULT_SHARE_DAYS): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString()
}

/** Midnight today in San Antonio, as an instant: the daily cap's window. */
export function dayStart(now: Date): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(now).map(p => [p.type, p.value]))
  const elapsed = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds()
  return new Date(now.getTime() - elapsed)
}

export const normalEmail = (s: string): string => s.trim().toLowerCase()
export const isEmail = (s: string): boolean => /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(s) && s.length <= 254

/** A region code as the runtime canonicalizes it (UK → GB, DD → DE). */
const canonicalRegion = (code: string): string => Intl.getCanonicalLocales(`und-${code}`)[0].slice(4)

/** Every region the runtime names (ISO 3166-1 alpha-2, English), for the form's list and for reading a typed country. */
export const COUNTRY_NAMES: ReadonlyMap<string, string> = (() => {
  const dn = new Intl.DisplayNames(["en"], { type: "region" }), out = new Map<string, string>()
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b)
    let name: string | undefined
    // A deprecated code (DD, UK, YU) is named as its successor; only the canonical one is kept, so a name has one code.
    try { name = canonicalRegion(code) === code ? dn.of(code) : undefined } catch { name = undefined }
    if (name && name !== code && !/unknown/i.test(name)) out.set(code, name)
  }
  return out
})()

/** A typed country as its code: a code ("US") or a name ("United States"); null when it names no region. */
export function countryCode(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z]{2}$/.test(s)) { try { const c = canonicalRegion(s.toUpperCase()); return COUNTRY_NAMES.has(c) ? c : null } catch { return null } }
  const lower = s.toLowerCase()
  for (const [code, name] of COUNTRY_NAMES) if (name.toLowerCase() === lower) return code
  return null
}

/** The domain's top level when it is an excluded jurisdiction's country domain (studio.de → "de"; .eu too), else null. */
export function excludedDomain(domain: string): string | null {
  const tld = domain.trim().toLowerCase().split(".").pop() ?? ""
  return tld === "eu" || (tld.length === 2 && EXCLUDED_COUNTRY_CODES.has(tld.toUpperCase())) ? tld : null
}

/**
 * The outbound-compliance checks a share runs before anything is stored or sent (outbound-compliance skill: master
 * 5.3's jurisdictions through EXCLUDED_COUNTRIES, never re-listed here, and the suppression list). The recipient's
 * country is the one the sender states, and the address's own country domain (.de, .ca) is checked as well.
 * Returns the reason in the sender's words (`invalid` when the input itself is unusable), or null when the share may go.
 */
export function shareRefusal(r: { email: string; country: string }, suppressed: boolean): { invalid?: true; reason: string } | null {
  const email = normalEmail(r.email)
  if (!isEmail(email)) return { invalid: true, reason: "That is not an email address." }
  const code = countryCode(r.country)
  if (!code) return { invalid: true, reason: "Choose the recipient's country from the list." }
  const refuse = (reason: string) => ({ reason })
  const name = COUNTRY_NAMES.get(code)?.toLowerCase() ?? ""
  // The European Union and the eurozone are named as regions too; every member is excluded, so they are.
  if (EXCLUDED_COUNTRY_CODES.has(code) || EXCLUDED_COUNTRIES.has(name) || code === "EU" || code === "EZ") return refuse(`434 MEDIA does not send to recipients in ${COUNTRY_NAMES.get(code)} (outbound jurisdiction policy). Nothing was sent.`)
  const tld = excludedDomain(email.slice(email.indexOf("@") + 1))
  if (tld) return refuse(`The address is on a .${tld} domain, a jurisdiction 434 MEDIA does not send to (outbound jurisdiction policy). Nothing was sent.`)
  if (suppressed) return refuse("That address is on the suppression list (it unsubscribed, bounced or complained). Nothing was sent.")
  return null
}

/** The email: a link, never an attachment. Plain words from the sender; the link and its expiry are the content. */
export function shareEmail(p: { brand: string; recipientName: string; senderName: string; senderEmail: string; url: string; expiresAt: string; versionId: string }): { subject: string; text: string; html: string } {
  const until = new Date(p.expiresAt).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" })
  const hello = p.recipientName ? `Hi ${p.recipientName},` : "Hello,"
  const subject = `${p.brand} brand book`
  const text = [
    hello, "",
    `${p.senderName} at 434 MEDIA shared the ${p.brand} brand book with you. It opens in your browser, and you can download it as a PDF from there.`, "",
    p.url, "",
    `The link works until ${until}. Please don't forward it; ask ${p.senderEmail} if someone else needs a copy.`, "",
    `Brand book version: ${p.versionId}`,
  ].join("\n")
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#171717">
<p>${esc(hello)}</p>
<p>${esc(p.senderName)} at 434 MEDIA shared the ${esc(p.brand)} brand book with you. It opens in your browser, and you can download it as a PDF from there.</p>
<p><a href="${esc(p.url)}" rel="noreferrer" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:4px">Open the ${esc(p.brand)} brand book</a></p>
<p style="color:#525252;font-size:13px">The link works until ${esc(until)}. Please don't forward it; ask <a href="mailto:${esc(p.senderEmail)}">${esc(p.senderEmail)}</a> if someone else needs a copy.</p>
<p style="color:#a3a3a3;font-size:12px">Brand book version ${esc(p.versionId)}</p>
</div>`
  return { subject, text, html }
}
