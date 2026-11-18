/**
 * The Ask panel's writes, each committed with its ledger entry in one transaction (lib/agent/ledger-server.ts `step`):
 *  - a task edit (due date, status, assignee): the task's new fields, a `record_edit` Activity holding each field before
 *    and after (triaged at once, so it never reaches the inbox), and an `edit_applied` entry on the turn's task;
 *  - its undo, within UNDO_WINDOW_MS, by the person who made it or the founder: the fields back, a second `record_edit`
 *    Activity under a fixed id (so an edit is undone once only), and an `edit_undone` entry. A field changed again
 *    since the edit is not overwritten: the undo is refused instead;
 *  - a triage's ledger entry: the triage itself goes through the existing service (lib/core-model/service.ts
 *    triageActivity and undoTriage), and this records it.
 *
 * The ledger holds ids and hashes only (lib/agent/ledger.ts). Who made the edit is on the Activity (`created_by`).
 * Pure apart from the injected AgentDb.
 */
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { LedgerRefused } from "../agent/ledger"
import { step, type AgentDb } from "../agent/ledger-server"
import { contentHash } from "../send-approval"
import { UNDO_WINDOW_MS } from "./policy"

export const TASKS_COLLECTION = "crm_tasks"
export const TASK_STATUSES = ["not_started", "in_progress", "completed", "blocked", "deferred"] as const
export type TaskStatusValue = (typeof TASK_STATUSES)[number]

export interface TaskPatch {
  due_date?: string
  status?: TaskStatusValue
  assigned_to?: string
}

export class AskRefused extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 400) {
    super(message)
    this.name = "AskRefused"
  }
}

type Change = { field: string; before: unknown; after: unknown; winner: "crm" }
const DAY = /^\d{4}-\d{2}-\d{2}$/
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** The patch, checked: only these three fields, each well-formed. */
export function checkTaskPatch(patch: TaskPatch): TaskPatch {
  const out: TaskPatch = {}
  if (patch.due_date !== undefined) {
    if (!DAY.test(patch.due_date) || !Number.isFinite(Date.parse(patch.due_date))) throw new AskRefused("A due date is YYYY-MM-DD.")
    out.due_date = patch.due_date
  }
  if (patch.status !== undefined) {
    if (!(TASK_STATUSES as readonly string[]).includes(patch.status)) throw new AskRefused(`Not a task status: ${patch.status}`)
    out.status = patch.status
  }
  if (patch.assigned_to !== undefined) {
    const a = patch.assigned_to.trim()
    if (!a || a.length > 100) throw new AskRefused("An assignee is a team member's name.")
    out.assigned_to = a
  }
  if (!Object.keys(out).length) throw new AskRefused("Nothing to change: a due date, a status or an assignee.")
  return out
}

/** The fields a patch writes, as the task route's status shortcuts write them (completing stamps a completed date). */
export function taskWrite(current: Record<string, unknown>, patch: TaskPatch, nowIso: string): Record<string, unknown> {
  const write: Record<string, unknown> = { ...patch }
  if (patch.status === "completed" && current.status !== "completed") write.completed_date = nowIso
  if (patch.status && patch.status !== "completed" && current.status === "completed") write.completed_date = ""
  return write
}

/** A turn's task id is `ask-<uuid>`; its edits' Activities are `<turn>-e<n>`. */
export const editActivityId = (turnTaskId: string, n: number) => `${turnTaskId}-e${n}`
const EDIT_ID = /^(ask-[A-Za-z0-9-]{1,80})-e\d{1,3}$/
export const undoActivityId = (editActivityId: string) => `${editActivityId}-undo`

export interface TaskEditInput {
  db: AgentDb
  turnTaskId: string
  /** The edit's number within the turn, for its Activity's id. */
  n: number
  taskId: string
  patch: TaskPatch
  /** Who made it: their address, as the CRM's other edits record it (`created_by`). */
  by: string
  /** The ledger's actor ("founder" or "member:<id>"). */
  actor: string
  now: string
}

export interface AppliedEdit {
  activityId: string
  taskId: string
  title: string
  changes: Change[]
}

/** Applies a task edit, its `record_edit` Activity and its ledger entry together. */
export async function applyTaskEdit(i: TaskEditInput): Promise<AppliedEdit> {
  const patch = checkTaskPatch(i.patch)
  const activityId = editActivityId(i.turnTaskId, i.n)
  let applied: AppliedEdit | null = null
  await step(i.db, {
    taskId: i.turnTaskId,
    at: i.now,
    read: async (tx) => tx.getDoc<Record<string, unknown>>(TASKS_COLLECTION, i.taskId),
    decide: (_task, current) => {
      if (!current) throw new AskRefused("That task was not found.", 404)
      const write = taskWrite(current, patch, i.now)
      const changes: Change[] = Object.entries(write)
        .filter(([k, v]) => !same(current[k], v))
        .map(([field, after]) => ({ field, before: current[field] ?? null, after, winner: "crm" as const }))
      if (!changes.length) throw new AskRefused("The task already has those values.", 409)
      const title = typeof current.title === "string" ? current.title : i.taskId
      applied = { activityId, taskId: i.taskId, title, changes }
      return {
        fields: { kind: "edit_applied", actor: i.actor, refs: { activity: activityId, record: i.taskId }, hashes: { input: contentHash(changes) }, reasonCode: "task-edit" },
        write: (tx) => {
          tx.mergeDoc(TASKS_COLLECTION, i.taskId, write, { touchUpdatedAt: true })
          tx.createDoc(CRM_COLLECTIONS.ACTIVITIES, activityId, editActivity({ title, changes, by: i.by, at: i.now, taskId: i.taskId, turnTaskId: i.turnTaskId, summary: `Task edited from Ask: ${changes.map((c) => c.field).join(", ")}` }))
          tx.createDoc(CRM_COLLECTIONS.ACTIVITY_TRIAGE, activityId, { decision: "save", by: i.by, at: i.now, activity_id: activityId })
        },
      }
    },
  })
  return applied!
}

