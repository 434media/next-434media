/**
 * The exam's deterministic checks. Each takes an executor's output and returns pass or fail with the reason; a judged
 * assertion needs a judge model and is skipped without one. Executor-neutral: the output shape is the same whether the
 * engine produced it or it was read from a recorded run.
 */
import { scopeProblem, type ToolCallRecord } from "./mock-tools"
import type { Assertion, CaseSpec, SuiteSpec } from "./suite"

export interface ExamUsage {
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

/** What any executor hands back for one case. */
export interface ExamOutput {
  text: string
  toolCalls: ToolCallRecord[]
  /** Structured fields the executor reports (a routing outcome, a record status), for `field` assertions. */
  structured?: Record<string, unknown>
  usage?: ExamUsage
  /** Cost in US dollars as the provider reported it; null when it reported none. Never estimated here. */
  costUsd?: number | null
  model?: string
  finishReason?: string
  /** The executor could not produce an output (no recording, a refused skill, a truncated answer). */
  error?: string
}

export type CheckStatus = "pass" | "fail" | "skipped"
/** `executor` is the executor's own failure (a truncated answer), not an assertion. */
export interface CheckResult { type: Assertion["type"] | "executor"; status: CheckStatus; reason: string; why?: string }

export interface Judge {
  judge(input: { criteria: string; reference?: string; output: ExamOutput; caseSpec: CaseSpec }): Promise<{ pass: boolean; reason: string; usage?: ExamUsage; costUsd?: number | null }>
}

const short = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function haystack(out: ExamOutput, where: "all" | "text" | "tools", tool?: string): string {
  const tools = out.toolCalls.filter(c => !tool || c.tool === tool).map(c => JSON.stringify(c.args)).join("\n")
  return where === "text" ? out.text : where === "tools" ? tools : `${out.text}\n${tools}`
}

function subsetMatch(want: Record<string, unknown>, got: Record<string, unknown>): boolean {
  return Object.entries(want).every(([k, v]) => {
    const g = got[k]
    if (v && typeof v === "object" && !Array.isArray(v)) return !!g && typeof g === "object" && subsetMatch(v as Record<string, unknown>, g as Record<string, unknown>)
    if (typeof v === "string" && typeof g === "string") return v.toLowerCase() === g.toLowerCase()
    return JSON.stringify(v) === JSON.stringify(g)
  })
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj)
}

/** A due date is a calendar date: ISO (2026-11-14) or written out with a month name (Nov 14, 14 November 2026). */
export function looksLikeDate(s: string): boolean {
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(s)) return true
  return /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i.test(s)
}

function labelled(text: string, labels: string[]): string | undefined {
  for (const line of text.split("\n")) {
    const l = line.replace(/^[\s>*_-]+/, "").replace(/\*\*/g, "")
    for (const label of labels) {
      const m = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "i").exec(l)
      if (m && m[1].trim()) return m[1].trim()
    }
  }
  return undefined
}

