import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getClients,
  getOpportunities,
  getSalesReps,
  getAllTasks,
  getClosedWonLeads,
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

// Pipeline stages configuration
const PIPELINE_STAGES: { stage: OpportunityStage; label: string; color: string }[] = [
  { stage: "lead", label: "Lead", color: "#6366f1" },
  { stage: "qualified", label: "Qualified", color: "#8b5cf6" },
  { stage: "proposal", label: "Proposal", color: "#0ea5e9" },
  { stage: "negotiation", label: "Negotiation", color: "#f59e0b" },
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

    // Fetch all data ONCE - no duplicate reads
    const [clients, opportunities, salesReps, allTasks, closedWon] = await Promise.all([
      getClients().catch(() => []),
      getOpportunities().catch(() => []),
      getSalesReps().catch(() => []),
      getAllTasks().catch(() => []),
      getClosedWonLeads().catch(() => []),
    ])

    // Check if data is empty (likely quota exceeded)
    const isQuotaExceeded = clients.length === 0 && opportunities.length === 0 && allTasks.length === 0

    // Calculate stats from the data we already have (no additional reads)
    const activeClients = clients.filter((c) => c.status === "active").length
    const pipelineOpportunities = opportunities.filter(
      (o) => o.stage !== "closed_won" && o.stage !== "closed_lost"
    )
    const pipelineValue = pipelineOpportunities.reduce(
      (sum, o) => sum + (o.value || 0),
      0
    )

    // This month's closed won
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const closedWonThisMonth = closedWon.filter((lead) => {
      const closeDate = new Date(lead.closed_date)
      return closeDate >= monthStart
    })
    const closedWonRevenue = closedWonThisMonth.reduce(
      (sum, lead) => sum + (lead.deal_value || 0),
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
      closedWonThisMonth: closedWonThisMonth.length,
      closedWonRevenue,
      tasksToday,
      tasksOverdue,
      conversionRate: Math.round(conversionRate * 10) / 10,
    }

    // Build pipeline view from opportunities we already have (no additional reads)
    const pipeline = PIPELINE_STAGES.map(({ stage, label, color }) => {
      const stageOpportunities = opportunities.filter((o) => o.stage === stage)
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
      ...(isQuotaExceeded && {
        warning: "Firebase quota exceeded. Data may be incomplete. Please wait a few minutes and refresh.",
      }),
    })
  } catch (error) {
    console.error("Error fetching CRM dashboard:", error)
    return NextResponse.json(
      { error: "Failed to fetch CRM dashboard data" },
      { status: 500 }
    )
  }
}
