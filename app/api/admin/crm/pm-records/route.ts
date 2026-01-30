import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getPMRecords,
  getPMRecordById,
  createPMRecord,
  updatePMRecord,
  deletePMRecord,
} from "@/app/lib/firestore-crm"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 }
  }

  return { session }
}

// GET - Fetch all PM records or single by ID
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      const pmRecord = await getPMRecordById(id)
      if (!pmRecord) {
        return NextResponse.json(
          { error: "PM record not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, pmRecord })
    }

    const pmRecords = await getPMRecords()
    return NextResponse.json({ success: true, pmRecords })
  } catch (error) {
    console.error("Error fetching PM records:", error)
    return NextResponse.json(
      { error: "Failed to fetch PM records" },
      { status: 500 }
    )
  }
}

// POST - Create a new PM record
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (!body.project_name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    const pmRecord = await createPMRecord({
      project_name: body.project_name.trim(),
      description: body.description || "",
      client_id: body.client_id || "",
      client_name: body.client_name || "",
      status: body.status || "planning",
      health: body.health || "on_track",
      start_date: body.start_date || "",
      end_date: body.end_date || "",
      deadline: body.deadline || "",
      budget: body.budget || 0,
      spent: body.spent || 0,
      pm_id: body.pm_id || "",
      pm_name: body.pm_name || "",
      team_members: body.team_members || [],
      scope: body.scope || "",
      deliverables: body.deliverables || [],
      notes: body.notes || "",
      opportunity_id: body.opportunity_id || "",
      task_ids: body.task_ids || [],
    })

    return NextResponse.json({ success: true, pmRecord }, { status: 201 })
  } catch (error) {
    console.error("Error creating PM record:", error)
    return NextResponse.json(
      { error: "Failed to create PM record" },
      { status: 500 }
    )
  }
}

// PUT - Update a PM record
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "PM record ID is required" },
        { status: 400 }
      )
    }

    const { id, ...updates } = body
    const pmRecord = await updatePMRecord(id, updates)

    return NextResponse.json({ success: true, pmRecord })
  } catch (error) {
    console.error("Error updating PM record:", error)
    return NextResponse.json(
      { error: "Failed to update PM record" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a PM record
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "PM record ID is required" },
        { status: 400 }
      )
    }

    await deletePMRecord(id)

    return NextResponse.json({ success: true, message: "PM record deleted" })
  } catch (error) {
    console.error("Error deleting PM record:", error)
    return NextResponse.json(
      { error: "Failed to delete PM record" },
      { status: 500 }
    )
  }
}
