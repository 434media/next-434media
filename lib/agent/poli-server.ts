/**
 * Polí's rule pass, the writes (lib/agent/poli.ts plans; V1 item 4, Polí slice 1). Called by the `agent-sweep` cron
 * every 10 minutes and by the founder's "Run now" on the Agents page.
 *
 * Each finding is one transaction (lib/agent/ledger-server.ts `AgentDb.run`): its ledger task, three entries
 * (`task_created`, `run_started`, `routed`) and, when it raises one, the founder-owned CRM task commit together. The
 * ledger task and the CRM task share the finding's fixed id, and both are created with `create`, so a second pass over
 * the same state, or two passes racing, write nothing new. The record is read again inside the transaction, so a task
 * that changed since the list was read is left for the next pass.
 *
 * The switch: `chief-of-staff` in `crm_meta/agent_controls` (lib/agent/controls.ts): `off` writes nothing; `proof`
 * plans and reports only; `draft` writes. A stop turns it off. Production reads the switch as every agent does. A
 * preview may run it too, only when its store is the staging project (lib/preview-auth.ts): Polí sends nothing, so the
 * reason previews read as stopped (they must never send) does not apply, and staging holds made-up data only. Any other
 * deployment reads as off.
 */
import { buildEntry, advance, newTask, type AgentTask } from "./ledger"
import type { AgentDb } from "./ledger-server"
import { AGENT_CONTROLS_DOC, parseControls, readAgentControls, skillMode } from "./controls"
import { POLI_ACTOR, POLI_OBJECTIVE, POLI_SKILL, planPass, poliTaskRecord, routeTask, findingId, type PoliFinding, type PoliMode, type PoliPlan, type PoliTaskView } from "./poli"
import { checkAuthProject, deployEnv } from "../preview-auth"

export const CRM_TASKS = "crm_tasks"
/** The most open tasks one pass reads; more is reported, never silently cut. */
export const POLI_READ_LIMIT = 2000

/** Polí's mode now. Never cached. */
export async function readPoliMode(env: Record<string, string | undefined> = process.env, readStored?: () => Promise<unknown>): Promise<PoliMode> {
  const de = deployEnv(env)
  if (de === "production") return skillMode(await readAgentControls(readStored, env), POLI_SKILL)
  const check = checkAuthProject(env)
  if (de !== "preview" || !check.ok || check.projectId === null) return "off"
  try {
    const read =
      readStored ??
      (async () => {
        const { getDb } = await import("../firebase-admin")
        return (await getDb().collection(AGENT_CONTROLS_DOC.collection).doc(AGENT_CONTROLS_DOC.id).get()).data()
      })
    return skillMode(parseControls(await read()), POLI_SKILL)
  } catch {
    return "off"
  }
}

/** A Firestore Timestamp, a Date, a number or a string, as ISO; null when unreadable. */
export function toIso(v: unknown): string | null {
  if (!v) return null
  if (typeof v === "string") return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null
  if (typeof v === "number") return Number.isFinite(v) ? new Date(v).toISOString() : null
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : null
  const o = v as { toDate?: () => Date; _seconds?: number; seconds?: number }
  if (typeof o.toDate === "function") return toIso(o.toDate())
  const s = typeof o._seconds === "number" ? o._seconds : o.seconds
  return typeof s === "number" ? new Date(s * 1000).toISOString() : null
}

/** A stored CRM task as the pass reads it. */
export function taskView(id: string, d: Record<string, unknown>): PoliTaskView {
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined)
  const poli = d.poli && typeof d.poli === "object" ? (d.poli as Record<string, unknown>) : undefined
  return {
    id,
    ref: str("ref"),
    title: str("title"),
    assigned_to: str("assigned_to"),
    due_date: str("due_date"),
    status: str("status"),
    brand: str("brand"),
    source: str("source"),
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at),
    ...(poli ? { poli: { path: typeof poli.path === "string" ? poli.path : undefined, record: typeof poli.record === "string" ? poli.record : undefined } } : {}),
  }
}

