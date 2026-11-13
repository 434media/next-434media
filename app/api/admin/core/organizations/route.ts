import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { normalizeDomain } from "@/lib/core-model/identity"
import { scoreOrganization } from "@/lib/core-model/score"
import { canSetVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { CORE_ROLES, type CoreRole } from "@/types/core-model"

export const runtime = "nodejs"

// GET /api/admin/core/organizations?q=&role= — Organizations the viewer may see, one per domain, each with its fit
// and grade from the shared rubric and how many people it links.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const view = await getVisibleCoreView(await viewerOf(auth.session))
    const params = new URL(request.url).searchParams
    const q = (params.get("q") ?? "").trim().toLowerCase()
    const role = params.get("role")
    const counts = new Map<string, number>()
    for (const a of view.affiliations) counts.set(a.organization_id, (counts.get(a.organization_id) ?? 0) + 1)
    const rows = view.organizations
      .filter((o) => !role || o.roles.includes(role as CoreRole))
      .filter((o) => !q || `${o.name} ${o.domain ?? ""}`.toLowerCase().includes(q))
      .map((o) => ({ ...o, people_count: counts.get(o.id) ?? 0 }))
    return NextResponse.json({ success: true, data: rows, warnings: view.warnings })
  } catch (error) {
    console.error("[GET /api/admin/core/organizations]", error)
    return NextResponse.json({ error: "Failed to load organizations" }, { status: 500 })
  }
}

// POST /api/admin/core/organizations — add one by hand. One per domain: a held domain returns 409 with the
// existing id. Scored on arrival with the shared rubric.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  const name = optString(body.name, 200)
  if (!name) return NextResponse.json({ error: "A name is required" }, { status: 400 })
  const domainRaw = optString(body.domain ?? body.website, 300)
  const domain = domainRaw ? normalizeDomain(domainRaw) : ""
  if (domainRaw && !domain) return NextResponse.json({ error: "That domain is not valid" }, { status: 400 })
  const visibility = normalizeVisibility(body.visibility)
  if (visibility === "restricted" && !canSetVisibility(await viewerOf(auth.session))) {
    return NextResponse.json({ error: "Only a full admin can restrict a record" }, { status: 403 })
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined)
  try {
    const base = {
      name,
      industry: optString(body.industry, 200),
      location: optString(body.location, 200),
      employee_count: num(body.employee_count),
      annual_revenue: num(body.annual_revenue),
    }
    const org = await firestoreCoreStore.createOrganization({
      ...base,
      domain: domain || undefined,
      roles: Array.isArray(body.roles) ? (body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]) : [],
      capabilities: optString(body.capabilities, 2000),
      rates: optString(body.rates, 2000),
      visibility,
      legacy_refs: [],
      ...scoreOrganization(base, await listIcpCohorts(), new Date().toISOString()),
    })
    return NextResponse.json({ success: true, data: org }, { status: 201 })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/organizations", error)
  }
}
