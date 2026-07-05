"use client"

import { useState, useEffect } from "react"
import {
  Target,
  Calendar,
  BarChart3,
  ArrowUpRight,
  Timer,
} from "lucide-react"
import type { FunnelKpis } from "@/lib/kpis/funnel"
import { FollowupsQueue } from "./FollowupsQueue"
import {
  formatCurrency,
  formatDate,
  DISPOSITION_OPTIONS,
} from "./types"
import type {
  DashboardStats,
  PipelineColumn,
  ViewMode,
  Client,
  Task,
  Disposition,
  Brand,
  BrandGoal,
  CurrentUser,
} from "./types"
import { useBrandGoals } from "@/hooks/useBrandGoals"

interface DashboardViewProps {
  stats: DashboardStats
  pipeline: PipelineColumn[]
  clients: Client[]
  tasks: Task[]
  onViewChange: (view: ViewMode) => void
  onShowClientForm: () => void
  onClientClick: (client: Client) => void
  onOpportunityClick?: (client: Client) => void  // New: open opportunity modal for opportunities
  onTaskClick: (task: Task) => void
  currentUser?: CurrentUser | null
}

// Helper to match brand goals (including combined 434 Media / Digital Canvas)
function matchesBrandGoal(itemBrand: Brand | undefined, goal: BrandGoal): boolean {
  if (!itemBrand) return false
  if (goal.includedBrands && goal.includedBrands.length > 0) {
    return goal.includedBrands.includes(itemBrand)
  }
  return itemBrand === goal.brand
}

