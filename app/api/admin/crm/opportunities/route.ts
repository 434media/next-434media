import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunitiesByStage,
  getOpportunitiesByClient,
  getPipelineView,
} from "@/app/lib/firestore-crm"
import type { OpportunityStage } from "@/app/types/crm-types"

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

// GET - Fetch opportunities with optional filters
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
    const stage = searchParams.get("stage") as OpportunityStage | null
    const clientId = searchParams.get("client_id")
    const view = searchParams.get("view") // "pipeline" for pipeline view

    // Get single opportunity by ID
    if (id) {
      const opportunity = await getOpportunityById(id)
      if (!opportunity) {
        return NextResponse.json(
          { error: "Opportunity not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, opportunity })
    }

    // Get pipeline view
    if (view === "pipeline") {
      const pipeline = await getPipelineView()
      return NextResponse.json({ success: true, pipeline })
    }

    // Get opportunities by stage
    if (stage) {
      const opportunities = await getOpportunitiesByStage(stage)
      return NextResponse.json({ success: true, opportunities })
    }

    // Get opportunities by client
    if (clientId) {
      const opportunities = await getOpportunitiesByClient(clientId)
      return NextResponse.json({ success: true, opportunities })
    }

    // Get all opportunities
    const opportunities = await getOpportunities()
    return NextResponse.json({ success: true, opportunities })
  } catch (error) {
    console.error("Error fetching opportunities:", error)
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 }
    )
  }
}

// POST - Create a new opportunity
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

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Opportunity name is required" },
        { status: 400 }
      )
    }

    const opportunity = await createOpportunity({
      name: body.name.trim(),
      description: body.description || "",
      client_id: body.client_id || "",
      client_name: body.client_name || "",
      stage: body.stage || "lead",
      probability: body.probability || 0,
      value: body.value || 0,
      currency: body.currency || "USD",
      expected_close_date: body.expected_close_date || "",
      actual_close_date: body.actual_close_date || "",
      owner_id: body.owner_id || "",
      owner_name: body.owner_name || "",
      services: body.services || [],
      notes: body.notes || "",
      lost_reason: body.lost_reason || "",
      won_reason: body.won_reason || "",
      competitors: body.competitors || [],
    })

    return NextResponse.json({ success: true, opportunity }, { status: 201 })
  } catch (error) {
    console.error("Error creating opportunity:", error)
    return NextResponse.json(
      { error: "Failed to create opportunity" },
      { status: 500 }
    )
  }
}

// PUT - Update an opportunity
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
        { error: "Opportunity ID is required" },
        { status: 400 }
      )
    }

    const { id, ...updates } = body

    // If stage changed to closed_won/closed_lost, set actual_close_date
    if (
      (updates.stage === "closed_won" || updates.stage === "closed_lost") &&
      !updates.actual_close_date
    ) {
      updates.actual_close_date = new Date().toISOString().split("T")[0]
    }

    const opportunity = await updateOpportunity(id, updates)

    return NextResponse.json({ success: true, opportunity })
  } catch (error) {
    console.error("Error updating opportunity:", error)
    return NextResponse.json(
      { error: "Failed to update opportunity" },
      { status: 500 }
    )
  }
}

// DELETE - Delete an opportunity
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
        { error: "Opportunity ID is required" },
        { status: 400 }
      )
    }

    await deleteOpportunity(id)

    return NextResponse.json({ success: true, message: "Opportunity deleted" })
  } catch (error) {
    console.error("Error deleting opportunity:", error)
    return NextResponse.json(
      { error: "Failed to delete opportunity" },
      { status: 500 }
    )
  }
}
