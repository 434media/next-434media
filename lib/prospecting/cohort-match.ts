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
 * Results:
 *   match  — an industry the cohort lists, or a size inside one of its bands.
 *            An industry match is preferred to a size match, and among either
 *            the earlier cohort letter wins.
 *   review — nothing matched on industry and the company's size is unknown
 *            (no revenue, no employee count), so a size-defined cohort can
 *            neither match nor be ruled out. Marked for review rather than
 *            scored as no-fit.
 *   null   — no cohort: no listed industry, and a known size outside every band.
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

export type CohortMatch =
  | {
      status: "match"
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
  | {
      status: "review"
      /** Why the company could not be placed. */
      reason: string
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

export function matchCohort(company: CompanyFacts, cohorts: CohortLike[]): CohortMatch | null {
  const ordered = [...cohorts]
    .filter((c): c is CohortLike & { match: CohortMatchFields } => !!c.match)
    .sort((a, b) => (a.letter ?? a.key).localeCompare(b.letter ?? b.key))
  const have = classifyIndustries(company.industry, company.company)

  // 1. Industry: the earliest cohort that lists one of the company's industries.
  for (const c of ordered) {
    const hit = have.filter((i) => c.match.industries.includes(i))
    if (hit.length) {
      return { status: "match", key: c.key, letter: c.letter, name: c.name, via: "industry", industries: hit }
    }
  }

  // 2. Size: the earliest size-defined cohort whose band the company sits in.
  let unknownSize = false
  for (const c of ordered) {
    const bands = c.match.size?.bands
    if (!bands?.length) continue
    const b = bandFor(company, bands)
    if (b === "unknown") {
      unknownSize = true
      continue
    }
    if (b) {
      return { status: "match", key: c.key, letter: c.letter, name: c.name, via: "size", band: b.band, sizeBasis: b.basis }
    }
  }

  // 3. Unknown size where a size-defined cohort could have matched: review.
  if (unknownSize) {
    return {
      status: "review",
      reason: have.length
        ? `industry (${have.join(", ")}) is in no cohort, and size is unknown (no revenue or employee count)`
        : "industry not recognized, and size is unknown (no revenue or employee count)",
    }
  }
  return null
}
