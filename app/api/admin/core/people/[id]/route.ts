import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView, personDetail } from "@/lib/core-model/read"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { personColdEditRefusal, personColdGate } from "@/lib/core-model/cold-gate"
import { canEmail } from "@/lib/core-model/consent"
import { canSee, canSetVisibility, normalizeVisibility } from "@/lib/core-model/visibility"
import { coreErrorResponse, optString, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { isSuppressed } from "@/lib/firestore-suppression"
import type { NewPerson } from "@/lib/core-model/service"
import { CORE_ROLES, CORE_SOURCES, LIFECYCLE_STAGES, type CoreRole, type CoreSource, type LifecycleStage } from "@/types/core-model"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> }

// GET /api/admin/core/people/:id — one Person with affiliations, timeline, the cold-outreach gate's answer and
// whether email is allowed (consent and suppression, checked in one place).
export async function GET(_request: NextRequest, ctx: Ctx) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const view = await getVisibleCoreView(await viewerOf(auth.session))
    const detail = personDetail(view, decodeURIComponent(id))
    if (!detail || !canSee(detail.person, await viewerOf(auth.session))) {
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
// lives until it is saved. A cold Person's source, country and location are locked (403 jurisdiction_locked), as on
// a lead. Only full admins may change visibility. Emails are not edited here: one email, one Person; a second
// address joins through an explicit merge.
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
      patch.lifecycle_stage = body.lifecycle_stage as LifecycleStage
    }
    if ("source" in body) {
      if (!CORE_SOURCES.includes(body.source as CoreSource)) return NextResponse.json({ error: "Unknown source" }, { status: 400 })
      patch.source = body.source as CoreSource
    }
    if ("country" in body) patch.country = optString(body.country, 2)?.toUpperCase()
    if ("location" in body) patch.location = optString(body.location, 200)
    if ("visibility" in body) {
      if (!canSetVisibility(viewer)) return NextResponse.json({ error: "Only a full admin can change visibility" }, { status: 403 })
      patch.visibility = normalizeVisibility(body.visibility)
    }
    if ("emails" in body || "consent" in body) {
      return NextResponse.json({ error: "Emails change only through a merge; consent only through its source" }, { status: 400 })
    }

    const person = await firestoreCoreStore.updatePerson(id, patch)
    return NextResponse.json({ success: true, data: person })
  } catch (error) {
    return coreErrorResponse("PATCH /api/admin/core/people/:id", error)
  }
}
