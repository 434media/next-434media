/**
 * Compare two E2 reports (next-434media#63). Fails if any exclusion decision
 * differs; lists every approve flip, grade change and ICP-match change.
 *
 *   tsx scripts/evals/icp/e2-compare.ts --before <e2-baseline.json> --after <e2-after.json> [--md <out.md>]
 */
import { readFileSync, writeFileSync } from "node:fs"

type Breakdown = Record<string, number | undefined> | null | undefined
interface Row {
  id: string
  kind: string
  company: string
  lead_fit: number | null
  lead_grade: string | null
  lead_breakdown?: Breakdown
  icp_match: boolean | null
  lead_review?: string | null
  cohort?: string | null
  cohort_detail?: Record<string, unknown> | null
  by_set: Record<
    string,
    { score: number; grade: string; excluded: boolean; approve: boolean; review?: string; breakdown?: Breakdown }
  >
}

/** Which rubric dimensions moved, e.g. "industry 22→0". */
function why(a: Breakdown, b: Breakdown): string {
  if (!a || !b) return "breakdown not recorded"
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  const moved = keys.filter((k) => a[k] !== b[k]).map((k) => `${k} ${a[k] ?? "–"}→${b[k] ?? "–"}`)
  return moved.length ? moved.join(", ") : "no dimension moved"
}

function cohortWhy(r: Row): string {
  const d = r.cohort_detail
  if (!d) return "no match"
  if (d.status === "review") return `review: ${d.reason}`
  if (d.via === "industry") return `industry ${(d.industries as string[]).join(", ")}`
  if (d.via === "size") return `size band ${d.band} (by ${d.sizeBasis})`
  const parts = []
  if (Array.isArray(d.terms) && d.terms.length) parts.push(`words ${d.terms.join(", ")}`)
  if (d.bySize) parts.push("enterprise size")
  if (d.byRevenueBand) parts.push("revenue band + signal word")
  return parts.join("; ") || "match"
}

// A candidate under review is neither approved nor rejected.
const decision = (x: { approve: boolean; review?: string }) => (x.review ? "review" : String(x.approve))
interface Report {
  git_sha: string
  generated_at: string
  filter_sets: string[]
  summary: Record<string, unknown>
  rows: Row[]
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const beforePath = arg("before")
const afterPath = arg("after")
if (!beforePath || !afterPath) {
  console.error("usage: e2-compare.ts --before <e2.json> --after <e2.json> [--md <out.md>]")
  process.exit(2)
}
const before = JSON.parse(readFileSync(beforePath, "utf-8")) as Report
const after = JSON.parse(readFileSync(afterPath, "utf-8")) as Report
const afterById = new Map(after.rows.map((r) => [r.id, r]))

// Only filter sets present in both reports are comparable.
const sets = before.filter_sets.filter((s) => after.filter_sets.includes(s))
const exclusionDiffs: string[] = []
const approveFlips: string[] = []
const gradeChanges: string[] = []
const matchChanges: string[] = []
const cohortChanges: string[] = []
const missing: string[] = []

for (const b of before.rows) {
  const a = afterById.get(b.id)
  if (!a) {
    missing.push(b.id)
    continue
  }
  if (b.lead_fit !== a.lead_fit || b.lead_grade !== a.lead_grade) {
    gradeChanges.push(
      `${b.id} (${b.company}): lead fit ${b.lead_fit}/${b.lead_grade} → ${a.lead_fit}/${a.lead_grade} — ${why(b.lead_breakdown, a.lead_breakdown)}`,
    )
  }
  if ((b.cohort ?? null) !== (a.cohort ?? null)) {
    cohortChanges.push(`${b.id} (${b.company}): cohort ${b.cohort ?? "none"} → ${a.cohort ?? "none"} — ${cohortWhy(a)}`)
  }
  if (b.icp_match !== a.icp_match) {
    matchChanges.push(`${b.id} (${b.company}): ICP match ${b.icp_match} → ${a.icp_match}`)
  }
  for (const s of sets) {
    const x = b.by_set[s]
    const y = a.by_set[s]
    if (x.excluded !== y.excluded) exclusionDiffs.push(`${b.id} (${b.company}) [${s}]: excluded ${x.excluded} → ${y.excluded}`)
    if (decision(x) !== decision(y)) {
      approveFlips.push(
        `${b.id} (${b.company}) [${s}]: approve ${decision(x)} → ${decision(y)} (score ${x.score} → ${y.score}; ${why(x.breakdown, y.breakdown)}${y.review ? `; ${y.review}` : ""})`,
      )
    }
  }
}

const lines = [
  `# E2 comparison`,
  ``,
  `- before: \`${before.git_sha}\` (${before.generated_at})`,
  `- after: \`${after.git_sha}\` (${after.generated_at})`,
  `- rows: ${before.rows.length}; filter sets compared: ${sets.join(", ")}`,
  `- **exclusions identical: ${exclusionDiffs.length === 0 ? "yes" : `NO (${exclusionDiffs.length} differ)`}**`,
  `- approve flips: ${approveFlips.length}`,
  `- lead fit/grade changes: ${gradeChanges.length}; ICP-match changes: ${matchChanges.length}; cohort changes: ${cohortChanges.length}`,
  missing.length ? `- rows missing after: ${missing.join(", ")}` : `- rows missing after: none`,
  ``,
  `## Exclusion differences`,
  ...(exclusionDiffs.length ? exclusionDiffs.map((l) => `- ${l}`) : ["none"]),
  ``,
  `## Approve flips`,
  ...(approveFlips.length ? approveFlips.map((l) => `- ${l}`) : ["none"]),
  ``,
  `## Lead fit / grade changes`,
  ...(gradeChanges.length ? gradeChanges.map((l) => `- ${l}`) : ["none"]),
  ``,
  `## ICP-match changes`,
  ...(matchChanges.length ? matchChanges.map((l) => `- ${l}`) : ["none"]),
  ``,
  `## Cohort changes`,
  ...(cohortChanges.length ? cohortChanges.map((l) => `- ${l}`) : ["none"]),
  ``,
  `Summary before: \`${JSON.stringify(before.summary)}\``,
  ``,
  `Summary after: \`${JSON.stringify(after.summary)}\``,
]
const md = lines.join("\n")
const mdPath = arg("md")
if (mdPath) writeFileSync(mdPath, md + "\n")
console.log(md)
if (exclusionDiffs.length || missing.length) process.exitCode = 1
