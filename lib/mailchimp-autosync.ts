import { getDefaultAudienceId } from "./mailchimp-config"
import { getEmailSignups } from "./firestore-email-signups"
import { getEventRegistrations } from "./firestore-event-registrations"
import { pushMembersToMailchimp } from "./mailchimp-analytics"
import {
  mailchimpIntentForEmailSignup,
  mailchimpIntentForEventRegistration,
  type MailchimpIntent,
} from "./mailchimp-intent"
import { getSuppressedEmails } from "./firestore-suppression"
import { getMailchimpRemoved, markMailchimpRemoved } from "./firestore-mailchimp-removed"
import { readMailchimpPushState, writeMailchimpPushState } from "./firestore-mailchimp-push-state"
import {
  PUSH_BUDGET_MS,
  cleanMergeText,
  drainPending,
  isFullPassDue,
  nextSentSet,
  pendingMembers,
  stillRemoved,
  type ErrorReason,
  type PlannedMember,
} from "./mailchimp-push-plan"

// Phase 2 of the alignment plan — the Firestore → Mailchimp auto-sync engine.
//
// Gathers consent-bearing audience records (via the intent policy), dedupes +
// merges canonical tags by email, and batch-upserts them into the one Mailchimp
// audience. The opposite direction from the daily Mailchimp → Firestore
// `mailchimp-sync` cron; both run independently.
//
// Idempotent: pushMembersToMailchimp uses update_existing + status_if_new, so
// re-upserting never changes an existing member's status (no resurrection of
// unsubscribed/cleaned) — only brand-new emails get `subscribed`.
//
// Incremental (founder, 2026-11-17): each run sends only members that are new
// or changed since the last successful push, and once a day every member again,
// within a time budget (lib/mailchimp-push-plan.ts). Pushing the whole list
// every hour had outgrown the function's time limit.

export interface AutoSyncResult {
  dryRun: boolean
  audienceId: string
  considered: { emailSignups: number; eventRegistrations: number }
  included: number
  skipped: number
  /** Consent-bearing contacts excluded because they're on the suppression list. */
  excludedSuppressed: number
  /**
   * Contacts skipped because Mailchimp permanently deleted them or judged the address invalid
   * (lib/firestore-mailchimp-removed.ts). Counted in `uniqueContacts`, never pushed.
   */
  excludedRemoved: number
  /** Unique contacts after dedupe across sources. */
  uniqueContacts: number
  /** Members grouped by identical canonical tag-set (one push per group). */
  groups: Array<{ tags: string[]; count: number }>
  /** Per-canonical-tag contact counts (what the sync would apply). */
  byTag: Record<string, number>
  /** A few example skips with reasons, for dry-run transparency. */
  sampleSkips: Array<{ email: string; reason: string }>
  /** This run started the daily full pass (every member is pending again). */
  fullPass: boolean
  /** Members new or changed since the last successful push: what this run sends. */
  pending: number
  /** Present only on a live (non-dry-run) pass. `deferred` carry over to the next run. */
  push?: {
    attempted: number
    newMembers: number
    updatedMembers: number
    errors: number
    /** Errors by Mailchimp error code (and merge field, when named), with one redacted example each. */
    errorReasons: ErrorReason[]
    deferred: number
    /** Addresses refused as permanently deleted this run, now marked and skipped from the next run on. */
    markedRemoved: number
    /** Addresses refused as fake or invalid this run, now marked and skipped until the address changes. */
    markedInvalid: number
    /** Members refused for a stale Source value (434Media, Website) and accepted with it set to 434MEDIA. */
    sourceFixed: number
  }
}

/**
 * Run one reconciliation pass. DRY-RUN BY DEFAULT — computes and returns the
 * full plan without writing to Mailchimp. Pass { dryRun: false } to execute.
 */
