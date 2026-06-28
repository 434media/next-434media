import type { IcpGrade, IcpFitBreakdown } from "@/types/crm-types"
import {
  INDUSTRY_SIGNALS,
  SOUTH_TEXAS_CITIES,
  TEXAS_CITIES,
  HISPANIC_TARGETED_METROS,
} from "@/lib/icp/taxonomy"

/**
 * Canonical ICP FIT score — the single source of truth (Step 2).
 *
 * Company-level FIT on the Canva rubric. The full rubric has six dimensions
 * summing to a fixed total, but unknowns score 0, so scoring only the three
 * dimensions we have data for today (Industry, Location, Company Size) and
 * keeping the deferred three in a 100-point denominator would cap every lead
 * at a C. Instead we NORMALIZE over the *active* dimensions: fit =
 * round(raw / activeMax × 100). As Growth/Funding/Event come online in
 * Step 2b they join the active set and the scale rebalances.
 *
 * Geography is weighted 20 (heavier than Canva's baseline 10) — 434's
 * South-Texas / Hispanic-market focus is a competitive position, not a
 * generic firmographic. See docs/funnel-step2-icp.md.
 *
 * FIT only. Title (a person-level qualifier) and intent (engagement, sponsor)
 * are deliberately NOT here — they're separate axes (see lib/score-lead.ts).
 * Jurisdiction exclusions (EU/UK/CA) are a pre-score gate, not a dimension.
 */

export interface IcpDimension {
  key: "industry" | "location" | "companySize" | "fundingStage" | "growthStage" | "eventActivity"
  label: string
  max: number
  /** Core dims are always in the denominator (unknown = 0). Extended dims join
   *  the denominator only when their data is present for the company. */
  core: boolean
}

export const ICP_DIMENSIONS: IcpDimension[] = [
  { key: "industry", label: "Industry", max: 25, core: true },
  { key: "location", label: "Location", max: 20, core: true }, // heavier than Canva's 10
  { key: "companySize", label: "Company Size", max: 15, core: true },
  { key: "fundingStage", label: "Funding Stage", max: 15, core: false }, // from revenue
  { key: "growthStage", label: "Growth Stage", max: 20, core: false }, // research-sourced
  { key: "eventActivity", label: "Event Activity", max: 15, core: false }, // research-sourced
]

/** Sum of the core dimensions' maxes — always in the denominator (60). */
export const ICP_CORE_MAX = ICP_DIMENSIONS.filter((d) => d.core).reduce((s, d) => s + d.max, 0)

// Growth stage (funding-round / maturity). Sourced from research/enrichment —
// no structured Apollo field. Dormant until populated.
export type GrowthStage = "series_b_plus" | "series_a" | "government" | "seed" | "bootstrapped"

// Event-activity signals (does the company host community moments?). Research-
// sourced. Dormant until populated.
export interface EventActivitySignal {
  conferences?: boolean
  meetups?: boolean
  webinars?: boolean
  community?: boolean
}

export interface IcpCompanyInput {
  industry?: string
  orgName?: string
  /** Free-text location, e.g. a lead's "San Antonio, TX". */
  location?: string
  city?: string
  state?: string
  /** Headcount, e.g. Apollo estimated_num_employees. */
  employeeCount?: number
  /** Annual revenue in USD (Apollo) — Funding Stage proxy. */
  annualRevenue?: number
  /** Growth stage — research-sourced; scored only when provided. */
  growthStage?: GrowthStage
  /** Event-activity signals — research-sourced; scored only when provided. */
  eventActivity?: EventActivitySignal
  // Fallback hints for the prospecting path when real fields are obfuscated
  // (Apollo Free plan): filter keywords inform industry, filter locations
  // inform location. Ignored when real data is present.
  keywordHint?: string
  locationHint?: string
}

export interface IcpFitResult {
  /** 0–100, normalized over the scored dimensions (core + present extended). */
  fit: number
  grade: IcpGrade
  /** Raw points per scored dimension. */
  breakdown: IcpFitBreakdown
  /** Sum of scored raw points (pre-normalization). */
  raw: number
  /** The normalization denominator (core max + present extended maxes). */
  activeMax: number
}

// Grade bands — consistent with the Canva worked example (63 = C) and the
// original 434 spec.
export function icpGrade(fit: number): IcpGrade {
  if (fit >= 90) return "A+"
  if (fit >= 80) return "A"
  if (fit >= 70) return "B"
  if (fit >= 60) return "C"
  return "D"
}

// ─── Dimension scorers (company-level) ──────────────────────────────────

