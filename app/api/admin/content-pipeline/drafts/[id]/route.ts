import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../auth"

export const runtime = "nodejs"

/**
 * GET /api/admin/content-pipeline/drafts/[id] — one pipeline draft in full, read-only, for scoring a run: its story
 * (source text cut to 2,000 characters), card copy, caption, photos with rights and crop, checks, notices, every
 * model call and its history. The jobs route keeps its summary; this one is for the reviewer who needs the record.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!/^MCU-[A-Z0-9]{2,6}-\d{8}-\d{2,3}$/.test(id)) return NextResponse.json({ error: "Invalid draft id" }, { status: 400 })
  try {
    const { firestorePipelineStore } = await import("@/lib/firestore-content-pipeline")
    const d = await firestorePipelineStore().getDraft(id)
    if (!d) return NextResponse.json({ error: "Draft not found" }, { status: 404 })
    return NextResponse.json({ draft: { ...d, story: { ...d.story, sourceText: d.story.sourceText.slice(0, 2000) } } }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/content-pipeline/drafts/[id]]", err)
    return NextResponse.json({ error: "Could not read the draft" }, { status: 500 })
  }
}

/**
 * POST /api/admin/content-pipeline/drafts/[id] — the requester's choice for an ICYMI draft waiting on one (more
 * published stories qualified than a roundup takes): { postIds } of the stories offered on the draft, within the
 * roundup's size. The draft then runs like any roundup (the panel's run, or the cron, picks it up). Super-admin only.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!/^MCU-[A-Z0-9]{2,6}-\d{8}-\d{2,3}$/.test(id)) return NextResponse.json({ error: "Invalid draft id" }, { status: 400 })
  const body = await req.json().catch(() => null) as { postIds?: unknown } | null
  const postIds = Array.isArray(body?.postIds) && body.postIds.length <= 20 && body.postIds.every(x => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x)) ? body.postIds as string[] : null
  if (!postIds) return NextResponse.json({ error: "postIds: the chosen stories' post ids" }, { status: 400 })
  try {
    const [{ firestorePipelineStore }, { chooseRoundup }] = await Promise.all([import("@/lib/firestore-content-pipeline"), import("@/lib/content-pipeline/worker")])
    const by = auth.session.email.toLowerCase()
    const r = await chooseRoundup(firestorePipelineStore(), id, postIds, by, new Date().toISOString())
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 })
    console.info("[content-pipeline] roundup chosen", JSON.stringify({ draft: id, by, stories: postIds.length }))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/admin/content-pipeline/drafts/[id]]", err)
    return NextResponse.json({ error: "Could not record the choice" }, { status: 500 })
  }
}
