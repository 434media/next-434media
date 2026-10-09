/**
 * Cohort match — which outbound cohort (icp_cohorts, master §5.6–5.10) a
 * company's industry, name and size point to. next-434media#63.
 *
 * It is shown as "cohort match" beside ICP match, and the ICP rubric's
 * Industry dimension is scored from it (lib/icp/rubric.ts), so the cohort
 * table is the single definition of who 434 targets. The terms come from each
 * cohort row's own `target_profile` wording, so a cohort edit in the system of
 * record changes the match with no code change. The cohort list is never
 * restated here.
 *
 * Deliberately simple: a word overlap between the company's industry and name
 * and the cohort's target-profile words, after dropping words that carry no
 * targeting meaning. Each matched word counts by how specific it is to the
 * cohort (how often the cohort uses it, divided by how many cohorts use it), so
 * "health" in Bio & Health outweighs the same word in a defense phrase. A
 * company word also matches a cohort word it starts with ("healthcare" →
 * "health"). Geography is not matched (every cohort is Texas-relevant, and
 * location is the ICP rubric's job).
 *
 * Company size, two ways, both read from the row's own wording:
 *
 *   - Enterprise. A cohort with a phrase defined by scale ("Fortune 500
 *     companies", "Large privately held companies", "Major regional
 *     enterprises" — SCALE_WORDS) matches an enterprise-sized company even
 *     with no industry word in common. A size match counts for less than one
 *     specific industry word, so a large hospital system still goes to the
 *     health cohort.
 *   - A revenue band. A phrase carrying a range like "($10M–$1B annual
 *     revenue)" is a rule, not words: a company inside the band matches when
 *     its industry or name shows one of the signal words the phrase lists
 *     after the range ("marketing, event, communications or workforce
 *     activity"). The band's words are kept out of word matching, so "market"
 *     in "Mid-market" never matches "marketing".
 *
 * Dealer groups and multi-location operators match on their own words
 * ("dealer" → "dealership"), whatever their size. Multi-location operators
 * have no field to match on in the lead or Apollo data, so only a name or
 * industry that says "dealer" is caught.
 */

export interface CohortLike {
  key: string
  letter?: string
  name: string
  target_profile: string[]
}

/** What the matcher reads about a company. */
export interface CompanyFacts {
  industry?: string | null
  company?: string | null
  employeeCount?: number | null
  annualRevenue?: number | null
}

export interface CohortMatch {
  key: string
  letter?: string
  name: string
  /** The cohort words the company matched, for the review surface. */
  terms: string[]
  /** True when the company's enterprise size put it in the cohort. */
  bySize?: boolean
  /** True when a revenue band in the row, with a signal word, matched. */
  byRevenueBand?: boolean
  /** The match's strength: about 1 for one industry word only this cohort uses. */
  weight: number
}

// Words that mark a target-profile phrase as defined by company scale.
const SCALE_WORDS = ["fortune", "large", "major", "enterprise"]

// Enterprise size for a size-defined cohort: either measure is enough. Founder
// decision 2026-10-08: enterprise starts where the mid-market ends.
//   - $1B revenue: the mid-market ceiling in both definitions. The National
//     Center for the Middle Market (Ohio State) defines the U.S. middle market
//     as $10M–$1B annual revenue; Gartner's glossary defines a midsize
//     enterprise as $50M–$1B annual revenue.
//     https://www.middlemarketcenter.org/Media/Documents/NCMM%20InfoSheet.pdf
//     https://www.gartner.com/en/information-technology/glossary/midsize-enterprise-mse
//   - 1,000 employees: Gartner's earlier midsize band of 100–999 employees.
//     Gartner's current glossary entry says 100–2,500 employees, so this line
//     is lower than Gartner's present ceiling (read 2026-10-08).
export const LARGE_EMPLOYEES = 1000
export const LARGE_REVENUE_USD = 1_000_000_000

// A size match weighs less than one industry word a single cohort owns (1.0).
const SIZE_WEIGHT = 0.5
// A revenue-band match with a signal word: more than enterprise size, less
// than one word a single cohort owns, so a mid-sized agency whose industry is
// "marketing & advertising" still goes to the agency cohort.
const BAND_WEIGHT = 0.75

// "$10M–$1B", "$10 M - $1B": a revenue band written into a target profile.
const BAND = /\$\s*(\d+(?:\.\d+)?)\s*([kmb])\s*[–—-]\s*\$\s*(\d+(?:\.\d+)?)\s*([kmb])/i
const UNIT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 }
// Filler around a band's signal words.
const BAND_FILLER = new Set(["with", "meaningful", "activity", "annual", "revenue", "significant", "and"])

// Words in target-profile phrases that say nothing about who the target is:
// structure words, size and ownership words, and geography.
const STOP = new Set([
  "and", "the", "with", "their", "other", "for", "into", "that", "which",
  "companies", "company", "organizations", "organization", "institutions", "institution",
  "brands", "brand", "businesses", "business", "firms", "firm", "groups", "group",
  "large", "major", "established", "significant", "independent", "specialist",
  "privately", "held", "regional", "enterprises", "enterprise", "operators", "operator",
  "multi", "location", "fortune", "networks", "network", "holding",
  "ecosystems", "ecosystem", "stakeholders", "investing", "operating", "named",
  "budgets", "seeking", "alignment", "related", "supplier", "suppliers",
  "texas", "mexico", "mexican", "american", "americans", "audiences", "audience",
  "live", "original", "content", "experiences", "storytelling", "communication",
  "communications", "programs", "program", "public", "initiatives", "funding",
  "sponsor", "sponsors", "led", "personalities", "events", "event", "culture",
  // Too generic to point at one cohort on their own.
  // ("relation" is not here: it is how "public relations" agencies match.)
  "technology", "system", "media", "marketing",
])

