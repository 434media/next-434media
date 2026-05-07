import type { ApolloPerson, ApolloSearchFilters } from "./apollo"

/**
 * Stage 3 — ICP scorer.
 *
 * Pure function: takes an Apollo person result + the filters that produced
 * it, returns a fit-only score 0–80 with per-dimension breakdown. No API
 * calls, no LLM, no I/O — easy to test, deterministic, fast.
 *
 * Two scoring "modes" the function adapts to automatically:
 *   - Real data available (Basic+ plans, or post-enrichment): score on
 *     actual values (city, industry, employee count).
 *   - Free-plan obfuscated response: fall back to filter-implied attributes
 *     plus org-name pattern matching (the only signal we always have).
 *
 * Score weights sum to 80, matching the icp.md "fit-only score range 0–80
 * before any engagement signal lifts it" specification:
 *
 *     Geography      0–25
 *     Industry       0–25
 *     Title          0–20
 *     Company size   0–10
 *     ─────────────────────
 *     Total          0–80
 *
 * Hard exclusions (agencies, PR firms, etc. — the ICP "always exclude"
 * rules) return score = -1 with an `excluded` reason so the review tray
 * can either filter or display them as "filtered: <reason>".
 */

// ─── Configuration ──────────────────────────────────────────────────────

/**
 * Default fit threshold for "approve into queue" decisions. Configurable
 * via PROSPECTING_FIT_THRESHOLD env var. icp.md recommends 50–60.
 */
export const DEFAULT_FIT_THRESHOLD = Number(
  process.env.PROSPECTING_FIT_THRESHOLD,
) || 60

// ─── Negative ICP patterns (hard exclusions) ────────────────────────────

/**
 * Org-name patterns that match marketing agencies, PR firms, advertising
 * firms, etc. — 434media's competitors per the ICP doc. Hard-exclude.
 *
 * Patterns are intentionally specific (require a "agency/group/firm" word
 * after the marketing-adjacent term) to avoid false positives on real
 * customers like "Acme Foods Brand Department."
 */
const NEGATIVE_ORG_PATTERNS: RegExp[] = [
  /\b(marketing|advertising|public relations|communications|brand|creative|digital marketing)\s+(agency|group|firm|partners|consultancy|consulting|studio|shop)\b/i,
  /\b(agency|firm|consultancy)\b.*\b(marketing|advertising|public relations)\b/i,
  /\bPR firm\b/i,
  /\bad agency\b/i,
]

