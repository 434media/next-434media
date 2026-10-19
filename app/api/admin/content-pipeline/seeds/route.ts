import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../auth"
import { seedProblems, type McuSeeds } from "@/lib/content-pipeline/seeds"

export const runtime = "nodejs"

/**
 * PUT /api/admin/content-pipeline/seeds — load the MCU source seeds (a copy of the founder's private Tracker) into
 * Firestore. They are kept out of this public repository (lib/content-pipeline/seeds.ts). Replaces the whole set.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await req.json().catch(() => null)
  let problems: string[]
  try {
    // The seed shape comes from the brand's published profile, read from the database for this request.
    const [{ requirePublishedProfile }, { withProfile }, { DEFAULT_PROPERTY }] = await Promise.all([import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/brand"), import("@/lib/content-pipeline/properties")])
    problems = withProfile(await requirePublishedProfile(DEFAULT_PROPERTY), () => seedProblems(body))
  } catch (err) {
    console.error("[PUT /api/admin/content-pipeline/seeds] profile not read:", err)
    return NextResponse.json({ error: "Could not read the brand profile" }, { status: 500 })
  }
  if (problems.length) return NextResponse.json({ error: "Seeds not usable", problems }, { status: 400 })
  const b = body as McuSeeds
  const seeds: McuSeeds = { purpose: b.purpose.trim(), cohorts: b.cohorts, orgs: b.orgs.map(o => ({ name: o.name, site: o.site, kind: o.kind })), dt101Backlog: b.dt101Backlog.map(x => ({ subject: x.subject, maker: x.maker, url: x.url })), dt101Covered: b.dt101Covered, snapshot: b.snapshot.trim(), updatedAt: new Date().toISOString(), updatedBy: auth.session.email.toLowerCase() }
  try {
    const { saveMcuSeeds } = await import("@/lib/firestore-content-pipeline")
    await saveMcuSeeds(seeds)
  } catch (err) {
    console.error("[PUT /api/admin/content-pipeline/seeds]", err)
    return NextResponse.json({ error: "Could not save seeds" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, orgs: seeds.orgs.length, dt101Backlog: seeds.dt101Backlog.length, snapshot: seeds.snapshot })
}