/**
 * Every task not completed, from the unified `crm_tasks`. Before the unified-tasks migration (`crm_meta/task_migration`)
 * the tasks live in the per-person collections, which Polí does not read: it reports `notUnified` and raises nothing.
 */
export async function readOpenTasks(): Promise<{ tasks: PoliTaskView[]; truncated: boolean; notUnified?: boolean }> {
  const { isTaskMigrationCompleted } = await import("../firestore-crm")
  if (!(await isTaskMigrationCompleted())) return { tasks: [], truncated: false, notUnified: true }
  const { getDb } = await import("../firebase-admin")
  const snap = await getDb().collection(CRM_TASKS).where("status", "!=", "completed").limit(POLI_READ_LIMIT).get()
  return { tasks: snap.docs.map((d) => taskView(d.id, d.data())), truncated: snap.size >= POLI_READ_LIMIT }
}

/**
 * The founder's name as tasks are assigned (`assigned_to`): the roster record (`crm_team_members`) whose email is the
 * founder's (ADMIN_FOUNDER_EMAIL). Null when it cannot be found: then nothing is raised (fails closed, never guessed).
 */
export async function readFounderAssignee(): Promise<string | null> {
  const { founderEmails } = await import("../founder-guard")
  const emails = founderEmails()
  if (!emails.length) return null
  const { getDb } = await import("../firebase-admin")
  for (const email of emails) {
    const snap = await getDb().collection("crm_team_members").where("email", "==", email).limit(1).get()
    const name = snap.docs[0]?.data()?.name
    if (typeof name === "string" && name.trim()) return name.trim()
  }
  return null
}

export interface PoliPassDeps {
  db: AgentDb
  mode: () => Promise<PoliMode>
  listOpen: () => Promise<{ tasks: PoliTaskView[]; truncated: boolean; notUnified?: boolean }>
  founder: () => Promise<string | null>
  now: () => string
  /** Gives a raised task its TSK reference after it commits (lib/record-refs.ts). Best effort. */
  numberTask?: (id: string) => Promise<void>
  maxOpen?: number
}

export interface PoliPassResult {
  mode: PoliMode
  /** Founder-owned tasks raised this pass. */
  raised: string[]
  /** Ledger entries for records an assistant already raised. */
  handled: string[]
  /** Findings that need a decision but wait for room under the open-task cap. */
  held: number
  /** Findings already written by an earlier pass, or whose record changed since it was read. */
  skipped: number
  truncated: boolean
  /** Why nothing was written, when that is the case. */
  note?: "off" | "proof" | "founder-unresolved" | "tasks-not-unified"
  plan?: PoliPlan
}

type Outcome = "written" | "exists" | "moved"

/** One finding: ledger task, three entries, and the founder-owned task when it raises one, committed together. */
async function writeFinding(db: AgentDb, f: PoliFinding, founder: string, at: string): Promise<Outcome> {
  return db.run(async (tx): Promise<Outcome> => {
    if (await tx.getTask(f.id)) return "exists"
    const raise = f.path !== "handled-elsewhere"
    if (raise && (await tx.getDoc(CRM_TASKS, f.id))) return "exists"
    const src = await tx.getDoc<Record<string, unknown>>(CRM_TASKS, f.task.id)
    const fresh = src ? taskView(f.task.id, src) : null
    if (!fresh || findingId(f.path, fresh) !== f.id || routeTask(fresh, at)?.path !== f.path) return "moved"
    const event = f.record
    let task: AgentTask = newTask({ id: f.id, property: "434", objective: POLI_OBJECTIVE, workflow: `${POLI_SKILL}/${f.path}`, budgetUsd: 0, lineage: { event }, requestedBy: POLI_ACTOR, now: at })
    const e1 = buildEntry(task, { kind: "task_created", actor: POLI_ACTOR, refs: { event } }, at)
    task = advance(task, e1)
    const e2 = buildEntry(task, { kind: "run_started", actor: POLI_ACTOR }, at)
    task = advance(task, e2, "running")
    const e3 = buildEntry(task, { kind: "routed", actor: POLI_ACTOR, refs: { event, ...(raise ? { record: `${CRM_TASKS}:${f.id}` } : {}) }, reasonCode: f.path }, at)
    task = advance(task, e3, "done")
    if (raise) tx.createDoc(CRM_TASKS, f.id, poliTaskRecord(f, founder, at))
    tx.appendEntry(e1)
    tx.appendEntry(e2)
    tx.appendEntry(e3)
    tx.putTask(task)
    return "written"
  })
}

