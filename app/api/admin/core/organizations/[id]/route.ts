import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, organizationDetail } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { normalizeDomain } from "@/lib/core-model/identity"
import { scoreOrganization } from "@/lib/core-model/score"
import { canSee, canSetVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import type { NewOrganization } from "@/lib/core-model/service"
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

// PATCH /api/admin/core/organizations/:id — edit a stored Organization. A change to what the rubric reads
// (name, industry, location, size, revenue) rescores it with the shared rubric. Only full admins change visibility.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id: rawId } = await ctx.params
  const id = decodeURIComponent(rawId)
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  try {
    const viewer = await viewerOf(auth.session)
    const current = await firestoreCoreStore.getOrganization(id)
    if (!current || current.merged_into || !canSee(current, viewer)) {
      return NextResponse.json({ error: "Not found, or read from an old collection" }, { status: 404 })
    }
    const patch: Partial<NewOrganization> = {}
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined)
    if ("name" in body) {
      const name = optString(body.name, 200)
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
      patch.name = name
    }
    if ("domain" in body) {
      const d = optString(body.domain, 300)
      const domain = d ? normalizeDomain(d) : ""
      if (d && !domain) return NextResponse.json({ error: "That domain is not valid" }, { status: 400 })
      patch.domain = domain || undefined
    }
    if ("roles" in body) {
      if (!Array.isArray(body.roles)) return NextResponse.json({ error: "roles must be a list" }, { status: 400 })
      patch.roles = body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]
    }
    if ("industry" in body) patch.industry = optString(body.industry, 200)
    if ("location" in body) patch.location = optString(body.location, 200)
    if ("employee_count" in body) patch.employee_count = num(body.employee_count)
    if ("annual_revenue" in body) patch.annual_revenue = num(body.annual_revenue)
    if ("capabilities" in body) patch.capabilities = optString(body.capabilities, 2000)
    if ("rates" in body) patch.rates = optString(body.rates, 2000)
    if ("visibility" in body) {
      if (!canSetVisibility(viewer)) return NextResponse.json({ error: "Only a full admin can change visibility" }, { status: 403 })
      patch.visibility = normalizeVisibility(body.visibility)
      if (patch.visibility === "private") return NextResponse.json({ error: "visibility must be business or restricted" }, { status: 400 })
    }
    const rescore = ["name", "industry", "location", "employee_count", "annual_revenue"].some((k) => k in body)
    if (rescore) Object.assign(patch, scoreOrganization({ ...current, ...patch }, await listIcpCohorts(), new Date().toISOString()))
    const org = await firestoreCoreStore.updateOrganization(id, patch)
    return NextResponse.json({ success: true, data: org })
  } catch (error) {
    return coreErrorResponse("PATCH /api/admin/core/organizations/:id", error)
  }
}
