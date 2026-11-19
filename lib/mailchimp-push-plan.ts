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

/**
 * One member Mailchimp did not take. `code` is Mailchimp's error_code, or "request_failed" when the whole request
 * failed. `field` and `fieldMessage` are the merge field a merge-field refusal names, when Mailchimp says which.
 */
export interface PushError {
  email: string
  code?: string
  message?: string
  field?: string
  fieldMessage?: string
}

export type PushFn = (
  members: MailchimpPushMember[],
  tags: string[],
) => Promise<{ newMembers: number; updatedMembers: number; errors: PushError[] }>

/**
 * Errors worth retrying on the next hourly run: the request itself failed, so
 * Mailchimp never judged the member. Any other error is Mailchimp rejecting the
 * member (an invalid or forgotten address, a compliance state), which the same
 * data will hit again every hour; those wait for the member to change or for the
 * daily full pass.
 */
export const RETRYABLE_ERROR_CODES: ReadonlySet<string> = new Set(["request_failed"])

/** Error counts by code (and merge field, when one is named), with one example message (addresses removed), for the run log. */
export interface ErrorReason {
  code: string
  /** The merge field Mailchimp named, e.g. "FNAME". Absent when the refusal names none. */
  field?: string
  count: number
  sample: string
}

/**
 * Mailchimp's refusal of an address it permanently deleted (2026-11-18: 61 a full pass). It will not take the
 * address back through the API; the person must re-subscribe. The batch call says "was permanently deleted and
 * cannot be re-imported"; the single-member call titles it "Forgotten Email Not Subscribed".
 */
export function isPermanentlyDeletedRefusal(message: string | undefined): boolean {
  return !!message && /permanently deleted|forgotten email/i.test(message)
}

/**
 * Whether an address Mailchimp permanently deleted is still to be skipped. It stays skipped until the person gives
 * consent again after the refusal was recorded: a consent record (signup or opted-in registration) dated later.
 * A missing or unreadable date never clears the mark.
 */
export function stillRemoved(removedAt: string, latestConsentAt: string | undefined): boolean {
  const r = Date.parse(removedAt)
  const c = latestConsentAt ? Date.parse(latestConsentAt) : NaN
  if (!Number.isFinite(c)) return true
  return !Number.isFinite(r) || c <= r
}

/** Mailchimp's limit for a text merge field. */
export const MERGE_TEXT_MAX = 255

/**
 * A name as a text merge field takes it: a string, control characters removed, whitespace collapsed, at most
 * MERGE_TEXT_MAX characters. Empty becomes undefined, so the field is left out rather than sent blank.
 */
export function cleanMergeText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  return s ? [...s].slice(0, MERGE_TEXT_MAX).join("") : undefined
}

/** Removes email addresses from a message so it can go in a log. */
export function redactEmails(text: string): string {
  return text.replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+\.[a-z]{2,}/gi, "<email>")
}

export interface DrainResult {
  attempted: number
  newMembers: number
  updatedMembers: number
  errors: number
  /** Of `errors`, those retried next run (RETRYABLE_ERROR_CODES). */
  retryable: number
  /** `errors` grouped by code, most frequent first. */
  reasons: ErrorReason[]
  /** Members left for the next run because the time budget ran out. */
  deferred: number
  /** Fingerprints not to send again until they change: accepted, or rejected for a reason a retry won't fix. */
  accepted: string[]
  /** Addresses Mailchimp refused as permanently deleted (isPermanentlyDeletedRefusal), lowercased. */
  removed: string[]
}

/**
 * Sends the pending members, one request at a time, until done or until the
 * budget is spent. A member whose request failed is tried again next run; a
 * member Mailchimp rejected is not, until it changes or the daily full pass.
 */
export async function drainPending(
  pending: PlannedMember[],
  push: PushFn,
  opts: { deadline: number; now?: () => number },
): Promise<DrainResult> {
  const now = opts.now ?? Date.now
  const res: DrainResult = {
    attempted: 0,
    newMembers: 0,
    updatedMembers: 0,
    errors: 0,
    retryable: 0,
    reasons: [],
    deferred: 0,
    accepted: [],
    removed: [],
  }
  const reasons = new Map<string, ErrorReason>()
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
    const retry = new Set<string>()
    for (const e of r.errors) {
      const code = e.code || "unknown"
      if (RETRYABLE_ERROR_CODES.has(code)) {
        retry.add(e.email.trim().toLowerCase())
        res.retryable++
      }
      if (isPermanentlyDeletedRefusal(e.message)) res.removed.push(e.email.trim().toLowerCase())
      const field = e.field?.trim() || undefined
      const key = field ? `${code}|${field}` : code
      const text = [e.message ?? "", e.fieldMessage ?? ""].filter(Boolean).join(" ")
      const reason = reasons.get(key) ?? { code, ...(field ? { field } : {}), count: 0, sample: redactEmails(text).slice(0, 200) }
      reason.count++
      reasons.set(key, reason)
    }
    for (const m of members) if (!retry.has(m.email.trim().toLowerCase())) res.accepted.push(fingerprint(m))
  }
  res.reasons = [...reasons.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code) || (a.field ?? "").localeCompare(b.field ?? ""))
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
