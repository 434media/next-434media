import { tagsForSource, type Brand } from "./mailchimp-tags"
import { mailchimpTagsFromInternal } from "./tag-taxonomy"
import type { FirestoreEmailSignup } from "./firestore-email-signups"
import type { EventRegistration } from "./firestore-event-registrations"

// Phase 2 of the alignment plan — the consent policy, in one place.
//
// `mailchimpIntentFor*` decides whether a Firestore audience record should be
// auto-synced to Mailchimp, and as what. The rule is consent, never tagging
// (tags are deterministic). Non-consented records return include:false and are
// NEVER pushed — not even as transactional — so the gray zone can't regrow.
//
// Only ever produces status "subscribed": there is no consent signal that maps
// to any other marketable status, and skip is expressed via include:false.

export interface MailchimpIntent {
  include: boolean
  email: string
  status: "subscribed"
  tags: string[]
  firstName?: string
  lastName?: string
  /** Human-readable why — surfaced in the dry-run report for transparency. */
  reason: string
}

function skip(email: string, reason: string): MailchimpIntent {
  return { include: false, email, status: "subscribed", tags: [], reason }
}

// email_signups `source` → canonical brand. Unknown sources fall back to the
// parent 434media brand.
const SIGNUP_SOURCE_TO_BRAND: Record<string, Brand> = {
  "434media": "434media",
  sdoh: "sdoh",
  txmx: "txmx",
  aim: "aim",
}

/**
 * Newsletter/email signups. Presence is opt-in, EXCEPT the SDOH Impact Report
 * lead magnet: a download only carries newsletter consent when the visitor also
 * ticked the box — a decision the capture route already made and pushed inline.
 * The Firestore record doesn't persist that flag, so the engine conservatively
 * skips this source and lets inline push own it.
 */
export function mailchimpIntentForEmailSignup(s: FirestoreEmailSignup): MailchimpIntent {
  const email = (s.email || "").toLowerCase().trim()
  if (!email) return skip(email, "no email")

  const src = (s.source || "").toLowerCase()
  if (src.includes("impact-report")) {
    return skip(email, "lead-magnet download (consent owned by inline push)")
  }

  const brand = SIGNUP_SOURCE_TO_BRAND[src] ?? "434media"
  return {
    include: true,
    email,
    status: "subscribed",
    tags: tagsForSource("email_signups", { brand }),
    reason: `newsletter signup (${s.source || "unknown"})`,
  }
}

/**
 * Event registrations. Registering for an event is NOT marketing consent — only
 * the explicit "keep me updated" opt-in (`subscribeToFeed` / the underlying
 * optInForUpdates) is. Tags come from the internal→canonical lean bridge.
 */
export function mailchimpIntentForEventRegistration(r: EventRegistration): MailchimpIntent {
  const email = (r.email || "").toLowerCase().trim()
  if (!email) return skip(email, "no email")
  if (!r.subscribeToFeed) return skip(email, "event registrant did not opt in")

  return {
    include: true,
    email,
    status: "subscribed",
    tags: mailchimpTagsFromInternal(r.tags),
    firstName: r.firstName || undefined,
    lastName: r.lastName || undefined,
    reason: `event registrant opted in (${r.eventName || r.event})`,
  }
}
