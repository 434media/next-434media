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
 *   - the hard jurisdiction exclusion (EU/UK/EEA/CH/CA) → score -1
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

/**
 * Jurisdictions where 434media does NOT pursue cold outbound. Per the ICP
 * doc, EU member states (incl. UK + EEA + Switzerland) and Canada are
 * hard-excluded due to strict consent laws (GDPR / CASL).
 *
 * Exported so the approval endpoint can apply a defense-in-depth check
 * (single source of truth for the jurisdiction list).
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
 * Meta Pixel, for one — need this projection of the same policy. Keep the two
 * lists in step: this file remains the single source of truth for where 434
 * does not track or cold-outreach.
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

/**
 * Returns whether a candidate is in an excluded jurisdiction. Checks both
 * the person's country and their organization's country — Apollo populates
 * one or the other depending on the data source.
 */
export function isExcludedJurisdiction(person: ApolloPerson): {
  excluded: boolean
  country?: string
} {
  const personCountry = (person.country || "").trim().toLowerCase()
  const orgCountry = (person.organization?.country || "").trim().toLowerCase()

  if (personCountry && EXCLUDED_COUNTRIES.has(personCountry)) {
    return { excluded: true, country: person.country }
  }
  if (orgCountry && EXCLUDED_COUNTRIES.has(orgCountry)) {
    return { excluded: true, country: person.organization?.country }
  }
  return { excluded: false }
}

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

  // Hard exclusion — EU/CA jurisdictions (strict cold-outreach consent laws).
  const jurisdiction = isExcludedJurisdiction(person)
  if (jurisdiction.excluded) {
    return excludedResult(
      person,
      `Outside reachable geography: ${jurisdiction.country}. 434media does not pursue cold outbound to EU/Canadian contacts due to strict consent laws (GDPR / CASL).`,
      `Excluded: contact in ${jurisdiction.country} — 434media does not reach out to EU/Canadian contacts (GDPR / CASL).`,
    )
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
