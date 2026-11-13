// Scoring on arrival: one rubric. The Organization is scored, because the rubric scores the company
// (lib/icp/rubric.ts, the same scorer every lead write runs through lib/score-lead.ts). No second scorer.

import { scoreIcpFit } from "@/lib/icp/rubric"
import type { CohortLike } from "@/lib/prospecting/cohort-match"
import type { Organization } from "@/types/core-model"

export type ScoredFields = Pick<Organization, "icp_fit_score" | "icp_grade" | "icp_breakdown" | "icp_review" | "scored_at">

export function scoreOrganization(
  org: Pick<Organization, "name" | "industry" | "location" | "employee_count" | "annual_revenue">,
  cohorts: CohortLike[],
  at: string,
): ScoredFields {
  const fit = scoreIcpFit({
    industry: org.industry,
    orgName: org.name,
    location: org.location,
    employeeCount: org.employee_count,
    annualRevenue: org.annual_revenue,
    cohorts,
  })
  return {
    icp_fit_score: fit.fit,
    icp_grade: fit.grade,
    icp_breakdown: fit.breakdown,
    icp_review: fit.needsReview ?? null,
    scored_at: at,
  }
}
