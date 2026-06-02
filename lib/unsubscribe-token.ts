import crypto from "crypto"

// Stateless, unforgeable unsubscribe tokens — HMAC(email) so an unsubscribe link
// can't be tampered with and needs no per-recipient DB row. Requires
// UNSUBSCRIBE_SECRET in the environment (fail-loud).

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error("Missing required env var: UNSUBSCRIBE_SECRET")
  return s
}

export function signUnsubscribe(email: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32)
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!email || !token) return false
  const expected = signUnsubscribe(email)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  } catch {
    return false
  }
}

/** Full unsubscribe URL for an email (baseUrl e.g. https://434media.com). */
export function unsubscribeUrl(baseUrl: string, email: string): string {
  const e = encodeURIComponent(email.toLowerCase().trim())
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?e=${e}&t=${signUnsubscribe(email)}`
}
