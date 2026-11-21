import { timingSafeEqual } from "node:crypto"

// Both sides are copied into equal fixed-size buffers that also carry their length, so timingSafeEqual compares the
// same number of bytes whatever was presented, and neither timing nor a length mismatch says how much of a guess was
// right. No hash: CodeQL read the earlier sha256 as password hashing (js/insufficient-password-hash, alert 102).
// A shared secret longer than MAX_SECRET_BYTES never matches.
const MAX_SECRET_BYTES = 1024
function framed(value: string): Buffer | null {
  const bytes = Buffer.from(value, "utf8")
  if (bytes.length > MAX_SECRET_BYTES) return null
  const out = Buffer.alloc(MAX_SECRET_BYTES + 2)
  out.writeUInt16BE(bytes.length, 0)
  bytes.copy(out, 2)
  return out
}
function constantTimeEquals(provided: string, expected: string): boolean {
  const a = framed(provided), b = framed(expected)
  if (!b) return false
  // A too-long presented value is still compared (against a zero frame), so it costs the same time as any other.
  return timingSafeEqual(a ?? Buffer.alloc(MAX_SECRET_BYTES + 2), b) && a !== null
}

/**
 * Constant-time check of an `Authorization: Bearer <secret>` header against the expected secret (security log ADM-10).
 * Both sides are compared as equal fixed-size frames, so neither the comparison's time nor a length mismatch says how much of a guess
 * was right. Header only: a secret in a query string lands in URLs and request logs. Vercel Cron sends this header.
 */
export function bearerSecretMatches(authorization: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !authorization) return false
  const match = /^Bearer (.+)$/.exec(authorization)
  if (!match) return false
  return constantTimeEquals(match[1], expected)
}

/**
 * Constant-time equality of a presented secret and the expected one. Both are compared as fixed-size frames, so neither timing nor a
 * length mismatch says how much of a guess was right. An empty or missing side never matches.
 */
export function secretMatches(provided: string | null | undefined, expected: string | null | undefined): boolean {
  if (!provided || !expected) return false
  return constantTimeEquals(provided, expected)
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
