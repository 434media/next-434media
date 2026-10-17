import { NextResponse } from "next/server"
import { requireSuperAdmin } from "../auth"
import { PIPELINE_MODELS } from "@/lib/content-pipeline/models"

export const runtime = "nodejs"

/** GET /api/admin/content-pipeline/jobs — recent Generate runs and where each draft stands (no source text). */
export async function GET() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { listRecentPipelineJobs, getMcuSeeds } = await import("@/lib/firestore-content-pipeline")
    const [runs, seeds] = await Promise.all([listRecentPipelineJobs(8), getMcuSeeds()])
    return NextResponse.json({
      seeds: seeds ? { loaded: true, snapshot: seeds.snapshot, updatedAt: seeds.updatedAt ?? null } : { loaded: false },
      models: PIPELINE_MODELS,
      jobs: runs.map(({ job, drafts }) => ({
        id: job.id, property: job.property ?? "milcity", kind: job.kind, count: job.count, topic: job.topic ?? null, status: job.status, note: job.note ?? null, noContentPostId: job.noContentPostId ?? null, closedAt: job.closedAt ?? null, createdAt: job.createdAt, requestedBy: job.request.actorEmail,
        drafts: drafts.map(d => ({ id: d.id, status: d.status, title: d.story.title, holdReason: d.holdReason ?? null, error: d.status === "held" || d.status === "in_review" ? null : d.error ?? null, postId: d.postId ?? null, checks: d.qa.length, calls: (d.calls ?? []).map(c => ({ step: c.step, model: c.model, provider: c.provider ?? null })) })),
      })),
    }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/content-pipeline/jobs]", err)
    return NextResponse.json({ error: "Could not read runs" }, { status: 500 })
  }
}
