import type { IcpGrade, IcpFitBreakdown } from "@/types/crm-types"
import {
  INDUSTRY_SIGNALS,
  SOUTH_TEXAS_CITIES,
  TEXAS_CITIES,
  HISPANIC_TARGETED_METROS,
} from "@/lib/prospecting/scorer"

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
  key: "industry" | "location" | "companySize" | "growthStage" | "fundingStage" | "eventActivity"
  label: string
  max: number
  /** false = declared in the rubric but not yet scored (activates in Step 2b). */
  active: boolean
}

export const ICP_DIMENSIONS: IcpDimension[] = [
  { key: "industry", label: "Industry", max: 25, active: true },
  { key: "location", label: "Location", max: 20, active: true }, // heavier than Canva's 10
  { key: "companySize", label: "Company Size", max: 15, active: true },
  { key: "growthStage", label: "Growth Stage", max: 20, active: false },
  { key: "fundingStage", label: "Funding Stage", max: 15, active: false },
  { key: "eventActivity", label: "Event Activity", max: 15, active: false },
]

/** Sum of the active dimensions' maxes — the normalization denominator (60 in 2a). */
export const ICP_ACTIVE_MAX = ICP_DIMENSIONS.filter((d) => d.active).reduce((s, d) => s + d.max, 0)

export interface IcpCompanyInput {
  industry?: string
  orgName?: string
  /** Free-text location, e.g. a lead's "San Antonio, TX". */
  location?: string
  city?: string
  state?: string
  /** Headcount, e.g. Apollo estimated_num_employees. */
  employeeCount?: number
}

export interface IcpFitResult {
  /** 0–100, normalized over the active dimensions. */
  fit: number
  grade: IcpGrade
  /** Raw points per active dimension. */
  breakdown: IcpFitBreakdown
  /** Sum of active raw points (pre-normalization). */
  raw: number
  /** The normalization denominator (sum of active maxes). */
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
  const haystack = [input.industry, input.orgName].filter(Boolean).join(" ").toLowerCase()
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
  const hay = [input.location, input.city, input.state].filter(Boolean).join(" ").toLowerCase()
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

export function scoreIcpFit(input: IcpCompanyInput): IcpFitResult {
  const breakdown: IcpFitBreakdown = {
    industry: scoreIndustry(input),
    location: scoreLocation(input),
    companySize: scoreCompanySize(input),
  }
  const raw = (breakdown.industry ?? 0) + (breakdown.location ?? 0) + (breakdown.companySize ?? 0)
  const fit = ICP_ACTIVE_MAX > 0 ? Math.round((raw / ICP_ACTIVE_MAX) * 100) : 0
  return { fit, grade: icpGrade(fit), breakdown, raw, activeMax: ICP_ACTIVE_MAX }
}
