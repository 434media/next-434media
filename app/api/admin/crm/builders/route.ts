import { type NextRequest, NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import {
  getBuildersByCohort,
  createBuilder,
  updateBuilder,
  deleteBuilder,
} from "@/lib/firestore-crm"
import type { Builder } from "@/types/crm-types"

export const runtime = "nodejs"

// External program participants of a cohort. Operator-managed (full_admin+).
// Not crm_team_members — builders never get an admin login.

const VALID_STATUSES = ["applied", "accepted", "active", "shipped", "demoed", "withdrawn"]

// GET — builders for a cohort (?cohortId=)
export async function GET(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const cohortId = new URL(request.url).searchParams.get("cohortId")
    if (!cohortId) return NextResponse.json({ success: false, error: "cohortId is required" }, { status: 400 })
    const builders = await getBuildersByCohort(cohortId)
    return NextResponse.json({ success: true, data: builders })
  } catch (error) {
    console.error("Error fetching builders:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch builders" }, { status: 500 })
  }
}

// POST — add a builder to a cohort
export async function POST(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { cohortId, name, status } = body as Partial<Builder>

    if (!cohortId) return NextResponse.json({ success: false, error: "cohortId is required" }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 })
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: `Invalid status: ${status}` }, { status: 400 })
    }

    const builder = await createBuilder({
      cohortId,
      name: name.trim(),
      status: status ?? "applied",
      teamName: body.teamName?.trim() || undefined,
      email: body.email?.trim().toLowerCase() || undefined,
      prototypeUrl: body.prototypeUrl?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
    })
    return NextResponse.json({ success: true, data: builder })
  } catch (error) {
    console.error("Error creating builder:", error)
    return NextResponse.json({ success: false, error: "Failed to create builder" }, { status: 500 })
  }
}

// PATCH — update a builder (body.id + changed fields)
export async function PATCH(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const body = await request.json()
    const { id } = body as { id?: string }
    if (!id) return NextResponse.json({ success: false, error: "Builder id is required" }, { status: 400 })

    const updates: Partial<Builder> = {}
    if (body.name !== undefined) updates.name = String(body.name).trim()
    if (body.teamName !== undefined) updates.teamName = String(body.teamName).trim()
    if (body.email !== undefined) updates.email = String(body.email).trim().toLowerCase()
    if (body.prototypeUrl !== undefined) updates.prototypeUrl = String(body.prototypeUrl).trim()
    if (body.notes !== undefined) updates.notes = String(body.notes).trim()
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status))
        return NextResponse.json({ success: false, error: `Invalid status: ${body.status}` }, { status: 400 })
      updates.status = body.status
    }

    const builder = await updateBuilder(id, updates)
    return NextResponse.json({ success: true, data: builder })
  } catch (error) {
    console.error("Error updating builder:", error)
    return NextResponse.json({ success: false, error: "Failed to update builder" }, { status: 500 })
  }
}

// DELETE — remove a builder (?id=)
export async function DELETE(request: NextRequest) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ success: false, error: "Builder id is required" }, { status: 400 })
    await deleteBuilder(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting builder:", error)
    return NextResponse.json({ success: false, error: "Failed to delete builder" }, { status: 500 })
  }
}
