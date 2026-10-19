import { NextResponse, after, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSuperAdmin } from "../auth"
import { REQUEST_KINDS } from "@/lib/content-pipeline/series"
import { DEFAULT_PROPERTY, propertyCanGenerate } from "@/lib/content-pipeline/properties"
import type { McuJob } from "@/lib/content-pipeline/store"
import type { BrandProfile } from "@/lib/content-pipeline/profile"

export const runtime = "nodejs"
// The run continues after the response (next/server after()) for up to this long; the cron picks up the rest.
export const maxDuration = 800
const RUN_BUDGET_MS = 700_000

const input = z.object({
  requestId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  property: z.string().regex(/^[a-z0-9-]{2,40}$/).default(DEFAULT_PROPERTY),
  kind: z.enum(REQUEST_KINDS as [string, ...string[]]),
  count: z.number().int().min(1).max(5).default(1),
  // The optional instruction (stored as `topic`, as before), passed to research and writing.
  topic: z.string().trim().min(2).max(1000).optional(),
}).strict()

/**
 * POST /api/admin/content-pipeline/generate — start a batch for a property (MilCityUSA only, for now) by template and count. Opens a durable job (idempotent on
 * requestId, so a double click starts one run) and runs it after responding. Drafts land in the board's Review
 * column; nothing is prepared, approved or published. Feed placement only (no benefit-led DT101 Reels template yet).
 */
export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose a property, a template (news, breaking, dt101, icymi), a count of 1–5 and an optional instruction" }, { status: 400 })
  const a = parsed.data
  // The brand's published profile, read from the database for this request (no cache): an unpublished or invalid
  // profile offers nothing.
  let profile: BrandProfile | null = null
  try {
    const { readPublishedProfile } = await import("@/lib/firestore-brand-profiles")
    const r = await readPublishedProfile(a.property)
    profile = "active" in r ? r.active.profile : null
  } catch (err) {
    console.error("[POST /api/admin/content-pipeline/generate] profile not read:", err)
    return NextResponse.json({ error: "Could not read the brand profile" }, { status: 500 })
  }
  if (!propertyCanGenerate(a.property, a.kind, profile)) return NextResponse.json({ error: "That brand has no published profile with that template yet" }, { status: 400 })
  const job: McuJob = {
    id: `job-${a.requestId}`, property: a.property, kind: a.kind as McuJob["kind"], count: a.kind === "icymi" ? 1 : a.count, ...(a.topic ? { topic: a.topic } : {}),
    placement: "feed", request: { actorEmail: auth.session.email.toLowerCase(), actorName: auth.session.name || "" },
    status: "researching", drafts: [], createdAt: new Date().toISOString(),
  }
  let created: boolean
  try {
    const { firestorePipelineStore } = await import("@/lib/firestore-content-pipeline")
    created = (await firestorePipelineStore().createJob(job)).created
  } catch (err) {
    console.error("[POST /api/admin/content-pipeline/generate] job not saved:", err)
    return NextResponse.json({ error: "Could not start the run" }, { status: 500 })
  }
  if (created) after(async () => {
    try { const { runPipeline } = await import("@/lib/content-pipeline/run"); console.info("[content-pipeline] run", JSON.stringify({ job: job.id, ...await runPipeline(RUN_BUDGET_MS) })) }
    catch (err) { console.error("[content-pipeline] run failed; the cron resumes it:", err) }
  })
  return NextResponse.json({ ok: true, jobId: job.id, started: created }, { status: created ? 202 : 200 })
}
