import { type NextRequest, NextResponse } from "next/server"
import { authorizeCronRequest, recordCronRun } from "@/lib/cron-auth"

export const runtime = "nodejs"
export const maxDuration = 300
const RUN_BUDGET_MS = 240_000

/**
 * The content pipeline's scheduled check (the pilot's one-minute resume, on this site's crons): resumes any job or
 * draft a Generate run left due — an interrupted run, a lost lease, the rest of a large batch. A tick with nothing
 * due writes no run record, so the minute schedule leaves no trail of empty runs, but every tick logs one line, so
 * a stall is visible in the runtime logs.
 */
export async function GET(request: NextRequest) {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized
  const { firestorePipelineStore } = await import("@/lib/firestore-content-pipeline")
  const due = await firestorePipelineStore().due(Date.now(), 5)
  console.info("[cron:content-pipeline]", JSON.stringify({ due: due.length, items: due.map(d => `${d.kind}:${d.id}`) }))
  if (!due.length) return NextResponse.json({ ok: true, job: "content-pipeline", message: "Nothing due" })
  const startedAt = new Date()
  try {
    const { runPipeline } = await import("@/lib/content-pipeline/run")
    const { steps } = await runPipeline(RUN_BUDGET_MS)
    console.info("[cron:content-pipeline]", JSON.stringify({ steps }))
    const finishedAt = new Date()
    await recordCronRun({ job: "content-pipeline", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), durationMs: finishedAt.getTime() - startedAt.getTime(), status: "success", message: `Ran ${steps} steps`, detail: { steps } })
    return NextResponse.json({ ok: true, job: "content-pipeline", steps })
  } catch (error) {
    const finishedAt = new Date(), message = error instanceof Error ? error.message : String(error)
    await recordCronRun({ job: "content-pipeline", startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString(), durationMs: finishedAt.getTime() - startedAt.getTime(), status: "error", message })
    console.error("[cron:content-pipeline] failed:", error)
    return NextResponse.json({ ok: false, job: "content-pipeline", error: message }, { status: 500 })
  }
}
