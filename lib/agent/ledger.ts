/**
 * One log we own: the task registry and the ledger (434 build sequence V1 item 4, build plan v3: "Each business task has
 * one record: identity, property, objective, allowed workflow, shared budget, cancellation flag, and lineage back to the
 * event that started it. Each run records the catalog and rules version it started under; security revocations always
 * override that pinned version. The ledger is append-only and records material decisions. It stores IDs and hashes, not
 * message bodies; personal content stays in the CRM (founder ruling). The CRM write and the ledger write commit
 * together").
 *
 *  - `agent_tasks/<taskId>`: the registry. One record per business task; its `state` and `cancelled` change, nothing
 *    else does. It carries the ledger's head (`seq`, `head`) so each entry is appended in the same transaction that
 *    reads it.
 *  - `agent_ledger/<taskId>_<seq>`: the ledger. Created once and never updated or deleted. Each entry holds the hash of
 *    the one before it, so a removed or altered entry breaks the chain (`verifyChain`).
 *
 * The "IDs and hashes only" rule is enforced, not hoped for: an entry is built from an allow-list of fields, each with a
 * pattern no sentence, name or address can match (`buildEntry` throws). Bodies, names, addresses and reasons in words
 * live on the CRM record the entry points to.
 *
 * Pure: no storage. lib/agent/ledger-server.ts writes it.
 */
import { contentHash } from "../send-approval"

export const AGENT_TASKS_COLLECTION = "agent_tasks"
export const AGENT_LEDGER_COLLECTION = "agent_ledger"

export const TASK_STATES = [
  "queued",
  "running",
  "awaiting_review",
  "approved",
  "rejected",
  "sending",
  "sent",
  "failed",
  "cancelled",
  "needs_reconciliation",
] as const
export type TaskState = (typeof TASK_STATES)[number]

/** Where a task may go from each state. A finished task goes nowhere. */
const NEXT: Record<TaskState, readonly TaskState[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["awaiting_review", "failed", "cancelled"],
  awaiting_review: ["approved", "rejected", "failed", "cancelled"],
  approved: ["sending", "failed", "cancelled"],
  sending: ["sent", "failed", "needs_reconciliation", "cancelled"],
  rejected: [],
  sent: [],
  failed: [],
  cancelled: [],
  needs_reconciliation: ["sent", "failed"],
}
export const OPEN_STATES: readonly TaskState[] = ["queued", "running", "awaiting_review", "approved", "sending"]

export function canMove(from: TaskState, to: TaskState): boolean {
  return from === to || NEXT[from].includes(to)
}

export interface TaskPins {
  /** sha256 of the skill folder (lib/skills/loader.ts fingerprint). */
  skill?: string
  /** The 434-context commit the skill was read at. */
  commit?: string
  /** sha256 of the catalog (03 Skills/skills-index.json) the run was admitted under. */
  catalog?: string
  /** Rule files the run follows, by path → sha256. */
  rules?: Record<string, string>
}

export interface AgentTask {
  id: string
  /** The brand by stored identifier, or "434". */
  property: string
  /** What the task is for, e.g. "intake-reply". */
  objective: string
  /** The one workflow it may run, e.g. "434-intake-qualification/draft". Polí chooses among declared paths only. */
  workflow: string
  /** The task's share of the budget, in US dollars. */
  budgetUsd: number
  cancelled: boolean
  state: TaskState
  /** Back to what started it: an event id ("contact_forms:<id>") and, for a task another task started, its parent. */
  lineage: { event: string; parent?: string }
  pins: TaskPins
  /** The ledger's head: the last entry's sequence number and hash. */
  seq: number
  head: string
  createdAt: string
  updatedAt: string
}

export const LEDGER_KINDS = [
  "task_created",
  "run_started",
  "run_refused",
  "run_finished",
  "draft_queued",
  "approved",
  "rejected",
  "expired",
  "send_claimed",
  "send_intent",
  "sent",
  "send_refused",
  "send_outcome_unknown",
  "kill_blocked",
  "cancelled",
  "reconciled",
] as const
export type LedgerKind = (typeof LEDGER_KINDS)[number]