function editActivity(e: { title: string; changes: Change[]; by: string; at: string; taskId: string; turnTaskId: string; summary: string; undoOf?: string }) {
  return {
    type: "record_edit",
    source: "manual",
    occurred_at: e.at,
    contact: {},
    summary: e.summary,
    change: e.changes.map((c) => ({ ...c, before: c.before ?? null, after: c.after ?? null })),
    visibility: "business",
    created_by: e.by,
    created_at: e.at,
    // What the edit was made to, and from where: read back by the undo, never shown on a timeline.
    record: { collection: TASKS_COLLECTION, id: e.taskId, title: e.title },
    ask: { task: e.turnTaskId, ...(e.undoOf ? { undo_of: e.undoOf } : {}) },
  }
}

interface StoredEdit {
  type?: string
  created_by?: string
  created_at?: string
  change?: Change[]
  record?: { collection?: string; id?: string; title?: string }
  ask?: { task?: string; undo_of?: string }
}

export interface UndoInput {
  db: AgentDb
  activityId: string
  /** The address of the person pressing Undo, and whether they are the founder. */
  by: string
  founder: boolean
  actor: string
  now: string
}

/** Puts a task edit back. Refused after the window, for anyone but its maker or the founder, twice, or over a later change. */
export async function undoTaskEdit(i: UndoInput): Promise<{ taskId: string; title: string }> {
  const m = EDIT_ID.exec(i.activityId)
  if (!m) throw new AskRefused("There is nothing to undo.", 404)
  // The turn's task id is inside the edit's id; it is checked against the stored Activity below.
  const turnTaskId = m[1]
  let out: { taskId: string; title: string } | null = null
  await step(i.db, {
    taskId: turnTaskId,
    at: i.now,
    read: async (tx) => {
      const edit = await tx.getDoc<StoredEdit>(CRM_COLLECTIONS.ACTIVITIES, i.activityId)
      const undone = await tx.getDoc(CRM_COLLECTIONS.ACTIVITIES, undoActivityId(i.activityId))
      const current = edit?.record?.id ? await tx.getDoc<Record<string, unknown>>(TASKS_COLLECTION, edit.record.id) : null
      return { edit, undone, current }
    },
    decide: (_task, { edit, undone, current }) => {
      if (!edit || edit.type !== "record_edit" || edit.ask?.task !== turnTaskId || edit.record?.collection !== TASKS_COLLECTION || !edit.record.id) throw new AskRefused("There is nothing to undo.", 404)
      if (edit.created_by !== i.by && !i.founder) throw new AskRefused("Only the person who made the change can undo it.", 403)
      if (!(Date.parse(i.now) - Date.parse(edit.created_at ?? "") <= UNDO_WINDOW_MS)) throw new AskRefused("Too late to undo. Change it on the task instead.", 409)
      if (undone) throw new AskRefused("That change was already undone.", 409)
      if (!current) throw new AskRefused("That task is gone.", 404)
      const changes = edit.change ?? []
      const moved = changes.find((c) => !same(current[c.field], c.after))
      if (moved) throw new AskRefused(`The task's ${moved.field} has changed since; change it on the task instead.`, 409)
      // A field that had no value before is removed again: null deletes it (lib/agent/ledger-server.ts mergeDoc).
      const write: Record<string, unknown> = Object.fromEntries(changes.map((c) => [c.field, c.before ?? null]))
      const taskId = edit.record.id
      const title = edit.record.title ?? taskId
      out = { taskId, title }
      const reverse: Change[] = changes.map((c) => ({ field: c.field, before: c.after, after: c.before ?? null, winner: "crm" }))
      const undoId = undoActivityId(i.activityId)
      return {
        fields: { kind: "edit_undone", actor: i.actor, refs: { activity: undoId, record: taskId }, hashes: { input: contentHash(reverse) }, reasonCode: "task-edit" },
        write: (tx) => {
          tx.mergeDoc(TASKS_COLLECTION, taskId, write, { touchUpdatedAt: true })
          tx.createDoc(CRM_COLLECTIONS.ACTIVITIES, undoId, editActivity({ title, changes: reverse, by: i.by, at: i.now, taskId, turnTaskId, summary: `Undone from Ask: ${reverse.map((c) => c.field).join(", ")}`, undoOf: i.activityId }))
          tx.createDoc(CRM_COLLECTIONS.ACTIVITY_TRIAGE, undoId, { decision: "save", by: i.by, at: i.now, activity_id: undoId })
        },
      }
    },
  })
  return out!
}

/** The ledger entry for a triage made from Ask, or for its undo. The triage itself is written by the core service. */
export async function recordTriage(db: AgentDb, i: { turnTaskId: string; activityId: string; actor: string; now: string; undone?: boolean; decision?: string }): Promise<void> {
  await step(db, {
    taskId: i.turnTaskId,
    at: i.now,
    decide: (task) => {
      if (task.objective !== "ask") throw new LedgerRefused("not an Ask turn")
      return {
        fields: {
          kind: i.undone ? "edit_undone" : "edit_applied",
          actor: i.actor,
          refs: { activity: i.activityId, record: i.activityId },
          reasonCode: i.undone ? "triage-undo" : `triage-${i.decision ?? "decision"}`,
        },
      }
    },
  })
}
