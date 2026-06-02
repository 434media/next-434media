import { getDefaultAudienceId } from "./mailchimp-config"
import { getEmailSignups } from "./firestore-email-signups"
import { getEventRegistrations } from "./firestore-event-registrations"
import { pushMembersToMailchimp, type MailchimpPushMember } from "./mailchimp-analytics"
import {
  mailchimpIntentForEmailSignup,
  mailchimpIntentForEventRegistration,
  type MailchimpIntent,
} from "./mailchimp-intent"

// Phase 2 of the alignment plan — the Firestore → Mailchimp auto-sync engine.
//
// Gathers consent-bearing audience records (via the intent policy), dedupes +
// merges canonical tags by email, and batch-upserts them into the one Mailchimp
// audience. The opposite direction from the daily Mailchimp → Firestore
// `mailchimp-sync` cron; both run independently.
//
// Stateless and idempotent: pushMembersToMailchimp uses update_existing +
// status_if_new, so re-upserting never changes an existing member's status
// (no resurrection of unsubscribed/cleaned) — only brand-new emails get
// `subscribed`. Tags refresh harmlessly each run.

interface SyncGroup {
  tags: string[]
  members: MailchimpPushMember[]
}

export interface AutoSyncResult {
  dryRun: boolean
  audienceId: string
  considered: { emailSignups: number; eventRegistrations: number }
  included: number
  skipped: number
  /** Unique contacts after dedupe across sources. */
  uniqueContacts: number
  /** Members grouped by identical canonical tag-set (one push per group). */
  groups: Array<{ tags: string[]; count: number }>
  /** Per-canonical-tag contact counts (what the sync would apply). */
  byTag: Record<string, number>
  /** A few example skips with reasons, for dry-run transparency. */
  sampleSkips: Array<{ email: string; reason: string }>
  /** Present only on a live (non-dry-run) pass. */
  push?: { attempted: number; newMembers: number; updatedMembers: number; errors: number }
}

/**
 * Run one reconciliation pass. DRY-RUN BY DEFAULT — computes and returns the
 * full plan without writing to Mailchimp. Pass { dryRun: false } to execute.
 */
export async function runAutoSync(opts: { dryRun?: boolean } = {}): Promise<AutoSyncResult> {
  const dryRun = opts.dryRun ?? true
  const audienceId = getDefaultAudienceId()
  if (!audienceId) throw new Error("No Mailchimp audience configured")

  const [signups, regs] = await Promise.all([getEmailSignups(), getEventRegistrations()])

  const intents: MailchimpIntent[] = [
    ...signups.map(mailchimpIntentForEmailSignup),
    ...regs.map(mailchimpIntentForEventRegistration),
  ]

  const included = intents.filter((i) => i.include && i.email)
  const skippedCount = intents.length - included.length

  // Dedupe + merge canonical tags by email (a person in both newsletter and an
  // event gets the union of their tags, pushed once).
  const merged = new Map<
    string,
    { email: string; tags: Set<string>; firstName?: string; lastName?: string }
  >()
  for (const i of included) {
    const cur = merged.get(i.email)
    if (cur) {
      i.tags.forEach((t) => cur.tags.add(t))
      cur.firstName ??= i.firstName
      cur.lastName ??= i.lastName
    } else {
      merged.set(i.email, {
        email: i.email,
        tags: new Set(i.tags),
        firstName: i.firstName,
        lastName: i.lastName,
      })
    }
  }

  // Group by identical tag-set. pushMembersToMailchimp applies one tags[] per
  // call, so each distinct tag-set is its own batch.
  const groups = new Map<string, SyncGroup>()
  const byTag: Record<string, number> = {}
  for (const m of merged.values()) {
    const tags = [...m.tags].sort()
    for (const t of tags) byTag[t] = (byTag[t] ?? 0) + 1
    const key = tags.join("|")
    const g = groups.get(key) ?? { tags, members: [] }
    g.members.push({ email: m.email, firstName: m.firstName, lastName: m.lastName })
    groups.set(key, g)
  }

  const result: AutoSyncResult = {
    dryRun,
    audienceId,
    considered: { emailSignups: signups.length, eventRegistrations: regs.length },
    included: included.length,
    skipped: skippedCount,
    uniqueContacts: merged.size,
    groups: [...groups.values()]
      .map((g) => ({ tags: g.tags, count: g.members.length }))
      .sort((a, b) => b.count - a.count),
    byTag,
    sampleSkips: intents
      .filter((i) => !i.include)
      .slice(0, 10)
      .map((i) => ({ email: i.email || "(blank)", reason: i.reason })),
  }

  if (!dryRun) {
    let newMembers = 0
    let updatedMembers = 0
    let errors = 0
    let attempted = 0
    for (const g of groups.values()) {
      attempted += g.members.length
      const r = await pushMembersToMailchimp(audienceId, g.members, "subscribed", g.tags)
      newMembers += r.newMembers
      updatedMembers += r.updatedMembers
      errors += r.errors.length
    }
    result.push = { attempted, newMembers, updatedMembers, errors }
  }

  return result
}