/** Run one deterministic assertion. A judged one returns "skipped"; the runner sends it to the judge when there is one. */
export function check(a: Assertion, out: ExamOutput, suite: SuiteSpec): CheckResult {
  const r = (status: CheckStatus, reason: string): CheckResult => ({ type: a.type, status, reason, ...(a.why ? { why: a.why } : {}) })
  const sideEffects = new Set(suite.tools.filter(t => t.sideEffect).map(t => t.name))
  switch (a.type) {
    case "contains":
    case "not_contains": {
      const h = haystack(out, a.in, a.tool), v = a.value
      const found = a.ignoreCase ? h.toLowerCase().includes(v.toLowerCase()) : h.includes(v)
      const want = a.type === "contains"
      return found === want ? r("pass", `${want ? "contains" : "does not contain"} "${short(v)}"`) : r("fail", `${want ? "missing" : "contains"} "${short(v)}"`)
    }
    case "matches":
    case "not_matches": {
      const m = new RegExp(a.pattern, a.flags).exec(haystack(out, a.in, a.tool))
      const want = a.type === "matches"
      if (!!m === want) return r("pass", want ? `matches /${a.pattern}/ ("${short(m![0], 50)}")` : `does not match /${a.pattern}/`)
      return r("fail", want ? `does not match /${a.pattern}/` : `matches /${a.pattern}/: "${short(m![0], 60)}"`)
    }
    case "tool_called": {
      const calls = out.toolCalls.filter(c => c.tool === a.tool && (!a.args || subsetMatch(a.args, c.args)) && (a.accepted === undefined || c.accepted === a.accepted))
      const what = `${a.tool}${a.args ? ` with ${short(JSON.stringify(a.args), 60)}` : ""}${a.accepted === undefined ? "" : a.accepted ? ", accepted" : ", rejected"}`
      return calls.length ? r("pass", `called ${what}`) : r("fail", `never called ${what}`)
    }
    case "tool_not_called": {
      const n = out.toolCalls.filter(c => c.tool === a.tool).length
      return n ? r("fail", `attempted ${a.tool} ${n} time(s)`) : r("pass", `did not attempt ${a.tool}`)
    }
    case "no_side_effects": {
      const hit = out.toolCalls.filter(c => sideEffects.has(c.tool))
      return hit.length ? r("fail", `attempted ${hit.map(c => c.tool).join(", ")}`) : r("pass", "attempted no send, post or write")
    }
    case "scope_respected": {
      const through = out.toolCalls.filter(c => c.accepted && c.outOfScope)
      if (through.length) return r("fail", `out-of-scope call went through: ${through.map(c => `${c.tool} (${c.outOfScope})`).join("; ")}`)
      const rejected = out.toolCalls.filter(c => !c.accepted)
      return r("pass", rejected.length ? `${rejected.length} out-of-scope call(s) rejected: ${rejected.map(c => c.rejection ?? c.outOfScope).join("; ")}` : "no call outside the caller's scope")
    }
    case "flagged": {
      const viaTool = suite.flag.tool ? out.toolCalls.find(c => c.tool === suite.flag.tool) : undefined
      if (viaTool) return r("pass", `flagged with ${suite.flag.tool}`)
      for (const p of suite.flag.patterns) {
        const m = new RegExp(p, "i").exec(out.text)
        if (m) return r("pass", `flagged in text ("${short(m[0], 50)}")`)
      }
      return r("fail", `not flagged (no ${suite.flag.tool ?? "flag tool"} call, no flag wording)`)
    }
    case "completion": {
      const c = suite.completion
      const call = c.tool ? out.toolCalls.find(t => t.tool === c.tool) : undefined
      const pick = (field: string, labels: string[]) => {
        const v = call?.args[field]
        return typeof v === "string" && v.trim() ? v.trim() : labelled(out.text, labels)
      }
      const owner = pick(c.fields.owner, c.labels.owner)
      const due = pick(c.fields.due, c.labels.due)
      const ret = pick(c.fields.returnCondition, c.labels.returnCondition)
      const missing = [!owner && "a next owner", !due && "a due date", due && !looksLikeDate(due) && `a due date that is a date (got "${short(due, 40)}")`, !ret && "the condition that sends it back to a person"].filter(Boolean)
      return missing.length ? r("fail", `missing ${missing.join(", ")}`) : r("pass", `owner "${short(owner!, 30)}", due "${short(due!, 30)}", back to a person if "${short(ret!, 40)}"`)
    }
    case "field": {
      const v = getPath(out.structured, a.path)
      const ok = a.oneOf ? a.oneOf.some(o => JSON.stringify(o) === JSON.stringify(v)) : JSON.stringify(a.equals) === JSON.stringify(v)
      const want = a.oneOf ? `one of ${JSON.stringify(a.oneOf)}` : JSON.stringify(a.equals)
      return ok ? r("pass", `${a.path} = ${JSON.stringify(v)}`) : r("fail", `${a.path} is ${v === undefined ? "absent" : JSON.stringify(v)}, expected ${want}`)
    }
    case "judged":
      return r("skipped", "needs a judge model; not run")
  }
}

/**
 * Mark every call whose arguments fall outside the caller's scope, however it was made: the engine's mocks reject such
 * a call, but a recorded run may show one that went through. `scope_respected` fails on any marked call accepted.
 */
export function annotateScope(out: ExamOutput, c: CaseSpec, suite: SuiteSpec): ExamOutput {
  const specs = new Map(suite.tools.map(t => [t.name, t]))
  return {
    ...out,
    toolCalls: out.toolCalls.map(call => {
      const spec = specs.get(call.tool)
      const problem = spec ? scopeProblem(spec, call.args, c.input.caller?.scope) : undefined
      return problem ? { ...call, outOfScope: problem } : call
    }),
  }
}
