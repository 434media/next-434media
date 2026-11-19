import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getClients,
  getOpportunities,
  getSalesReps,
  getAllTasks,
} from "@/lib/firestore-crm"
import { isQuotaError } from "@/lib/firestore-quota"
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

// Pipeline stages configuration
const PIPELINE_STAGES: { stage: OpportunityStage; label: string; color: string }[] = [
  { stage: "discovery", label: "Discovery", color: "#14b8a6" },
  { stage: "proposal", label: "Proposal", color: "#0ea5e9" },
  { stage: "closed_won", label: "Closed Won", color: "#22c55e" },
  { stage: "closed_lost", label: "Closed Lost", color: "#ef4444" },
]

// GET - Get CRM dashboard data (optimized to minimize Firestore reads)
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    // Fetch all data ONCE. Read crm_clients FRESH (bypassing the 30s cache) so the
    // dashboard reflects the latest writes immediately. The fresh read warms the
    // cache, so getOpportunities() below — which derives from crm_clients — reuses
    // it without a second Firestore read. Sales reps are read fresh too; tasks are
    // uncached post-migration.
    // A failed read still degrades to an empty list, but is remembered: the
    // warning below is driven by real read errors, never by an empty store
    // (a preview's staging store is legitimately empty).
    const readErrors: unknown[] = []
    const orEmpty = <T,>(read: Promise<T[]>): Promise<T[]> =>
      read.catch((err) => {
        readErrors.push(err)
        console.error("[GET /api/admin/crm] read failed:", err)
        return [] as T[]
      })
    const clients = await orEmpty(getClients({ fresh: true }))
    const [opportunities, salesReps, allTasks] = await Promise.all([
      orEmpty(getOpportunities()),
      orEmpty(getSalesReps({ fresh: true })),
      orEmpty(getAllTasks()),
    ])
    const warning = readErrors.some(isQuotaError)
      ? "Firebase quota exceeded. Data may be incomplete. Please wait a few minutes and refresh."
      : readErrors.length > 0
        ? "Some CRM data could not be loaded. Data may be incomplete. Please refresh."
        : null

    // Archived deals are out of the active pipeline (the pipeline board's rule:
    // is_opportunity && !is_archived). Closed-won totals stay all-time.
    const archivedIds = new Set(clients.filter((c) => c.is_archived).map((c) => c.id))

    // Calculate stats from the data we already have (no additional reads)
    const activeClients = clients.filter((c) => c.status === "active").length
    const pipelineOpportunities = opportunities.filter(
      (o) => !archivedIds.has(o.id) && o.stage !== "closed_won" && o.stage !== "closed_lost"
    )
    const pipelineValue = pipelineOpportunities.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    )

    // Closed won — all-time, from the live source (crm_clients opportunities with
    // stage=closed_won). The crm_clients opps don't carry a reliable close date, so
    // we report the all-time count + summed value rather than a misleading "this
    // month" slice. (Previously read the frozen crm_closed_won_leads Airtable
    // import, which had no dollar values and fed no UI.)
    const now = new Date()
    const closedWonOpportunities = opportunities.filter(
      (o) => o.stage === "closed_won"
    )
    const closedWonValue = closedWonOpportunities.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    )

    // Today's tasks
    const today = new Date().toISOString().split("T")[0]
    const tasksToday = allTasks.filter(
      (t) => t.due_date?.startsWith(today) && t.status !== "completed"
    ).length
    
    // Overdue tasks
    const tasksOverdue = allTasks.filter((t) => {
      if (!t.due_date || t.status === "completed") return false
      return new Date(t.due_date) < now
    }).length

    // Conversion rate
    const totalClosed = opportunities.filter(
      (o) => o.stage === "closed_won" || o.stage === "closed_lost"
    ).length
    const won = opportunities.filter((o) => o.stage === "closed_won").length
    const conversionRate = totalClosed > 0 ? (won / totalClosed) * 100 : 0

    const stats = {
      totalClients: clients.length,
      activeClients,
      totalOpportunities: opportunities.length,
      pipelineValue,
      closedWonCount: closedWonOpportunities.length,
      closedWonValue,
      tasksToday,
      tasksOverdue,
      conversionRate: Math.round(conversionRate * 10) / 10,
    }

    // Build pipeline view from opportunities we already have (no additional reads)
    const pipeline = PIPELINE_STAGES.map(({ stage, label, color }) => {
      const stageOpportunities = opportunities.filter((o) => o.stage === stage && !archivedIds.has(o.id))
      const totalValue = stageOpportunities.reduce(
        (sum, o) => sum + (o.value || 0),
        0
      )
      return { stage, label, color, opportunities: stageOpportunities, totalValue }
    })

    // Get recent activity (last 10 updated items)
    const allItems = [
      ...clients.map(c => ({ ...c, type: "client" as const })),
      ...opportunities.map(o => ({ ...o, type: "opportunity" as const })),
      ...allTasks.map(t => ({ ...t, type: "task" as const })),
    ]
    
    const recentActivity = allItems
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      stats,
      pipeline,
      recentActivity,
      counts: {
        clients: clients.length,
        opportunities: opportunities.length,
        salesReps: salesReps.length,
        tasks: allTasks.length,
      },
      ...(warning && { warning }),
    })
  } catch (error) {
    console.error("Error fetching CRM dashboard:", error)
    return NextResponse.json(
      { error: "Failed to fetch CRM dashboard data" },
      { status: 500 }
    )
  }
}
