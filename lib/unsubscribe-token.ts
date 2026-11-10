import crypto from "crypto"

// Stateless, unforgeable unsubscribe tokens — HMAC(email) so an unsubscribe link
// can't be tampered with and needs no per-recipient DB row. Requires
// UNSUBSCRIBE_SECRET in the environment (fail-loud).
//
// Rotation: links already sent are signed with the old secret and must keep
// working (CAN-SPAM: an unsubscribe link must work for at least 30 days after
// the send). Put the old value in UNSUBSCRIBE_SECRET_PREVIOUS when the new one
// goes in; new links are signed only with UNSUBSCRIBE_SECRET, and both verify.
// Remove UNSUBSCRIBE_SECRET_PREVIOUS once the last send signed with it is more
// than 30 days old.

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error("Missing required env var: UNSUBSCRIBE_SECRET")
  return s
}

function hmac(key: string, email: string): string {
  return crypto.createHmac("sha256", key).update(email.toLowerCase().trim()).digest("hex").slice(0, 32)
}

export function signUnsubscribe(email: string): string {
  return hmac(secret(), email)
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  if (!email || !token) return false
  const keys = [secret(), process.env.UNSUBSCRIBE_SECRET_PREVIOUS].filter((k): k is string => !!k)
  let ok = false
  for (const key of keys) {
    try {
      // No early exit: every key is checked, so timing does not reveal which one matched.
      if (crypto.timingSafeEqual(Buffer.from(hmac(key, email)), Buffer.from(token))) ok = true
    } catch {
      // Wrong-length token: not a match for this key.
    }
  }
  return ok
}

/** Full unsubscribe URL for an email (baseUrl e.g. https://434media.com). */
export function unsubscribeUrl(baseUrl: string, email: string): string {
  const e = encodeURIComponent(email.toLowerCase().trim())
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?e=${e}&t=${signUnsubscribe(email)}`
}
