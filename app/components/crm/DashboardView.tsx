"use client"

import { Users, DollarSign, TrendingUp, Target, UserPlus, CheckCircle2 } from "lucide-react"
import { StatCard } from "./StatCard"
import { QuickActionCard } from "./QuickActionCard"
import { formatCurrency } from "./types"
import type { DashboardStats, PipelineColumn, ViewMode } from "./types"

interface DashboardViewProps {
  stats: DashboardStats
  pipeline: PipelineColumn[]
  onViewChange: (view: ViewMode) => void
  onShowClientForm: () => void
}

export function DashboardView({ stats, pipeline, onViewChange, onShowClientForm }: DashboardViewProps) {
  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={stats.totalClients}
          subValue={`${stats.activeClients} active`}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(stats.pipelineValue)}
          subValue={`${stats.totalOpportunities} opportunities`}
          icon={DollarSign}
          color="emerald"
        />
        <StatCard
          label="Closed Won (MTD)"
          value={stats.closedWonThisMonth}
          subValue={formatCurrency(stats.closedWonRevenue)}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats.conversionRate}%`}
          subValue={`${stats.tasksOverdue} overdue tasks`}
          icon={Target}
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          title="View Pipeline"
          description="Manage opportunities across stages"
          icon={Target}
          onClick={() => onViewChange("pipeline")}
        />
        <QuickActionCard
          title="Add Client"
          description="Create a new client record"
          icon={UserPlus}
          onClick={() => {
            onViewChange("clients")
            onShowClientForm()
          }}
        />
        <QuickActionCard
          title="Today's Tasks"
          description={`${stats.tasksToday} tasks due today`}
          icon={CheckCircle2}
          onClick={() => onViewChange("tasks")}
        />
      </div>

      {/* Pipeline Summary */}
      {pipeline.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Pipeline Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {pipeline.map((col) => (
              <div
                key={col.stage}
                className="p-4 rounded-lg bg-neutral-900 border border-neutral-800"
              >
                <div
                  className="w-3 h-3 rounded-full mb-2"
                  style={{ backgroundColor: col.color }}
                />
                <p className="text-xs text-neutral-400 mb-1">{col.label}</p>
                <p className="text-lg font-semibold">{col.opportunities.length}</p>
                <p className="text-xs text-neutral-500">
                  {formatCurrency(col.totalValue)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