/** Intake's outcomes (Intake SOP; intake_gate.py), the routing a draft carries. */
export const ROUTING_OUTCOMES = ["qualified", "clarify", "discovery", "flag", "decline", "route-ntooitive", "ampd-intake"] as const
export type RoutingOutcome = (typeof ROUTING_OUTCOMES)[number]

export interface LedgerFields {
  kind: LedgerKind
  /** "system", "founder", "skill:<name>" or "member:<team member id>". Never an address or a name. */
  actor: string
  /** Ids of what the entry is about. */
  refs?: { activity?: string; approval?: string; run?: string; message?: string; decision?: string; event?: string }
  /** sha256 hex of what was approved, drafted, sent, read. */
  hashes?: { input?: string; draft?: string; approval?: string; sent?: string }
  outcome?: RoutingOutcome
  /** A short code: why a run was refused, why a decision was made, why a send stopped. */
  reasonCode?: string
  /** The model call cost, when the entry closes a run. */
  costUsd?: number
}

export interface LedgerEntry extends LedgerFields {
  id: string
  taskId: string
  seq: number
  at: string
  /** The previous entry's hash; "genesis" for the first. */
  prev: string
  /** sha256 over every other field of this entry. */
  hash: string
}

export class LedgerRefused extends Error {
  constructor(message: string) {
    super(message)
    this.name = "LedgerRefused"
  }
}

export const GENESIS = "genesis"
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:~-]{0,199}$/
const HEX64 = /^[a-f0-9]{64}$/
const ACTOR = /^(system|founder|skill:[a-z0-9-]{1,64}|member:[A-Za-z0-9_-]{1,64})$/
const CODE = /^[a-z0-9][a-z0-9-]{1,39}$/
const REF_KEYS = ["activity", "approval", "run", "message", "decision", "event"] as const
const HASH_KEYS = ["input", "draft", "approval", "sent"] as const
const FIELD_KEYS = new Set(["kind", "actor", "refs", "hashes", "outcome", "reasonCode", "costUsd"])

export function ledgerEntryId(taskId: string, seq: number): string {
  return `${taskId}_${String(seq).padStart(6, "0")}`
}

/** The fields, checked: an allow-list of keys, each with a pattern. Anything that could carry words is refused. */
export function checkFields(f: LedgerFields): void {
  for (const k of Object.keys(f)) if (!FIELD_KEYS.has(k)) throw new LedgerRefused(`ledger field "${k}" is not allowed`)
  if (!(LEDGER_KINDS as readonly string[]).includes(f.kind)) throw new LedgerRefused(`unknown ledger kind "${f.kind}"`)
  if (!ACTOR.test(f.actor ?? "")) throw new LedgerRefused("the actor must be system, founder, skill:<name> or member:<id>")
  if (f.refs) {
    for (const [k, v] of Object.entries(f.refs)) {
      if (!(REF_KEYS as readonly string[]).includes(k)) throw new LedgerRefused(`ledger ref "${k}" is not allowed`)
      if (v !== undefined && (typeof v !== "string" || !ID.test(v) || v.includes("@"))) throw new LedgerRefused(`ledger ref "${k}" must be an id`)
    }
  }
  if (f.hashes) {
    for (const [k, v] of Object.entries(f.hashes)) {
      if (!(HASH_KEYS as readonly string[]).includes(k)) throw new LedgerRefused(`ledger hash "${k}" is not allowed`)
      if (v !== undefined && (typeof v !== "string" || !HEX64.test(v))) throw new LedgerRefused(`ledger hash "${k}" must be a sha256`)
    }
  }
  if (f.outcome !== undefined && !(ROUTING_OUTCOMES as readonly string[]).includes(f.outcome)) throw new LedgerRefused(`unknown routing outcome "${f.outcome}"`)
  if (f.reasonCode !== undefined && !CODE.test(f.reasonCode)) throw new LedgerRefused("a reason code is a short slug")
  if (f.costUsd !== undefined && !(typeof f.costUsd === "number" && Number.isFinite(f.costUsd) && f.costUsd >= 0)) throw new LedgerRefused("a cost is a non-negative number")
}

const strip = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o)) as T

