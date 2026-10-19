import { NextResponse, after, type NextRequest } from "next/server"
import { z } from "zod4"
import { requireSuperAdmin } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"

const input = z.object({ versionId: z.string().regex(/^[a-z][a-z0-9-]{1,30}@v\d{1,6}$/), force: z.boolean().default(false) }).strict()

/**
 * POST /api/admin/brand-profiles/[id]/restore { versionId, force? } — restore an earlier version in one action: it is
 * validated again and republished as a new version (restored_from names the one it came from), and becomes the
 * draft. A draft with unpublished edits is refused (400) unless force, and then kept in drafts_before_restore (the last two).
 * History is never rewritten.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  if (!BRAND_ID.test(id)) return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
  const parsed = input.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Send {versionId}, e.g. milcity@v1" }, { status: 400 })
  try {
    const [{ firestoreBrandProfiles }, { backupPublished }] = await Promise.all([import("@/lib/firestore-brand-profiles"), import("@/lib/content-pipeline/profile-backup")])
    const store = firestoreBrandProfiles()
    const result = await store.restore(id, parsed.data.versionId, auth.session.email.toLowerCase(), new Date().toISOString(), parsed.data.force)
    if (!result.ok) return NextResponse.json({ error: "That version cannot be restored", problems: result.problems }, { status: result.problems[0]?.startsWith("no ") ? 404 : 400 })
    const v = result.version
    after(async () => { await backupPublished(v, b => store.markBackup(id, v.n, b)) })
    return NextResponse.json({ ok: true, versionId: v.version_id, restoredFrom: v.restored_from, publishedAt: v.published_at })
  } catch (err) {
    console.error("[POST /api/admin/brand-profiles/[id]/restore]", err)
    return NextResponse.json({ error: "Could not restore" }, { status: 500 })
  }
}
