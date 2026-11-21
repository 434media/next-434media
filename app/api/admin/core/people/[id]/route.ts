import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, personDetail, rebuildVisibleCoreView } from "@/lib/core-model/read"
import { findWithOneRebuild } from "@/lib/core-model/detail-lookup"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { personColdGate } from "@/lib/core-model/cold-gate"
import { canEmail } from "@/lib/core-model/consent"
import { canSee, normalizeVisibility } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { isSuppressed } from "@/lib/firestore-suppression"
import { editPersonRecord, type LinkEdit, type PersonEdit } from "@/lib/core-model/edit"
import { normalizeDomain, normalizeEmail } from "@/lib/core-model/identity"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import {
  AFFILIATION_ROLES,
  CORE_ROLES,
  CORE_SOURCES,
  LIFECYCLE_STAGES,
  RELATIONSHIPS,
  type AffiliationRole,
  type CoreRole,
  type CoreSource,
  type LifecycleStage,
  type Relationship,
} from "@/types/core-model"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/core/people/:id — one Person with affiliations, timeline, the cold-outreach gate's answer and
// whether email is allowed (consent and suppression, checked in one place).
export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const viewer = await viewerOf(auth.session)
    const personId = decodeURIComponent(id)
    // A record saved a moment ago on another instance may be missing from this one's cached view: rebuild once.
    const detail = await findWithOneRebuild(
      () => getVisibleCoreView(viewer),
      () => rebuildVisibleCoreView(viewer),
      (view) => personDetail(view, personId),
    )
    if (!detail || !canSee(detail.person, viewer)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const email = detail.person.emails[0]
    const suppressed = email ? await isSuppressed(email).catch(() => true) : false
    return NextResponse.json({
      success: true,
      data: { ...detail, cold_gate: personColdGate(detail.person), email_allowed: canEmail(detail.person, suppressed) },
    })
  } catch (error) {
    console.error("[GET /api/admin/core/people/:id]", error)
    return NextResponse.json({ error: "Failed to load person" }, { status: 500 })
  }
}

// PATCH /api/admin/core/people/:id — edit a Person, stored or read from an old collection. A Person read from `leads`,
// `crm_clients`, `contact_forms` or AIM is saved as a core record that replaces it; the old collection is never
// written (lib/core-model/edit.ts). Rules, each refused in the service and again in the store:
//   - a cold Person's source, country and location are locked (403 jurisdiction_locked), as on a lead;
//   - a client never reverts: no move back from `customer` (409 client_never_reverts);
//   - only the founder changes `relationship`; personal is always `private`; `private` is never set by hand;
//   - only full admins restrict or unrestrict; a private Person is the founder's alone (404 to anyone else);
//   - one Person per email: an address another Person holds is refused (409 with its id).
// `links` is the whole set of the Person's current organization links: ones left out end (kept as inactive history),
// and a link may create a new Organization ({ create: { name, domain } }). Every edit is logged as an Activity.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id: rawId } = await ctx.params
  const id = decodeURIComponent(rawId)
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

  const edit: PersonEdit = {}
  if ("name" in body) edit.name = optString(body.name, 200) ?? ""
  if ("title" in body) edit.title = optString(body.title, 200)
  if ("notes" in body) edit.notes = optString(body.notes, 20_000)
  for (const key of ["emails", "phones"] as const) {
    if (!(key in body)) continue
    if (!Array.isArray(body[key])) return NextResponse.json({ error: `${key} must be a list` }, { status: 400 })
    edit[key] = (body[key] as unknown[]).map((v) => optString(v, key === "emails" ? 320 : 50)).filter((v): v is string => Boolean(v))
  }
  if ("emails" in edit && (edit.emails ?? []).some((e) => !normalizeEmail(e))) {
    return NextResponse.json({ error: "One of the emails is not an address" }, { status: 400 })
  }
  if ("roles" in body) {
    if (!Array.isArray(body.roles)) return NextResponse.json({ error: "roles must be a list" }, { status: 400 })
    edit.roles = body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]
  }
  if ("lifecycle_stage" in body) {
    if (!LIFECYCLE_STAGES.includes(body.lifecycle_stage as LifecycleStage)) return NextResponse.json({ error: "Unknown lifecycle stage" }, { status: 400 })
    edit.lifecycle_stage = body.lifecycle_stage as LifecycleStage
  }
  if ("source" in body) {
    if (!CORE_SOURCES.includes(body.source as CoreSource)) return NextResponse.json({ error: "Unknown source" }, { status: 400 })
    edit.source = body.source as CoreSource
  }
  if ("country" in body) edit.country = optString(body.country, 2)?.toUpperCase()
  if ("location" in body) edit.location = optString(body.location, 200)
  if ("relationship" in body) {
    if (!RELATIONSHIPS.includes(body.relationship as Relationship)) {
      return NextResponse.json({ error: "relationship must be business or personal" }, { status: 400 })
    }
    edit.relationship = body.relationship as Relationship
  }
  if ("visibility" in body) edit.visibility = normalizeVisibility(body.visibility)
  if ("links" in body) {
    if (!Array.isArray(body.links)) return NextResponse.json({ error: "links must be a list" }, { status: 400 })
    const links: LinkEdit[] = []
    for (const raw of body.links) {
      const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
      const role = AFFILIATION_ROLES.includes(l.role as AffiliationRole) ? (l.role as AffiliationRole) : null
      if (!role) return NextResponse.json({ error: "Each link needs a role" }, { status: 400 })
      const c = l.create && typeof l.create === "object" ? (l.create as Record<string, unknown>) : null
      const domainRaw = c ? optString(c.domain, 300) : undefined
      if (domainRaw && !normalizeDomain(domainRaw)) return NextResponse.json({ error: "That domain is not valid" }, { status: 400 })
      links.push({
        organization_id: c ? undefined : optString(l.organization_id, 300),
        create: c ? { name: optString(c.name, 200) ?? "", domain: domainRaw } : undefined,
        role,
        title: optString(l.title, 200),
      })
    }
    edit.links = links
  }
  if ("consent" in body || "address_book" in body || "google" in body) {
    return NextResponse.json({ error: "Consent changes only through its source; the Google link only through the sync" }, { status: 400 })
  }

  try {
    const viewer = await viewerOf(auth.session)
    // The viewer's own view: a record they may not see is not found, and cannot be edited.
    // Rebuilt once when the record is missing: it may have been saved a moment ago on another instance.
    const [view, cohorts] = await Promise.all([
      findWithOneRebuild(
        () => getVisibleCoreView(viewer),
        () => rebuildVisibleCoreView(viewer),
        (v) => (v.people.some((r) => r.id === id) ? v : null),
      ).then((v) => v ?? getVisibleCoreView(viewer)),
      listIcpCohorts().catch(() => []),
    ])
    const person = await editPersonRecord(firestoreCoreStore, view, id, edit, { viewer, actor: auth.session.email, cohorts })
    return NextResponse.json({ success: true, data: person })
  } catch (error) {
    return coreErrorResponse("PATCH /api/admin/core/people/:id", error)
  }
}
