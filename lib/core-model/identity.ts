// The duplicate rule (spec rule 1): a Person is matched by email and an Organization by website domain.
// Matching only: nothing here merges. A merge is an explicit, logged action (lib/core-model/service.ts).

/** Trimmed, lower-case; empty when it is not an address. */
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return ""
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ""
}

/**
 * Mailbox providers whose domain says nothing about the company. An address on one of these never makes or
 * matches an Organization.
 */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "att.net",
  "sbcglobal.net",
  "comcast.net",
  "verizon.net",
  "charter.net",
  "cox.net",
  "hey.com",
  "fastmail.com",
])

/** A host as an Organization domain: lower-case, no `www.`, no port. Empty when unusable. */
export function normalizeDomain(value: unknown): string {
  if (typeof value !== "string") return ""
  let host = value.trim().toLowerCase()
  if (!host) return ""
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname
    } catch {
      return ""
    }
  } else {
    host = host.split(/[/?#]/)[0]
  }
  host = host.replace(/:\d+$/, "").replace(/^www\./, "").replace(/\.$/, "")
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : ""
}

/** The company domain an email implies, or empty for a free-mail or unusable address. */
export function domainFromEmail(email: unknown): string {
  const normalized = normalizeEmail(email)
  if (!normalized) return ""
  const domain = normalizeDomain(normalized.split("@")[1])
  return domain && !FREE_MAIL_DOMAINS.has(domain) ? domain : ""
}

/** The Organization domain from a website, else from an email. */
export function organizationDomain(input: { website?: unknown; email?: unknown }): string {
  const fromSite = normalizeDomain(input.website)
  if (fromSite && !FREE_MAIL_DOMAINS.has(fromSite)) return fromSite
  return domainFromEmail(input.email)
}

/** A key for an Organization with no domain: its name, folded. Used only to group read-time records. */
export function organizationNameKey(name: unknown): string {
  if (typeof name !== "string") return ""
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|company|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** The Person in `people` holding this email, if any. Merged-away records never match. */
export function matchPerson<T extends { emails: string[]; merged_into?: string }>(
  people: T[],
  email: unknown,
): T | undefined {
  const key = normalizeEmail(email)
  if (!key) return undefined
  return people.find((p) => !p.merged_into && p.emails.includes(key))
}

/** The Organization in `orgs` on this domain, if any. */
export function matchOrganization<T extends { domain?: string; merged_into?: string }>(
  orgs: T[],
  domain: unknown,
): T | undefined {
  const key = normalizeDomain(domain)
  if (!key) return undefined
  return orgs.find((o) => !o.merged_into && o.domain === key)
}

/** First and last name from one display name. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}
