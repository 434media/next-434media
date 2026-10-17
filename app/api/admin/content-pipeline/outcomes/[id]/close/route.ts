import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../../auth"

export const runtime = "nodejs"

/**
 * POST /api/admin/content-pipeline/outcomes/[id]/close — "Confirm no new content". Closes a content-pipeline
 * "no new content" card: records who closed it and when, on the card and on its Generate job, and the board stops
 * showing it. Nothing is deleted. Only a card marked pipeline_outcome can be closed here; closing twice is a no-op.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return NextResponse.json({ error: "Invalid card id" }, { status: 400 })
  try {
    const { getContentPostById, updateContentPost } = await import("@/lib/firestore-crm")
    const post = await getContentPostById(id)
    if (!post) return NextResponse.json({ error: "Card not found" }, { status: 404 })
    const outcome = post.pipeline_outcome
    if (!outcome || outcome.kind !== "no_new_content") return NextResponse.json({ error: "Only a \"no new content\" card can be closed here" }, { status: 400 })
    if (outcome.closed_at) return NextResponse.json({ ok: true, closedAt: outcome.closed_at, closedBy: outcome.closed_by ?? null, already: true })
    const closedAt = new Date().toISOString(), closedBy = auth.session.email.toLowerCase()
    await updateContentPost(id, { pipeline_outcome: { ...outcome, closed_at: closedAt, closed_by: closedBy } })
    // The job keeps the same record; a failure here never undoes the close.
    try {
      const { firestorePipelineStore } = await import("@/lib/firestore-content-pipeline")
      const store = firestorePipelineStore(), job = await store.getJob(outcome.job_id)
      if (job && !job.closedAt) await store.saveJob({ ...job, closedAt, closedBy, updatedAt: closedAt })
    } catch (err) {
      console.error("[POST /api/admin/content-pipeline/outcomes/close] job not updated:", err)
    }
    console.info("[content-pipeline] no-content closed", JSON.stringify({ card: id, job: outcome.job_id, by: closedBy }))
    return NextResponse.json({ ok: true, closedAt, closedBy })
  } catch (err) {
    console.error("[POST /api/admin/content-pipeline/outcomes/close]", err)
    return NextResponse.json({ error: "Could not close the card" }, { status: 500 })
  }
}
