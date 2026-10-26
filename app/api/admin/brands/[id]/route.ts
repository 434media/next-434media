import { NextResponse, type NextRequest } from "next/server"
import { requireStaff } from "../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/brands/[id] — one brand's page (plan v11.2.1 Step 4 items 2 and 3): its status, the missing templates
 * and its brand book for 434 staff (interns excluded, as /admin/brand); and for super-admins, who edit and publish,
 * also the onboarding checklist, its sources (the seeds the profile names, as loaded), and its profile document (draft
 * and published) with the version history. Editing, Publish and Restore go through /api/admin/brand-profiles/[id].
 * The draft is sent without its `visual` block: the book is generated, never edited by hand (the PUT keeps the stored one).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const [{ readBrand }, { firestoreBrandProfiles }, { brandState, missingTemplates, onboardingChecklist }, { PIPELINE_PROPERTIES }, { publishProblems, draftToken }, { brandBookStatus }] = await Promise.all([
      import("@/lib/firestore-brands"), import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/brand-status"), import("@/lib/content-pipeline/properties"), import("@/lib/content-pipeline/profile-store"), import("@/lib/content-pipeline/brand-book-check"),
    ])
    const store = firestoreBrandProfiles(), doc = await store.get(id)
    if (!doc && !PIPELINE_PROPERTIES.some(p => p.id === id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
    const [{ facts: f, seeds }, versions] = await Promise.all([readBrand(id, doc), doc && auth.superAdmin ? store.versions(id) : Promise.resolve([])])
    // The brand book is the published version's, so it names the version it was built from (Step 4 item 3).
    const status = f.published ? brandBookStatus(f.published.profile.visual) : null
    const book = status?.ok && f.published ? { versionId: f.published.versionId, book: status.book } : null
    const brand = { id: f.id, label: f.label, brandType: f.brandType, onRoster: f.onRoster, state: brandState(f), versionId: f.published?.versionId ?? null, publishedAt: f.published?.publishedAt ?? null, publishedBy: f.published?.publishedBy ?? null, problem: f.published ? null : f.publishedProblem, draftDiffers: f.draftDiffers, postsMade: f.postsMade }
    const missing = missingTemplates(f.published?.profile ?? null, f.label, f.brandBook, f.brandBookProblem)
    const headers = { "cache-control": "private, no-store" }
    if (!auth.superAdmin) return NextResponse.json({ canEdit: false, brand, missing, book }, { headers })
    return NextResponse.json({
      canEdit: true, brand, missing, book,
      checklist: onboardingChecklist(f),
      sources: { pointer: f.sources?.seeds ?? null, note: f.sources?.note ?? null, seeds },
      doc: doc ? {
        brand_type: doc.brand_type, client_id: doc.client_id, identity: doc.identity,
        draft: doc.draft ? { ...doc.draft, profile: withoutVisual(doc.draft.profile) } : null, draftToken: draftToken(doc.draft),
        draftHasBook: hasVisual(doc.draft?.profile), last_version: doc.last_version, published: doc.published ? { version_id: doc.published.version_id } : null,
      } : null,
      draftProblems: doc?.draft ? publishProblems(doc) : [],
      versions: versions.map(v => ({ versionId: v.version_id, n: v.n, profileVersion: v.profile.profileVersion, sha256: v.profile_sha256, publishedBy: v.published_by, publishedAt: v.published_at, restoredFrom: v.restored_from })),
    }, { headers })
  } catch (err) {
    console.error("[GET /api/admin/brands/[id]]", err)
    return NextResponse.json({ error: "Could not read the brand" }, { status: 500 })
  }
}

const hasVisual = (profile: unknown) => !!profile && typeof profile === "object" && (profile as Record<string, unknown>).visual !== undefined
/** The draft profile as the hand editor shows it: without the generated `visual` block. */
function withoutVisual(profile: unknown): unknown {
  if (!hasVisual(profile)) return profile
  return Object.fromEntries(Object.entries(profile as Record<string, unknown>).filter(([k]) => k !== "visual"))
}
