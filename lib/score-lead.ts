import type { Lead, LeadPriority, LeadScoreBreakdown } from "@/types/crm-types"

/**
 * Inline lead scoring (0–100). Runs on every write; no Cloud Function needed.
 *
 * Why inline: with Zapier removed, every write to the `leads` collection goes
 * through one of our own API routes. Scoring there avoids a second deploy
 * target (Cloud Functions + Blaze plan) and the `onWrite` recursion footgun
 * the spec's Cloud Function had.
 *
 * Adjust weights here when targeting changes — this is the one source of truth.
 */

const GEO_TERMS = ["TX", "Texas", "San Antonio", "Mexico", "LATAM", "Monterrey"]
const INDUSTRIES = [
  "cpg",
  "healthcare",
  "finance",
  "real estate",
  "government",
  "tech",
  "retail",
  "food",
  "beverage",
]
const DECISION_MAKER_TITLES = [
  "CMO",
  "VP",
  "Director",
  "Head of",
  "Founder",
  "CEO",
  "President",
  "Owner",
]

export interface ScoreResult {
  score: number
  priority: LeadPriority
  breakdown: LeadScoreBreakdown
}

type ScoreInput = Pick<
  Lead,
  | "location"
  | "industry"
  | "title"
  | "source"
  | "email_opens"
  | "email_clicks"
  | "tags"
>

export function scoreLead(input: ScoreInput): ScoreResult {
  let score = 0
  const breakdown: LeadScoreBreakdown = {}

  // Geography fit (+25) — Texas / LATAM relevance
  if (input.location && GEO_TERMS.some((t) => input.location!.includes(t))) {
    score += 25
    breakdown.geography = 25
  }

  // Industry fit (+25) — verticals 434media has audience proof in
  if (
    input.industry &&
    INDUSTRIES.some((i) => input.industry!.toLowerCase().includes(i))
  ) {
    score += 25
    breakdown.industry = 25
  }

  // Decision-maker title (+20)
  if (
    input.title &&
    DECISION_MAKER_TITLES.some((t) => input.title!.includes(t))
  ) {
    score += 20
    breakdown.title = 20
  }

  // Event source (+15) — in-person captures convert at higher rates
  if (input.source === "event") {
    score += 15
    breakdown.event = 15
  }

  // Email engagement (+10) — opens or clicks signal warm interest
  if ((input.email_opens ?? 0) > 2 || (input.email_clicks ?? 0) > 0) {
    score += 10
    breakdown.engagement = 10
  }

  // Sponsor/brand tag (+5) — manually flagged as a sponsorship target
  if (input.tags?.includes("sponsor") || input.tags?.includes("brand")) {
    score += 5
    breakdown.sponsor = 5
  }

  const priority: LeadPriority = score >= 65 ? "high" : score >= 40 ? "medium" : "low"

  return { score, priority, breakdown }
}