/** Lowercase words of 3+ letters, singularized ("agencies" → "agency"). */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((w) => w.length >= 3)
    .map((w) => {
      if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`
      if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1)
      return w
    })
}

// The stop list, singularized the same way as the words it is checked against.
const STOP_WORDS = new Set([...STOP].flatMap((w) => words(w)))

/** A revenue band read from a target-profile phrase, with its signal words. */
export interface RevenueBand {
  minUsd: number
  maxUsd: number
  signals: string[]
}

/** The phrase's revenue band, or null when it states none. */
export function parseRevenueBand(phrase: string): RevenueBand | null {
  const m = BAND.exec(phrase)
  if (!m) return null
  const minUsd = Number(m[1]) * UNIT[m[2].toLowerCase()]
  const maxUsd = Number(m[3]) * UNIT[m[4].toLowerCase()]
  // The signal words follow the band: "… ($10M–$1B annual revenue) with
  // meaningful marketing, event, communications or workforce activity".
  const after = phrase.slice(m.index + m[0].length)
  const signals = [...new Set(words(after).filter((w) => !BAND_FILLER.has(w)))]
  return { minUsd, maxUsd, signals }
}

/** The revenue bands a cohort's target profile states. */
export function cohortBands(cohort: CohortLike): RevenueBand[] {
  return cohort.target_profile.map(parseRevenueBand).filter((b): b is RevenueBand => b !== null)
}

/** The targeting words of one cohort with how often its phrases use each. */
export function cohortTermCounts(cohort: CohortLike): Map<string, number> {
  const counts = new Map<string, number>()
  for (const phrase of cohort.target_profile) {
    if (parseRevenueBand(phrase)) continue // a band is a rule, not words
    for (const w of words(phrase)) if (!STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return counts
}

/** Whether a cohort's target profile defines it by company scale. */
export function isSizeDefined(cohort: CohortLike): boolean {
  return cohort.target_profile.some((phrase) => words(phrase).some((w) => SCALE_WORDS.includes(w)))
}

/** Whether a company is large by either measure. Unknown size is not large. */
export function isLarge(company: CompanyFacts): boolean {
  return (company.employeeCount ?? 0) >= LARGE_EMPLOYEES || (company.annualRevenue ?? 0) >= LARGE_REVENUE_USD
}

/** The targeting words of one cohort, from its target-profile phrases. */
export function cohortTerms(cohort: CohortLike): string[] {
  return [...cohortTermCounts(cohort).keys()]
}

// A company word matches a cohort word that equals it or, for words of five
// letters or more, that it starts with ("healthcare" → "health").
function hits(have: Set<string>, term: string): boolean {
  if (have.has(term)) return true
  if (term.length < 5) return false
  for (const w of have) if (w.startsWith(term)) return true
  return false
}

/** Whether a company sits in a band and shows one of the band's signals. */
function inBand(band: RevenueBand, company: CompanyFacts, have: Set<string>): boolean {
  const revenue = company.annualRevenue
  if (revenue === null || revenue === undefined) return false
  if (revenue < band.minUsd || revenue >= band.maxUsd) return false
  return band.signals.some((s) => hits(have, s))
}

/**
 * The cohort whose target-profile words best overlap the company's industry
 * and name — or whose enterprise scale or revenue band the company meets —
 * or null when none does. Ties go to the earlier cohort letter.
 */
export function matchCohort(company: CompanyFacts, cohorts: CohortLike[]): CohortMatch | null {
  const have = new Set(words(`${company.industry ?? ""} ${company.company ?? ""}`))
  const large = isLarge(company)
  if (!have.size && !large) return null
  const ordered = [...cohorts].sort((a, b) => (a.letter ?? a.key).localeCompare(b.letter ?? b.key))
  const counts = ordered.map((c) => cohortTermCounts(c))
  // How many cohorts use each word — a word every cohort shares says little.
  const spread = new Map<string, number>()
  for (const m of counts) for (const t of m.keys()) spread.set(t, (spread.get(t) ?? 0) + 1)

  let best: CohortMatch | null = null
  ordered.forEach((c, i) => {
    const matched = [...counts[i].entries()].filter(([t]) => hits(have, t))
    const bySize = large && isSizeDefined(c)
    const byRevenueBand = cohortBands(c).some((b) => inBand(b, company, have))
    const weight =
      matched.reduce((sum, [t, n]) => sum + n / (spread.get(t) ?? 1), 0) +
      (bySize ? SIZE_WEIGHT : 0) +
      (byRevenueBand ? BAND_WEIGHT : 0)
    if ((matched.length || bySize || byRevenueBand) && (!best || weight > best.weight)) {
      best = {
        key: c.key,
        letter: c.letter,
        name: c.name,
        terms: matched.map(([t]) => t),
        weight,
        ...(bySize ? { bySize } : {}),
        ...(byRevenueBand ? { byRevenueBand } : {}),
      }
    }
  })
  return best
}
