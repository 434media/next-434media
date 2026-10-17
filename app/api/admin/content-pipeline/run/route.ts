import { NextResponse, after } from "next/server"
import { requireSuperAdmin } from "../auth"

export const runtime = "nodejs"
export const maxDuration = 800
const RUN_BUDGET_MS = 700_000

/**
 * POST /api/admin/content-pipeline/run — resume due pipeline work. The Generate panel calls it about once a minute
 * while a run is open, so a run advances where no cron fires (Vercel runs crons on production only) and after a step's
 * retry wait. Leases keep overlapping runs apart, and nothing due means nothing runs.
 */
export async function POST() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let due: boolean
  try {
    const { firestorePipelineStore } = await import("@/lib/firestore-content-pipeline")
    due = (await firestorePipelineStore().due(Date.now(), 1)).length > 0
  } catch (err) {
    console.error("[POST /api/admin/content-pipeline/run] could not read due work:", err)
    return NextResponse.json({ error: "Could not read the run" }, { status: 500 })
  }
  if (due) after(async () => {
    try { const { runPipeline } = await import("@/lib/content-pipeline/run"); console.info("[content-pipeline] resume", JSON.stringify(await runPipeline(RUN_BUDGET_MS))) }
    catch (err) { console.error("[content-pipeline] resume failed:", err) }
  })
  return NextResponse.json({ ok: true, resumed: due }, { status: due ? 202 : 200 })
}
