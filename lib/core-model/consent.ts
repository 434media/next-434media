// Consent lives on the Person (spec rule 2): channel, granted when and from which source, plus suppression.
// Form submitters asked to hear from us; prospects did not. Every send checks it here, in one place.
// Suppression itself stays in `email_suppression` (lib/firestore-suppression.ts) and is passed in, so a
// suppressed address is never emailable whatever its consent says.

import type { ChannelConsent, CoreSource, Person, PersonConsent } from "@/types/core-model"

/** The email consent a first touch from `source` carries. */
export function consentFromSource(source: CoreSource, at: string): PersonConsent {
  return { email: emailConsentFromSource(source, at) }
}

export function emailConsentFromSource(source: CoreSource, at: string): ChannelConsent {
  switch (source) {
    case "web":
      return { status: "granted", basis: "requested_contact", source, at }
    case "newsletter":
      return { status: "granted", basis: "subscribed", source, at }
    case "event":
      return { status: "granted", basis: "registered", source, at }
    // Prospected and partner-list people never asked to hear from us; an address-book entry, a hand-entered
    // record, a referral or a social signal carries no consent either until the person gives it.
    default:
      return { status: "none", basis: "none", source, at: "" }
  }
}

/**
 * Consent when a known Person arrives again. Consent once granted is kept (with its original source and
 * time); a withdrawal is never overwritten by a later arrival; `none` is upgraded when the new source grants.
 */
export function mergeConsent(current: PersonConsent, incoming: PersonConsent): PersonConsent {
  const cur = current.email
  const inc = incoming.email
  if (cur.status === "withdrawn") return current
  if (cur.status === "granted") return current
  return inc.status === "granted" ? { email: inc } : current
}

/** The one check every email send makes. Suppression wins over everything. */
export function canEmail(person: Pick<Person, "consent">, suppressed: boolean): { allowed: boolean; reason: string } {
  if (suppressed) return { allowed: false, reason: "The address is suppressed (unsubscribed, bounced or complained)." }
  const c = person.consent.email
  if (c.status === "granted") return { allowed: true, reason: `Consent: ${c.basis} via ${c.source}.` }
  if (c.status === "withdrawn") return { allowed: false, reason: "Consent was withdrawn." }
  return { allowed: false, reason: `No consent: first touch was "${c.source}".` }
}

/** Read stored consent defensively, defaulting to what the source implies. */
export function normalizeConsent(raw: unknown, source: CoreSource, fallbackAt: string): PersonConsent {
  const email = (raw as { email?: Partial<ChannelConsent> } | null)?.email
  if (email && (email.status === "granted" || email.status === "none" || email.status === "withdrawn")) {
    return {
      email: {
        status: email.status,
        basis: (email.basis as ChannelConsent["basis"]) || (email.status === "granted" ? "requested_contact" : email.status),
        source: (email.source as CoreSource) || source,
        at: typeof email.at === "string" ? email.at : "",
      },
    }
  }
  return consentFromSource(source, fallbackAt)
}
