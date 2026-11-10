import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"
import type { BookPlan } from "@/lib/brand-book-publish"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Publish brand book (lib/brand-book-publish.ts): the brand book regenerated from the newest copy of the brand's visual
 * standard that 434-context's brand-assets workflow put in storage, published as the profile's next version. It writes
 * Firestore only, with the site's own identity; the files the book names were published by the workflow's create-only
 * publisher, and are read here, never written.
 *
 * GET is the dry run: what would be published, from which standard, whether every file the Marks table names is in
 * storage with the bytes its publisher recorded, and the plan's token. POST publishes with that token; if anything the
 * plan was made from has changed, it is refused (409), and any problem refuses it (400). A book already published is
 * reported, not published again. Super-admins only, as Publish.
 */
async function plan(id: string): Promise<{ plan: BookPlan; doc: import("@/lib/content-pipeline/profile-store").BrandProfileDoc | null; standard: import("@/lib/brand-asset-store").StoredStandard | null }> {
  const [{ planBook }, { brandAssetStore }, { firestoreBrandProfiles }, { draftDiffers }] = await Promise.all([
    import("@/lib/brand-book-publish"), import("@/lib/brand-asset-store"), import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/profile-store"),
  ])
  const assets = brandAssetStore()
  const [doc, standard] = await Promise.all([firestoreBrandProfiles().get(id), assets.latestStandard(id)])
  const { bookFromStandard, namedFiles } = await import("@/lib/brand-book-publish")
  const names = standard ? namedFiles(bookFromStandard(standard.md, standard.sourcePath)) : []
  const files = Object.fromEntries(await Promise.all(names.map(async f => {
    const info = await assets.info(id, f)
    const data = info ? await assets.read(id, f) : null
    return [f, info && data ? { data, recorded: info.sha256 } : null] as const
  })))
  return {
    plan: planBook({ brandId: id, standard, files, doc: doc && { last_version: doc.last_version, published: doc.published, draftDiffers: draftDiffers(doc) } }),
    doc,
    standard,
  }
}

const view = (p: BookPlan) => ({ ...p, files: p.files.map(f => ({ file: f.file, state: f.state })) })

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    return NextResponse.json(view((await plan(id)).plan), { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brand-profiles/[id]/book]", err)
    return NextResponse.json({ error: "Could not read the standard, the files or the profile" }, { status: 502 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  const body = await req.json().catch(() => null) as { token?: unknown } | null
  if (typeof body?.token !== "string") return NextResponse.json({ error: "Run the check first, then publish what it showed" }, { status: 400 })
  let p: BookPlan, doc: Awaited<ReturnType<typeof plan>>["doc"], standard: Awaited<ReturnType<typeof plan>>["standard"]
  try { ({ plan: p, doc, standard } = await plan(id)) } catch (err) {
    console.error("[POST /api/admin/brand-profiles/[id]/book] plan", err)
    return NextResponse.json({ error: "Could not read the standard, the files or the profile" }, { status: 502 })
  }
  if (p.token !== body.token) return NextResponse.json({ error: "Something changed since the check. Check again.", plan: view(p) }, { status: 409 })
  if (p.problems.length) return NextResponse.json({ error: "The brand book can't be published", problems: p.problems, plan: view(p) }, { status: 400 })
  if (p.current) return NextResponse.json({ ok: true, current: true, versionId: p.publishedVersion })
  try {
    const [{ firestoreBrandProfiles, appendBrandActivity }, { bookFromStandard }, { draftToken }] = await Promise.all([
      import("@/lib/firestore-brand-profiles"), import("@/lib/brand-book-publish"), import("@/lib/content-pipeline/profile-store"),
    ])
    // The standard the plan was checked against (its object and generation are in the token).
    const visual = bookFromStandard(standard!.md, standard!.sourcePath)
    const store = firestoreBrandProfiles(), actor = auth.session.email.toLowerCase(), at = new Date().toISOString()
    // As `profile.ts book`, on the published profile (the plan refused a draft with unpublished edits); the save and
    // the publish each refuse a draft saved by someone else in between.
    const published = doc!.published!
    const saved = await store.saveDraft(id, { profile: { ...(published.profile as object), visual }, examples: published.examples }, actor, at, draftToken(doc!.draft))
    const result = await store.publish(id, actor, at, draftToken(saved.draft))
    if (!result.ok) return NextResponse.json({ error: "The profile could not be published", problems: result.problems }, { status: 400 })
    const v = result.version
    await appendBrandActivity(id, { type: "brand_book_published", actor, at, detail: { versionId: v.version_id, standard: p.standard, digest: p.digest, files: p.files.map(f => f.file) } })
      .catch(err => console.error("[POST /api/admin/brand-profiles/[id]/book] activity not recorded", err))
    console.info("[brand-profiles/book]", JSON.stringify({ by: actor, brand: id, version: v.version_id, standard: p.standard?.version, digest: p.digest }))
    return NextResponse.json({ ok: true, versionId: v.version_id, publishedAt: v.published_at })
  } catch (err) {
    const { DraftChanged } = await import("@/lib/firestore-brand-profiles")
    if (err instanceof DraftChanged) return NextResponse.json({ error: "The draft changed since the check. Check again." }, { status: 409 })
    console.error("[POST /api/admin/brand-profiles/[id]/book]", err)
    return NextResponse.json({ error: "Could not publish" }, { status: 500 })
  }
}
