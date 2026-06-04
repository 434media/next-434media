import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getOpportunities,
  getOpportunityById,
  getOpportunitiesByStage,
  getOpportunitiesByClient,
  getPipelineView,
} from "@/lib/firestore-crm"

// This route is READ-ONLY. Opportunities are created/updated/deleted through
// /api/admin/crm/clients (they live in crm_clients with is_opportunity=true);
// the legacy write handlers + crm_opportunities collection were retired.
import type { OpportunityStage } from "@/types/crm-types"

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
