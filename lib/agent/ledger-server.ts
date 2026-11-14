/**
 * Writes the task registry and the ledger (lib/agent/ledger.ts), and commits a CRM write and its ledger entry together
 * ("The CRM write and the ledger write commit together", build plan v3).
 *
 * Everything goes through `AgentDb.run`, one transaction: the task is read, any other reads are made, then the CRM
 * documents, the new ledger entry and the task's moved head are written at once. If any write fails, none happens.
 * Firestore requires every read in a transaction to come before every write; `AgentTx` enforces that order, in the
 * in-memory store the tests use as well, so a step that would break it fails in the tests first.
 *
 * Ledger entries are written with `create` only: this module has no path that updates or deletes one
 * (lib/__tests__/agent-ledger.test.ts reads this file to check).
 */
import { AGENT_LEDGER_COLLECTION, AGENT_TASKS_COLLECTION, LedgerRefused, advance, buildEntry, type AgentTask, type LedgerEntry, type LedgerFields, type TaskState } from "./ledger"

/** One transaction. Reads first, then writes. */
export interface AgentTx {
  getTask(id: string): Promise<AgentTask | null>
  getDoc<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null>
  /** Fails the transaction when the document exists. */
  createDoc(collection: string, id: string, data: object): void
  setDoc(collection: string, id: string, data: object): void
  putTask(task: AgentTask): void
  /** Fails the transaction when the entry exists. */
  appendEntry(entry: LedgerEntry): void
}

export interface AgentDb {
  run<T>(fn: (tx: AgentTx) => Promise<T>): Promise<T>
}

/** Firestore rejects `undefined` at any depth; every record here is plain JSON. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** The live store: the default database, one Firestore transaction per run. */
export function firestoreAgentDb(): AgentDb {
  return {
    async run(fn) {
      const { getDb } = await import("../firebase-admin")
      const db = getDb()
      return db.runTransaction(async (t) => {
        let writing = false
        const read = () => {
          if (writing) throw new Error("agent ledger: a read after a write in one transaction")
        }
        const tx: AgentTx = {
          async getTask(id) {
            read()
            const snap = await t.get(db.collection(AGENT_TASKS_COLLECTION).doc(id))
            return snap.exists ? (snap.data() as AgentTask) : null
          },
          async getDoc(collection, id) {
            read()
            const snap = await t.get(db.collection(collection).doc(id))
            return snap.exists ? (snap.data() as never) : null
          },
          createDoc(collection, id, data) {
            writing = true
            t.create(db.collection(collection).doc(id), plain(data))
          },
          setDoc(collection, id, data) {
            writing = true
            t.set(db.collection(collection).doc(id), plain(data))
          },
          putTask(task) {
            writing = true
            t.set(db.collection(AGENT_TASKS_COLLECTION).doc(task.id), plain(task))
          },
          appendEntry(entry) {
            writing = true
            t.create(db.collection(AGENT_LEDGER_COLLECTION).doc(entry.id), plain(entry))
          },
        }
        return fn(tx)
      })
    },
  }
}

/** Creates a task and its first entry (`task_created`). Refused when a task with this id exists. */
export async function createTask(db: AgentDb, task: AgentTask, actor: string, at: string, refs?: LedgerFields["refs"]): Promise<{ task: AgentTask; entry: LedgerEntry }> {
  return db.run(async (tx) => {
    if (await tx.getTask(task.id)) throw new LedgerRefused(`task ${task.id} already exists`)
    const entry = buildEntry(task, { kind: "task_created", actor, refs: { event: task.lineage.event, ...(refs ?? {}) } }, at)
    const next = advance(task, entry)
    tx.putTask(next)
    tx.appendEntry(entry)
    return { task: next, entry }
  })
}

export interface StepInput<P> {
  taskId: string
  at: string
  /** Extra reads, made after the task is read and before any write. */
  read?: (tx: AgentTx, task: AgentTask) => Promise<P>
  /**
   * Decide from what was read: the ledger fields, the state to move to, and the CRM writes to make with them. Throwing
   * here writes nothing.
   */
  decide: (task: AgentTask, prepared: P) => { fields: LedgerFields; to?: TaskState; write?: (tx: AgentTx) => void }
}

/** One step of a task: CRM writes, the ledger entry and the task's new head, committed together. */
export async function step<P = undefined>(db: AgentDb, s: StepInput<P>): Promise<{ task: AgentTask; entry: LedgerEntry }> {
  return db.run(async (tx) => {
    const task = await tx.getTask(s.taskId)
    if (!task) throw new LedgerRefused(`no task ${s.taskId}`)
    const prepared = (s.read ? await s.read(tx, task) : undefined) as P
    const { fields, to, write } = s.decide(task, prepared)
    const entry = buildEntry(task, fields, s.at)
    const next = advance(task, entry, to)
    write?.(tx)
    tx.appendEntry(entry)
    tx.putTask(next)
    return { task: next, entry }
  })
}

/**
 * Carries out a stop plan (lib/agent/ledger.ts planStop): each task to cancel is cancelled, and each task caught
 * mid-send moves to `needs_reconciliation`, each with its ledger entry. A task that finished in the meantime is left as
 * it is. Returns what was changed.
 */
export async function applyStop(db: AgentDb, plan: { cancel: string[]; reconcile: string[] }, actor: string, now: () => string): Promise<{ cancelled: string[]; reconcile: string[] }> {
  const done = { cancelled: [] as string[], reconcile: [] as string[] }
  for (const [ids, to, kind, reasonCode] of [
    [plan.cancel, "cancelled", "cancelled", "stopped"],
    [plan.reconcile, "needs_reconciliation", "kill_blocked", "stopped-in-flight"],
  ] as const) {
    for (const taskId of ids) {
      try {
        await step(db, {
          taskId,
          at: now(),
          decide: (task) => {
            if (!["queued", "running", "awaiting_review", "approved", "sending"].includes(task.state)) throw new LedgerRefused("finished")
            return { fields: { kind, actor, reasonCode }, to }
          },
        })
        ;(to === "cancelled" ? done.cancelled : done.reconcile).push(taskId)
      } catch (e) {
        if (!(e instanceof LedgerRefused)) throw e
      }
    }
  }
  return done
}
