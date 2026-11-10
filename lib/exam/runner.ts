/**
 * The exam's one runner (IMP-27): every case of a suite through one executor, each assertion checked, and a report of
 * pass or fail with the reason per case, plus a run log of tokens and cost. Cases run one at a time, so a live run's
 * spend is bounded by the suite and a failure is attributable to one case.
 */
import { annotateScope, check, type CheckResult, type ExamOutput, type ExamUsage, type Judge } from "./assertions"
import type { Executor } from "./executors"
import type { CaseSpec, Suite } from "./suite"

/**
 * pass: every assertion passed. fail: at least one failed. partial: none failed but some were skipped (a judged
 * assertion with no judge). no-output: the executor produced nothing to check (no recording, a refused skill).
 */
export type CaseStatus = "pass" | "fail" | "partial" | "no-output"

export interface CaseResult {
  id: string
  title: string
  category: string
  author?: string
  status: CaseStatus
  /** The first failing reason, or the executor's error: the one line a reader needs. */
  reason: string
  checks: CheckResult[]
  /** When the case carries a person's verdict: whether the exam's result agrees with it. */
  agreesWithReview?: boolean
  reviewLabel?: string
  usage?: ExamUsage
  costUsd: number | null
  ms: number
  output: ExamOutput
}

export interface ExamReport {
  suite: { id: string; title: string; version: string; sha256: string; subject?: string }
  executor: string
  startedAt: string
  finishedAt: string
  /** The code version that ran, when the caller knows it. */
  gitSha?: string
  cases: CaseResult[]
  totals: {
    cases: number
    pass: number
    fail: number
    partial: number
    noOutput: number
    reviewed: number
    agreeWithReview: number
    usage: Required<ExamUsage>
    /** Sum of provider-reported costs; null when no case reported one. Never an estimate. */
    costUsd: number | null
    casesWithCost: number
  }
}

export interface RunOptions {
  judge?: Judge
  /** Run only these case ids. */
  only?: string[]
  gitSha?: string
  now?: () => Date
}

export async function runSuite(suite: Suite, executor: Executor, opts: RunOptions = {}): Promise<ExamReport> {
  const now = opts.now ?? (() => new Date())
  const startedAt = now().toISOString()
  const cases = opts.only ? suite.cases.filter(c => opts.only!.includes(c.id)) : suite.cases
  const results: CaseResult[] = []
  for (const c of cases) results.push(await runCase(suite, c, executor, opts.judge))
  return { suite: { id: suite.spec.id, title: suite.spec.title, version: suite.spec.version, sha256: suite.sha256, subject: suite.spec.subject }, executor: executor.name, startedAt, finishedAt: now().toISOString(), gitSha: opts.gitSha, cases: results, totals: totals(results) }
}

async function runCase(suite: Suite, c: CaseSpec, executor: Executor, judge?: Judge): Promise<CaseResult> {
  const t = Date.now()
  let out: ExamOutput
  try { out = await executor.run(c, suite.spec) } catch (e) { out = { text: "", toolCalls: [], error: `executor threw: ${(e as Error).message}` } }
  out = annotateScope(out, c, suite.spec)
  let costUsd = out.costUsd ?? null
  const usage: ExamUsage = { ...(out.usage ?? {}) }
  const base = { id: c.id, title: c.title, category: c.category, ...(c.author ? { author: c.author } : {}), output: out }
  if (out.error && !out.text && !out.toolCalls.length) {
    return { ...base, status: "no-output", reason: out.error, checks: [], costUsd, usage, ms: Date.now() - t, ...review(c, "no-output") }
  }
  const checks: CheckResult[] = []
  for (const a of c.expect) {
    if (a.type === "judged" && judge) {
      try {
        const j = await judge.judge({ criteria: a.criteria, reference: a.reference ?? c.reference, output: out, caseSpec: c })
        checks.push({ type: "judged", status: j.pass ? "pass" : "fail", reason: `judge: ${j.reason}`, ...(a.why ? { why: a.why } : {}) })
        if (j.costUsd != null) costUsd = (costUsd ?? 0) + j.costUsd
        for (const k of ["inputTokens", "outputTokens", "reasoningTokens"] as const) if (j.usage?.[k] != null) usage[k] = (usage[k] ?? 0) + j.usage[k]!
      } catch (e) {
        checks.push({ type: "judged", status: "skipped", reason: `judge failed: ${(e as Error).message}` })
      }
    } else checks.push(check(a, out, suite.spec))
  }
  // An output the executor itself marked bad (a truncated answer) fails, whatever the checks say.
  if (out.error) checks.unshift({ type: "executor", status: "fail", reason: out.error })
  const failed = checks.find(k => k.status === "fail")
  const status: CaseStatus = failed ? "fail" : checks.some(k => k.status === "skipped") ? "partial" : "pass"
  const reason = failed ? `${failed.reason}${failed.why ? ` (rule: ${failed.why})` : ""}` : status === "partial" ? "deterministic checks passed; judged checks not run" : "all checks passed"
  return { ...base, status, reason, checks, costUsd, usage, ms: Date.now() - t, ...review(c, status) }
}

