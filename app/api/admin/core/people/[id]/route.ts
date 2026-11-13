import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, personDetail } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { personColdEditRefusal, personColdGate } from "@/lib/core-model/cold-gate"
import { canEmail } from "@/lib/core-model/consent"
import { canHandlePersonal, canSee, canSetVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
import { stageMoveRefusal } from "@/lib/core-model/lifecycle"
import { applyPersonEditToBook } from "@/lib/core-model/address-book"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { isSuppressed } from "@/lib/firestore-suppression"
import { editPerson, type NewPerson } from "@/lib/core-model/service"
import {
  CORE_ROLES,
  CORE_SOURCES,
  LIFECYCLE_STAGES,
  RELATIONSHIPS,
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
    const view = await getVisibleCoreView(viewer)
    const detail = personDetail(view, decodeURIComponent(id))
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

// PATCH /api/admin/core/people/:id — edit a stored Person. A Person read from an old collection is edited where it
// lives until it is saved. Rules, each refused here and again in the service or the store:
//   - a cold Person's source, country and location are locked (403 jurisdiction_locked), as on a lead;
//   - a client never reverts: no move back from `customer` (409);
//   - only the founder changes `relationship`; personal is always `private`; `private` is never set by hand;
//   - only full admins restrict or unrestrict;
//   - emails change only through a merge, consent only through its source.
// An edit to an address-book field (name, phones, notes, title) of a Person synced with Google updates the Person's
// address book and is stamped, so the sync writes it back (when write-back is on) and latest edit wins.
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id: rawId } = await ctx.params
  const id = decodeURIComponent(rawId)
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })

  try {
    const current = await firestoreCoreStore.getPerson(id)
    const viewer = await viewerOf(auth.session)
    if (!current || current.merged_into || !canSee(current, viewer)) {
      return NextResponse.json({ error: "Not found, or read from an old collection (edit it there, or save it first)" }, { status: 404 })
    }

    const refusal = personColdEditRefusal(current, body)
    if (refusal) return NextResponse.json({ error: refusal, code: "jurisdiction_locked" }, { status: 403 })

    const patch: Partial<NewPerson> = {}
    if ("name" in body) {
      const name = optString(body.name, 200)
      if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 })
      patch.name = name
    }
    if ("title" in body) patch.title = optString(body.title, 200)
    if ("notes" in body) patch.notes = optString(body.notes, 20_000)
    if ("phones" in body) {
      if (!Array.isArray(body.phones)) return NextResponse.json({ error: "phones must be a list" }, { status: 400 })
      patch.phones = body.phones.map((p) => optString(p, 50)).filter((p): p is string => Boolean(p))
    }
    if ("roles" in body) {
      if (!Array.isArray(body.roles)) return NextResponse.json({ error: "roles must be a list" }, { status: 400 })
      patch.roles = body.roles.filter((r) => CORE_ROLES.includes(r as CoreRole)) as CoreRole[]
    }
    if ("lifecycle_stage" in body) {
      if (!LIFECYCLE_STAGES.includes(body.lifecycle_stage as LifecycleStage)) {
        return NextResponse.json({ error: "Unknown lifecycle stage" }, { status: 400 })
      }
      const stageRefusal = stageMoveRefusal(current.lifecycle_stage, body.lifecycle_stage as LifecycleStage)
      if (stageRefusal) return NextResponse.json({ error: stageRefusal, code: "client_never_reverts" }, { status: 409 })
      patch.lifecycle_stage = body.lifecycle_stage as LifecycleStage
    }
    if ("source" in body) {
      if (!CORE_SOURCES.includes(body.source as CoreSource)) return NextResponse.json({ error: "Unknown source" }, { status: 400 })
      patch.source = body.source as CoreSource
    }
    if ("country" in body) patch.country = optString(body.country, 2)?.toUpperCase()
    if ("location" in body) patch.location = optString(body.location, 200)
    if ("relationship" in body) {
      if (!RELATIONSHIPS.includes(body.relationship as Relationship)) {
        return NextResponse.json({ error: "relationship must be business or personal" }, { status: 400 })
      }
      if (!canHandlePersonal(viewer)) return NextResponse.json({ error: "Only the founder can change this" }, { status: 403 })
      patch.relationship = body.relationship as Relationship
    }
    if ("visibility" in body) {
      const to = normalizeVisibility(body.visibility)
      if (to === "private") return NextResponse.json({ error: "A personal contact is private; set relationship instead" }, { status: 400 })
      if (!canSetVisibility(viewer, to)) return NextResponse.json({ error: "Only a full admin can change visibility" }, { status: 403 })
      patch.visibility = to
    }
    if ("emails" in body || "consent" in body || "address_book" in body || "google" in body) {
      return NextResponse.json({ error: "Emails change only through a merge; consent only through its source; the Google link only through the sync" }, { status: 400 })
    }

    // The Person's address book follows a person's edit of its fields, so the sync can write it back.
    if (current.address_book && (["name", "phones", "notes", "title"] as const).some((k) => k in patch)) {
      patch.address_book = applyPersonEditToBook(current.address_book, patch)
    }
    const person = await editPerson(firestoreCoreStore, id, patch, { founder: canHandlePersonal(viewer), byPerson: true })
    return NextResponse.json({ success: true, data: person })
  } catch (error) {
    return coreErrorResponse("PATCH /api/admin/core/people/:id", error)
  }
}
