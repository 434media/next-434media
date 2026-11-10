/**
 * Run an exam suite against recorded outputs (434 build sequence V1 item 3, IMP-27).
 *
 *   tsx scripts/exam/run.ts --suite <suite folder> --recordings <recordings.json> [--out <folder>] [--only id,id] [--check]
 *
 * Writes <out>/<suite>-<executor>.json (every output, for whoever may read it) and .md (pass or fail with the reason per
 * case, and the run log), and prints the Markdown. --check exits 1 when any case fails.
 *
 * Only the recorded executor runs from here. It calls no model and sends nothing. Our engine (engineExecutor in
 * lib/exam/executors.ts) spends Gateway credit, so it does not run from a laptop key or from CI: a live run belongs
 * behind a super-admin gate, as /api/admin/engine/smoke does. Business suites live in 434-context, not in this public
 * repository; pass their path.
 */
import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { recordedExecutor, Recordings } from "../../lib/exam/executors"
import { reportMarkdown, runSuite } from "../../lib/exam/runner"
import { loadSuite } from "../../lib/exam/suite"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main() {
  const suiteDir = arg("suite"), recPath = arg("recordings")
  if (arg("executor") && arg("executor") !== "recorded") {
    console.error("Only --executor recorded runs from here. A live engine run spends Gateway credit and runs behind a super-admin gate; see lib/exam/README.md.")
    process.exit(2)
  }
  if (!suiteDir || !recPath) {
    console.error("usage: tsx scripts/exam/run.ts --suite <folder> --recordings <file.json> [--out <folder>] [--only id,id] [--check]")
    process.exit(2)
  }
  const suite = await loadSuite(suiteDir)
  const rec = Recordings.parse(JSON.parse(readFileSync(recPath, "utf8")))
  let gitSha: string | undefined
  try { gitSha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() } catch { /* not a checkout */ }
  const only = arg("only")?.split(",").map(s => s.trim()).filter(Boolean)
  const report = await runSuite(suite, recordedExecutor(rec), { gitSha, only })
  const md = reportMarkdown(report)
  const out = arg("out")
  if (out) {
    mkdirSync(out, { recursive: true })
    const base = join(out, `${suite.spec.id}-${rec.executor}`)
    writeFileSync(`${base}.json`, JSON.stringify(report, null, 2) + "\n")
    writeFileSync(`${base}.md`, md)
  }
  console.log(md)
  if (process.argv.includes("--check") && report.totals.fail > 0) process.exit(1)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(2) })
