import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { AGENT_TASKS_COLLECTION, type AgentTask } from "@/lib/agent/ledger"
import { firestoreAgentDb } from "@/lib/agent/ledger-server"
import { liveIntakeDeps } from "@/lib/agent/intake-server"
import { INTAKE_OBJECTIVE, runIntake } from "@/lib/agent/intake"
import { sweepAgentTasks } from "@/lib/agent/sweep"

export const runtime = "nodejs"
export const maxDuration = 800

/**
 * GET /api/cron/agent-sweep (every 10 minutes; V1 item 4, the proof slice). Runs agent tasks left `queued` past their
 * grace, fails tasks whose run died mid-way, and closes tasks whose engine run was lost or waited past its cap, each
 * with its ledger entry (lib/agent/sweep.ts). Sends nothing: an
 * intake run only drafts. Off Production, and while the kill switch is on, an intake run refuses itself.
 *
 * Then Polí's rule pass (lib/agent/poli-server.ts; V1 item 4, Polí slice 1): rules only, no model call. A failure in
 * it is reported in the run's message and never stops the sweep above.
 */
export async function GET(request: NextRequest) {
  return runCronJob("agent-sweep", request, async () => {
    const { getDb } = await import("@/lib/firebase-admin")
    const listByState = async (state: "queued" | "running") =>
      (await getDb().collection(AGENT_TASKS_COLLECTION).where("state", "==", state).limit(50).get()).docs.map((d) => d.data() as AgentTask)
    const out = await sweepAgentTasks({
      db: firestoreAgentDb(),
      listByState,
      run: async (task) => {
        if (task.objective !== INTAKE_OBJECTIVE) return { ok: false, code: "unknown-objective" }
        const r = await runIntake(task.id, liveIntakeDeps())
        return r.ok ? { ok: true } : { ok: false, code: r.code }
      },
      now: () => new Date().toISOString(),
      // Tasks whose run waits inside the engine (none yet: no run is held in the engine until Polí's). The engine's
      // status read is wired with the first such run; until then the wait cap still closes any that pass it.
      listOnEngine: async () =>
        (await getDb().collection(AGENT_TASKS_COLLECTION).where("engineRun.since", ">", "").limit(50).get()).docs.map((d) => d.data() as AgentTask),
    })
    let poli: string
    let poliDetail: unknown = null
    try {
      const { runPoliPassLive, summarize } = await import("@/lib/agent/poli-server")
      const r = await runPoliPassLive()
      poli = summarize(r)
      poliDetail = { mode: r.mode, raised: r.raised, handled: r.handled, held: r.held, skipped: r.skipped, truncated: r.truncated, note: r.note }
    } catch (e) {
      console.error("[cron:agent-sweep] Polí's pass failed:", e)
      poli = "Polí's pass failed"
    }
    return { message: `ran ${out.ran.length}, failed ${out.failedStale.length} stale, closed ${out.lostRuns.length} lost engine runs, ${out.waiting} waiting; ${poli}`, detail: { ...out, poli: poliDetail } }
  })
}
