import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { recordArrival } from "@/lib/core-model/service"
import { normalizeEmail } from "@/lib/core-model/identity"
import { canHandlePersonal, canSetVisibility, effectiveVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
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

// POST /api/admin/core/people — add a person by hand ("+ Add person"). Saved directly, never through the inbox: the
// form asks personal or business and the stage. Only the founder may add a personal contact (it is `private`); a
// staff member's add is always `business`, whatever the body says. One Person per email: an address already held
// returns 409, with the existing id only when the viewer may see that Person (a private one is never named).
// Recorded as an Activity ("Added by hand") and marked triaged, so it does not wait in the inbox.
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
  const viewer = await viewerOf(auth.session)
  // Staff adds are always business. The founder chooses; his default is personal (spec, "Personal or business").
  // A lead or customer is business; the founder's contact-stage adds default to personal unless he says business.
  const relationship =
    canHandlePersonal(viewer) && stage === "contact" && body.relationship !== "business" ? "personal" : "business"
  if (body.relationship === "personal" && !canHandlePersonal(viewer)) {
    return NextResponse.json({ error: "Only the founder can add a personal contact" }, { status: 403 })
  }
  const visibility = normalizeVisibility(body.visibility)
  if (visibility === "private") return NextResponse.json({ error: "A personal contact is private; set relationship instead" }, { status: 400 })
  if (visibility === "restricted" && !canSetVisibility(viewer)) {
    return NextResponse.json({ error: "Only a full admin can restrict a record" }, { status: 403 })
  }

  try {
    if (email) {
      const existing = await firestoreCoreStore.findPersonByEmail(email)
      if (existing) {
        if (effectiveVisibility(existing) === "private" && !canHandlePersonal(viewer)) {
          return NextResponse.json({ error: "That email address is already on file" }, { status: 409 })
        }
        return NextResponse.json({ error: `${email} already belongs to ${existing.name}`, existing_id: existing.id }, { status: 409 })
      }
    }
    const notes = optString(body.notes, 20_000)
    const { person, activity } = await recordArrival(
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
        relationship,
        allowPrivate: canHandlePersonal(viewer),
      },
      await listIcpCohorts(),
    )
    // Saved directly: an add by hand is already decided, so it never waits in the inbox.
    await firestoreCoreStore.recordTriage({
      id: activity.id,
      decision: "save",
      by: auth.session.email,
      at: new Date().toISOString(),
      person_id: person.id,
    })
    return NextResponse.json({ success: true, data: person }, { status: 201 })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/people", error)
  }
}
