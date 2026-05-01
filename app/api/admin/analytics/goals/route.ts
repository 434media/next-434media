import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createGoal, getGoals, type GoalSource, type GoalPeriod } from "@/lib/firestore-goals"

export const runtime = "nodejs"

const VALID_SOURCES: GoalSource[] = [
  "ga4:sessions",
  "ga4:totalUsers",
  "ga4:screenPageViews",
  "ga4:engagementRate",
  "ga4:engagedSessions",
  "ga4_event",
  "crm:leads_created",
  "crm:leads_converted",
]

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/analytics/goals — list all goals (no scoping; KPI panel
// filters per property client-side, settings page shows everything).
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const goals = await getGoals()
    return NextResponse.json({ success: true, goals })
  } catch (err) {
    console.error("[GET /goals]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load goals" },
      { status: 500 },
    )
  }
}

// POST /api/admin/analytics/goals — create a goal.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const source = typeof body.source === "string" ? (body.source as GoalSource) : ("ga4:sessions" as GoalSource)
  const eventName = typeof body.eventName === "string" ? body.eventName.trim() : ""
  const target = typeof body.target === "number" ? body.target : Number(body.target) || 0
  const period: GoalPeriod = body.period === "weekly" ? "weekly" : "monthly"
  const propertyId =
    typeof body.propertyId === "string" && body.propertyId.length > 0 ? body.propertyId : null
  const invertGoodness = !!body.invertGoodness

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `source must be one of ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    )
  }
  if (source === "ga4_event" && !eventName) {
    return NextResponse.json(
      { error: "eventName is required when source is ga4_event" },
      { status: 400 },
    )
  }
  // GA4 metric and ga4_event sources require a property scope (no portfolio-
  // wide rollup for those — would need an aggregator we haven't built).
  if ((source.startsWith("ga4:") || source === "ga4_event") && !propertyId) {
    return NextResponse.json(
      { error: "GA4-source goals require a propertyId scope" },
      { status: 400 },
    )
  }
  if (target <= 0) return NextResponse.json({ error: "target must be > 0" }, { status: 400 })

  try {
    const goal = await createGoal({
      name,
      source,
      eventName: source === "ga4_event" ? eventName : undefined,
      target,
      period,
      propertyId,
      invertGoodness,
      createdBy: auth.session.email,
    })
    return NextResponse.json({ success: true, goal }, { status: 201 })
  } catch (err) {
    console.error("[POST /goals]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create goal" },
      { status: 500 },
    )
  }
}
