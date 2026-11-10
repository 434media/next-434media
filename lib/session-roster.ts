import type { AdminRole, User } from "./session-cookie"

/**
 * Per-request roster re-check for admin sessions (security sweep 2026-10-29).
 *
 * The session cookie is signed at sign-in and carries the role for 24 hours. Until this check, deactivating someone in
 * admin settings, removing their roster record or lowering their role changed nothing until that cookie expired: the
 * role was frozen in it. getSession now asks the roster again, at most once a minute per address per server instance,
 * and applies the answer to the cookie's identity:
 *  - no longer admitted (deactivated, removed, duplicate records, invalid role): no session;
 *  - admitted: the session carries the roster's CURRENT role, not the one it was signed with.
 *
 * The decision is the same one sign-in makes (authorizeAdminSignIn), so owners (ADMIN_OWNER_EMAILS) always pass.
 *
 * A failed lookup fails closed, as sign-in does, with one allowance so a brief Firestore blip does not sign everyone out:
 * a decision read successfully within the last five minutes is reused. Past that, everyone but the owners is refused.
 */

export type RosterDecision =
  | { authorized: true; role: AdminRole; name?: string }
  | { authorized: false; reason: string }

/** How long a roster answer is reused before asking again. */
export const ROSTER_RECHECK_MS = 60 * 1000
/** How long a successful answer may stand in for a failed lookup. */
export const ROSTER_STALE_GRACE_MS = 5 * 60 * 1000

/** The session a cookie's user becomes under a roster decision. Pure. */
export function applyRosterDecision(user: User, decision: RosterDecision): User | null {
  if (!decision.authorized) return null
  return { ...user, role: decision.role }
}

type CacheEntry = { at: number; decision: RosterDecision }

/**
 * A small TTL cache around a roster lookup. `lookup` is the sign-in decision; a result whose reason is `lookup_failed`
 * is treated as "no answer", never cached, and replaced by a recent good answer when there is one.
 */
export function createRosterChecker(
  lookup: (email: string) => Promise<RosterDecision>,
  opts: { now?: () => number; ttlMs?: number; graceMs?: number } = {},
) {
  const now = opts.now ?? Date.now
  const ttl = opts.ttlMs ?? ROSTER_RECHECK_MS
  const grace = opts.graceMs ?? ROSTER_STALE_GRACE_MS
  const cache = new Map<string, CacheEntry>()

  async function decide(email: string): Promise<RosterDecision> {
    const key = email.trim().toLowerCase()
    const hit = cache.get(key)
    const t = now()
    if (hit && t - hit.at < ttl) return hit.decision

    const fresh = await lookup(key)
    if (!fresh.authorized && fresh.reason === "lookup_failed") {
      if (hit && t - hit.at < grace) return hit.decision
      cache.delete(key)
      return fresh
    }
    cache.set(key, { at: t, decision: fresh })
    // Keep the map bounded over a long-lived instance; the roster is small, so this rarely evicts.
    if (cache.size > 500) cache.delete(cache.keys().next().value as string)
    return fresh
  }

  return { decide, clear: () => cache.clear() }
}
