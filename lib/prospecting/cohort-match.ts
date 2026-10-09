/**
 * Cohort match — which outbound cohort (icp_cohorts, master §5.6–5.10) a
 * company belongs to, read from each cohort row's structured `match` fields.
 * next-434media#63.
 *
 * The rows carry the definition; nothing about any cohort is restated here.
 * The prose target profile stays in the row for people and agents. Matching
 * reads only:
 *
 *   match.industries — categories in the ICP_INDUSTRIES vocabulary
 *                      (lib/prospecting/industry-tags.ts). A company's own
 *                      industry text and name are classified into that
 *                      vocabulary by classifyIndustries().
 *   match.size       — revenue and employee bands, where the cohort is defined
 *                      by size (cohort D). Revenue decides the band when it is
 *                      known; otherwise employee count.
 *
 * A company carries EVERY cohort it matches (matchCohorts), not just one: a
 * cohort matches when it lists one of the company's industries, or when the
 * company's size is inside one of its bands. The founder picks the pitch at
 * lead approval from that list.
 *
 * Review: when no cohort matches and the company's size is unknown (no
 * revenue, no employee count), a size-defined cohort can neither match nor be
 * ruled out, so the company is marked for review rather than scored as no-fit.
 * No match and a known size outside every band is simply no cohort.
 *
 * The ICP rubric scores its Industry dimension from this (lib/icp/rubric.ts).
 */
import { classifyIndustries, type IcpIndustry } from "./industry-tags"

/** A numeric range: gte/lte inclusive, gt/lt exclusive. */
export interface Range {
  gt?: number
  gte?: number
  lt?: number
  lte?: number
}

export interface SizeBand {
  name: string
  revenue_usd?: Range
  employees?: Range
}

export interface CohortMatchFields {
  industries: string[]
  size: { bands: SizeBand[] } | null
}

export interface CohortLike {
  key: string
  letter?: string
  name: string
  match?: CohortMatchFields
}

/** What the matcher reads about a company. */
export interface CompanyFacts {
  industry?: string | null
  company?: string | null
  employeeCount?: number | null
  annualRevenue?: number | null
}

/** One cohort a company matches, and how. */
export interface CohortHit {
  key: string
  letter?: string
  name: string
  /** "industry": a listed industry; "size": inside a size band. */
  via: "industry" | "size"
  /** The company's industries the cohort lists (via "industry"). */
  industries?: IcpIndustry[]
  /** The band the company sits in (via "size"). */
  band?: string
  /** What decided the band: revenue when known, else employees. */
  sizeBasis?: "revenue" | "employees"
}

export interface CohortMatches {
  /** Every cohort the company matches, in cohort-letter order. */
  matches: CohortHit[]
  /** Set when nothing matched and size is unknown: why it needs review. */
  review?: string
}

export function inRange(value: number, r: Range): boolean {
  if (r.gt !== undefined && !(value > r.gt)) return false
  if (r.gte !== undefined && !(value >= r.gte)) return false
  if (r.lt !== undefined && !(value < r.lt)) return false
  if (r.lte !== undefined && !(value <= r.lte)) return false
  return true
}

const known = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n)

/**
 * The band a company sits in. Revenue decides when known (a band with no
 * revenue range cannot be decided by revenue); otherwise employee count.
 * Returns "unknown" when neither is known.
 */
export function bandFor(
  company: CompanyFacts,
  bands: SizeBand[],
): { band: string; basis: "revenue" | "employees" } | null | "unknown" {
  if (known(company.annualRevenue)) {
    const revenue = company.annualRevenue
    const b = bands.find((x) => x.revenue_usd && inRange(revenue, x.revenue_usd))
    return b ? { band: b.name, basis: "revenue" } : null
  }
  if (known(company.employeeCount)) {
    const employees = company.employeeCount
    const b = bands.find((x) => x.employees && inRange(employees, x.employees))
    return b ? { band: b.name, basis: "employees" } : null
  }
  return "unknown"
}

/** Every cohort a company matches, or why it needs review. */
export function matchCohorts(company: CompanyFacts, cohorts: CohortLike[]): CohortMatches {
  const ordered = [...cohorts]
    .filter((c): c is CohortLike & { match: CohortMatchFields } => !!c.match)
    .sort((a, b) => (a.letter ?? a.key).localeCompare(b.letter ?? b.key))
  const have = classifyIndustries(company.industry, company.company)
  const matches: CohortHit[] = []
  let unknownSize = false

  for (const c of ordered) {
    const base = { key: c.key, letter: c.letter, name: c.name }
    const hit = have.filter((i) => c.match.industries.includes(i))
    if (hit.length) {
      matches.push({ ...base, via: "industry", industries: hit })
      continue
    }
    const bands = c.match.size?.bands
    if (!bands?.length) continue
    const b = bandFor(company, bands)
    if (b === "unknown") unknownSize = true
    else if (b) matches.push({ ...base, via: "size", band: b.band, sizeBasis: b.basis })
  }

  if (!matches.length && unknownSize) {
    return {
      matches,
      review: have.length
        ? `industry (${have.join(", ")}) is in no cohort, and size is unknown (no revenue or employee count)`
        : "industry not recognized, and size is unknown (no revenue or employee count)",
    }
  }
  return { matches }
}
