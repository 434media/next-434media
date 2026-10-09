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
 * Exits 1 if any run sets a revenue filter on a prompt that states no revenue
 * figure: a cohort's revenue floor is never a search filter.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { revenueFigureStated, translatePromptToFilters } from "../../../lib/prospecting/translator"
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
  const prompts = JSON.parse(readFileSync(join(__dirname, "e1-prompts.json"), "utf-8")) as { id: string; prompt: string }[]

  const results = []
  const unrequestedRevenue: string[] = []
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
        if (r.filters.revenue_range && !revenueFigureStated(p.prompt)) unrequestedRevenue.push(`${p.id} run ${i + 1}`)
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
        results,
      },
      null,
      2,
    ),
  )
  console.log(`E1 → ${out}`)
  console.log(`unrequested revenue filters: ${unrequestedRevenue.length ? unrequestedRevenue.join(", ") : "none"}`)
  if (unrequestedRevenue.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
