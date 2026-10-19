import { NextResponse } from "next/server"
import { requireSuperAdmin } from "../content-pipeline/auth"
import { PIPELINE_PROPERTIES, templatesOf } from "@/lib/content-pipeline/properties"
import type { BrandProfile } from "@/lib/content-pipeline/profile"

export const runtime = "nodejs"

/**
 * GET /api/admin/brand-profiles — every brand on the roster with its published profile's version and templates, read
 * from the database on this request (no cache). A brand with no valid published profile has no templates and gives
 * its reason, so the Generate panel (and the Create table after it) does not offer it.
 */
export async function GET() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { readPublishedProfile } = await import("@/lib/firestore-brand-profiles")
    const brands = await Promise.all(PIPELINE_PROPERTIES.map(async p => {
      const r = await readPublishedProfile(p.id)
      const profile = "active" in r ? r.active.profile as BrandProfile : null
      return { id: p.id, label: p.label, active: p.active && !!profile, versionId: "active" in r ? r.active.versionId : null, profileVersion: profile?.profileVersion ?? null, templates: profile ? templatesOf(profile) : [], reason: !p.active ? p.reason ?? null : "problems" in r ? r.problems[0] : null }
    }))
    return NextResponse.json({ brands }, { headers: { "cache-control": "private, no-store" } })
  } catch (err) {
    console.error("[GET /api/admin/brand-profiles]", err)
    return NextResponse.json({ error: "Could not read brand profiles" }, { status: 500 })
  }
}
