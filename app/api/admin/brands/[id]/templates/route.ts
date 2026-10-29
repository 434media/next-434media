import { NextResponse, type NextRequest } from "next/server"
import { requireStaff } from "../../../content-pipeline/auth"
import { BRAND_ID } from "@/lib/content-pipeline/profile-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// One dataset read per template; a test fill waits on an upload and an autofill job.
export const maxDuration = 120

/** The brand's published profile and the Canva reader allowed to read only its templates, or an error response. */
async function setup(id: string) {
  if (!BRAND_ID.test(id)) return { error: NextResponse.json({ error: "Unknown brand" }, { status: 404 }) }
  const [{ readPublishedProfile }, { canvaDeps }, { profileTemplateIds }] = await Promise.all([import("@/lib/firestore-brand-profiles"), import("@/lib/owned-meta-execution"), import("@/lib/canva-create")])
  const p = await readPublishedProfile(id)
  if ("problems" in p) return { error: NextResponse.json({ error: `No valid published profile for this brand, so no templates to check (${p.problems.slice(0, 3).join("; ")})` }, { status: 404 }) }
  const { deps } = await canvaDeps()
  if (!deps) return { error: NextResponse.json({ error: "Canva integration is not configured" }, { status: 502 }) }
  return { active: p.active, canva: { canva: deps, allowedTemplates: profileTemplateIds([p.active.profile]) } }
}

/**
 * GET /api/admin/brands/[id]/templates — the template check (pre-run, founder 2026-10-29): every template the brand's
 * published profile binds, read from Canva and compared with the profile (lib/content-pipeline/template-check.ts).
 * Read-only: nothing is written here or in Canva. 434 staff, as the brand page.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const s = await setup(id)
    if ("error" in s) return s.error
    const [{ checkTemplates, DATASET_LIMIT }, { templateFields }] = await Promise.all([import("@/lib/content-pipeline/template-check"), import("@/lib/canva-create")])
    const rows = await checkTemplates(s.active.profile, templateId => templateFields(s.canva, templateId))
    const broken = rows.filter(r => r.problems.length)
    if (broken.length) console.warn("[GET /api/admin/brands/[id]/templates]", JSON.stringify({ brand: id, version: s.active.versionId, broken: broken.map(r => ({ series: r.series, format: r.format, template: r.templateId, problems: r.problems })) }))
    return NextResponse.json({ versionId: s.active.versionId, checkedAt: new Date().toISOString(), rows, limit: DATASET_LIMIT, canTestFill: auth.superAdmin }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brands/[id]/templates]", err)
    return NextResponse.json({ error: "Could not check the templates" }, { status: 500 })
  }
}

/**
 * POST /api/admin/brands/[id]/templates {series, format} — a test fill of one template's photo frame (canva-create.ts
 * probeTemplateMedia): catches a frame Canva's dataset still lists but the template no longer has. Run by hand only.
 * Makes a throwaway design and image in the connected Canva account and moves both to its Trash; super-admins only.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!auth.superAdmin) return NextResponse.json({ error: "Forbidden: super-admin access required" }, { status: 403 })
  const { id } = await ctx.params
  const body = await req.json().catch(() => null) as { series?: unknown; format?: unknown } | null
  const series = typeof body?.series === "string" ? body.series : "", format = body?.format
  if (!/^[a-z0-9_]{1,40}$/.test(series) || (format !== "feed" && format !== "reels")) return NextResponse.json({ error: "Name a series and a format (feed or reels)" }, { status: 400 })
  try {
    const s = await setup(id)
    if ("error" in s) return s.error
    const spec = s.active.profile.series[series as keyof typeof s.active.profile.series]
    const templateId = spec?.templates[format], mediaField = spec?.media?.[format]
    if (!spec || !templateId) return NextResponse.json({ error: "The profile has no such template" }, { status: 404 })
    if (!mediaField) return NextResponse.json({ error: "This template takes no photo, so there is no frame to test" }, { status: 400 })
    const [{ probeTemplateMedia, PROBE_LIMITS }, sharp] = await Promise.all([import("@/lib/canva-create"), import("sharp").then(m => m.default)])
    // A plain grey 4:5 PNG: small, and nothing anyone would mistake for a real photo.
    const image = await sharp({ create: { width: 400, height: 500, channels: 3, background: { r: 128, g: 128, b: 128 } } }).png().toBuffer()
    const result = await probeTemplateMedia(s.canva, { templateId, mediaField, image }, PROBE_LIMITS)
    console.info("[POST /api/admin/brands/[id]/templates]", JSON.stringify({ by: auth.session.email, brand: id, version: s.active.versionId, series, format, template: templateId, outcome: result.outcome, code: result.code, cleanup: result.cleanup }))
    return NextResponse.json(result)
  } catch (err) {
    const name = err instanceof Error ? err.name : ""
    console.error("[POST /api/admin/brands/[id]/templates]", id, series, format, name === "CanvaError" ? JSON.stringify({ code: (err as { code?: string }).code, detail: (err as { detail?: string }).detail }) : "", err)
    if (name === "CanvaError") return NextResponse.json({ error: (err as Error).message }, { status: 502 })
    return NextResponse.json({ error: "Could not run the test fill" }, { status: 500 })
  }
}