/** A case reviewed "approved unedited" should pass; one "approved with edits" or "rejected" should not. */
function review(c: CaseSpec, status: CaseStatus): Pick<CaseResult, "agreesWithReview" | "reviewLabel"> {
  if (!c.reviewed || status === "no-output" || status === "partial") return c.reviewed ? { reviewLabel: c.reviewed.label } : {}
  const shouldPass = c.reviewed.label === "approved unedited"
  return { reviewLabel: c.reviewed.label, agreesWithReview: (status === "pass") === shouldPass }
}

function totals(rs: CaseResult[]): ExamReport["totals"] {
  const sum = (k: keyof ExamUsage) => rs.reduce((n, r) => n + (r.usage?.[k] ?? 0), 0)
  const costed = rs.filter(r => r.costUsd != null)
  return {
    cases: rs.length,
    pass: rs.filter(r => r.status === "pass").length,
    fail: rs.filter(r => r.status === "fail").length,
    partial: rs.filter(r => r.status === "partial").length,
    noOutput: rs.filter(r => r.status === "no-output").length,
    reviewed: rs.filter(r => r.agreesWithReview !== undefined).length,
    agreeWithReview: rs.filter(r => r.agreesWithReview === true).length,
    usage: { inputTokens: sum("inputTokens"), outputTokens: sum("outputTokens"), reasoningTokens: sum("reasoningTokens"), cacheReadTokens: sum("cacheReadTokens"), cacheWriteTokens: sum("cacheWriteTokens") },
    costUsd: costed.length ? costed.reduce((n, r) => n + (r.costUsd ?? 0), 0) : null,
    casesWithCost: costed.length,
  }
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ")

/**
 * The report as Markdown: a summary, one row per case with its reason, and the run log of tokens and cost. Outputs are
 * left out on purpose: a business suite's outputs carry business content, and the JSON report holds them for whoever
 * may read it.
 */
export function reportMarkdown(r: ExamReport): string {
  const t = r.totals
  const money = (n: number | null) => (n == null ? "not reported" : `$${n.toFixed(4)}`)
  const lines = [
    `# Exam: ${r.suite.title}`,
    "",
    `- **Suite:** \`${r.suite.id}\` v${r.suite.version}, sha256 \`${r.suite.sha256.slice(0, 16)}\`${r.suite.subject ? `, examining ${r.suite.subject}` : ""}`,
    `- **Executor:** \`${r.executor}\``,
    `- **Ran:** ${r.startedAt} to ${r.finishedAt}${r.gitSha ? `, code \`${r.gitSha.slice(0, 12)}\`` : ""}`,
    `- **Result:** ${t.pass} pass, ${t.fail} fail${t.partial ? `, ${t.partial} partial` : ""}${t.noOutput ? `, ${t.noOutput} no output` : ""} of ${t.cases}`,
    ...(t.reviewed ? [`- **Agreement with the reviewer's verdicts:** ${t.agreeWithReview} of ${t.reviewed}`] : []),
    "",
    "| Case | Category | Result | Reason |" + (t.reviewed ? " Review | Agrees |" : ""),
    "|---|---|---|---|" + (t.reviewed ? "---|---|" : ""),
    ...r.cases.map(c => `| \`${c.id}\` ${cell(c.title)} | ${cell(c.category)} | **${c.status}** | ${cell(c.reason)} |` + (t.reviewed ? ` ${c.reviewLabel ?? ""} | ${c.agreesWithReview === undefined ? "" : c.agreesWithReview ? "yes" : "**no**"} |` : "")),
    "",
    "## Run log",
    "",
    "| Case | Model | Input | Output | Reasoning | Cache read | Cache write | Cost | ms |",
    "|---|---|---|---|---|---|---|---|---|",
    ...r.cases.map(c => `| \`${c.id}\` | ${c.output.model ?? ""} | ${c.usage?.inputTokens ?? ""} | ${c.usage?.outputTokens ?? ""} | ${c.usage?.reasoningTokens ?? ""} | ${c.usage?.cacheReadTokens ?? ""} | ${c.usage?.cacheWriteTokens ?? ""} | ${money(c.costUsd)} | ${c.ms} |`),
    `| **Total** | | ${t.usage.inputTokens} | ${t.usage.outputTokens} | ${t.usage.reasoningTokens} | ${t.usage.cacheReadTokens} | ${t.usage.cacheWriteTokens} | ${money(t.costUsd)}${t.costUsd != null ? ` (${t.casesWithCost} of ${t.cases} cases reported)` : ""} | |`,
    "",
    "Cost is what the provider reported, never estimated here; a recorded run carries whatever its source logged.",
    "",
  ]
  return lines.join("\n")
}
