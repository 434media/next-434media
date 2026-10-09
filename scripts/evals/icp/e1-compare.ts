/**
 * Compare two E1 reports against their noise floor (next-434media#63).
 *
 * Within one report, every pair of runs of the same prompt gives the noise
 * floor: how much the translator disagrees with itself. Across reports, every
 * (run in A, run in B) pair gives the cross-mode agreement. A field counts as
 * changed for a prompt only when cross-mode agreement falls below the lower of
 * the two floors.
 *
 *   tsx scripts/evals/icp/e1-compare.ts --a <e1-file.json> --b <e1-cohorts.json> [--md <out.md>]
 */
import { readFileSync, writeFileSync } from "node:fs"

type Filters = Record<string, unknown>
interface Run {
  filters?: Filters
  icpIndustries?: string[]
  error?: string
}
interface Report {
  mode: string
  git_sha: string
  results: { id: string; prompt: string; runs: Run[] }[]
}

// The filter fields compared, each reduced to a set of strings.
const FIELDS = [
  "organization_locations",
  "icp_industries",
  "person_seniorities",
  "person_titles",
  "num_employees_ranges",
  "revenue_range",
  "q_keywords",
  "contact_email_status",
  "organization_job_titles",
  "num_jobs_range",
] as const
type Field = (typeof FIELDS)[number]

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function asSet(run: Run, field: Field): Set<string> {
  const norm = (s: string) => s.trim().toLowerCase()
  if (field === "icp_industries") return new Set((run.icpIndustries ?? []).map(norm))
  const v = run.filters?.[field]
  if (v === undefined || v === null) return new Set()
  if (Array.isArray(v)) return new Set(v.map((x) => norm(String(x))))
  if (typeof v === "object") return new Set(Object.entries(v).map(([k, x]) => `${k}=${x}`))
  return new Set(norm(String(v)).split(/\s+/).filter(Boolean))
}

/** Jaccard similarity; two empty sets agree fully. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return inter / (a.size + b.size - inter)
}

function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
}

function withinFloor(runs: Run[], field: Field): number | null {
  const ok = runs.filter((r) => r.filters)
  const sims: number[] = []
  for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) sims.push(jaccard(asSet(ok[i], field), asSet(ok[j], field)))
  return mean(sims)
}

function cross(a: Run[], b: Run[], field: Field): number | null {
  const sims: number[] = []
  for (const x of a.filter((r) => r.filters)) for (const y of b.filter((r) => r.filters)) sims.push(jaccard(asSet(x, field), asSet(y, field)))
  return mean(sims)
}

const aPath = arg("a")
const bPath = arg("b")
if (!aPath || !bPath) {
  console.error("usage: e1-compare.ts --a <e1.json> --b <e1.json> [--md <out.md>]")
  process.exit(2)
}
const A = JSON.parse(readFileSync(aPath, "utf-8")) as Report
const B = JSON.parse(readFileSync(bPath, "utf-8")) as Report
const bById = new Map(B.results.map((r) => [r.id, r]))
const f = (n: number | null) => (n === null ? "—" : n.toFixed(2))

const lines = [`# E1 comparison: ${A.mode} (\`${A.git_sha}\`) vs ${B.mode} (\`${B.git_sha}\`)`, ""]
const changed: string[] = []
const floorsA: number[] = []
const floorsB: number[] = []
for (const ra of A.results) {
  const rb = bById.get(ra.id)
  if (!rb) continue
  lines.push(`## ${ra.id}`, `> ${ra.prompt}`, "", `| field | floor ${A.mode} | floor ${B.mode} | cross | changed |`, `|---|---|---|---|---|`)
  for (const field of FIELDS) {
    const fa = withinFloor(ra.runs, field)
    const fb = withinFloor(rb.runs, field)
    const cr = cross(ra.runs, rb.runs, field)
    if (fa !== null) floorsA.push(fa)
    if (fb !== null) floorsB.push(fb)
    const floor = Math.min(fa ?? 1, fb ?? 1)
    const isChanged = cr !== null && cr < floor - 1e-9
    if (isChanged) changed.push(`${ra.id}.${field} (cross ${f(cr)} < floor ${f(floor)})`)
    lines.push(`| ${field} | ${f(fa)} | ${f(fb)} | ${f(cr)} | ${isChanged ? "**yes**" : ""} |`)
  }
  const errs = [...ra.runs, ...rb.runs].filter((r) => r.error).length
  if (errs) lines.push("", `${errs} run(s) failed for this prompt.`)
  lines.push("")
}
lines.splice(
  2,
  0,
  `- mean noise floor: ${A.mode} ${f(mean(floorsA))}, ${B.mode} ${f(mean(floorsB))}`,
  `- fields changed beyond the noise floor: ${changed.length}`,
  ...changed.map((c) => `  - ${c}`),
  "",
)
const md = lines.join("\n")
const mdPath = arg("md")
if (mdPath) writeFileSync(mdPath, md + "\n")
console.log(md)
