import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getGoals } from "@/lib/firestore-goals"
import { evaluateGoalsForProperty } from "@/lib/goal-evaluator"

export const runtime = "nodejs"
export const maxDuration = 60

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/analytics/goals/evaluate?propertyId=<id>
//
// Returns the union of "this property's goals" + "portfolio-wide goals"
// with each one's current value, status, and pace. The KPI panel renders
// directly from this response.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId")
  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 })
  }

  try {
    const allGoals = await getGoals()
    const evaluations = await evaluateGoalsForProperty(propertyId, allGoals)
    return NextResponse.json({ success: true, evaluations })
  } catch (err) {
    console.error("[GET /goals/evaluate]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to evaluate goals" },
      { status: 500 },
    )
  }
}
