import type { Lead, LeadPriority, LeadScoreBreakdown, IcpGrade, IcpFitBreakdown } from "@/types/crm-types"
import { isSponsorTagged } from "./tag-taxonomy"
import { scoreIcpFit } from "./icp/rubric"

/**
 * Inline lead scoring. Runs on every write; no Cloud Function needed.
 *
 * Step 2: the score is now the canonical ICP **fit** (0–100, company-level,
 * from lib/icp/rubric.ts) — one number that travels prospect → lead →
 * opportunity unchanged. Signals that aren't company fit are relocated, not
 * dropped:
 *   - engagement / sponsor / event-source → `intent_score` (the second axis;
 *     the full intent model is Step 6)
 *   - title (a person-level qualifier) → handled at the prospecting layer
 *
 * The legacy `score` field mirrors `icp_fit_score` during the transition so
 * existing consumers (KPIs, UI) keep working.
 */

export interface ScoreResult {
  /** Legacy field — mirrors icp_fit_score (0–100) during the transition. */
  score: number
  priority: LeadPriority
  breakdown: LeadScoreBreakdown
  // Canonical ICP fit
  icp_fit_score: number
  icp_grade: IcpGrade
  icp_breakdown: IcpFitBreakdown
  // Relocated intent signals (engagement / sponsor / event-source)
  intent_score: number
  intent_breakdown: { engagement?: number; sponsor?: number; event?: number }
}

type ScoreInput = Pick<
  Lead,
  "location" | "industry" | "title" | "company" | "employee_count" | "source" | "email_opens" | "email_clicks" | "tags"
>

export function scoreLead(input: ScoreInput): ScoreResult {
  // ── ICP FIT (company-level, canonical rubric) — the source of truth ──
  const fit = scoreIcpFit({
    industry: input.industry,
    orgName: input.company,
    location: input.location,
    employeeCount: input.employee_count,
  })

  // ── INTENT (relocated out of fit) — likelihood to engage right now ──
  let intent = 0
  const intent_breakdown: { engagement?: number; sponsor?: number; event?: number } = {}
  // Email engagement — opens or clicks signal warm interest.
  if ((input.email_opens ?? 0) > 2 || (input.email_clicks ?? 0) > 0) {
    intent += 10
    intent_breakdown.engagement = 10
  }
  // Sponsor-tagged target (`intent:sponsor` + legacy aliases).
  if (isSponsorTagged(input.tags)) {
    intent += 5
    intent_breakdown.sponsor = 5
  }
  // Event-sourced capture — in-person leads convert at higher rates. This was
  // folded into the old fit score; it's a warmth/intent signal, not company fit.
  if (input.source === "event") {
    intent += 15
    intent_breakdown.event = 15
  }

  // Priority from ICP grade, with intent as a warmth bump so engaged /
  // event-sourced leads stay near the top (preserves the old engagement→priority
  // behavior the Resend re-score relies on). Contact seniority re-enters
  // priority when the axes are combined in Step 6.
  const priority: LeadPriority =
    fit.fit >= 80 || intent >= 10 ? "high" : fit.fit >= 60 ? "medium" : "low"

  // Keep the legacy breakdown populated from the fit dims so existing UI that
  // reads geography/industry doesn't blank out.
  const breakdown: LeadScoreBreakdown = {
    ...(fit.breakdown.location ? { geography: fit.breakdown.location } : {}),
    ...(fit.breakdown.industry ? { industry: fit.breakdown.industry } : {}),
    ...(intent_breakdown.engagement ? { engagement: intent_breakdown.engagement } : {}),
    ...(intent_breakdown.sponsor ? { sponsor: intent_breakdown.sponsor } : {}),
    ...(intent_breakdown.event ? { event: intent_breakdown.event } : {}),
  }

  return {
    score: fit.fit,
    priority,
    breakdown,
    icp_fit_score: fit.fit,
    icp_grade: fit.grade,
    icp_breakdown: fit.breakdown,
    intent_score: intent,
    intent_breakdown,
  }
}
