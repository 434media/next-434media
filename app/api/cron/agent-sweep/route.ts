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
 * grace and fails tasks whose run died mid-way, each with its ledger entry (lib/agent/sweep.ts). Sends nothing: an
 * intake run only drafts. Off Production, and while the kill switch is on, an intake run refuses itself.
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
    })
    return { message: `ran ${out.ran.length}, failed ${out.failedStale.length} stale, ${out.waiting} waiting`, detail: out }
  })
}
