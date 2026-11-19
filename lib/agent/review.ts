/**
 * The founder-review queue and the console, as data (434 build sequence V1 item 4, build plan v3: "Approvals happen in
 * the signed-in admin's founder-review queue (R2)"; "The console … approvals waiting, each with its reason; runs and
 * their state; failures; cost by task, property and day; and how long work waits at each handoff, with an alert past a
 * limit"; "Approval reasons. Every approval that reaches the founder records a reason. A weekly view groups the repeats,
 * and 3 or more repeats become a proposed rule for the founder to approve").
 *
 * Pure: every function here takes records already read and returns what the page shows. lib/agent/review-server.ts
 * reads and writes.
 */
import { approvalStatus, type ApprovalStatus, type SendApproval } from "../send-approval"
import type { AgentTask, LedgerEntry, RoutingOutcome, TaskState } from "./ledger"

/** How long a draft may wait for the founder before the console and the alert call it late. */
export const REVIEW_WAIT_LIMIT_MS = 24 * 60 * 60 * 1000
/** A reason repeated this often in a week becomes a proposed rule. */
export const RULE_REPEATS = 3
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The reasons the founder picks from. A short code groups the repeats; his words go with it. "other" takes free text
 * only. The list is the console's, not a policy: a code here decides nothing.
 */
export const DISMISS_REASON_CODE = "solicitation"
export const REASON_CODES = {
  approve: [
    { code: "as-drafted", label: "Right as drafted" },
    { code: "edited", label: "Edited, then approved" },
    { code: "routing-right", label: "Routing is right" },
    { code: "proof-run", label: "Proof run" },
    { code: "other", label: "Other" },
  ],
  reject: [
    { code: "tone", label: "Tone or voice" },
    { code: "facts", label: "Wrong or missing facts" },
    { code: "routing", label: "Wrong routing" },
    { code: "not-now", label: "Not the right time" },
    { code: "handle-myself", label: "I'll handle it myself" },
    { code: "other", label: "Other" },
    /**
     * Set by **Dismiss: spam or solicitation**, not picked from the Reject list (founder, 2026-11-19): nothing is sent,
     * the arrival leaves To do, and the sender's later arrivals are held with no draft (lib/agent/solicitation.ts).
     */
    { code: DISMISS_REASON_CODE, label: "Spam or solicitation" },
  ],
} as const

/**
 * The flag's first sentence, at most FLAG_SHORT characters: what it is and the decision he needs to make. Flags drafted
 * before 2026-11-19 run to a paragraph; the rest stays one tap away, and the full detail is in the intake record.
 */
export const FLAG_SHORT = 160
export function shortFlag(flag: string): { short: string; truncated: boolean } {
  const text = flag.trim().replace(/\s+/g, " ")
  const sentence = text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text
  const short = sentence.length > FLAG_SHORT ? `${sentence.slice(0, FLAG_SHORT).replace(/\s+\S*$/, "")}…` : sentence
  return { short, truncated: short !== text }
}

/** A stored approval, with what the intake run added to it (lib/agent/intake.ts). */
export type StoredApproval = SendApproval & {
  routing?: { outcome: RoutingOutcome; flag?: string }
  intake?: { policyVersion?: string; record?: string; nextOwner?: string; due?: string; returnCondition?: string; model?: string }
  arrival?: { formId?: string; receivedAt?: string }
  /** The pre-check's note when it was unsure and drafted anyway (lib/agent/solicitation.ts). */
  precheck?: { signals: string[]; summary: string }
}

export interface ReviewItem {
  id: string
  taskId: string
  status: ApprovalStatus
  /** Waiting on the founder, and for how long. */
  waitingMs: number | null
  late: boolean
  to: string[]
  from: string
  replyTo?: string
  subject: string
  text: string
  hash: string
  reviewReason: string
  outcome?: RoutingOutcome
  flag?: string
  record?: string
  handoff?: { nextOwner?: string; due?: string; returnCondition?: string }
  model?: string
  createdAt: string
  expiresAt: string
  receivedAt?: string
  decision?: { decision: "approved" | "rejected"; at: string; reasonCode: string; reason: string }
  sent?: { at: string; messageId: string }
  taskCancelled: boolean
  /** The arrival's Activity in the People Inbox (`contact_forms:<formId>`), where the draft is shown inline. */
  activityId?: string
  /** Edits made before the decision; the drafted text is kept on the approval as evidence. */
  edits: number
  /** What the solicitation pre-check saw, when it was unsure and drafted anyway. */
  precheck?: string
}

