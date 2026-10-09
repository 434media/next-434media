/**
 * Shared ICP taxonomy — 434's geography lists.
 *
 * Neutral module imported by BOTH the canonical rubric (lib/icp/rubric.ts) and
 * the prospecting scorer (lib/prospecting/scorer.ts) so there's one source of
 * truth and no circular dependency between them.
 */

export const SOUTH_TEXAS_CITIES = [
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

export const TEXAS_CITIES = [
  "austin",
  "houston",
  "dallas",
  "fort worth",
  "el paso",
  "lubbock",
  "amarillo",
  "waco",
]

export const HISPANIC_TARGETED_METROS = [
  "miami",
  "los angeles",
  "chicago",
  "phoenix",
  "albuquerque",
  "denver",
]

// Industry is no longer a hand-written list here: the rubric scores it from the
// outbound cohorts (icp_cohorts) through lib/prospecting/cohort-match.ts
// (next-434media#63).
