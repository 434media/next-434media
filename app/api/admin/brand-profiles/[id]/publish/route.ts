import { NextResponse, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"

/**
 * POST /api/admin/brand-profiles/[id]/publish — publish the draft. It is validated first (the engine's own profile
 * validator); an invalid draft is refused with its problems (400) and nothing changes. A valid one becomes a new
 * version, kept with who published it and when, and governs the next request. 434-context pulls
 * its backup record the next day (GET /api/brand-profiles/backups).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const { firestoreBrandProfiles } = await import("@/lib/firestore-brand-profiles")
    const store = firestoreBrandProfiles()
    // The draftToken the editor saw, when it sends one (the Brands area does): a draft saved in between is refused.
    const body = await req.json().catch(() => null) as { expectedDraft?: unknown } | null
    const expected = typeof body?.expectedDraft === "string" ? body.expectedDraft.slice(0, 64) : undefined
    const { DRAFT_CHANGED } = await import("@/lib/content-pipeline/profile-store")
    const result = await store.publish(id, auth.session.email.toLowerCase(), new Date().toISOString(), expected)
    if (!result.ok) return NextResponse.json({ error: result.problems[0] === DRAFT_CHANGED ? DRAFT_CHANGED : "The draft cannot be published", problems: result.problems }, { status: result.problems[0] === DRAFT_CHANGED ? 409 : result.problems[0]?.startsWith("no brand profile document") ? 404 : 400 })
    const v = result.version
    // The book is re-checked against its generator digest; a bad one never blocks the profile, it just isn't shown.
    const { brandBookStatus } = await import("@/lib/content-pipeline/brand-book-check")
    const book = v.profile.visual === undefined ? null : brandBookStatus(v.profile.visual)
    return NextResponse.json({ ok: true, versionId: v.version_id, publishedAt: v.published_at, sha256: v.profile_sha256, ...(book && !book.ok ? { bookProblem: book.reason } : {}) })
  } catch (err) {
    console.error("[POST /api/admin/brand-profiles/[id]/publish]", err)
    return NextResponse.json({ error: "Could not publish" }, { status: 500 })
  }
}
