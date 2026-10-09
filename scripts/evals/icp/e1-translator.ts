/**
 * E1 — the prospecting translator, with its noise floor (next-434media#63).
 *
 * Translates every prompt in e1-prompts.json `--runs` times and writes the
 * filters each run produced. Two runs of the same prompt give the noise floor;
 * e1-compare.ts judges differences between two reports against it.
 *
 *   tsx scripts/evals/icp/e1-translator.ts --runs 3 [--cohorts <cohorts.json>] --out <e1.json>
 *
 * Without --cohorts the translator reads `icp_cohorts` itself, through the
 * production reader (lib/firestore-icp-cohorts.ts), so it needs Firestore
 * credentials (GOOGLE_SERVICE_ACCOUNT_KEY). --cohorts substitutes a fixture.
 *
 * Calls the model through the AI Gateway, so it needs AI_GATEWAY_API_KEY or a
 * current VERCEL_OIDC_TOKEN. Cohort rows and reports are internal: keep them
 * out of this public repository (see README.md).
 *
 * Exits 1 if any check fails, on any run:
 *   - a revenue filter on a prompt that states no revenue figure (a cohort's
 *     revenue floor is never a search filter);
 *   - a location outside the United States (cold outbound is US-only,
 *     master 5.3);
 *   - for a prompt marked `expect.no_keyword_with_tags`, a niche q_keywords
 *     term on top of industry tags (translator rule 11);
 *   - for a prompt marked `expect.industries_within_cohort: "<letter>"`, an ICP
 *     industry outside that cohort's match.industries: a query naming one
 *     cohort searches only that cohort's industries.
 *
 * A prompt marked `expected_failure: "<issue>"` is a known failure tracked by
 * that issue: its failures are reported but do not fail the run, and if it
 * starts passing the run says so, so the marker can be removed.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { revenueFigureStated, translatePromptToFilters } from "../../../lib/prospecting/translator"
import { isOutsideUnitedStates } from "../../../lib/prospecting/scorer"
import { listIcpCohorts } from "../../../lib/firestore-icp-cohorts"
import type { OutboundCohort } from "../../../lib/sor/types.generated"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
  } catch {
    return "unknown"
  }
}

async function main() {
  const runs = Number(arg("runs") ?? 3)
  const out = arg("out")
  if (!out) {
    console.error("usage: e1-translator.ts --runs 3 [--cohorts <cohorts.json>] --out <e1.json>")
    process.exit(2)
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error("E1 needs AI Gateway credentials: set AI_GATEWAY_API_KEY or a current VERCEL_OIDC_TOKEN.")
    process.exit(2)
  }
  const cohortsPath = arg("cohorts")
  const cohorts = cohortsPath ? (JSON.parse(readFileSync(cohortsPath, "utf-8")) as OutboundCohort[]) : undefined
  const prompts = JSON.parse(readFileSync(join(__dirname, "e1-prompts.json"), "utf-8")) as {
    id: string
    prompt: string
    expect?: { no_keyword_with_tags?: boolean; industries_within_cohort?: string }
    expected_failure?: string
  }[]

  // The cohort rows the industry check compares against: the fixture if one was
  // given, else the same production read the translator makes.
  const cohortRows = prompts.some((p) => p.expect?.industries_within_cohort) ? (cohorts ?? (await listIcpCohorts())) : []

  const results = []
  const unrequestedRevenue: string[] = []
  const outsideUs: string[] = []
  const keywordOverTags: string[] = []
  const outsideCohort: string[] = []
  const expectedFailures: string[] = []
  for (const p of prompts) {
    const runsOut = []
    for (let i = 0; i < runs; i++) {
      try {
        const r = await translatePromptToFilters(p.prompt, { cohorts })
        runsOut.push({
          filters: r.filters,
          icpIndustries: r.icpIndustries ?? [],
          nicheKeyword: r.nicheKeyword ?? null,
          ambiguityNote: r.ambiguityNote ?? null,
          reasoning: r.reasoning,
        })
        const tag = `${p.id} run ${i + 1}`
        // A known failure is reported against its issue instead of failing the run.
        const fail = (list: string[], what: string) =>
          (p.expected_failure ? expectedFailures : list).push(p.expected_failure ? `${what} [${p.expected_failure}]` : what)
        if (r.filters.revenue_range && !revenueFigureStated(p.prompt)) fail(unrequestedRevenue, tag)
        const foreign = (r.filters.organization_locations ?? []).filter(isOutsideUnitedStates)
        if (foreign.length) fail(outsideUs, `${tag} (${foreign.join(", ")})`)
        if (p.expect?.no_keyword_with_tags && r.filters.industry_tag_ids?.length && r.nicheKeyword) {
          fail(keywordOverTags, `${tag} ("${r.nicheKeyword}")`)
        }
        const letter = p.expect?.industries_within_cohort
        if (letter) {
          const own = new Set<string>(cohortRows.find((c) => c.letter === letter)?.match?.industries ?? [])
          const extra = (r.icpIndustries ?? []).filter((i) => !own.has(i))
          if (!own.size) fail(outsideCohort, `${tag} (cohort ${letter} not found)`)
          else if (extra.length) fail(outsideCohort, `${tag} (${extra.join(", ")})`)
        }
      } catch (err) {
        runsOut.push({ error: err instanceof Error ? err.message : String(err) })
      }
    }
    results.push({ id: p.id, prompt: p.prompt, revenue_figure_stated: revenueFigureStated(p.prompt), runs: runsOut })
    console.log(`${p.id}: ${runsOut.filter((r) => !("error" in r)).length}/${runs} ok`)
  }

  writeFileSync(
    out,
    JSON.stringify(
      {
        eval: "E1",
        mode: "cohorts",
        cohorts_source: cohortsPath ? `fixture: ${cohortsPath}` : "icp_cohorts via lib/firestore-icp-cohorts.ts",
        runs,
        generated_at: new Date().toISOString(),
        git_sha: gitSha(),
        unrequested_revenue_filters: unrequestedRevenue,
        locations_outside_us: outsideUs,
        keyword_over_tags: keywordOverTags,
        industries_outside_named_cohort: outsideCohort,
        expected_failures: expectedFailures,
        results,
      },
      null,
      2,
    ),
  )
  console.log(`E1 → ${out}`)
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "none")
  console.log(`unrequested revenue filters: ${list(unrequestedRevenue)}`)
  console.log(`locations outside the US: ${list(outsideUs)}`)
  console.log(`niche keyword on top of industry tags (rule 11): ${list(keywordOverTags)}`)
  console.log(`industries outside the named cohort: ${list(outsideCohort)}`)
  console.log(`expected failures (tracked, not failing the run): ${list(expectedFailures)}`)
  for (const p of prompts.filter((x) => x.expected_failure)) {
    if (!expectedFailures.some((f) => f.startsWith(`${p.id} `))) {
      console.log(`${p.id} passed: remove its expected_failure marker (${p.expected_failure})`)
    }
  }
  if (unrequestedRevenue.length || outsideUs.length || keywordOverTags.length || outsideCohort.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
