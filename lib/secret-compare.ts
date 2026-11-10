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

/**
 * Constant-time equality of a presented secret and the expected one. Both are hashed first, so neither timing nor a
 * length mismatch says how much of a guess was right. An empty or missing side never matches.
 */
export function secretMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

export type SharedSecretDecision = "ok" | "denied" | "unconfigured" | "dev_open"

/**
 * The decision for a route that a shared API key guards, kept pure so it is tested without a request.
 *  - configured: the presented key must match (constant time);
 *  - unset in production: "unconfigured", which the caller turns into a refusal. A missing setting never opens a route;
 *  - unset outside production: "dev_open", so local development needs no key.
 */
export function decideSharedSecret(
  provided: string | null | undefined,
  expected: string | null | undefined,
  isProduction: boolean,
): SharedSecretDecision {
  if (!expected) return isProduction ? "unconfigured" : "dev_open"
  return secretMatches(provided, expected) ? "ok" : "denied"
}
