import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"

/** GET /api/admin/brand-profiles/[id] — the brand's document (draft and published) and its version history. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const { firestoreBrandProfiles } = await import("@/lib/firestore-brand-profiles")
    const store = firestoreBrandProfiles(), doc = await store.get(id)
    if (!doc) return NextResponse.json({ error: "No profile for that brand" }, { status: 404 })
    const versions = (await store.versions(id)).map(v => ({ versionId: v.version_id, n: v.n, profileVersion: v.profile.profileVersion, sha256: v.profile_sha256, publishedBy: v.published_by, publishedAt: v.published_at, restoredFrom: v.restored_from }))
    return NextResponse.json({ doc, versions }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brand-profiles/[id]]", err)
    return NextResponse.json({ error: "Could not read the profile" }, { status: 500 })
  }
}

const draftInput = z.object({
  profile: z.record(z.string(), z.unknown()),
  examples: z.object({ approved: z.array(z.unknown()).max(50), rejected: z.array(z.unknown()).max(50) }).default({ approved: [], rejected: [] }),
  /** The draftToken the editor saw (the Brands area sends it); a draft saved in between is refused, 409. */
  expectedDraft: z.string().max(64).optional(),
}).strict()

/**
 * PUT /api/admin/brand-profiles/[id] — save the draft. A draft affects nothing until it is published, so it may be
 * incomplete; Publish is where it is validated.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  const parsed = draftInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Send {profile, examples: {approved, rejected}}" }, { status: 400 })
  try {
    const { firestoreBrandProfiles } = await import("@/lib/firestore-brand-profiles")
    const store = firestoreBrandProfiles()
    if (!await store.get(id)) return NextResponse.json({ error: "No profile for that brand" }, { status: 404 })
    const { expectedDraft, ...draft } = parsed.data
    const doc = await store.saveDraft(id, draft as { profile: unknown; examples: { approved: never[]; rejected: never[] } }, auth.session.email.toLowerCase(), new Date().toISOString(), expectedDraft)
    // The problems Publish would raise, so the editor sees them before publishing (saving is still allowed).
    const { publishProblems, draftToken } = await import("@/lib/content-pipeline/profile-store")
    return NextResponse.json({ ok: true, draft: doc.draft, draftToken: draftToken(doc.draft), publishProblems: publishProblems(doc) })
  } catch (err) {
    const { DraftTooLarge, DraftChanged } = await import("@/lib/firestore-brand-profiles")
    if (err instanceof DraftChanged) return NextResponse.json({ error: err.message }, { status: 409 })
    if (err instanceof DraftTooLarge) return NextResponse.json({ error: "The draft is too large", problems: [err.message] }, { status: 400 })
    console.error("[PUT /api/admin/brand-profiles/[id]]", err)
    return NextResponse.json({ error: "Could not save the draft" }, { status: 500 })
  }
}