// Active Opportunities List Component - shows client-based opportunities only
function ActiveOpportunitiesList({
  clients,
  tasks,
  onClientClick,
  onTaskClick,
  onViewAll,
}: {
  clients: Client[]
  tasks: Task[]
  onClientClick: (client: Client) => void
  onTaskClick: (task: Task) => void
  onViewAll: () => void
}) {
  // Get opportunity clients only (not tasks)
  const opportunityClients = clients.filter(c => c.is_opportunity)

  // Combine clients that are active opportunities (exclude closed)
  const activeOpportunities: Array<{
    id: string
    type: "client"
    title: string
    companyName: string
    contactName: string
    followUpDate?: string
    disposition: string
    dispositionValue: Disposition
    dispositionColor: string
    value?: number
    brand?: Brand
    original: Client
  }> = []

  // Add clients only
  opportunityClients
    .filter(c => c.disposition !== "closed_won" && c.disposition !== "closed_lost")
    .forEach(c => {
      const primaryContact = c.contacts?.find(contact => contact.is_primary) || c.contacts?.[0]
      activeOpportunities.push({
        id: c.id,
        type: "client",
        title: c.title || c.company_name || c.name,
        companyName: c.company_name || c.name || "",
        contactName: primaryContact?.name || c.name || "No contact",
        followUpDate: c.next_followup_date,
        disposition: DISPOSITION_OPTIONS.find(d => d.value === (c.disposition || "discovery"))?.label || "Discovery",
        dispositionValue: c.disposition || "discovery",
        dispositionColor: DISPOSITION_OPTIONS.find(d => d.value === (c.disposition || "discovery"))?.color || "#14b8a6",
        value: c.pitch_value,
        brand: c.brand,
        original: c,
      })
    })

  // Sort by follow-up date
  activeOpportunities.sort((a, b) => {
    if (!a.followUpDate && !b.followUpDate) return 0
    if (!a.followUpDate) return 1
    if (!b.followUpDate) return -1
    return new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime()
  })

  return (
    <div className="bg-white rounded-lg border border-neutral-200/70 overflow-hidden">
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-medium text-neutral-900">Active Opportunities</h3>
            <span className="text-xs tabular-nums text-neutral-400">({activeOpportunities.length})</span>
          </div>
          <button
            onClick={() => {
              onViewAll()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-950 flex items-center gap-1 transition-colors"
          >
            View all
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 max-h-[60dvh] sm:max-h-100 overflow-y-auto">
        {activeOpportunities.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-400">
            No active opportunities. Add clients as opportunities to track them here.
          </div>
        ) : (
          activeOpportunities.slice(0, 10).map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => onClientClick(item.original)}
              className="w-full p-4 hover:bg-neutral-50 transition-colors text-left"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left side - Main content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Title row */}
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-neutral-900 truncate">{item.title}</h4>
                    {item.brand && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 text-neutral-600">
                        {item.brand}
                      </span>
                    )}
                  </div>
                  {/* Company and Contact row */}
                  <p className="text-xs text-neutral-500">
                    {item.companyName && item.title !== item.companyName && (
                      <span className="font-medium text-neutral-600">{item.companyName}</span>
                    )}
                    {item.companyName && item.title !== item.companyName && item.contactName && (
                      <span className="text-neutral-300"> · </span>
                    )}
                    {item.contactName && <span>{item.contactName}</span>}
                  </p>
                  {/* Due date row */}
                  {item.followUpDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-xs font-medium tabular-nums text-neutral-600">
                        Follow-up · {formatDate(item.followUpDate)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Right side - Status and value (mono pill + colored dot) */}
                <div className="shrink-0 text-right space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: item.dispositionColor }}
                      aria-hidden="true"
                    />
                    {item.disposition}
                  </span>
                  {item.value !== undefined && item.value > 0 && (
                    <p className="text-sm font-semibold tabular-nums text-neutral-900">{formatCurrency(item.value, true)}</p>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Platform Goals Progress (uses opportunity clients only for budget tracking)
// Display order for the Platform Goals list. Brands not listed fall to the end.
const PLATFORM_GOAL_ORDER = ["434 Media", "Digital Canvas", "TXMX Boxing", "Vemos Vamos", "DEVSA"]
const platformGoalRank = (brand: string) => {
  const i = PLATFORM_GOAL_ORDER.indexOf(brand)
  return i === -1 ? PLATFORM_GOAL_ORDER.length : i
}

function PlatformGoalsProgress({ clients }: { clients: Client[] }) {
  const { goals: brandGoals } = useBrandGoals()
  const orderedGoals = [...brandGoals].sort((a, b) => platformGoalRank(a.brand) - platformGoalRank(b.brand))
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900">Platform Goals</h3>
        </div>
        <span className="text-xs text-neutral-500">Annual Targets</span>
      </div>

      <div className="p-4 space-y-4">
        {orderedGoals.map((goal) => {
          const brandClients = clients.filter(c => matchesBrandGoal(c.brand, goal) && c.is_opportunity)
          const wonRevenue = brandClients
            .filter(c => c.disposition === "closed_won")
            .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
          const pipelineValue = brandClients
            .filter(c => c.disposition !== "closed_won" && c.disposition !== "closed_lost")
            .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
          const progress = Math.min(100, (wonRevenue / goal.annualGoal) * 100)

          const displayName = goal.includedBrands && goal.includedBrands.length > 1
            ? `${goal.brand} / ${goal.includedBrands.filter(b => b !== goal.brand).join(", ")}`
            : goal.brand

          return (
            <div key={goal.brand} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: goal.color }} />
                  <span className="text-sm font-medium text-neutral-900">{displayName}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold" style={{ color: goal.color }}>
                    {formatCurrency(wonRevenue, true)}
                  </span>
                  <span className="text-xs text-neutral-400"> / {formatCurrency(goal.annualGoal, true)}</span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, backgroundColor: goal.color }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{Math.round(progress)}% achieved (Won/Goal)</span>
                <span>{formatCurrency(pipelineValue, true)} in pipeline</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Funnel scoreboard — the CRM's bottom half (Discovery → Proposal → Closed-Won)
// read from the SAME FunnelKpis as /admin/kpis, so the two never disagree. Leads
// the dashboard so a first-timer sees the funnel before the finance detail.
function FunnelScoreboard({ kpis }: { kpis: FunnelKpis }) {
  const reachedOf = (s: string) => kpis.stages.find((x) => x.stage === s)?.reached ?? 0
  const convOf = (from: string) => {
    const c = kpis.conversions.find((x) => x.from === from)
    return c ? Math.round(c.rate * 100) : 0
  }
  const ttcw = kpis.velocity.find((v) => v.step === "Time to Closed-Won")
  const stageCells = [
    { label: "Discovery", value: reachedOf("discovery"), color: "#14b8a6" },
    { label: "Proposal", value: reachedOf("proposal"), color: "#0ea5e9" },
    { label: "Closed-Won", value: reachedOf("closed_won"), color: "#22c55e" },
  ]
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-medium text-neutral-900">Funnel — this half</h3>
        </div>
        <a
          href="/admin/kpis"
          className="text-[11px] text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
        >
          Full funnel KPIs <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {stageCells.map((c) => (
          <div key={c.label} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-[10px] uppercase tracking-wide text-neutral-400">{c.label}</span>
            </div>
            <div className="text-xl font-semibold tabular-nums text-neutral-900 mt-0.5">{c.value}</div>
          </div>
        ))}
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Disc → Prop</span>
          <div className="text-xl font-semibold tabular-nums text-neutral-900 mt-0.5">{convOf("discovery")}%</div>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400">Prop → Won</span>
          <div className="text-xl font-semibold tabular-nums text-neutral-900 mt-0.5">{convOf("proposal")}%</div>
        </div>
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
          <span className="text-[10px] uppercase tracking-wide text-neutral-400 inline-flex items-center gap-1">
            <Timer className="w-3 h-3" />Time to Won
          </span>
          <div className="text-xl font-semibold tabular-nums text-neutral-900 mt-0.5">
            {ttcw && ttcw.sampleSize > 0 ? `${ttcw.medianDays}d` : "—"}
          </div>
        </div>
      </div>
      <p className="text-[10px] text-neutral-400 mt-2">
        Same figures as the Funnel KPI page — leads + opportunities, this funnel&apos;s bottom half.
      </p>
    </div>
  )
}

export function DashboardView({
  stats,
  pipeline,
  clients,
  tasks,
  onViewChange,
  onShowClientForm,
  onClientClick,
  onOpportunityClick,
  onTaskClick,
  currentUser,
}: DashboardViewProps) {
  // Funnel scoreboard data — same source as /admin/kpis so numbers align.
  const [funnel, setFunnel] = useState<FunnelKpis | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/kpis/funnel", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.kpis) setFunnel(d.kpis) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])
  
  // Handler that opens opportunity modal for opportunities, contact modal for contacts
  const handleClientClick = (client: Client) => {
    if (client.is_opportunity && onOpportunityClick) {
      onOpportunityClick(client)
    } else {
      onClientClick(client)
    }
  }
  
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Funnel scoreboard — leads the dashboard; same numbers as /admin/kpis.
          The DOC/confidence forecast lives in the pipeline (a Confidence filter
          + per-card DOC pill); quota-to-target is tracked per brand in Platform
          Goals below — so the dashboard stays funnel-consistent. */}
      {funnel && <FunnelScoreboard kpis={funnel} />}

      {/* Main Content Grid - 70/30 split on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left Column - Primary content (70%) */}
        <div className="space-y-6">
          {/* Unified follow-up queue — leads + opportunities + sequence sends. */}
          <FollowupsQueue />

          <ActiveOpportunitiesList
            clients={clients}
            tasks={tasks}
            onClientClick={handleClientClick}
            onTaskClick={onTaskClick}
            onViewAll={() => onViewChange("pipeline")}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <PlatformGoalsProgress clients={clients} />
        </div>
      </div>
    </div>
  )
}
