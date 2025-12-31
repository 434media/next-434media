"use client"

import { Users, DollarSign, TrendingUp, Target, UserPlus, CheckCircle2, BarChart3 } from "lucide-react"
import { StatCard } from "./StatCard"
import { QuickActionCard } from "./QuickActionCard"
import { formatCurrency, BRAND_GOALS } from "./types"
import type { DashboardStats, PipelineColumn, ViewMode } from "./types"

interface DashboardViewProps {
  stats: DashboardStats
  pipeline: PipelineColumn[]
  onViewChange: (view: ViewMode) => void
  onShowClientForm: () => void
  currentUser?: { name: string; email: string; picture?: string } | null
}

export function DashboardView({ stats, pipeline, onViewChange, onShowClientForm, currentUser }: DashboardViewProps) {
  // Calculate totals for the big picture view
  const totalBudget = BRAND_GOALS.reduce((sum, b) => sum + b.annualGoal, 0)
  const totalPitched = stats.pipelineValue + stats.closedWonRevenue + (stats.closedLostRevenue || 0)
  const pacing = stats.closedWonRevenue + stats.pipelineValue
  const remaining = Math.max(0, totalBudget - stats.closedWonRevenue)
  
  // Calculate Won vs Lost percentages
  const totalClosed = stats.closedWonRevenue + (stats.closedLostRevenue || 0)
  const wonPercentage = totalClosed > 0 ? Math.round((stats.closedWonRevenue / totalClosed) * 100) : 100

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      {currentUser && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-neutral-900 to-neutral-800 border border-neutral-700">
          <div>
            <h2 className="text-xl font-semibold">Welcome back, {currentUser.name}!</h2>
            <p className="text-sm text-neutral-400 mt-1">Here&apos;s your sales overview</p>
          </div>
          <div className="text-sm text-neutral-400 hidden sm:block">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}

      {/* Top-Level Stats - Big Picture View (similar to mockup) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Budget</p>
          <p className="text-2xl font-bold text-white">{formatCurrency(totalBudget)}</p>
          <p className="text-xs text-neutral-500 mt-1">Annual sales goal</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Remaining</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(remaining)}</p>
          <p className="text-xs text-neutral-500 mt-1">To reach goal</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Pacing</p>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(pacing)}</p>
          <p className="text-xs text-neutral-500 mt-1">Won + Pipeline</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">Total Pitched</p>
          <p className="text-2xl font-bold text-purple-400">{formatCurrency(totalPitched)}</p>
          <p className="text-xs text-neutral-500 mt-1">All opportunities</p>
        </div>
        {/* Won vs Lost Pie Chart Indicator */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center">
          <div className="relative w-16 h-16 mb-2">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle cx="18" cy="18" r="15" fill="none" stroke="#374151" strokeWidth="3" />
              {/* Won portion (green) */}
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeDasharray={`${wonPercentage} ${100 - wonPercentage}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold">{wonPercentage}%</span>
            </div>
          </div>
          <p className="text-xs text-neutral-400">Won vs Lost</p>
        </div>
      </div>

      {/* Pipeline Overview Section - styled like the mockup */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-neutral-400" />
            Pipeline Overview
          </h3>
          <button 
            onClick={() => onViewChange("pipeline")}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            View Full Pipeline →
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-1">Active Opportunities</p>
            <p className="text-2xl font-bold">{stats.totalOpportunities}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">Active</span>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-1">Gross Pipeline</p>
            <p className="text-2xl font-bold">{formatCurrency(stats.pipelineValue)}</p>
            <p className="text-xs text-neutral-500 mt-1">Open deals</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-1">Avg Deal Size</p>
            <p className="text-2xl font-bold">
              {stats.totalOpportunities > 0 
                ? formatCurrency(Math.round(stats.pipelineValue / stats.totalOpportunities))
                : "$0"
              }
            </p>
            <p className="text-xs text-neutral-500 mt-1">Per opportunity</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-1">Won Count</p>
            <p className="text-2xl font-bold text-emerald-400">{stats.closedWonThisMonth}</p>
            <p className="text-xs text-neutral-500 mt-1">This period</p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
            <p className="text-xs text-neutral-400 mb-1">Won Size</p>
            <p className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.closedWonRevenue)}</p>
            <p className="text-xs text-neutral-500 mt-1">Closed revenue</p>
          </div>
        </div>
      </div>

      {/* Stage & Brand Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stage-wise breakdown */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <h4 className="text-sm font-semibold mb-4">Stage Wise</h4>
          <div className="space-y-3">
            {pipeline.map((col) => {
              const maxValue = Math.max(...pipeline.map(p => p.totalValue), 1)
              const widthPercent = (col.totalValue / maxValue) * 100
              
              return (
                <div key={col.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-400">{col.label}</span>
                    <span className="font-medium">{formatCurrency(col.totalValue)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${widthPercent}%`,
                        backgroundColor: col.color 
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Brand-wise breakdown */}
        <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
          <h4 className="text-sm font-semibold mb-4">Brand Wise</h4>
          <div className="space-y-3">
            {BRAND_GOALS.map((brandGoal) => {
              const brandStat = stats.brandStats?.find(b => b.brand === brandGoal.brand)
              const wonRevenue = brandStat?.wonRevenue || 0
              const progressPercent = Math.min(100, (wonRevenue / brandGoal.annualGoal) * 100)
              
              return (
                <div key={brandGoal.brand} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-400">{brandGoal.brand}</span>
                    <span className="font-medium">{formatCurrency(wonRevenue)}</span>
                  </div>
                  <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${progressPercent}%`,
                        backgroundColor: brandGoal.color 
                      }}
                    />
                  </div>
                  <p className="text-xs text-neutral-500">
                    {formatCurrency(wonRevenue)} of {formatCurrency(brandGoal.annualGoal)} goal ({Math.round(progressPercent)}%)
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickActionCard
          title="View Pipeline"
          description="Manage opportunities across brands"
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

      {/* Stats Grid - Additional KPIs */}
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
    </div>
  )
}