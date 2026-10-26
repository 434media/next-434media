import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/brands/[id] — one brand's page (plan v11.2.1 Step 4 item 2): its status, the onboarding checklist, the
 * missing templates, its sources (the seeds the profile names, as loaded), and its profile document (draft and
 * published) with the version history. Editing, Publish and Restore go through /api/admin/brand-profiles/[id].
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const [{ readBrand }, { firestoreBrandProfiles }, { brandState, missingTemplates, onboardingChecklist }, { PIPELINE_PROPERTIES }, { publishProblems, draftToken }] = await Promise.all([
      import("@/lib/firestore-brands"), import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/brand-status"), import("@/lib/content-pipeline/properties"), import("@/lib/content-pipeline/profile-store"),
    ])
    const store = firestoreBrandProfiles(), doc = await store.get(id)
    if (!doc && !PIPELINE_PROPERTIES.some(p => p.id === id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
    const [{ facts: f, seeds }, versions] = await Promise.all([readBrand(id, doc), doc ? store.versions(id) : Promise.resolve([])])
    return NextResponse.json({
      brand: { id: f.id, label: f.label, brandType: f.brandType, onRoster: f.onRoster, state: brandState(f), versionId: f.published?.versionId ?? null, publishedAt: f.published?.publishedAt ?? null, publishedBy: f.published?.publishedBy ?? null, problem: f.published ? null : f.publishedProblem, draftDiffers: f.draftDiffers, postsMade: f.postsMade },
      checklist: onboardingChecklist(f),
      missing: missingTemplates(f.published?.profile ?? null, f.label, f.brandBook),
      sources: { pointer: f.sources?.seeds ?? null, note: f.sources?.note ?? null, seeds },
      doc: doc ? { brand_type: doc.brand_type, client_id: doc.client_id, identity: doc.identity, draft: doc.draft, draftToken: draftToken(doc.draft), last_version: doc.last_version, published: doc.published ? { version_id: doc.published.version_id } : null } : null,
      draftProblems: doc?.draft ? publishProblems(doc) : [],
      versions: versions.map(v => ({ versionId: v.version_id, n: v.n, profileVersion: v.profile.profileVersion, sha256: v.profile_sha256, publishedBy: v.published_by, publishedAt: v.published_at, restoredFrom: v.restored_from })),
    }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brands/[id]]", err)
    return NextResponse.json({ error: "Could not read the brand" }, { status: 500 })
  }
}
