import { createHash, timingSafeEqual } from "node:crypto"

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header against the expected secret (security log ADM-10).
 * Both sides are hashed first, so neither the comparison's time nor an early length mismatch says how much of a guess
 * was right. Header only: a secret in a query string lands in URLs and request logs. Vercel Cron sends this header.
 */
export function bearerSecretMatches(authorization: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !authorization) return false
  const match = /^Bearer (.+)$/.exec(authorization)
  if (!match) return false
  const a = createHash("sha256").update(match[1]).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}