/**
 * Jurisdictions where 434media does NOT pursue cold outbound. Per the ICP
 * doc, EU member states (incl. UK + EEA + Switzerland) and Canada are
 * hard-excluded due to strict consent laws (GDPR / CASL).
 *
 * Lowercased for case-insensitive matching against Apollo's country fields.
 *
 * Exported so the approval endpoint can apply a defense-in-depth check
 * (single source of truth for the jurisdiction list).
 *
 * Limitation: on Apollo Free plan, country is obfuscated (`has_country: true`
 * only — actual value hidden). The scorer can't enforce this on Free-plan
 * responses; production usage on Basic+ exposes the country field and the
 * exclusion fires cleanly. The translator's geography filter is the
 * complementary defense — restrict `organization_locations` to US/Mexico
 * so EU/CA candidates don't appear in Free-plan results in the first place.
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

// ─── Geography scoring (max 25) ─────────────────────────────────────────

const SOUTH_TEXAS_CITIES = [
  "san antonio",
  "brownsville",
  "laredo",
  "mcallen",
  "harlingen",
  "corpus christi",
  "edinburg",
  "rio grande",
  "rgv",
]

const TEXAS_CITIES = [
  "austin",
  "houston",
  "dallas",
  "fort worth",
  "el paso",
  "lubbock",
  "amarillo",
  "waco",
]

const HISPANIC_TARGETED_METROS = [
  "miami",
  "los angeles",
  "chicago",
  "phoenix",
  "albuquerque",
  "denver",
]

interface DimensionResult {
  score: number
  reason: string
}

function scoreGeography(
  person: ApolloPerson,
  filters: ApolloSearchFilters,
): DimensionResult {
  const city = (person.city || "").toLowerCase()
  const state = (person.state || "").toLowerCase()
  const orgCity = (person.organization?.city || "").toLowerCase()
  const orgState = (person.organization?.state || "").toLowerCase()

  // Use real values when available (Basic+ plans).
  const haveRealLocation = !!(city || state || orgCity || orgState)

  if (haveRealLocation) {
    const allText = [city, state, orgCity, orgState].join(" ")
    if (SOUTH_TEXAS_CITIES.some((c) => allText.includes(c))) {
      return { score: 25, reason: "South Texas — top ICP priority" }
    }
    if (state === "texas" || state === "tx" || orgState === "texas" || orgState === "tx") {
      if (TEXAS_CITIES.some((c) => allText.includes(c))) {
        return { score: 22, reason: "Greater Texas (Austin/Houston/Dallas/etc.)" }
      }
      return { score: 20, reason: "Texas (specific city not surfaced)" }
    }
    if (HISPANIC_TARGETED_METROS.some((c) => allText.includes(c))) {
      return { score: 18, reason: "Hispanic-targeted national metro" }
    }
    if (state || orgState) {
      return { score: 5, reason: "Outside primary ICP geography" }
    }
  }

  // Fall back to filter-implied location (Free plan obfuscates city/state).
  const filterLocations = (filters.organization_locations || []).join(" ").toLowerCase()
  if (/texas|tx\b/i.test(filterLocations)) {
    return {
      score: 20,
      reason: "Texas (filter-implied — actual city hidden on Free plan)",
    }
  }
  if (/mexico/i.test(filterLocations)) {
    return {
      score: 22,
      reason: "Mexico (filter-implied — strong border-market signal)",
    }
  }
  if (HISPANIC_TARGETED_METROS.some((c) => filterLocations.includes(c))) {
    return {
      score: 18,
      reason: "Hispanic-targeted metro (filter-implied)",
    }
  }

  return { score: 0, reason: "no geography signal" }
}

// ─── Industry scoring (max 25) ──────────────────────────────────────────

interface IndustrySignal {
  name: string
  patterns: RegExp[]
  score: number
}

/**
 * Industry recognition patterns. Run against:
 *   1. organization.industry (Basic+ plans return this)
 *   2. organization.name + person.title (always available; coarser)
 *   3. q_keywords in the filters used (intent signal from the prompt)
 */
const INDUSTRY_SIGNALS: IndustrySignal[] = [
  {
    name: "Healthcare / life sciences",
    score: 25,
    patterns: [
      /\bhealth(care|tech)?\b/i,
      /\bbio(tech)?\b/i,
      /\bmedic(al|ine)\b/i,
      /\bpharma\b/i,
      /\bhospital\b/i,
      /\bclinic(al)?\b/i,
      /\bmilitary[- ]health\b/i,
      /\blife scien(ce|ces)\b/i,
      /\bprosthetic/i,
    ],
  },
  {
    name: "Capital / VC / accelerators",
    score: 25,
    patterns: [
      /\bventure(s)?\b/i,
      /\bcapital\b/i,
      /\b(angel|angels)\b/i,
      /\baccelerator\b/i,
      /\bincubator\b/i,
      /\bfamily office\b/i,
      /\bportfolio (marketing|management)\b/i,
      /\b(VC|LP|GP) firm\b/i,
    ],
  },
  {
    name: "Sports / fight / lifestyle (Latino-targeted)",
    score: 25,
    patterns: [
      /\bboxing\b/i,
      /\bfight (sport|club|gym)\b/i,
      /\bMMA\b/i,
      /\bsports? (apparel|gear|nutrition|league)\b/i,
      /\bathletic(s)?\b/i,
    ],
  },
  {
    name: "Tech / SaaS / dev",
    score: 22,
    patterns: [
      /\bsoftware\b/i,
      /\bSaaS\b/i,
      /\bdeveloper(s)?\b/i,
      /\bAI (tool|product|platform)\b/i,
      /\bdev(\.|ops)?\b/i,
      /\b(edtech|recruit|talent platform)\b/i,
    ],
  },
  {
    name: "Media / broadcast (bilingual)",
    score: 25,
    patterns: [
      /\bunivision\b/i,
      /\btelemundo\b/i,
      /\bbroadcast(er|ing)\b/i,
      /\bspanish[- ]language\b/i,
      /\bbilingual media\b/i,
    ],
  },
  {
    name: "Education / workforce",
    score: 22,
    patterns: [
      /\buniversity\b/i,
      /\bcollege\b/i,
      /\binstitute\b/i,
      /\bacademy\b/i,
      /\beducation\b/i,
      /\bworkforce\b/i,
    ],
  },
  {
    name: "Nonprofit / mission",
    score: 22,
    patterns: [
      /\bfoundation\b/i,
      /\bministries\b/i,
      /\bnonprofit\b/i,
      /\balliance\b/i,
      /\bcoalition\b/i,
      /\bsocial impact\b/i,
      /\bmission(-driven)?\b/i,
    ],
  },
  {
    name: "CPG (Hispanic focus)",
    score: 22,
    patterns: [
      /\b(foods?|beverage|snack)\b/i,
      /\bconsumer (brand|goods)\b/i,
      /\b(hispanic|latino|latinx) brand\b/i,
    ],
  },
  {
    name: "Civic-tech / economic-development",
    score: 22,
    patterns: [
      /\bcivic(-tech)?\b/i,
      /\beconomic development\b/i,
      /\bchamber of commerce\b/i,
      /\btech bloc\b/i,
    ],
  },
]

