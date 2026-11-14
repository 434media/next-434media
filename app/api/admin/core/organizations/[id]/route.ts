import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, organizationDetail } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { normalizeDomain } from "@/lib/core-model/identity"
import { canSee } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { editOrganizationRecord, type OrganizationEdit } from "@/lib/core-model/edit"
import { CORE_ROLES, type CoreRole } from "@/types/core-model"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/core/organizations/:id — one Organization with its people and timeline.
export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const viewer = await viewerOf(auth.session)
    const detail = organizationDetail(await getVisibleCoreView(viewer), decodeURIComponent(id))
    if (!detail || !canSee(detail.organization, viewer)) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    console.error("[GET /api/admin/core/organizations/:id]", error)
    return NextResponse.json({ error: "Failed to load organization" }, { status: 500 })
  }
}

// PATCH /api/admin/core/organizations/:id — edit an Organization: name, domain, roles, industry, location. One read
// from an old collection is saved as a core record that replaces it; the old collection is never written. A change to
// what the rubric reads rescores it with the shared rubric; a domain another Organization holds is refused (409 with
// its id). Every edit is logged as an Activity (lib/core-model/edit.ts).
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id: rawId } = await ctx.params
  const id = decodeURIComponent(rawId)
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  const edit: OrganizationEdit = {}
  if ("name" in body) edit.name = optString(body.name, 200) ?? ""
  if ("domain" in body) {
    const d = optString(body.domain, 300)
    if (d && !normalizeDomain(d)) return NextResponse.json({ error: "That domain is not valid" }, { status: 400 })
    edit.domain = d
  }
  if ("roles" in body) {
    if (!Array.isArray(body.roles)) return NextResponse.json({ error: "roles must be a list" }, { status: 400 })
    edit.roles = body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]
  }
  if ("industry" in body) edit.industry = optString(body.industry, 200)
  if ("location" in body) edit.location = optString(body.location, 200)
  if ("visibility" in body) return NextResponse.json({ error: "An organization's visibility follows its people" }, { status: 400 })
  try {
    const viewer = await viewerOf(auth.session)
    // The viewer's own view: a record they may not see is not found, and cannot be edited.
    const [view, cohorts] = await Promise.all([getVisibleCoreView(viewer), listIcpCohorts().catch(() => [])])
    const org = await editOrganizationRecord(firestoreCoreStore, view, id, edit, { viewer, actor: auth.session.email, cohorts })
    return NextResponse.json({ success: true, data: org })
  } catch (error) {
    return coreErrorResponse("PATCH /api/admin/core/organizations/:id", error)
  }
}
