import { NextResponse, after, type NextRequest } from "next/server"
import { requireSuperAdmin } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"

/**
 * POST /api/admin/brand-profiles/[id]/publish — publish the draft. It is validated first (the engine's own profile
 * validator); an invalid draft is refused with its problems (400) and nothing changes. A valid one becomes a new
 * version, kept with who published it and when, and governs the next request. Its 434-context backup follows the
 * response.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  try {
    const [{ firestoreBrandProfiles }, { backupPublished }] = await Promise.all([import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/profile-backup")])
    const store = firestoreBrandProfiles()
    const result = await store.publish(id, auth.session.email.toLowerCase(), new Date().toISOString())
    if (!result.ok) return NextResponse.json({ error: "The draft cannot be published", problems: result.problems }, { status: result.problems[0]?.startsWith("no brand profile document") ? 404 : 400 })
    const v = result.version
    after(async () => { await backupPublished(v, b => store.markBackup(id, v.n, b)) })
    return NextResponse.json({ ok: true, versionId: v.version_id, publishedAt: v.published_at, sha256: v.profile_sha256 })
  } catch (err) {
    console.error("[POST /api/admin/brand-profiles/[id]/publish]", err)
    return NextResponse.json({ error: "Could not publish" }, { status: 500 })
  }
}
