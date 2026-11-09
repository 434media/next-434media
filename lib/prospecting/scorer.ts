import type { ApolloPerson, ApolloSearchFilters } from "./apollo"
import type { IcpGrade, IcpFitBreakdown } from "@/types/crm-types"
import { scoreIcpFit } from "@/lib/icp/rubric"
import type { CohortHit, CohortLike } from "./cohort-match"

/**
 * Stage 3 — ICP scorer (prospecting path).
 *
 * Company FIT is delegated to the canonical rubric (lib/icp/rubric.ts), so a
 * prospect's score is the SAME 0–100 fit + grade the lead carries downstream
 * (Step 2 — one score everywhere). This file owns the prospecting-only
 * concerns:
 *   - the hard jurisdiction exclusion: cold outbound is US-only (master 5.3),
 *     so a candidate with any non-US or unreadable country → score -1
 *   (Agencies are no longer excluded: they are an outbound cohort — founder
 *   ruling 2026-10-08, the master over the old ICP doc.)
 *   - the contact qualifier (title) — a person-level signal, NOT company fit,
 *     so it's surfaced separately rather than folded into the fit score
 *   - the approve-into-queue threshold
 *
 * Free-plan obfuscation is handled by passing the search's locations to the
 * rubric as a location fallback. The search keyword is not passed: it describes
 * the search, not the candidate, so it never counts as the candidate's industry.
 * Industry is scored from the outbound cohorts (icp_cohorts).
 */

// ─── Configuration ──────────────────────────────────────────────────────

/**
 * Default fit threshold for "approve into queue" decisions, on the 0–100 fit
 * scale (60 = grade C, the prospecting approve bar). Configurable via
 * PROSPECTING_FIT_THRESHOLD. The funnel's *quality*-match bar is higher (70 / B).
 */
export const DEFAULT_FIT_THRESHOLD = Number(process.env.PROSPECTING_FIT_THRESHOLD) || 60

// ─── Hard exclusions ────────────────────────────────────────────────────
//
// Jurisdiction is the only hard exclusion. Agencies used to be one (an
// org-name pattern match on agencies, PR and advertising firms, as competitors
// per the ICP doc, now lib/prospecting/icp-base.md). The master's outbound cohorts name agencies as production
// clients, so the founder ruled on 2026-10-08 that the master wins and the
// agency exclusion is removed (next-434media#63, cohort E).

// ─── Jurisdiction: cold outbound is US-only (master 5.3) ────────────────
//
// "Cold outbound is sent only to prospects in the United States." The
// United States allow-list below is the single source of truth for that rule
// in code, and it fails closed: a blank, unknown or unreadable country is
// blocked, never assumed to be American. Every cold surface (prospecting
// search, scoring, approval, 1:1 send-outreach, the outreach sequence) gates on
// `isColdOutreachAllowed` / `isColdLocationAllowed` / `coldOutreachGateForLead`
// rather than re-listing countries. Inbound and warm contacts are handled
// normally and are not gated (master 5.3); see `COLD_LEAD_SOURCES`.

/** The only jurisdiction cold outbound may reach (ISO 3166-1 alpha-2). */
export const COLD_OUTREACH_ALLOWED_COUNTRY = "US"

/**
 * Lead sources that are cold: the rep went out and found the contact, with no
 * prior intent toward 434. Every other `LeadSource` is warm or inbound and is
 * not jurisdiction-gated. "prospected" is the only source set by the Apollo
 * prospecting path (captureLeadFromProspecting in lib/firestore-leads.ts).
 */
export const COLD_LEAD_SOURCES: ReadonlySet<string> = new Set(["prospected"])

export interface JurisdictionCheck {
  allowed: boolean
  /** ISO 3166-1 alpha-2 of the jurisdiction the value resolved to, when it resolved. */
  country?: string
  /** Why it was allowed or blocked, in words a rep can act on. */
  reason: string
}

/** Lowercase, strip accents, dots and extra whitespace: " U.S.A. " → "usa", "España" → "espana". */
function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Ways of writing the United States that the runtime's region names don't cover. */
const US_ALIASES = [
  "us", "usa", "u s", "u s a", "united states", "united states of america",
  "the united states", "the united states of america", "america", "ee uu", "eeuu",
]

/** UK names that aren't ISO region names. All resolve to GB (blocked, like every non-US value). */
const GB_ALIASES = ["uk", "great britain", "britain", "england", "scotland", "wales", "northern ireland"]

