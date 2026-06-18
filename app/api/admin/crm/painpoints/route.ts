import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin, requireFullAdmin } from "@/lib/auth"
import {
  getPainpoints,
  getPainpointById,
  getPainpointsByCohort,
  createPainpoint,
  updatePainpoint,
  deletePainpoint,
} from "@/lib/firestore-crm"
import type { Painpoint } from "@/types/crm-types"

export const runtime = "nodejs"

// Painpoints are the program's intake front door. The Underwriter Onboarding
// squad (interns) AUTHORS them, so create/edit allow any authorized admin
// (incl. `intern`). Two actions stay operator-only (full_admin+): deleting a
// painpoint, and ACTIVATING it into a cohort's problem set (status:"activated"
// + cohortId) — that's a program decision, not an authoring one.

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

const VALID_VERTICALS = [
  "cybersecurity",
  "fintech",
  "military",
  "health",
  "science",
  "education",
  "aerospace",
  "other",
]
const VALID_STATUSES = ["submitted", "triaged", "vetted", "activated", "rejected", "archived"]
const VALID_SOURCES = ["public_form", "manual", "interview", "inbox"]

// GET — list all painpoints, a single one (?id=), or a cohort's set (?cohortId=)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const params = new URL(request.url).searchParams
    const id = params.get("id")
    if (id) {
      const painpoint = await getPainpointById(id)
      if (!painpoint)
        return NextResponse.json({ success: false, error: "Painpoint not found" }, { status: 404 })
      return NextResponse.json({ success: true, data: painpoint })
    }
    const cohortId = params.get("cohortId")
    if (cohortId) {
      const data = await getPainpointsByCohort(cohortId)
      return NextResponse.json({ success: true, data })
    }
    const data = await getPainpoints({ fresh: true })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error fetching painpoints:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch painpoints" }, { status: 500 })
  }
}

// POST — create a painpoint (intern-authorable). New painpoints default to the
// "manual" source and "submitted" status; activation happens later via PATCH.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { title, vertical, problemStatement } = body as Partial<Painpoint>

    if (!title?.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 })
    }
    if (!vertical || !VALID_VERTICALS.includes(vertical)) {
      return NextResponse.json({ success: false, error: "Valid vertical is required" }, { status: 400 })
    }
    if (!problemStatement?.trim()) {
      return NextResponse.json(
        { success: false, error: "Problem statement is required" },
        { status: 400 },
      )
    }
    if (body.source && !VALID_SOURCES.includes(body.source)) {
      return NextResponse.json({ success: false, error: `Invalid source: ${body.source}` }, { status: 400 })
    }

    const painpoint = await createPainpoint({
      title: title.trim(),
      vertical,
      status: "submitted",
      source: body.source ?? "manual",
      problemStatement: problemStatement.trim(),
      underwriterName: body.underwriterName?.trim() || undefined,
      underwriterRole: body.underwriterRole?.trim() || undefined,
      sponsorClientId: body.sponsorClientId ?? null,
      sponsorName: body.sponsorName?.trim() || undefined,
      salesFraming: body.salesFraming?.trim() || undefined,
      builderBrief: body.builderBrief?.trim() || undefined,
      whoIsAffected: body.whoIsAffected?.trim() || undefined,
      currentWorkaround: body.currentWorkaround?.trim() || undefined,
      costImpact: body.costImpact?.trim() || undefined,
      frequency: body.frequency?.trim() || undefined,
      evidence: body.evidence?.trim() || undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      notes: body.notes?.trim() || undefined,
      created_by: auth.session.email,
    })
    return NextResponse.json({ success: true, data: painpoint })
  } catch (error) {
    console.error("Error creating painpoint:", error)
    return NextResponse.json({ success: false, error: "Failed to create painpoint" }, { status: 500 })
  }
}

// PATCH — update a painpoint. Interns can edit content + advance through
// submitted/triaged/vetted. ACTIVATING (status:"activated") or assigning a
// cohortId is operator-only, so a stray intern can't seed a cohort's problem set.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ success: false, error: "Painpoint id is required" }, { status: 400 })

    const wantsActivation =
      body.status === "activated" ||
      (body.cohortId !== undefined && body.cohortId !== null && body.cohortId !== "")
    if (wantsActivation) {
      const operator = await requireFullAdmin()
      if ("error" in operator) {
        return NextResponse.json(
          { success: false, error: "Activating a painpoint into a cohort requires full admin." },
          { status: operator.status },
        )
      }
    }

    const updates: Partial<Painpoint> = {}
    if (body.title !== undefined) updates.title = String(body.title).trim()
    if (body.vertical !== undefined) {
      if (!VALID_VERTICALS.includes(body.vertical))
        return NextResponse.json({ success: false, error: `Invalid vertical: ${body.vertical}` }, { status: 400 })
      updates.vertical = body.vertical
    }
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status))
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      updates.status = body.status
    }
    if (body.source !== undefined) {
      if (!VALID_SOURCES.includes(body.source))
        return NextResponse.json({ success: false, error: `Invalid source: ${body.source}` }, { status: 400 })
      updates.source = body.source
    }
    if (body.problemStatement !== undefined) updates.problemStatement = String(body.problemStatement).trim()
    if (body.underwriterName !== undefined) updates.underwriterName = String(body.underwriterName).trim()
    if (body.underwriterRole !== undefined) updates.underwriterRole = String(body.underwriterRole).trim()
    if (body.sponsorClientId !== undefined) updates.sponsorClientId = body.sponsorClientId || null
    if (body.sponsorName !== undefined) updates.sponsorName = String(body.sponsorName).trim()
    if (body.salesFraming !== undefined) updates.salesFraming = String(body.salesFraming).trim()
    if (body.builderBrief !== undefined) updates.builderBrief = String(body.builderBrief).trim()
    if (body.whoIsAffected !== undefined) updates.whoIsAffected = String(body.whoIsAffected).trim()
    if (body.currentWorkaround !== undefined) updates.currentWorkaround = String(body.currentWorkaround).trim()
    if (body.costImpact !== undefined) updates.costImpact = String(body.costImpact).trim()
    if (body.frequency !== undefined) updates.frequency = String(body.frequency).trim()
    if (body.evidence !== undefined) updates.evidence = String(body.evidence).trim()
    if (body.cohortId !== undefined) updates.cohortId = body.cohortId || null
    if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : []
    if (body.notes !== undefined) updates.notes = String(body.notes).trim()

    const painpoint = await updatePainpoint(id, updates)
    return NextResponse.json({ success: true, data: painpoint })
  } catch (error) {
    console.error("Error updating painpoint:", error)
    return NextResponse.json({ success: false, error: "Failed to update painpoint" }, { status: 500 })
  }
}

// DELETE — operator-only (?id=). Interns archive (PATCH status:"archived"); only
// full admins remove a row outright.
export async function DELETE(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, error: "Painpoint id is required" }, { status: 400 })
    await deletePainpoint(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting painpoint:", error)
    return NextResponse.json({ success: false, error: "Failed to delete painpoint" }, { status: 500 })
  }
}
