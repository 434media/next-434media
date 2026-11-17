import { createHash } from "node:crypto"
import type { MailchimpPushMember } from "./mailchimp-analytics"

// The incremental Firestore → Mailchimp push (founder, 2026-11-17). Pure: no
// Firestore, no Mailchimp. lib/mailchimp-autosync.ts does the I/O.
//
// Every hour the full plan is still computed (Firestore reads are cheap), but
// only members that are new or changed since the last successful push are sent.
// "Changed" is a fingerprint of everything the push writes (email, tags, first
// and last name), not a timestamp: the source records carry no reliable
// updated-at, and a tag merge on an existing registration changes no date.
//
// Once a day the remembered set is cleared, so every member is pushed again
// (the safety net). Pushing stops at a time budget and the rest carries over to
// the next hourly run, so no run can reach the function's time limit.

/** One member as the push writes it, with the canonical tag-set it gets. */
export interface PlannedMember extends MailchimpPushMember {
  tags: string[]
}

/** Mailchimp's batch-subscribe cap per request. */
export const PUSH_CHUNK = 500

/** The full pass runs again once this long has passed since the last one started. */
export const FULL_PASS_EVERY_MS = 24 * 60 * 60 * 1000

/** Stop starting new requests this long after the run began (maxDuration is 300 s). */
export const PUSH_BUDGET_MS = 180 * 1000

export function fingerprint(m: PlannedMember): string {
  const tags = [...m.tags].sort().join("|")
  return createHash("sha1")
    .update([m.email.trim().toLowerCase(), tags, m.firstName ?? "", m.lastName ?? ""].join("\u0000"))
    .digest("hex")
    .slice(0, 12)
}

/** Whether this run starts a new full pass: never ran one, or the last began a day or more ago. */
export function isFullPassDue(lastFullPassAt: string | undefined, now: Date): boolean {
  if (!lastFullPassAt) return true
  const t = Date.parse(lastFullPassAt)
  return !Number.isFinite(t) || now.getTime() - t >= FULL_PASS_EVERY_MS
}

/** Members not in the remembered set: new, or changed since they were last pushed. */
export function pendingMembers(members: PlannedMember[], sent: ReadonlySet<string>): PlannedMember[] {
  return members.filter((m) => !sent.has(fingerprint(m)))
}

/** Same-tag-set members in chunks of PUSH_CHUNK; one request each. */
export function pushRequests(members: PlannedMember[]): Array<{ tags: string[]; members: PlannedMember[] }> {
  const groups = new Map<string, { tags: string[]; members: PlannedMember[] }>()
  for (const m of members) {
    const tags = [...m.tags].sort()
    const key = tags.join("|")
    const g = groups.get(key) ?? { tags, members: [] }
    g.members.push(m)
    groups.set(key, g)
  }
  const out: Array<{ tags: string[]; members: PlannedMember[] }> = []
  for (const g of groups.values()) {
    for (let i = 0; i < g.members.length; i += PUSH_CHUNK) {
      out.push({ tags: g.tags, members: g.members.slice(i, i + PUSH_CHUNK) })
    }
  }
  return out
}

export type PushFn = (
  members: MailchimpPushMember[],
  tags: string[],
) => Promise<{ newMembers: number; updatedMembers: number; errors: Array<{ email: string }> }>

export interface DrainResult {
  attempted: number
  newMembers: number
  updatedMembers: number
  errors: number
  /** Members left for the next run because the time budget ran out. */
  deferred: number
  /** Fingerprints of members Mailchimp accepted this run. */
  accepted: string[]
}

/**
 * Sends the pending members, one request at a time, until done or until the
 * budget is spent. A member Mailchimp reports an error for is not accepted, so
 * it is tried again next run.
 */
export async function drainPending(
  pending: PlannedMember[],
  push: PushFn,
  opts: { deadline: number; now?: () => number },
): Promise<DrainResult> {
  const now = opts.now ?? Date.now
  const res: DrainResult = { attempted: 0, newMembers: 0, updatedMembers: 0, errors: 0, deferred: 0, accepted: [] }
  const requests = pushRequests(pending)
  for (let i = 0; i < requests.length; i++) {
    if (now() >= opts.deadline) {
      res.deferred = requests.slice(i).reduce((n, r) => n + r.members.length, 0)
      break
    }
    const { tags, members } = requests[i]
    const r = await push(
      members.map(({ email, firstName, lastName }) => ({ email, firstName, lastName })),
      tags,
    )
    res.attempted += members.length
    res.newMembers += r.newMembers
    res.updatedMembers += r.updatedMembers
    res.errors += r.errors.length
    const failed = new Set(r.errors.map((e) => e.email.trim().toLowerCase()))
    for (const m of members) if (!failed.has(m.email.trim().toLowerCase())) res.accepted.push(fingerprint(m))
  }
  return res
}

/**
 * The set to remember after a run: what was remembered and is still current,
 * plus what was accepted now. Fingerprints of members no longer in the plan
 * (changed, removed, now suppressed) drop out.
 */
export function nextSentSet(
  members: PlannedMember[],
  previouslySent: ReadonlySet<string>,
  accepted: string[],
): string[] {
  const current = new Set(members.map(fingerprint))
  const out = new Set<string>()
  for (const f of previouslySent) if (current.has(f)) out.add(f)
  for (const f of accepted) if (current.has(f)) out.add(f)
  return [...out].sort()
}