/** Locales whose region names are recognised, so a native name ("Deutschland") resolves like an English one. */
const REGION_NAME_LOCALES = [
  "en", "de", "fr", "es", "it", "pt", "nl", "pl", "sv", "da", "nb", "fi", "cs", "sk", "hu", "ro",
  "bg", "el", "hr", "sl", "et", "lv", "lt", "ga", "mt", "is",
]

/** Not countries: "unknown" and supranational pseudo-regions. Region codes the runtime knows, less these and retired codes, are recognised. */
const PSEUDO_REGIONS = new Set(["ZZ", "EU", "EZ", "UN", "QO"])

const { REGION_CODES, PLACE_TO_CODE } = (() => {
  const codes = new Set<string>()
  const byName = new Map<string, string>()
  const en = new Intl.DisplayNames(["en"], { type: "region" })
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b)
      if (PSEUDO_REGIONS.has(code)) continue
      try {
        // Skip retired codes ("DD" East Germany, "YU"): they canonicalize to a live one.
        if (Intl.getCanonicalLocales(`und-${code}`)[0] !== `und-${code}`) continue
        const name = en.of(code)
        if (name && name !== code) codes.add(code)
      } catch {
        // not a region code
      }
    }
  }
  for (const locale of REGION_NAME_LOCALES) {
    const dn = new Intl.DisplayNames([locale], { type: "region" })
    for (const code of codes) {
      const name = dn.of(code)
      if (name && name !== code) {
        const key = normalizePlace(name)
        if (!byName.has(key)) byName.set(key, code)
      }
    }
  }
  for (const a of US_ALIASES) byName.set(a, "US")
  for (const a of GB_ALIASES) byName.set(a, "GB")
  return { REGION_CODES: codes, PLACE_TO_CODE: byName }
})()

/**
 * Resolve a country value to ISO 3166-1 alpha-2: an alpha-2 code ("DE"), the
 * United States' alpha-3 ("USA"), or an English or native name ("Germany",
 * "Deutschland"), in any case and spacing. Null when it can't be read.
 */
export function resolveCountryCode(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const key = normalizePlace(value)
  if (!key) return null
  const byName = PLACE_TO_CODE.get(key)
  if (byName) return byName
  const upper = key.toUpperCase()
  if (upper.length === 2 && REGION_CODES.has(upper)) return upper
  return null
}

function displayCountry(code: string): string {
  return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code
}

/**
 * The cold-outreach gate for a country value (a lead's or a contact's
 * country). Allowed only when it resolves to the United States; blank, unknown
 * and every other country are blocked.
 */
export function isColdOutreachAllowed(country: string | null | undefined): JurisdictionCheck {
  const raw = typeof country === "string" ? country.trim() : ""
  if (!raw) {
    return { allowed: false, reason: "No country on record, so the contact can't be confirmed as in the United States. Cold outbound is sent only to prospects in the United States." }
  }
  const code = resolveCountryCode(raw)
  if (!code) {
    return { allowed: false, reason: `Country "${raw}" can't be read as the United States. Cold outbound is sent only to prospects in the United States.` }
  }
  if (code !== COLD_OUTREACH_ALLOWED_COUNTRY) {
    return { allowed: false, country: code, reason: `Contact is in ${displayCountry(code)}. Cold outbound is sent only to prospects in the United States.` }
  }
  return { allowed: true, country: code, reason: "United States" }
}

/** The fifty states and DC, by name, for reading a free-text location such as "San Antonio, Texas". */
const US_STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", "washington dc": "DC", florida: "FL",
  georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
  kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
}

/**
 * State postal codes that can stand for the United States in a location. A
 * code that is also a country code ("CA" California / Canada, "DE" Delaware /
 * Germany) is left out: it can't be read either way, so it fails closed.
 */
const US_STATE_POSTAL = new Set(Object.values(US_STATES).filter((c) => !REGION_CODES.has(c)))

/**
 * The cold-outreach gate for a free-text location ("San Antonio, Texas, US",
 * "Texas", "Monterrey, Mexico"), read by its last comma-separated part. Allowed
 * when that part is the United States, a US state by name, or a state postal
 * code that isn't also a country code. Anything else, blank included, is
 * blocked. A state name wins over a country of the same name ("Georgia",
 * "New Mexico"), because a location's last part names a state far more often.
 */