function scoreIndustry(
  person: ApolloPerson,
  filters: ApolloSearchFilters,
): DimensionResult {
  const orgName = person.organization?.name ?? ""
  const industry = person.organization?.industry ?? ""
  const title = person.title ?? ""
  const keywords = filters.q_keywords ?? ""

  // Combined haystack — real industry value is highest signal, but we
  // also pattern-match against org name + title + filter keywords because
  // those are always present (even on Free plan).
  const haystack = [industry, orgName, title, keywords].join(" ").toLowerCase()

  if (!haystack.trim()) {
    return { score: 0, reason: "no industry signal" }
  }

  let bestMatch: IndustrySignal | null = null
  for (const signal of INDUSTRY_SIGNALS) {
    if (signal.patterns.some((p) => p.test(haystack))) {
      if (!bestMatch || signal.score > bestMatch.score) {
        bestMatch = signal
      }
    }
  }

  if (bestMatch) {
    const source = industry
      ? "industry field"
      : orgName
        ? "org name pattern"
        : "filter keyword"
    return {
      score: bestMatch.score,
      reason: `${bestMatch.name} (matched via ${source})`,
    }
  }

  return { score: 0, reason: "no ICP industry match" }
}

// ─── Title scoring (max 20) ─────────────────────────────────────────────

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

// ─── Company size scoring (max 10) ──────────────────────────────────────

function scoreCompanySize(person: ApolloPerson): DimensionResult {
  const employees = person.organization?.estimated_num_employees
  const orgName = person.organization?.name ?? ""

  // Institutional clients (nonprofits, broadcasters, healthcare systems,
  // universities) get full credit regardless of size — different decision-
  // making, different budgets, ICP says no upper cap when mission-aligned.
  const isInstitutional = /\b(university|college|institute|foundation|ministries|hospital|broadcast(er)?|government|alliance)\b/i.test(orgName)
  if (isInstitutional) {
    return { score: 10, reason: "institutional client (no size cap applies)" }
  }

  if (employees === undefined) {
    return {
      score: 0,
      reason: "size unknown (Free plan hides employee count)",
    }
  }

  if (employees >= 10 && employees <= 500) {
    return { score: 10, reason: `${employees} employees — ICP sweet spot (10–500)` }
  }
  if (employees >= 5 && employees < 10) {
    return { score: 7, reason: `${employees} employees — early-stage (5–10)` }
  }
  if (employees > 500 && employees <= 1000) {
    return { score: 7, reason: `${employees} employees — above sweet spot but workable` }
  }
  if (employees > 1000) {
    return { score: 3, reason: `${employees} employees — large enterprise (lower fit)` }
  }
  return { score: 0, reason: `${employees} employees — too small (no funding signal)` }
}