export async function runAutoSync(
  opts: { dryRun?: boolean; startedAt?: Date } = {},
): Promise<AutoSyncResult> {
  const dryRun = opts.dryRun ?? true
  const startedAt = opts.startedAt ?? new Date()
  const audienceId = getDefaultAudienceId()
  if (!audienceId) throw new Error("No Mailchimp audience configured")

  const [signups, regs, suppressed, removed, state] = await Promise.all([
    getEmailSignups(),
    getEventRegistrations(),
    getSuppressedEmails(),
    getMailchimpRemoved(),
    readMailchimpPushState(),
  ])

  const intents: MailchimpIntent[] = [
    ...signups.map(mailchimpIntentForEmailSignup),
    ...regs.map(mailchimpIntentForEventRegistration),
  ]

  const consentBearing = intents.filter((i) => i.include && i.email)
  // Honor broadcast opt-outs: a suppressed email is never pushed to Mailchimp —
  // even one that never became a member — so an unsubscribe can't be silently
  // undone by a later sync re-adding them as subscribed.
  const included = consentBearing.filter((i) => !suppressed.has(i.email))
  const excludedSuppressed = consentBearing.length - included.length
  const skippedCount = intents.length - consentBearing.length

  // Dedupe + merge canonical tags by email (a person in both newsletter and an
  // event gets the union of their tags, pushed once).
  // Names go through cleanMergeText, so a value Mailchimp's text merge fields refuse (over-long, control
  // characters, blank) is corrected or left out rather than refused.
  const merged = new Map<
    string,
    { email: string; tags: Set<string>; firstName?: string; lastName?: string; consentAt?: string }
  >()
  const later = (a?: string, b?: string) => (!a ? b : !b ? a : Date.parse(b) > Date.parse(a) ? b : a)
  for (const i of included) {
    const cur = merged.get(i.email)
    if (cur) {
      i.tags.forEach((t) => cur.tags.add(t))
      cur.firstName ??= cleanMergeText(i.firstName)
      cur.lastName ??= cleanMergeText(i.lastName)
      cur.consentAt = later(cur.consentAt, i.consentAt)
    } else {
      merged.set(i.email, {
        email: i.email,
        tags: new Set(i.tags),
        firstName: cleanMergeText(i.firstName),
        lastName: cleanMergeText(i.lastName),
        consentAt: i.consentAt,
      })
    }
  }

  // Group by identical tag-set, for the report. The push itself groups only
  // the pending members (lib/mailchimp-push-plan.ts).
  const groups = new Map<string, { tags: string[]; count: number }>()
  const byTag: Record<string, number> = {}
  const planned: PlannedMember[] = []
  let excludedRemoved = 0
  for (const m of merged.values()) {
    // Mailchimp permanently deleted this address, or judged it invalid: skip it on every pass, the full pass
    // included, until the person gives consent again after a deletion was recorded (never, for an invalid one).
    const mark = removed.get(m.email)
    if (mark !== undefined && stillRemoved(mark.removedAt, m.consentAt, mark.reason)) {
      excludedRemoved++
      continue
    }
    const tags = [...m.tags].sort()
    for (const t of tags) byTag[t] = (byTag[t] ?? 0) + 1
    const key = tags.join("|")
    const g = groups.get(key) ?? { tags, count: 0 }
    g.count++
    groups.set(key, g)
    planned.push({
      email: m.email,
      ...(m.firstName ? { firstName: m.firstName } : {}),
      ...(m.lastName ? { lastName: m.lastName } : {}),
      tags,
    })
  }

  const fullPass = isFullPassDue(state.lastFullPassAt, startedAt)
  const remembered = fullPass ? new Set<string>() : state.sent
  const pending = pendingMembers(planned, remembered)

  const result: AutoSyncResult = {
    dryRun,
    audienceId,
    considered: { emailSignups: signups.length, eventRegistrations: regs.length },
    included: included.length,
    skipped: skippedCount,
    excludedSuppressed,
    excludedRemoved,
    uniqueContacts: merged.size,
    groups: [...groups.values()].sort((a, b) => b.count - a.count),
    byTag,
    sampleSkips: intents
      .filter((i) => !i.include)
      .slice(0, 10)
      .map((i) => ({ email: i.email || "(blank)", reason: i.reason })),
    fullPass,
    pending: pending.length,
  }

  if (!dryRun) {
    const drained = await drainPending(
      pending,
      (members, tags) => pushMembersToMailchimp(audienceId, members, "subscribed", tags),
      { deadline: startedAt.getTime() + PUSH_BUDGET_MS },
    )
    // Record permanent refusals before the state, so a failed state write never loses them.
    if (drained.removed.length) await markMailchimpRemoved(drained.removed, new Date().toISOString())
    await writeMailchimpPushState({
      sent: nextSentSet(planned, remembered, drained.accepted),
      lastFullPassAt: fullPass ? startedAt.toISOString() : state.lastFullPassAt!,
      updatedAt: new Date().toISOString(),
      pending: drained.deferred + drained.retryable,
    })
    const { attempted, newMembers, updatedMembers, errors, reasons, deferred } = drained
    result.push = {
      attempted,
      newMembers,
      updatedMembers,
      errors,
      errorReasons: reasons,
      deferred,
      markedRemoved: new Set(drained.removed.filter((r) => r.reason === "permanently_deleted").map((r) => r.email)).size,
      markedInvalid: new Set(drained.removed.filter((r) => r.reason === "invalid_address").map((r) => r.email)).size,
      sourceFixed: drained.sourceFixed,
    }
  }

  return result
}