export function isColdLocationAllowed(location: string | null | undefined): JurisdictionCheck {
  const raw = typeof location === "string" ? location.trim() : ""
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean)
  const last = parts[parts.length - 1]
  if (!last) {
    return { allowed: false, reason: "No location on record, so the contact can't be confirmed as in the United States. Cold outbound is sent only to prospects in the United States." }
  }
  const key = normalizePlace(last)
  if (US_STATES[key] || US_STATE_POSTAL.has(key.toUpperCase())) {
    return { allowed: true, country: COLD_OUTREACH_ALLOWED_COUNTRY, reason: "United States" }
  }
  const check = isColdOutreachAllowed(last)
  if (!check.allowed && !check.country) {
    return { allowed: false, reason: `Location "${raw}" can't be read as the United States. Cold outbound is sent only to prospects in the United States.` }
  }
  return check
}

/**
 * Whether a search location falls outside what cold outbound may reach. The
 * translator drops such locations from Apollo filters, and searches the United
 * States when none remain. Fails closed: an unreadable location is outside.
 */
export function isOutsideUnitedStates(location: string): boolean {
  return !isColdLocationAllowed(location).allowed
}

/**
 * The cold-outreach gate for an Apollo candidate. Apollo fills the person's
 * country, the organization's, or both; any non-US value blocks. With
 * `blank: "pending"`, a candidate with no country at all is let through as
 * unconfirmed: Apollo's search results often withhold the country until the
 * contact is revealed, and the approval gate runs strict after the reveal.
 * Strict (the default) blocks it.
 */
export function coldOutreachJurisdiction(
  person: ApolloPerson,
  opts: { blank?: "block" | "pending" } = {},
): JurisdictionCheck & { pending?: boolean } {
  const values = [person.country, person.organization?.country]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean)
  if (values.length === 0) {
    if (opts.blank === "pending") {
      return { allowed: true, pending: true, reason: "Country not yet known; confirmed as the United States at approval." }
    }
    return isColdOutreachAllowed(null)
  }
  for (const v of values) {
    const check = isColdOutreachAllowed(v)
    if (!check.allowed) return check
  }
  return { allowed: true, country: COLD_OUTREACH_ALLOWED_COUNTRY, reason: "United States" }
}

/** The fields of a lead the cold-outreach gate reads. */
export interface ColdGateLead {
  source?: string | null
  country?: string | null
  location?: string | null
}

/**
 * The cold-outreach gate for a CRM lead, for every send path. A lead whose
 * `source` is not cold (`COLD_LEAD_SOURCES`) is warm or inbound and passes
 * ungated. A cold lead must be in the United States: by its `country` (ISO
 * alpha-2, stamped at prospecting approval) when present, otherwise by its
 * `location` ("City, State", as captured from Apollo). Fails closed.
 */
export function coldOutreachGateForLead(lead: ColdGateLead): JurisdictionCheck & { cold: boolean } {
  const cold = COLD_LEAD_SOURCES.has(lead.source ?? "")
  if (!cold) return { allowed: true, cold, reason: "Warm or inbound lead; not jurisdiction-gated." }
  const check = (lead.country ?? "").trim() ? isColdOutreachAllowed(lead.country) : isColdLocationAllowed(lead.location)
  return { ...check, cold }
}

/**
 * The GDPR / CASL jurisdictions (EU, UK, EEA, Switzerland, Canada), by name.
 *
 * NOT the cold-outreach gate: cold outbound is US-only and gates on the
 * allow-list above, which already blocks every one of these. This list is kept
 * only for two non-cold surfaces that refuse these jurisdictions specifically:
 * the brand-book share (lib/brand-share.ts, a recipient-requested send) and,
 * through EXCLUDED_COUNTRY_CODES, the Meta Pixel gate (lib/meta-pixel-gate.ts,
 * visitor tracking). Don't use it for a cold path.
 */
export const EXCLUDED_COUNTRIES: Set<string> = new Set([
  // EU member states
  "austria", "belgium", "bulgaria", "croatia", "cyprus",
  "czech republic", "czechia",
  "denmark", "estonia", "finland", "france", "germany",
  "greece", "hungary", "ireland", "italy", "latvia",
  "lithuania", "luxembourg", "malta", "netherlands",
  "poland", "portugal", "romania", "slovakia", "slovenia",
  "spain", "sweden",
  // EEA non-EU
  "iceland", "liechtenstein", "norway",
  // Switzerland (Swiss-equivalent of GDPR)
  "switzerland",
  // UK + post-Brexit variants (retains GDPR-equivalent law)
  "united kingdom", "uk", "great britain", "britain",
  "england", "scotland", "wales", "northern ireland",
  // Canada (CASL)
  "canada",
])

