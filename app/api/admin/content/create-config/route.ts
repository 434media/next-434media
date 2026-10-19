import { NextResponse } from "next/server"
import { requireContentRunner } from "../../content-pipeline/auth"
import { PIPELINE_PROPERTIES } from "@/lib/content-pipeline/properties"
import { CREATE_PLATFORMS, createTemplates, type CreateTemplate } from "@/lib/content-pipeline/create-table"
import type { BrandProfile } from "@/lib/content-pipeline/profile"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/admin/content/create-config — what the Create table offers: each brand on the roster, and for a brand with
 * a valid published profile, its templates (from the profile's template map, read fresh) and their card fields.
 */
export async function GET() {
  const auth = await requireContentRunner()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { readPublishedProfile } = await import("@/lib/firestore-brand-profiles")
    const brands = await Promise.all(PIPELINE_PROPERTIES.map(async p => {
      if (!p.active) return { id: p.id, label: p.label, active: false, reason: p.reason ?? "Not available yet", versionId: null, templates: [] as CreateTemplate[] }
      const r = await readPublishedProfile(p.id)
      if ("problems" in r) return { id: p.id, label: p.label, active: false, reason: "No valid published profile", versionId: null, templates: [] as CreateTemplate[] }
      const templates = createTemplates(r.active.profile as BrandProfile)
      return { id: p.id, label: p.label, active: templates.length > 0, reason: templates.length ? null : "No templates connected yet", versionId: r.active.versionId, templates }
    }))
    return NextResponse.json({ brands, platforms: CREATE_PLATFORMS })
  } catch (err) {
    console.error("[GET /api/admin/content/create-config] profiles not read:", err)
    return NextResponse.json({ error: "Could not read the brand profiles" }, { status: 500 })
  }
}