// Industry (max 25) — reuses the prospecting INDUSTRY_SIGNALS taxonomy
// (434's real verticals). Scores are already 22–25; cap at the dimension max.
function scoreIndustry(input: IcpCompanyInput): number {
  const haystack = [input.industry, input.orgName, input.keywordHint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  if (!haystack.trim()) return 0
  let best = 0
  for (const sig of INDUSTRY_SIGNALS) {
    if (sig.patterns.some((p) => p.test(haystack)) && sig.score > best) best = sig.score
  }
  return Math.min(best, 25)
}

// Location (max 20) — 434's geography priority, rescaled heavier than Canva's
// 10. South Texas tops the ladder; any US signal floors at a small credit.
function scoreLocation(input: IcpCompanyInput): number {
  // Real location wins; fall back to the filter-implied hint (Free-plan obfuscation).
  const primary = [input.location, input.city, input.state].filter(Boolean).join(" ").toLowerCase()
  const hay = primary || (input.locationHint || "").toLowerCase()
  if (!hay.trim()) return 0
  if (SOUTH_TEXAS_CITIES.some((c) => hay.includes(c))) return 20 // top ICP priority
  if (/\bmexico\b/.test(hay)) return 18 // border market
  const inTexas = /\b(texas|tx)\b/.test(hay)
  if (inTexas && TEXAS_CITIES.some((c) => hay.includes(c))) return 17
  if (inTexas) return 15
  if (HISPANIC_TARGETED_METROS.some((c) => hay.includes(c))) return 13
  return 4 // some location signal, outside priority geography
}

// Company Size (max 15) — ICP sweet spot 10–500. Institutions (universities,
// hospitals, broadcasters, government) get full credit regardless of headcount.
// Unknown = 0, per the rubric (it counts against fit, not benefit-of-the-doubt).
function scoreCompanySize(input: IcpCompanyInput): number {
  const orgName = input.orgName ?? ""
  const isInstitutional =
    /\b(university|college|institute|foundation|ministries|hospital|broadcast(er)?|government|alliance)\b/i.test(
      orgName,
    )
  if (isInstitutional) return 15
  const n = input.employeeCount
  if (n === undefined) return 0
  if (n >= 10 && n <= 500) return 15
  if (n >= 5 && n < 10) return 10
  if (n > 500 && n <= 1000) return 10
  if (n > 1000) return 5
  return 0 // < 5
}

// ─── Extended dimensions (counted only when data is present) ────────────

// Funding Stage (max 15) — proxied from annual revenue (Apollo gives no round
// data). Higher revenue → more budget for 434's services. The $2–10M → 9 band
// matches the Canva worked example (Lab Cafe, <$10M, 9/15).
function scoreFunding(revenue: number): number {
  if (revenue >= 50_000_000) return 15
  if (revenue >= 10_000_000) return 12
  if (revenue >= 2_000_000) return 9
  if (revenue >= 500_000) return 6
  return 3 // defined but small / bootstrapped
}

// Growth Stage (max 20) — funding-round / maturity, per the original 434 spec.
function scoreGrowth(stage: GrowthStage): number {
  switch (stage) {
    case "series_b_plus": return 20
    case "series_a": return 15
    case "government": return 12
    case "seed": return 10
    case "bootstrapped": return 5
  }
}

// Event Activity (max 15) — does the company host community moments? Scaled
// from the original spec (conferences weightiest).
function scoreEvent(signal: EventActivitySignal): number {
  let s = 0
  if (signal.conferences) s += 6
  if (signal.meetups) s += 3
  if (signal.webinars) s += 3
  if (signal.community) s += 3
  return Math.min(s, 15)
}

export function scoreIcpFit(input: IcpCompanyInput): IcpFitResult {
  // Core dimensions — always scored, always in the denominator (unknown = 0).
  const breakdown: IcpFitBreakdown = {
    industry: scoreIndustry(input),
    location: scoreLocation(input),
    companySize: scoreCompanySize(input),
  }
  let raw = (breakdown.industry ?? 0) + (breakdown.location ?? 0) + (breakdown.companySize ?? 0)
  let denom = ICP_CORE_MAX

  // Extended dimensions — join raw AND denominator only when data is present,
  // so they sharpen rich-data leads without cratering sparse ones.
  if (input.annualRevenue !== undefined) {
    breakdown.fundingStage = scoreFunding(input.annualRevenue)
    raw += breakdown.fundingStage
    denom += 15
  }
  if (input.growthStage !== undefined) {
    breakdown.growthStage = scoreGrowth(input.growthStage)
    raw += breakdown.growthStage
    denom += 20
  }
  if (input.eventActivity !== undefined) {
    breakdown.eventActivity = scoreEvent(input.eventActivity)
    raw += breakdown.eventActivity
    denom += 15
  }

  const fit = denom > 0 ? Math.round((raw / denom) * 100) : 0
  return { fit, grade: icpGrade(fit), breakdown, raw, activeMax: denom }
}