/** One pass. Writes only in `draft`; a finding that fails is left for the next pass and does not stop the rest. */
export async function runPoliPass(deps: PoliPassDeps): Promise<PoliPassResult> {
  const mode = await deps.mode()
  if (mode === "off") return { mode, raised: [], handled: [], held: 0, skipped: 0, truncated: false, note: "off" }
  const now = deps.now()
  const { tasks, truncated, notUnified } = await deps.listOpen()
  if (notUnified) return { mode, raised: [], handled: [], held: 0, skipped: 0, truncated: false, note: "tasks-not-unified" }
  const plan = planPass(tasks, now, deps.maxOpen)
  const base = { mode, raised: [] as string[], handled: [] as string[], held: plan.held.length, skipped: 0, truncated, plan }
  if (mode === "proof") return { ...base, note: "proof" }
  const founder = await deps.founder()
  if (!founder) return { ...base, held: plan.held.length + plan.raise.length, note: "founder-unresolved" }
  for (const f of [...plan.raise, ...plan.handled]) {
    try {
      const out = await writeFinding(deps.db, f, founder, deps.now())
      if (out !== "written") {
        base.skipped++
        continue
      }
      if (f.path === "handled-elsewhere") base.handled.push(f.id)
      else {
        base.raised.push(f.id)
        await deps.numberTask?.(f.id).catch((e: unknown) => console.error(`[poli] ${f.id} has no TSK reference yet:`, e instanceof Error ? e.message : e))
      }
    } catch (e) {
      console.error(`[poli] finding ${f.id} was not written:`, e instanceof Error ? e.message : e)
      base.skipped++
    }
  }
  return base
}

/** The live pass: the default database, the live switch, the founder from the roster. */
export async function runPoliPassLive(): Promise<PoliPassResult> {
  const { firestoreAgentDb } = await import("./ledger-server")
  return runPoliPass({
    db: firestoreAgentDb(),
    mode: () => readPoliMode(),
    listOpen: readOpenTasks,
    founder: readFounderAssignee,
    now: () => new Date().toISOString(),
    numberTask: async (id) => {
      const [{ getDb, admin }, { assignRefIfMissing, firestoreRefStore }] = await Promise.all([import("../firebase-admin"), import("../record-refs")])
      await assignRefIfMissing(firestoreRefStore(getDb()), CRM_TASKS, id, "TSK", { now: admin.firestore.FieldValue.serverTimestamp() })
    },
  })
}

/** Polí's Today line, read when To do opens (lib/agent/today.ts): the same plan, nothing written. */
export async function readPoliToday(now: string): Promise<{ plan: PoliPlan; mode: PoliMode } | null> {
  try {
    const [mode, { tasks }] = await Promise.all([readPoliMode(), readOpenTasks()])
    return { plan: planPass(tasks, now), mode }
  } catch (e) {
    console.error("[poli] Today's Polí line could not be read:", e instanceof Error ? e.message : e)
    return null
  }
}

export function summarize(r: PoliPassResult): string {
  if (r.note === "off") return "Polí off"
  if (r.note === "tasks-not-unified") return `Polí ${r.mode}: tasks are not yet in the unified crm_tasks, nothing read`
  const base = `Polí ${r.mode}: raised ${r.raised.length}, handled elsewhere ${r.handled.length}, held ${r.held}, skipped ${r.skipped}${r.truncated ? ", list cut at the read limit" : ""}`
  return r.note === "founder-unresolved" ? `${base}; the founder is not on the roster, nothing raised` : r.note === "proof" ? `${base} (proof: nothing written)` : base
}
