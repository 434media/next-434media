/**
 * Today: the front door's daily brief, slice 1 (434 build sequence V1 item 4, the front door; founder, 2026-11-17:
 * "approve slice 1"). A founder-only card on To do with at most three lines, each a summary that links to where the
 * work lives:
 *  - **Past its limit:** queues whose oldest item is over its limit (lib/queue-age.ts, the watchdog's own check);
 *  - **Needs a check:** agent runs that failed in the last 24 hours, scheduled jobs that did not fire
 *    (lib/cron-watchdog.ts), and a queue that could not be read;
 *  - **Model cost:** the last 24 hours, the last 7 days, and the top task (the Agents page's records).
 *
 * "A daily brief is a query, not a memory": computed when the page opens, never stored. A line with nothing to say is
 * left out; when nothing is late or failed, the card says "All clear". Guardrail: no new collection, job, email or
 * model call, and a new line takes a build-sequence entry first.
 *
 * Pure: it takes what lib/agent/review-server.ts has already read.
 */
import type { Missed } from "../cron-watchdog"
import type { QueueAlert } from "../queue-age"
import type { CostSummary, RunSummary } from "./review"

export const DAY_MS = 24 * 60 * 60 * 1000

export type TodayTone = "late" | "check" | "info"
export interface TodayLine {
  key: "late" | "check" | "cost"
  tone: TodayTone
  title: string
  detail: string
  href: string
  linkLabel: string
}
export interface Today {
  at: string
  /** True when nothing is late and nothing needs a check; the cost line may still show. */
  allClear: boolean
  lines: TodayLine[]
}

/** Short names for the watched queues (lib/queue-age.ts QUEUES), and where each one is worked. */
const QUEUE_VIEW: Record<string, { label: string; href: string }> = {
  "founder-review": { label: "Content posts to approve", href: "/admin/content?column=review" },
  "content-pipeline-jobs": { label: "Content requests", href: "/admin/content" },
  "content-pipeline-drafts": { label: "Content drafts", href: "/admin/content" },
  "agent-review": { label: "Agent drafts", href: "/admin/todo" },
  "agent-tasks-queued": { label: "Agent tasks not started", href: "/admin/agents" },
}

const hours = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`)
export const usd = (n: number) => `$${n.toFixed(2)}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export interface TodayInput {
  now: string
  overdue: QueueAlert[]
  missed: Missed[]
  unreadable: string[]
  runs: RunSummary
  costs: CostSummary
  /** Model cost in the 24 hours before `now`. */
  cost24hUsd: number
}

export function todayBrief(input: TodayInput): Today {
  const now = Date.parse(input.now)
  const lines: TodayLine[] = []

  if (input.overdue.length) {
    // The longest-waiting queue first; the link opens where that one is worked.
    const late = [...input.overdue].sort((a, b) => b.ageHours - a.ageHours)
    const parts = late.map((q) => `${QUEUE_VIEW[q.queue]?.label ?? q.queue}: ${q.waiting}${q.truncated ? "+" : ""}, oldest ${hours(q.ageHours)} (limit ${hours(q.limitHours)})`)
    lines.push({ key: "late", tone: "late", title: "Past its limit", detail: `${parts.join(". ")}.`, href: QUEUE_VIEW[late[0].queue]?.href ?? "/admin/agents", linkLabel: "Open" })
  }

  const failed = input.runs.failures.filter((f) => now - Date.parse(f.at) <= DAY_MS)
  const checks: string[] = []
  if (failed.length) checks.push(`${plural(failed.length, "agent run")} failed or need${failed.length === 1 ? "s" : ""} a check in the last 24 h`)
  if (input.missed.length) checks.push(input.missed.length === 1 ? `${input.missed[0].job} did not run when due` : `${input.missed.length} scheduled jobs did not run when due (${input.missed.map((m) => m.job).join(", ")})`)
  if (input.unreadable.length) checks.push(`${plural(input.unreadable.length, "queue")} could not be read`)
  if (checks.length) lines.push({ key: "check", tone: "check", title: "Needs a check", detail: `${checks.join(". ")}.`, href: "/admin/agents", linkLabel: "Agents" })

  const allClear = lines.length === 0
  if (input.costs.totalUsd > 0 || input.cost24hUsd > 0) {
    const top = input.costs.byTask[0]
    const detail = [`Last 24 h ${usd(input.cost24hUsd)}`, `last 7 days ${usd(input.costs.totalUsd)}`, ...(top && top.usd > 0 ? [`top task: ${top.key} ${usd(top.usd)}`] : [])].join(" · ")
    lines.push({ key: "cost", tone: "info", title: "Model cost", detail, href: "/admin/agents", linkLabel: "Agents" })
  }
  return { at: input.now, allClear, lines }
}

/** Model cost in the window before `now`, from `ai_call_costs` records. */
export function costSince(records: { at: string; usd: number }[], now: string, windowMs = DAY_MS): number {
  const from = Date.parse(now) - windowMs
  let total = 0
  for (const r of records) if (Date.parse(r.at) > from && Number.isFinite(r.usd)) total += r.usd
  return total
}