/**
 * The same jurisdictions as ISO 3166-1 alpha-2 codes.
 *
 * `EXCLUDED_COUNTRIES` above is keyed on human-readable names because that is
 * what Apollo returns. Edge/CDN geo headers (Vercel's `x-vercel-ip-country`)
 * speak ISO codes instead, so surfaces that gate on visitor geography — the
 * Meta Pixel, for one — need this projection of the same list. Keep the two
 * lists in step. Like EXCLUDED_COUNTRIES, this is not the cold-outreach gate.
 */
export const EXCLUDED_COUNTRY_CODES: Set<string> = new Set([
  // EU member states
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  // EEA non-EU
  "IS", "LI", "NO",
  // Switzerland (Swiss-equivalent of GDPR)
  "CH",
  // UK (retains GDPR-equivalent law) + Crown dependencies
  "GB", "UK", "GG", "JE", "IM",
  // Canada (CASL / PIPEDA)
  "CA",
])

// ─── Contact qualifier — title (max 20) ─────────────────────────────────
// A person-level signal (is this the right contact?), NOT company fit. Kept
// here and surfaced separately from the rubric's company fit score.

interface DimensionResult {
  score: number
  reason: string
}

interface TitleTier {
  name: string
  patterns: RegExp[]
  score: number
}

const TITLE_TIERS: TitleTier[] = [
  {
    name: "Founder / Co-Founder",
    score: 20,
    patterns: [/\bfounder\b/i, /\bco[- ]?founder\b/i],
  },
  {
    name: "CEO / President",
    score: 20,
    patterns: [/\bCEO\b/i, /\bchief executive\b/i, /\bpresident\b/i, /\bmanaging partner\b/i, /\bmanaging director\b/i],
  },
  {
    name: "CMO / VP Marketing / Brand Director",
    score: 18,
    patterns: [
      /\bCMO\b/i,
      /\bchief marketing\b/i,
      /\bVP\s+(of\s+)?marketing\b/i,
      /\bvice president\s+(of\s+)?marketing\b/i,
      /\bbrand director\b/i,
      /\bhead of marketing\b/i,
      /\bhead of brand\b/i,
    ],
  },
  {
    name: "Head of Partnerships / Sponsorships / BD",
    score: 18,
    patterns: [
      /\bhead of partnerships?\b/i,
      /\bdirector of partnerships?\b/i,
      /\bVP\s+(of\s+)?partnerships?\b/i,
      /\bsponsorship manager\b/i,
      /\bhead of (BD|business development)\b/i,
      /\bdirector of (BD|business development)\b/i,
    ],
  },
  {
    name: "Communications / Community / Social Impact Director",
    score: 15,
    patterns: [
      /\b(director|head) of (communications?|comms)\b/i,
      /\b(director|head) of community\b/i,
      /\b(director|head) of social impact\b/i,
      /\bchief communications\b/i,
    ],
  },
  {
    name: "Portfolio Marketing / Storytelling lead",
    score: 15,
    patterns: [
      /\bportfolio marketing\b/i,
      /\b(director|head) of (storytelling|portfolio)\b/i,
    ],
  },
  {
    name: "Other senior leadership",
    score: 12,
    patterns: [
      /\b(VP|vice president)\b/i,
      /\bchief\b/i,
      /\bdirector\b/i,
      /\bhead of\b/i,
      /\bexecutive director\b/i,
    ],
  },
  {
    name: "Manager",
    score: 5,
    patterns: [/\bmanager\b/i, /\blead\b/i],
  },
]