/** The next entry after `task`'s head. The caller stores it and moves the head, in one transaction. */
export function buildEntry(task: Pick<AgentTask, "id" | "seq" | "head">, fields: LedgerFields, at: string): LedgerEntry {
  checkFields(fields)
  if (!ID.test(task.id)) throw new LedgerRefused("a task id must be an id")
  if (!Number.isFinite(Date.parse(at))) throw new LedgerRefused("a ledger entry needs a time")
  const seq = task.seq + 1
  const body = strip({ ...fields, id: ledgerEntryId(task.id, seq), taskId: task.id, seq, at, prev: task.head || GENESIS })
  return { ...body, hash: contentHash(body) }
}

/** True when the entries, in order, form an unbroken chain from the first. */
export function verifyChain(entries: LedgerEntry[]): { ok: boolean; problem?: string } {
  let prev = GENESIS
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const { hash, ...body } = e
    if (e.seq !== i + 1) return { ok: false, problem: `entry ${e.id}: expected seq ${i + 1}` }
    if (e.prev !== prev) return { ok: false, problem: `entry ${e.id}: does not follow the entry before it` }
    if (contentHash(body) !== hash) return { ok: false, problem: `entry ${e.id}: altered` }
    prev = hash
  }
  return { ok: true }
}

/** A new task, before its first entry. */
export function newTask(input: { id: string; property: string; objective: string; workflow: string; budgetUsd: number; lineage: { event: string; parent?: string }; pins?: TaskPins; now: string }): AgentTask {
  if (!ID.test(input.id)) throw new LedgerRefused("a task id must be an id")
  if (!ID.test(input.lineage?.event ?? "") || input.lineage.event.includes("@")) throw new LedgerRefused("a task's lineage starts at an event id")
  if (input.lineage.parent !== undefined && !ID.test(input.lineage.parent)) throw new LedgerRefused("a parent task is an id")
  for (const [k, v] of [["property", input.property], ["objective", input.objective], ["workflow", input.workflow]] as const) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,99}$/.test(v)) throw new LedgerRefused(`a task's ${k} is an identifier`)
  }
  if (!(input.budgetUsd >= 0 && Number.isFinite(input.budgetUsd))) throw new LedgerRefused("a task has a budget")
  return {
    id: input.id,
    property: input.property,
    objective: input.objective,
    workflow: input.workflow,
    budgetUsd: input.budgetUsd,
    cancelled: false,
    state: "queued",
    lineage: strip(input.lineage),
    pins: strip(input.pins ?? {}),
    seq: 0,
    head: GENESIS,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

/** The task after an entry: the head moves, and the state moves when `to` is given and allowed. */
export function advance(task: AgentTask, entry: LedgerEntry, to?: TaskState): AgentTask {
  if (entry.taskId !== task.id || entry.seq !== task.seq + 1 || entry.prev !== task.head) throw new LedgerRefused("this entry does not follow the task's head")
  if (to && !canMove(task.state, to)) throw new LedgerRefused(`a task cannot move from ${task.state} to ${to}`)
  return { ...task, seq: entry.seq, head: entry.hash, state: to ?? task.state, cancelled: task.cancelled || to === "cancelled", updatedAt: entry.at }
}

/**
 * What a stop does to the tasks it finds (the kill switch guarantee). With no `root`, the whole agent stopped: every open
 * task is in scope. With a `root`, one task is cancelled: it and every task descended from it are in scope. In scope, a
 * task that has not reached the provider is cancelled; a task already `sending` (an intent recorded, no receipt) is not
 * cancelled, because it may have gone: it moves to `needs_reconciliation` for a person. Pure; the caller writes each
 * change with its ledger entry.
 */
export function planStop(tasks: Pick<AgentTask, "id" | "state" | "lineage">[], root?: string): { cancel: string[]; reconcile: string[] } {
  let scope: Set<string>
  if (root === undefined) scope = new Set(tasks.map((t) => t.id))
  else {
    scope = new Set([root])
    let grew = true
    while (grew) {
      grew = false
      for (const t of tasks) {
        if (!scope.has(t.id) && t.lineage.parent && scope.has(t.lineage.parent)) {
          scope.add(t.id)
          grew = true
        }
      }
    }
  }
  const cancel: string[] = []
  const reconcile: string[] = []
  for (const t of tasks) {
    if (!scope.has(t.id) || !OPEN_STATES.includes(t.state)) continue
    if (t.state === "sending") reconcile.push(t.id)
    else cancel.push(t.id)
  }
  return { cancel, reconcile }
}
