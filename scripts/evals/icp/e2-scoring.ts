/**
 * E2 — the scoring outcome on a frozen snapshot (next-434media#63).
 *
 * Scores every frozen lead and every synthetic case (e2-synthetic.json)
 * through the production scorers, once per filter set, and writes one report.
 * Run it on the code before a change and after it, then e2-compare.ts.
 *
 *   tsx scripts/evals/icp/e2-scoring.ts --snapshot <leads.json> \
 *     [--cohorts <cohorts.json>] [--filters <e1-report.json>] --out <e2.json>
 *
 * The snapshot, cohort rows and reports are internal: keep them out of this
 * public repository (see README.md).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { scoreCandidate, isAboveThreshold, DEFAULT_FIT_THRESHOLD } from "../../../lib/prospecting/scorer"
import { scoreLead } from "../../../lib/score-lead"
import type { ApolloPerson, ApolloSearchFilters } from "../../../lib/prospecting/apollo"
import type { CohortLike } from "../../../lib/prospecting/cohort-match"
import type { LeadSource } from "../../../types/crm-types"

interface SnapshotLead {
  id: string
  company?: string | null
  industry?: string | null
  location?: string | null
  employee_count?: number | null
  annual_revenue?: number | null
  title?: string | null
  source?: string | null
  status?: string | null
}

interface SyntheticCase {
  case: string
  expect_excluded: boolean
  person: ApolloPerson
}

interface FilterSet {
  name: string
  filters: ApolloSearchFilters
}

// Optional: the cohort matcher only exists once the #63 switch lands. The
// baseline runs without it.
// Two shapes over time: the prose matcher returned { key, terms, ... }; the
// structured matcher returns { status: "match", key, via, ... } or
// { status: "review", reason }.
type CohortMatcher = (
  company: { industry?: string; company?: string; employeeCount?: number; annualRevenue?: number },
  cohorts: unknown[],
) => Record<string, unknown> | null

// Since #63's scoring change the scorers take the cohorts as a last argument.
// Code from before it ignores the extra argument, so one script runs on both.
type LeadScorer = (input: Parameters<typeof scoreLead>[0], cohorts: CohortLike[]) => ReturnType<typeof scoreLead>
type CandidateScorer = (
  person: ApolloPerson,
  filters: ApolloSearchFilters,
  cohorts: CohortLike[],
) => ReturnType<typeof scoreCandidate>
const scoreLeadWith = scoreLead as unknown as LeadScorer
const scoreCandidateWith = scoreCandidate as unknown as CandidateScorer

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const ICP_MATCH_THRESHOLD = Number(process.env.ICP_MATCH_THRESHOLD ?? 70)

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
  } catch {
    return "unknown"
  }
}

/** "San Antonio, Texas" → city + state, the way Apollo would carry them. */
function splitLocation(location?: string | null): { city?: string; state?: string } {
  if (!location) return {}
  const [city, state] = location.split(",").map((s) => s.trim())
  return { city: city || undefined, state: state || undefined }
}

function leadToPerson(l: SnapshotLead): ApolloPerson {
  const { city, state } = splitLocation(l.location)
  return {
    id: l.id,
    first_name: "",
    title: l.title ?? undefined,
    city,
    state,
    organization: {
      name: l.company ?? "",
      industry: l.industry ?? undefined,
      estimated_num_employees: l.employee_count ?? undefined,
      annual_revenue: l.annual_revenue ?? undefined,
    },
  } as ApolloPerson
}

function filterSets(e1Path?: string): FilterSet[] {
  const sets: FilterSet[] = [
    { name: "none", filters: {} },
    { name: "texas-default", filters: { organization_locations: ["Texas, US"] } },
  ]
  if (!e1Path) return sets
  const e1 = JSON.parse(readFileSync(e1Path, "utf-8")) as {
    mode: string
    results: { id: string; runs: { filters?: ApolloSearchFilters; error?: string }[] }[]
  }
  for (const r of e1.results) {
    const first = r.runs.find((run) => run.filters)
    if (first?.filters) sets.push({ name: `e1:${e1.mode}:${r.id}`, filters: first.filters })
  }
  return sets
}

async function loadMatcher(): Promise<CohortMatcher | null> {
  try {
    // A variable path keeps the baseline compiling before the module exists.
    const modulePath: string = "../../../lib/prospecting/cohort-match"
    const mod = (await import(modulePath)) as {
      matchCohort?: CohortMatcher
      matchCohorts?: (company: Parameters<CohortMatcher>[0], cohorts: unknown[]) => {
        matches: { key: string }[]
        review?: string
      }
    }
    // Since every match is carried (matchCohorts), a company's cohorts are a
    // list; it is folded into the older single-match shape for the report.
    if (mod.matchCohorts) {
      const many = mod.matchCohorts
      return (company, cohorts) => {
        const r = many(company, cohorts)
        if (r.review) return { status: "review", reason: r.review }
        if (!r.matches.length) return null
        return { status: "match", key: r.matches.map((m) => m.key).join(","), matches: r.matches }
      }
    }
    return mod.matchCohort ?? null
  } catch {
    return null
  }
}