function scoreTitle(person: ApolloPerson): DimensionResult {
  const title = person.title ?? ""
  if (!title.trim()) {
    return { score: 0, reason: "no title" }
  }
  // Walk tiers in order; first match wins so seniority hierarchy is respected.
  for (const tier of TITLE_TIERS) {
    if (tier.patterns.some((p) => p.test(title))) {
      return { score: tier.score, reason: `${tier.name} ("${title}")` }
    }
  }
  return { score: 0, reason: `non-decision-maker title ("${title}")` }
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface ScoredPerson {
  person: ApolloPerson
  /** 0–100 canonical ICP fit, or -1 when hard-excluded by a negative ICP rule. */
  score: number
  grade: IcpGrade
  breakdown: IcpFitBreakdown
  /** Title fit (0–20) — a contact qualifier, NOT part of the company fit score. */
  contactQualifier: number
  /**
   * Set when the company could not be placed in a cohort because its size is
   * unknown: Industry is left out of the score and the candidate is marked for
   * review instead of scored as no-fit. Holds why.
   */
  needsReview?: string
  /** Every outbound cohort the candidate matches — the pitch is picked from these at approval. */
  cohorts: CohortHit[]
  /** Set when score is -1 — explains why the candidate was excluded. */
  excluded?: string
  /** Per-dimension explanations, for the review tray. */
  reasons: string[]
}

const EXCLUDED_BREAKDOWN: IcpFitBreakdown = { industry: 0, location: 0, companySize: 0 }

function excludedResult(person: ApolloPerson, message: string, reason: string): ScoredPerson {
  return {
    person,
    score: -1,
    grade: "D",
    breakdown: EXCLUDED_BREAKDOWN,
    contactQualifier: 0,
    excluded: message,
    reasons: [reason],
    cohorts: [],
  }
}

/**
 * Score a single Apollo candidate against the 434media ICP. Company fit comes
 * from the canonical rubric; title is a separate contact qualifier. Returns a
 * -1 score with `excluded` reason for hard-excluded candidates.
 */
export function scoreCandidate(
  person: ApolloPerson,
  filters: ApolloSearchFilters,
  cohorts: CohortLike[],
): ScoredPerson {
  const orgName = person.organization?.name ?? ""

  // Hard exclusion — cold outbound is US-only (master 5.3). A non-US or
  // unreadable country excludes. No country at all is common in Apollo search
  // results (withheld until reveal), so it is marked unconfirmed here and the
  // approval gate blocks it if the reveal doesn't show the United States.
  const jurisdiction = coldOutreachJurisdiction(person, { blank: "pending" })
  if (!jurisdiction.allowed) {
    return excludedResult(person, jurisdiction.reason, `Excluded: ${jurisdiction.reason}`)
  }

  // Company FIT — canonical rubric (same scorer the lead uses), with filter
  // fallbacks for Free-plan obfuscation.
  const fit = scoreIcpFit({
    industry: person.organization?.industry,
    orgName,
    city: person.city || person.organization?.city,
    state: person.state || person.organization?.state,
    employeeCount: person.organization?.estimated_num_employees,
    annualRevenue: person.organization?.annual_revenue,
    locationHint: (filters.organization_locations || []).join(" "),
    cohorts,
  })

  const title = scoreTitle(person)

  const reasons = [
    fit.needsReview ? `Industry: review — ${fit.needsReview}` : `Industry +${fit.breakdown.industry}`,
    `Location +${fit.breakdown.location}`,
    `Company size +${fit.breakdown.companySize}`,
  ]
  if (fit.breakdown.fundingStage !== undefined) reasons.push(`Funding +${fit.breakdown.fundingStage}`)
  reasons.push(`Contact +${title.score}: ${title.reason}`, `Fit ${fit.fit}/100 → grade ${fit.grade}`)
  if (jurisdiction.pending) reasons.push(`Jurisdiction: ${jurisdiction.reason}`)

  return {
    person,
    score: fit.fit,
    grade: fit.grade,
    breakdown: fit.breakdown,
    contactQualifier: title.score,
    reasons,
    cohorts: fit.cohorts,
    ...(fit.needsReview ? { needsReview: fit.needsReview } : {}),
  }
}

/**
 * Score an array of candidates, sorted highest fit first. Hard-excluded
 * candidates (-1) sort to the bottom.
 */
export function scoreCandidates(
  people: ApolloPerson[],
  filters: ApolloSearchFilters,
  cohorts: CohortLike[],
): ScoredPerson[] {
  const scored = people.map((p) => scoreCandidate(p, filters, cohorts))
  return scored.sort((a, b) => {
    if (a.score === -1 && b.score !== -1) return 1
    if (b.score === -1 && a.score !== -1) return -1
    return b.score - a.score
  })
}

/**
 * Threshold check — does this candidate qualify to enter the leads queue?
 */
export function isAboveThreshold(
  score: number,
  threshold: number = DEFAULT_FIT_THRESHOLD,
): boolean {
  if (score === -1) return false
  return score >= threshold
}
