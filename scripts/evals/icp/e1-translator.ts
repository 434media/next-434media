/**
 * E1 — the prospecting translator, with its noise floor (next-434media#63).
 *
 * Translates every prompt in e1-prompts.json `--runs` times in one ICP mode
 * and writes the filters each run produced. Two runs of the same mode give the
 * noise floor; e1-compare.ts judges cross-mode differences against it.
 *
 *   tsx scripts/evals/icp/e1-translator.ts --mode file|cohorts --runs 3 \
 *     [--cohorts <cohorts.json>] --out <e1.json>
 *
 * Calls the model through the AI Gateway, so it needs AI_GATEWAY_API_KEY or a
 * current VERCEL_OIDC_TOKEN. Cohort rows and reports are internal: keep them
 * out of this public repository (see README.md).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import { translatePromptToFilters, type TranslateResult } from "../../../lib/prospecting/translator"

// The options argument exists once the #63 switch lands; before it, the
// translator takes the prompt alone and always reads icp.md (file mode).
type Translate = (prompt: string, options?: { source?: string; cohorts?: unknown[] }) => Promise<TranslateResult>
const translate = translatePromptToFilters as Translate

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
  const mode = arg("mode") ?? "file"
  const runs = Number(arg("runs") ?? 3)
  const out = arg("out")
  if (!out || !["file", "cohorts"].includes(mode)) {
    console.error("usage: e1-translator.ts --mode file|cohorts --runs 3 [--cohorts <cohorts.json>] --out <e1.json>")
    process.exit(2)
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error("E1 needs AI Gateway credentials: set AI_GATEWAY_API_KEY or a current VERCEL_OIDC_TOKEN.")
    process.exit(2)
  }
  const cohortsPath = arg("cohorts")
  if (mode === "cohorts" && !cohortsPath) {
    console.error("--mode cohorts needs --cohorts <cohorts.json> (the icp_cohorts rows)")
    process.exit(2)
  }
  const cohorts = cohortsPath ? (JSON.parse(readFileSync(cohortsPath, "utf-8")) as unknown[]) : undefined
  const prompts = JSON.parse(readFileSync(join(__dirname, "e1-prompts.json"), "utf-8")) as { id: string; prompt: string }[]

  const results = []
  for (const p of prompts) {
    const runsOut = []
    for (let i = 0; i < runs; i++) {
      try {
        const r = await translate(p.prompt, { source: mode, cohorts })
        runsOut.push({
          filters: r.filters,
          icpIndustries: r.icpIndustries ?? [],
          nicheKeyword: r.nicheKeyword ?? null,
          ambiguityNote: r.ambiguityNote ?? null,
          reasoning: r.reasoning,
        })
      } catch (err) {
        runsOut.push({ error: err instanceof Error ? err.message : String(err) })
      }
    }
    results.push({ id: p.id, prompt: p.prompt, runs: runsOut })
    console.log(`${p.id}: ${runsOut.filter((r) => !("error" in r)).length}/${runs} ok`)
  }

  writeFileSync(
    out,
    JSON.stringify({ eval: "E1", mode, runs, generated_at: new Date().toISOString(), git_sha: gitSha(), results }, null, 2),
  )
  console.log(`E1 (${mode}) → ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