/** The People Inbox Activity an intake draft answers: the website form it was drafted from. */
export function arrivalActivityId(a: Pick<StoredApproval, "arrival">): string | undefined {
  return a.arrival?.formId ? `contact_forms:${a.arrival.formId}` : undefined
}

export function reviewItem(a: StoredApproval, now: string, task?: Pick<AgentTask, "cancelled">): ReviewItem {
  const status = approvalStatus(a, now)
  const waitingMs = status === "pending" ? Math.max(0, Date.parse(now) - Date.parse(a.createdAt)) : null
  const d = a.approval ?? a.rejection
  return {
    id: a.id,
    taskId: a.taskId,
    status,
    waitingMs,
    late: waitingMs !== null && waitingMs >= REVIEW_WAIT_LIMIT_MS,
    to: a.payload.to,
    from: a.payload.from,
    ...(a.payload.replyTo ? { replyTo: a.payload.replyTo } : {}),
    subject: a.payload.subject,
    text: a.payload.text,
    hash: a.hash,
    reviewReason: a.reviewReason,
    ...(a.routing ? { outcome: a.routing.outcome, ...(a.routing.flag ? { flag: a.routing.flag } : {}) } : {}),
    ...(a.intake?.record ? { record: a.intake.record } : {}),
    ...(a.intake ? { handoff: { nextOwner: a.intake.nextOwner, due: a.intake.due, returnCondition: a.intake.returnCondition }, model: a.intake.model } : {}),
    createdAt: a.createdAt,
    expiresAt: a.expiresAt,
    ...(a.arrival?.receivedAt ? { receivedAt: a.arrival.receivedAt } : {}),
    ...(d ? { decision: { decision: a.approval ? "approved" : "rejected", at: d.at, reasonCode: d.reasonCode, reason: d.reason } } : {}),
    ...(a.receipt ? { sent: { at: a.receipt.at, messageId: a.receipt.messageId } } : {}),
    taskCancelled: !!task?.cancelled,
    ...(arrivalActivityId(a) ? { activityId: arrivalActivityId(a) } : {}),
    edits: a.revisions?.length ?? 0,
    ...(a.precheck?.summary ? { precheck: a.precheck.summary } : {}),
  }
}

