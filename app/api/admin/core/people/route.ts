import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { recordArrival } from "@/lib/core-model/service"
import { normalizeEmail } from "@/lib/core-model/identity"
import { canSetVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { CORE_ROLES, CORE_SOURCES, LIFECYCLE_STAGES, type CoreRole, type CoreSource, type LifecycleStage } from "@/types/core-model"

export const runtime = "nodejs"

// GET /api/admin/core/people?q=&stage= — People the viewer may see (stored plus read from old collections),
// matched by email so one human is one row. Visibility filtered (restricted: full admins only).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const view = await getVisibleCoreView(await viewerOf(auth.session))
    const params = new URL(request.url).searchParams
    const q = (params.get("q") ?? "").trim().toLowerCase()
    const stage = params.get("stage")
    const orgs = new Map(view.organizations.map((o) => [o.id, o]))
    const orgNames = new Map<string, string[]>()
    for (const a of view.affiliations) {
      const o = orgs.get(a.organization_id)
      if (o) orgNames.set(a.person_id, [...(orgNames.get(a.person_id) ?? []), o.name])
    }
    const rows = view.people
      .filter((p) => !stage || p.lifecycle_stage === stage)
      .filter((p) => {
        if (!q) return true
        const hay = [p.name, ...p.emails, ...(orgNames.get(p.id) ?? [])].join(" ").toLowerCase()
        return hay.includes(q)
      })
      .map((p) => ({ ...p, organizations: orgNames.get(p.id) ?? [] }))
    return NextResponse.json({ success: true, data: rows, warnings: view.warnings })
  } catch (error) {
    console.error("[GET /api/admin/core/people]", error)
    return NextResponse.json({ error: "Failed to load people" }, { status: 500 })
  }
}

// POST /api/admin/core/people — add a person by hand. One Person per email: an address already held returns
// 409 with the existing id, never a copy. Recorded as an Activity ("Added by hand") like every other way in.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

  const name = optString(body.name, 200)
  const emailRaw = optString(body.email, 320)
  const email = emailRaw ? normalizeEmail(emailRaw) : ""
  if (emailRaw && !email) return NextResponse.json({ error: "That email address is not valid" }, { status: 400 })
  if (!name && !email) return NextResponse.json({ error: "A name or an email is required" }, { status: 400 })
  const source = (CORE_SOURCES.includes(body.source as CoreSource) ? body.source : "manual") as CoreSource
  const stage = (LIFECYCLE_STAGES.includes(body.lifecycle_stage as LifecycleStage) ? body.lifecycle_stage : "contact") as LifecycleStage
  const roles = Array.isArray(body.roles) ? (body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]) : []
  const visibility = normalizeVisibility(body.visibility)
  const viewer = await viewerOf(auth.session)
  if (visibility === "restricted" && !canSetVisibility(viewer)) {
    return NextResponse.json({ error: "Only a full admin can restrict a record" }, { status: 403 })
  }

  try {
    if (email) {
      const existing = await firestoreCoreStore.findPersonByEmail(email)
      if (existing) {
        return NextResponse.json({ error: `${email} already belongs to ${existing.name}`, existing_id: existing.id }, { status: 409 })
      }
    }
    const notes = optString(body.notes, 20_000)
    const { person } = await recordArrival(
      firestoreCoreStore,
      {
        type: "note",
        source,
        occurred_at: new Date().toISOString(),
        contact: {
          name,
          email: email || undefined,
          phone: optString(body.phone, 50),
          company: optString(body.company, 200),
          website: optString(body.website, 300),
          title: optString(body.title, 200),
          location: optString(body.location, 200),
          country: optString(body.country, 2)?.toUpperCase(),
        },
        summary: "Added by hand",
        body: notes,
        created_by: auth.session.email,
        stage,
        roles,
        visibility,
      },
      await listIcpCohorts(),
    )
    return NextResponse.json({ success: true, data: person }, { status: 201 })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/people", error)
  }
}
