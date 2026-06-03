import { getEmailSignups } from "./firestore-email-signups"
import { getEventRegistrations } from "./firestore-event-registrations"
import {
  mailchimpIntentForEmailSignup,
  mailchimpIntentForEventRegistration,
  type MailchimpIntent,
} from "./mailchimp-intent"
import { getMailchimpSubscriberMap } from "./mailchimp-analytics"
import { getSuppressedEmails } from "./firestore-suppression"
import { listPartnerListMembers } from "./firestore-partner-list-members"
import { BROADCAST_AUDIENCES } from "./broadcast-audiences"

// Recipient builder for a branded broadcast (Phase 2).
//
// Reuses the auto-sync consent-intent logic to gather opted-in contacts, keeps
// only those matching the selected audiences, dedupes by email, then EXCLUDES
// anyone unsubscribed/cleaned in Mailchimp or on the suppression list — so a
// broadcast can never reach a non-consented or opted-out contact, and consent
// stays single-sourced in Mailchimp.
//
// Partner-list members are COLD by default: they're tagged `partner:<slug>` and
// only reach the matching stage if a BROADCAST_AUDIENCES selector exists for
// that partner (added only after the partner confirms opt-in). The Mailchimp
// opt-out + suppression exclusions still apply to them, so an unsubscribe is
// always honored.

export interface BroadcastRecipient {
  email: string
  firstName?: string
  /** Which selected audience ids this recipient matched. */
  audiences: string[]
}

export interface BroadcastGatherResult {
  recipients: BroadcastRecipient[]
  stats: {
    consideredSignups: number
    consideredEvents: number
    /** Unique opted-in contacts matching the selected audiences (pre-exclusion). */
    matchedUnique: number
    excludedUnsubscribed: number
    excludedSuppressed: number
    finalCount: number
    /** Final recipient count per selected audience (overlaps counted in each). */
    perAudience: Record<string, number>
  }
}

export async function gatherBroadcastRecipients(
  selectedIds: string[],
): Promise<BroadcastGatherResult> {
  const selectors = BROADCAST_AUDIENCES.filter((a) => selectedIds.includes(a.id))

  const [signups, regs, members, mcMap, suppressed] = await Promise.all([
    getEmailSignups(),
    getEventRegistrations(),
    listPartnerListMembers({}),
    getMailchimpSubscriberMap().catch(() => null),
    getSuppressedEmails(),
  ])

  // Partner members → intents tagged `partner:<slug>`. Cold by default: an
  // intent only survives audience matching if a selector exists for its
  // partner (gated above), so this can't email a partner that hasn't opted in.
  const memberIntents: MailchimpIntent[] = members
    .filter((m) => m.email)
    .map((m) => ({
      include: true,
      email: m.email.toLowerCase().trim(),
      status: "subscribed",
      tags: [`partner:${m.partnerSlug}`],
      firstName: m.firstName || undefined,
      reason: `partner list member (${m.partnerName || m.partnerSlug})`,
    }))

  const intents = [
    ...signups.map(mailchimpIntentForEmailSignup),
    ...regs.map(mailchimpIntentForEventRegistration),
    ...memberIntents,
  ].filter((i) => i.include && i.email)

  // Mailchimp opt-outs (unsubscribed / cleaned) — honored as the consent ledger.
  const optedOut = new Set<string>()
  if (mcMap?.byEmail) {
    for (const [email, entry] of Object.entries(mcMap.byEmail)) {
      const memberships = (entry as { memberships?: Array<{ status?: string }> }).memberships ?? []
      if (memberships.some((m) => m.status === "unsubscribed" || m.status === "cleaned")) {
        optedOut.add(email.toLowerCase())
      }
    }
  }

  // Match to selected audiences + dedupe by email (merge audiences, keep name).
  const merged = new Map<string, BroadcastRecipient>()
  for (const i of intents) {
    const matchedAudiences = selectors.filter((s) => s.match(i.tags)).map((s) => s.id)
    if (matchedAudiences.length === 0) continue
    const cur = merged.get(i.email)
    if (cur) {
      for (const a of matchedAudiences) if (!cur.audiences.includes(a)) cur.audiences.push(a)
      cur.firstName ??= i.firstName
    } else {
      merged.set(i.email, { email: i.email, firstName: i.firstName, audiences: [...matchedAudiences] })
    }
  }

  let excludedUnsubscribed = 0
  let excludedSuppressed = 0
  const recipients: BroadcastRecipient[] = []
  for (const r of merged.values()) {
    if (optedOut.has(r.email)) {
      excludedUnsubscribed++
      continue
    }
    if (suppressed.has(r.email)) {
      excludedSuppressed++
      continue
    }
    recipients.push(r)
  }

  const perAudience: Record<string, number> = {}
  for (const r of recipients) for (const a of r.audiences) perAudience[a] = (perAudience[a] ?? 0) + 1

  return {
    recipients,
    stats: {
      consideredSignups: signups.length,
      consideredEvents: regs.length,
      matchedUnique: merged.size,
      excludedUnsubscribed,
      excludedSuppressed,
      finalCount: recipients.length,
      perAudience,
    },
  }
}