async function main() {
  const snapshotPath = arg("snapshot")
  const out = arg("out")
  if (!snapshotPath || !out) {
    console.error("usage: e2-scoring.ts --snapshot <leads.json> [--cohorts <cohorts.json>] [--filters <e1.json>] --out <e2.json>")
    process.exit(2)
  }
  const leads = JSON.parse(readFileSync(snapshotPath, "utf-8")) as SnapshotLead[]
  const synthetic = JSON.parse(readFileSync(join(__dirname, "e2-synthetic.json"), "utf-8")) as SyntheticCase[]
  const cohortsPath = arg("cohorts")
  const cohorts = cohortsPath ? (JSON.parse(readFileSync(cohortsPath, "utf-8")) as CohortLike[]) : null
  const matcher = cohorts ? await loadMatcher() : null
  const sets = filterSets(arg("filters"))

  const cases: { id: string; kind: "lead" | "synthetic"; person: ApolloPerson; lead?: SnapshotLead; expect_excluded?: boolean }[] = [
    ...leads.map((l) => ({ id: l.id, kind: "lead" as const, person: leadToPerson(l), lead: l })),
    ...synthetic.map((s) => ({ id: s.case, kind: "synthetic" as const, person: s.person, expect_excluded: s.expect_excluded })),
  ]

  const rows = []
  for (const c of cases) {
    // Lead path: the canonical fit a stored lead carries (no filters involved).
    const leadFit = c.lead
      ? scoreLeadWith({
          company: c.lead.company ?? "",
          industry: c.lead.industry ?? undefined,
          location: c.lead.location ?? undefined,
          title: c.lead.title ?? undefined,
          employee_count: c.lead.employee_count ?? undefined,
          annual_revenue: c.lead.annual_revenue ?? undefined,
          source: (c.lead.source ?? "manual") as LeadSource,
          // Engagement is intent, not fit; zero keeps the fit comparison clean.
          email_opens: 0,
          email_clicks: 0,
        }, cohorts ?? [])
      : null
    const cohort =
      matcher && cohorts
        ? matcher(
            {
              industry: c.person.organization?.industry,
              company: c.person.organization?.name,
              employeeCount: c.person.organization?.estimated_num_employees,
              annualRevenue: c.person.organization?.annual_revenue,
            },
            cohorts,
          )
        : undefined
    const bySet: Record<
      string,
      { score: number; grade: string; excluded: boolean; approve: boolean; review?: string; breakdown: unknown }
    > = {}
    for (const s of sets) {
      const scored = scoreCandidateWith(c.person, s.filters, cohorts ?? []) as ReturnType<typeof scoreCandidate> & {
        needsReview?: string
      }
      bySet[s.name] = {
        score: scored.score,
        grade: scored.grade,
        excluded: scored.score === -1,
        approve: isAboveThreshold(scored.score),
        ...(scored.needsReview ? { review: scored.needsReview } : {}),
        breakdown: scored.breakdown,
      }
    }
    rows.push({
      id: c.id,
      kind: c.kind,
      company: c.person.organization?.name ?? "",
      expect_excluded: c.expect_excluded,
      lead_fit: leadFit?.icp_fit_score ?? null,
      lead_grade: leadFit?.icp_grade ?? null,
      lead_breakdown: leadFit?.icp_breakdown ?? null,
      lead_review: (leadFit as { icp_review?: string | null } | null)?.icp_review ?? null,
      icp_match: leadFit ? leadFit.icp_fit_score >= ICP_MATCH_THRESHOLD : null,
      cohort:
        cohort === undefined
          ? undefined
          : cohort === null
            ? null
            : cohort.status === "review"
              ? "review"
              : ((cohort.key as string) ?? null),
      cohort_detail: cohort === undefined || cohort === null ? cohort : cohort,
      by_set: bySet,
    })
  }

  const leadRows = rows.filter((r) => r.kind === "lead")
  const synth = rows.filter((r) => r.kind === "synthetic")
  const synthMismatch = synth.filter((r) => r.by_set.none.excluded !== r.expect_excluded).map((r) => r.id)
  const report = {
    eval: "E2",
    generated_at: new Date().toISOString(),
    git_sha: gitSha(),
    thresholds: { approve: DEFAULT_FIT_THRESHOLD, icp_match: ICP_MATCH_THRESHOLD },
    snapshot: { path: snapshotPath, leads: leads.length },
    synthetic_cases: synthetic.length,
    filter_sets: sets.map((s) => s.name),
    cohort_match: matcher ? "on" : "off",
    summary: {
      icp_match_rate: leadRows.length ? leadRows.filter((r) => r.icp_match).length / leadRows.length : 0,
      cohort_match_rate: matcher
        ? leadRows.filter((r) => r.cohort && r.cohort !== "review").length / Math.max(leadRows.length, 1)
        : null,
      review_count_leads: leadRows.filter((r) => r.lead_review).length,
      approve_count_no_filters: rows.filter((r) => r.by_set.none.approve).length,
      excluded_count_no_filters: rows.filter((r) => r.by_set.none.excluded).length,
      synthetic_expectation_mismatches: synthMismatch,
    },
    rows,
  }
  writeFileSync(out, JSON.stringify(report, null, 2))
  console.log(
    `E2 @ ${report.git_sha}: ${leads.length} leads + ${synthetic.length} synthetic × ${sets.length} filter sets → ${out}`,
  )
  console.log(JSON.stringify(report.summary))
  if (synthMismatch.length) process.exitCode = 1
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
