/**
 * Cohort match — which outbound cohort (icp_cohorts, master §5.6–5.10) a
 * company's industry and name point to. next-434media#63.
 *
 * Informational, not a score: it sits next to ICP match and changes no
 * threshold, approval or exclusion. The terms come from each cohort row's own
 * `target_profile` wording, so a cohort edit in the system of record changes
 * the match with no code change. The cohort list is never restated here.
 *
 * Deliberately simple: a word overlap between the company's industry and name
 * and the cohort's target-profile words, after dropping words that carry no
 * targeting meaning. Each matched word counts by how specific it is to the
 * cohort (how often the cohort uses it, divided by how many cohorts use it), so
 * "health" in Bio & Health outweighs the same word in a defense phrase. A
 * company word also matches a cohort word it starts with ("healthcare" →
 * "health"). Geography is not matched (every cohort is Texas-relevant, and
 * location is the ICP rubric's job).
 */

export interface CohortLike {
  key: string
  letter?: string
  name: string
  target_profile: string[]
}

export interface CohortMatch {
  key: string
  letter?: string
  name: string
  /** The cohort words the company matched, for the review surface. */
  terms: string[]
}

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
  "technology", "system", "media", "marketing", "relation",
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

/** The targeting words of one cohort with how often its phrases use each. */
export function cohortTermCounts(cohort: CohortLike): Map<string, number> {
  const counts = new Map<string, number>()
  for (const phrase of cohort.target_profile) {
    for (const w of words(phrase)) if (!STOP_WORDS.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  return counts
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

/**
 * The cohort whose target-profile words best overlap the company's industry
 * and name, or null when none does. Ties go to the earlier cohort letter.
 */
export function matchCohort(
  company: { industry?: string | null; company?: string | null },
  cohorts: CohortLike[],
): CohortMatch | null {
  const have = new Set(words(`${company.industry ?? ""} ${company.company ?? ""}`))
  if (!have.size) return null
  const ordered = [...cohorts].sort((a, b) => (a.letter ?? a.key).localeCompare(b.letter ?? b.key))
  const counts = ordered.map((c) => cohortTermCounts(c))
  // How many cohorts use each word — a word every cohort shares says little.
  const spread = new Map<string, number>()
  for (const m of counts) for (const t of m.keys()) spread.set(t, (spread.get(t) ?? 0) + 1)

  let best: (CohortMatch & { weight: number }) | null = null
  ordered.forEach((c, i) => {
    const matched = [...counts[i].entries()].filter(([t]) => hits(have, t))
    const weight = matched.reduce((sum, [t, n]) => sum + n / (spread.get(t) ?? 1), 0)
    if (matched.length && (!best || weight > best.weight)) {
      best = { key: c.key, letter: c.letter, name: c.name, terms: matched.map(([t]) => t), weight }
    }
  })
  if (!best) return null
  const { weight: _weight, ...match } = best as CohortMatch & { weight: number }
  return match
}
