/**
 * The agent sweep (cron, every 10 minutes): no task is left behind.
 *  - A task still `queued` two minutes after it was created (its arrival's run never started: a function cut short, a
 *    deploy) is run now.
 *  - A task `running` for over fifteen minutes is past any function's limit, so its run died: it is marked `failed`
 *    with a ledger entry, never re-run on a guess.
 * Pure apart from its injected reads; the cron route wires it.
 */
import type { AgentTask } from "./ledger"
import { step, type AgentDb } from "./ledger-server"

export const QUEUED_GRACE_MS = 2 * 60_000
export const RUNNING_STALE_MS = 15 * 60_000
export const SWEEP_RUN_CAP = 3

export interface SweepDeps {
  db: AgentDb
  listByState: (state: "queued" | "running") => Promise<AgentTask[]>
  run: (task: AgentTask) => Promise<{ ok: boolean; code?: string }>
  now: () => string
}

export async function sweepAgentTasks(deps: SweepDeps): Promise<{ ran: string[]; failedStale: string[]; waiting: number }> {
  const now = Date.parse(deps.now())
  const failedStale: string[] = []
  for (const t of await deps.listByState("running")) {
    if (now - Date.parse(t.updatedAt) < RUNNING_STALE_MS) continue
    try {
      await step(deps.db, {
        taskId: t.id,
        at: deps.now(),
        decide: (cur) => {
          if (cur.state !== "running" || now - Date.parse(cur.updatedAt) < RUNNING_STALE_MS) throw new Error("moved on")
          return { fields: { kind: "run_finished", actor: "system", reasonCode: "stale-run" }, to: "failed" }
        },
      })
      failedStale.push(t.id)
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
  return { ran, failedStale, waiting: Math.max(0, due.length - SWEEP_RUN_CAP) }
}