// ─── Public API ─────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  geography: number
  industry: number
  title: number
  companySize: number
}

export interface ScoredPerson {
  person: ApolloPerson
  /** 0–80 fit score, or -1 when hard-excluded by negative ICP rule */
  score: number
  breakdown: ScoreBreakdown
  /** Set when score is -1 — explains why the candidate was excluded */
  excluded?: string
  /** Per-dimension explanations, in scoring order. Useful for the review tray. */
  reasons: string[]
}

/**
 * Score a single Apollo candidate against the 434media ICP.
 *
 * Returns a -1 score with `excluded` reason for hard-excluded candidates
 * (agencies, PR firms, etc. per icp.md negative filters). The review tray
 * can choose to hide these or show them as "filtered" entries.
 */
export function scoreCandidate(
  person: ApolloPerson,
  filters: ApolloSearchFilters,
): ScoredPerson {
  const orgName = person.organization?.name ?? ""

  // Hard exclusion 1 — competitor agencies / PR firms.
  for (const pattern of NEGATIVE_ORG_PATTERNS) {
    if (pattern.test(orgName)) {
      return {
        person,
        score: -1,
        breakdown: { geography: 0, industry: 0, title: 0, companySize: 0 },
        excluded: `Negative ICP filter: "${orgName}" appears to be an agency or PR/marketing firm — explicitly excluded by the ICP doc.`,
        reasons: [
          `Excluded: organization "${orgName}" matches a negative ICP pattern (agency / PR / marketing firm).`,
        ],
      }
    }
  }

  // Hard exclusion 2 — EU/CA jurisdictions (strict cold-outreach consent
  // laws; per the ICP doc, 434media does not pursue these regardless of fit).
  const jurisdiction = isExcludedJurisdiction(person)
  if (jurisdiction.excluded) {
    return {
      person,
      score: -1,
      breakdown: { geography: 0, industry: 0, title: 0, companySize: 0 },
      excluded: `Outside reachable geography: ${jurisdiction.country}. 434media does not pursue cold outbound to EU/Canadian contacts due to strict consent laws (GDPR / CASL).`,
      reasons: [
        `Excluded: contact in ${jurisdiction.country} — 434media does not reach out to EU/Canadian contacts (GDPR / CASL).`,
      ],
    }
  }

  const geo = scoreGeography(person, filters)
  const ind = scoreIndustry(person, filters)
  const tit = scoreTitle(person)
  const sz = scoreCompanySize(person)

  return {
    person,
    score: geo.score + ind.score + tit.score + sz.score,
    breakdown: {
      geography: geo.score,
      industry: ind.score,
      title: tit.score,
      companySize: sz.score,
    },
    reasons: [
      `Geography +${geo.score}: ${geo.reason}`,
      `Industry +${ind.score}: ${ind.reason}`,
      `Title +${tit.score}: ${tit.reason}`,
      `Size +${sz.score}: ${sz.reason}`,
    ],
  }
}

/**
 * Score an array of candidates and return them sorted highest score first.
 * Hard-excluded candidates (-1) sort to the bottom — caller decides whether
 * to display them.
 */
export function scoreCandidates(
  people: ApolloPerson[],
  filters: ApolloSearchFilters,
): ScoredPerson[] {
  const scored = people.map((p) => scoreCandidate(p, filters))
  // Excluded (-1) to bottom; otherwise descending by score.
  return scored.sort((a, b) => {
    if (a.score === -1 && b.score !== -1) return 1
    if (b.score === -1 && a.score !== -1) return -1
    return b.score - a.score
  })
}

/**
 * Threshold check — does this candidate qualify to enter the leads queue?
 * Uses DEFAULT_FIT_THRESHOLD (env-configurable) unless overridden.
 */
export function isAboveThreshold(
  score: number,
  threshold: number = DEFAULT_FIT_THRESHOLD,
): boolean {
  if (score === -1) return false
  return score >= threshold
}
