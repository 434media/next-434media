/**
 * The agent sweep (cron, every 10 minutes): no task is left behind.
 *  - A task still `queued` two minutes after it was created (its arrival's run never started: a function cut short, a
 *    deploy) is run now.
 *  - A task `running` for over fifteen minutes is past any function's limit, so its run died: it is marked `failed`
 *    with a ledger entry, never re-run on a guess. A task whose run waits inside the engine (`engineRun`) is not judged
 *    by that clock: the engine check below covers it.
 *  - A task waiting on an engine run is checked against the engine (the D1 finding, 434-context#359: "a run the engine
 *    loses on its own leaves Firestore saying 'waiting'"). When the engine no longer holds the run (cancelled, failed,
 *    expired, gone, or finished without writing its result), the task is closed with a `reconciled` entry: `failed`,
 *    or `needs_reconciliation` for a person when it was mid-send and may have gone. A wait older than
 *    ENGINE_WAIT_CAP_MS is closed with an `expired` entry before the engine's 30-day retention can lose it. Either way
 *    the console and the Today card list it as a failure with its reason; it never reads as waiting.
 * Pure apart from its injected reads; the cron route wires it.
 */
import { OPEN_STATES, type AgentTask, type TaskState } from "./ledger"
import { step, type AgentDb } from "./ledger-server"

export const QUEUED_GRACE_MS = 2 * 60_000
export const RUNNING_STALE_MS = 15 * 60_000
export const SWEEP_RUN_CAP = 3
/** Below the engine's 30-day run retention (D1 finding 4), with room for a missed sweep or two. */
export const ENGINE_WAIT_CAP_MS = 25 * 24 * 3_600_000
export const ENGINE_RETENTION_MS = 30 * 24 * 3_600_000

/** A run's status as the engine reports it; `not_found` when the engine has no such run. */
export type EngineRunStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "not_found"
const ENGINE_HOLDS: readonly EngineRunStatus[] = ["pending", "running"]

export interface SweepDeps {
  db: AgentDb
  listByState: (state: "queued" | "running") => Promise<AgentTask[]>
  run: (task: AgentTask) => Promise<{ ok: boolean; code?: string }>
  now: () => string
  /** Open tasks that carry an `engineRun`. Omitted: nothing waits on the engine yet. */
  listOnEngine?: () => Promise<AgentTask[]>
  /** The engine's status for a run. Omitted: only the wait cap applies, and the rest are counted as unchecked. */
  engineStatus?: (runId: string) => Promise<EngineRunStatus>
}

export interface SweepResult {
  ran: string[]
  failedStale: string[]
  waiting: number
  /** Tasks closed because the engine no longer holds their run, or their wait passed the cap. */
  lostRuns: string[]
  /** Tasks on the engine whose status could not be read this time. */
  engineUnchecked: number
}

/** What a lost engine run does to its task: mid-send may have gone, so a person checks; anything else failed. */
const closedState = (t: AgentTask): TaskState => (t.state === "sending" ? "needs_reconciliation" : "failed")

export async function sweepAgentTasks(deps: SweepDeps): Promise<SweepResult> {
  const now = Date.parse(deps.now())
  const failedStale: string[] = []
  for (const t of await deps.listByState("running")) {
    if (t.engineRun || now - Date.parse(t.updatedAt) < RUNNING_STALE_MS) continue
    try {
      await step(deps.db, {
        taskId: t.id,
        at: deps.now(),
        decide: (cur) => {
          if (cur.state !== "running" || cur.engineRun || now - Date.parse(cur.updatedAt) < RUNNING_STALE_MS) throw new Error("moved on")
          return { fields: { kind: "run_finished", actor: "system", reasonCode: "stale-run" }, to: "failed" }
        },
      })
      failedStale.push(t.id)
    } catch {
      /* it moved on since the list was read */
    }
  }

  const lostRuns: string[] = []
  let engineUnchecked = 0
  for (const t of deps.listOnEngine ? await deps.listOnEngine() : []) {
    if (!t.engineRun || !OPEN_STATES.includes(t.state)) continue
    const run = t.engineRun
    let close: { kind: "expired" | "reconciled"; reasonCode: string } | null = null
    if (now - Date.parse(run.since) >= ENGINE_WAIT_CAP_MS) close = { kind: "expired", reasonCode: "engine-wait-cap" }
    else if (deps.engineStatus) {
      let status: EngineRunStatus
      try {
        status = await deps.engineStatus(run.id)
      } catch {
        engineUnchecked++
        continue
      }
      if (!ENGINE_HOLDS.includes(status)) close = { kind: "reconciled", reasonCode: `engine-${status.replace("_", "-")}` }
    } else engineUnchecked++
    if (!close) continue
    const c = close
    try {
      await step(deps.db, {
        taskId: t.id,
        at: deps.now(),
        decide: (cur) => {
          if (!cur.engineRun || cur.engineRun.id !== run.id || !OPEN_STATES.includes(cur.state)) throw new Error("moved on")
          return { fields: { kind: c.kind, actor: "system", refs: { run: run.id }, reasonCode: c.reasonCode }, to: closedState(cur), engineRun: null }
        },
      })
      lostRuns.push(t.id)
    } catch {
      /* it moved on since the list was read */
    }
  }

  const due = (await deps.listByState("queued")).filter((t) => !t.cancelled && now - Date.parse(t.createdAt) >= QUEUED_GRACE_MS).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const ran: string[] = []
  for (const t of due.slice(0, SWEEP_RUN_CAP)) {
    await deps.run(t)
    ran.push(t.id)
  }
  return { ran, failedStale, waiting: Math.max(0, due.length - SWEEP_RUN_CAP), lostRuns, engineUnchecked }
}