/** Waiting first (oldest first), then everything else newest first. */
export function sortQueue(items: ReviewItem[]): ReviewItem[] {
  const waiting = items.filter((i) => i.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const rest = items.filter((i) => i.status !== "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return [...waiting, ...rest]
}

export interface ReasonGroup {
  decision: "approved" | "rejected"
  code: string
  count: number
  /** The founder's words, newest first, at most three. */
  examples: string[]
  /** Three or more in the week: shown as a proposed rule for the founder to approve. Nothing applies it. */
  proposeRule: boolean
}

/** The week's decisions grouped by reason. "other" is listed but never proposed: it has no shared reason. */
export function groupReasons(approvals: StoredApproval[], now: string): ReasonGroup[] {
  const since = Date.parse(now) - WEEK_MS
  const groups = new Map<string, ReasonGroup & { latest: string }>()
  for (const a of approvals) {
    const d = a.approval ?? a.rejection
    if (!d || Date.parse(d.at) < since) continue
    const decision = a.approval ? "approved" : "rejected"
    const key = `${decision}:${d.reasonCode}`
    const g = groups.get(key) ?? { decision, code: d.reasonCode, count: 0, examples: [], proposeRule: false, latest: d.at }
    g.count++
    g.examples.push(d.reason)
    if (d.at > g.latest) g.latest = d.at
    groups.set(key, g)
  }
  return [...groups.values()]
    .map(({ latest: _latest, ...g }) => ({ ...g, examples: g.examples.slice(-3).reverse(), proposeRule: g.code !== "other" && g.count >= RULE_REPEATS }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
}

export interface HandoffWait {
  handoff: "arrival-to-draft" | "draft-to-decision" | "decision-to-send"
  label: string
  samples: number
  medianMs: number | null
  maxMs: number | null
}

const HANDOFFS: { handoff: HandoffWait["handoff"]; label: string; from: LedgerEntry["kind"][]; to: LedgerEntry["kind"][] }[] = [
  { handoff: "arrival-to-draft", label: "Arrival to draft", from: ["task_created"], to: ["draft_queued"] },
  { handoff: "draft-to-decision", label: "Draft to your decision", from: ["draft_queued"], to: ["approved", "rejected"] },
  { handoff: "decision-to-send", label: "Approval to sent", from: ["approved"], to: ["sent"] },
]

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** How long work waited at each handoff, from the ledger: first entry of the one kind to first of the next, per task. */
export function handoffWaits(entries: LedgerEntry[]): HandoffWait[] {
  const byTask = new Map<string, LedgerEntry[]>()
  for (const e of entries) byTask.set(e.taskId, [...(byTask.get(e.taskId) ?? []), e])
  return HANDOFFS.map((h) => {
    const waits: number[] = []
    for (const list of byTask.values()) {
      const sorted = [...list].sort((a, b) => a.seq - b.seq)
      const start = sorted.find((e) => h.from.includes(e.kind))
      const end = start && sorted.find((e) => e.seq > start.seq && h.to.includes(e.kind))
      if (start && end) waits.push(Date.parse(end.at) - Date.parse(start.at))
    }
    return { handoff: h.handoff, label: h.label, samples: waits.length, medianMs: median(waits), maxMs: waits.length ? Math.max(...waits) : null }
  })
}

export interface RunSummary {
  byState: Partial<Record<TaskState, number>>
  failures: { taskId: string; state: TaskState; reasonCode?: string; at: string }[]
}

/** Runs by state, and the ones that failed or need a person, with the reason the ledger gives. */
export function runSummary(tasks: AgentTask[], entries: LedgerEntry[]): RunSummary {
  const byState: RunSummary["byState"] = {}
  for (const t of tasks) byState[t.state] = (byState[t.state] ?? 0) + 1
  const last = new Map<string, LedgerEntry>()
  for (const e of entries) {
    const cur = last.get(e.taskId)
    if (!cur || e.seq > cur.seq) last.set(e.taskId, e)
  }
  const failures = tasks
    .filter((t) => t.state === "failed" || t.state === "needs_reconciliation")
    .map((t) => ({ taskId: t.id, state: t.state, ...(last.get(t.id)?.reasonCode ? { reasonCode: last.get(t.id)!.reasonCode } : {}), at: t.updatedAt }))
    .sort((a, b) => b.at.localeCompare(a.at))
  return { byState, failures }
}

export interface CostRow { key: string; usd: number; calls: number }
export interface CostSummary { totalUsd: number; byDay: CostRow[]; byProperty: CostRow[]; byTask: CostRow[] }

/** Cost by day, property and task, from `ai_call_costs` records (lib/engine/cost-ledger.ts). */
export function costSummary(records: { at: string; task: string; property?: string; usd: number }[]): CostSummary {
  const add = (m: Map<string, CostRow>, key: string, usd: number) => {
    const r = m.get(key) ?? { key, usd: 0, calls: 0 }
    r.usd += usd
    r.calls++
    m.set(key, r)
  }
  const day = new Map<string, CostRow>(), prop = new Map<string, CostRow>(), task = new Map<string, CostRow>()
  let total = 0
  for (const r of records) {
    const usd = Number.isFinite(r.usd) ? r.usd : 0
    total += usd
    add(day, r.at.slice(0, 10), usd)
    add(prop, r.property ?? "(none)", usd)
    add(task, r.task, usd)
  }
  return {
    totalUsd: total,
    byDay: [...day.values()].sort((a, b) => b.key.localeCompare(a.key)),
    byProperty: [...prop.values()].sort((a, b) => b.usd - a.usd),
    byTask: [...task.values()].sort((a, b) => b.usd - a.usd).slice(0, 10),
  }
}

/** Drafts waiting past the limit, for the alert. */
export function lateApprovals(items: ReviewItem[]): ReviewItem[] {
  return items.filter((i) => i.late)
}
