"use client"

import { useState } from "react"
import {
  RocketIcon,
  TrendingUp,
  Target,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Calendar,
  Building2,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Search,
} from "lucide-react"
import {
  formatCurrency,
  formatDate,
  BRAND_GOALS,
  DISPOSITION_OPTIONS,
  DOC_OPTIONS,
} from "./types"
import type {
  DashboardStats,
  PipelineColumn,
  ViewMode,
  Client,
  Task,
  Disposition,
  Brand,
  CurrentUser,
} from "./types"

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
function matchesBrandGoal(itemBrand: Brand | undefined, goal: typeof BRAND_GOALS[0]): boolean {
  if (!itemBrand) return false
  if (goal.includedBrands && goal.includedBrands.length > 0) {
    return goal.includedBrands.includes(itemBrand)
  }
  return itemBrand === goal.brand
}

// KPI Card Component
function KPICard({
  label,
  value,
  subLabel,
  icon: Icon,
  color = "neutral",
  trend,
}: {
  label: string
  value: string
  subLabel?: string
  icon: React.ElementType
  color?: "neutral" | "emerald" | "amber" | "blue" | "sky" | "red"
  trend?: { value: number; isPositive: boolean }
}) {
  const colorClasses = {
    neutral: "bg-neutral-50 text-neutral-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    sky: "bg-sky-50 text-sky-600",
    red: "bg-red-50 text-red-600",
  }

  const valueColors = {
    neutral: "text-neutral-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    sky: "text-sky-600",
    red: "text-red-600",
  }

  return (
    <div className="p-4 md:p-5 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.isPositive ? "text-emerald-600" : "text-red-500"}`}>
            {trend.isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {trend.value}%
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl md:text-3xl font-bold tracking-tight ${valueColors[color]}`}>{value}</p>
      {subLabel && <p className="text-xs text-neutral-400 mt-1">{subLabel}</p>}
    </div>
  )
}

// Opportunity Progress Chart - Visual representation of active opportunities (clients only)
function OpportunityProgressChart({ 
  clients,
}: { 
  clients: Client[]
}) {
  const opportunityClients = clients.filter(c => c.is_opportunity)

  // Count by disposition - items without disposition default to "pitched"
  const pitchedCount = opportunityClients.filter(c => c.disposition === "pitched" || !c.disposition).length
  const wonCount = opportunityClients.filter(c => c.disposition === "closed_won").length
  const lostCount = opportunityClients.filter(c => c.disposition === "closed_lost").length

  const totalOpportunities = opportunityClients.length
  const activeOpportunities = pitchedCount

  // Calculate percentages for visualization
  const wonPercent = totalOpportunities > 0 ? (wonCount / totalOpportunities) * 100 : 0
  const pitchedPercent = totalOpportunities > 0 ? (pitchedCount / totalOpportunities) * 100 : 0
  const lostPercent = totalOpportunities > 0 ? (lostCount / totalOpportunities) * 100 : 0

  return (
    <div className="p-4 md:p-5 rounded-xl bg-white border border-neutral-200 shadow-sm col-span-2 lg:col-span-1">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-sky-50">
          <Target className="w-4 h-4 text-sky-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Opportunity Flow</h3>
          <p className="text-[10px] text-neutral-400">{totalOpportunities} total opportunities</p>
        </div>
      </div>

      {/* Stacked horizontal bar */}
      {totalOpportunities > 0 ? (
        <>
          <div className="h-5 rounded-lg bg-neutral-100 overflow-hidden flex mb-3">
            {wonPercent > 0 && (
              <div 
                className="h-full bg-emerald-500 flex items-center justify-center"
                style={{ width: `${wonPercent}%` }}
                title={`Won: ${wonCount}`}
              >
                {wonPercent >= 12 && <span className="text-[9px] font-bold text-white">{wonCount}</span>}
              </div>
            )}
            {pitchedPercent > 0 && (
              <div 
                className="h-full bg-sky-500 flex items-center justify-center"
                style={{ width: `${pitchedPercent}%` }}
                title={`Pitched: ${pitchedCount}`}
              >
                {pitchedPercent >= 12 && <span className="text-[9px] font-bold text-white">{pitchedCount}</span>}
              </div>
            )}
            {lostPercent > 0 && (
              <div 
                className="h-full bg-slate-400 flex items-center justify-center"
                style={{ width: `${lostPercent}%` }}
                title={`Lost: ${lostCount}`}
              >
                {lostPercent >= 12 && <span className="text-[9px] font-bold text-white">{lostCount}</span>}
              </div>
            )}
          </div>

          {/* Legend - Won first, then Pitched, then Lost */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span className="text-[10px] text-neutral-600">Won ({wonCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-sky-500" />
              <span className="text-[10px] text-neutral-600">Pitched ({pitchedCount})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-slate-400" />
              <span className="text-[10px] text-neutral-600">Lost ({lostCount})</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-center gap-1">
            <span className="text-lg font-bold text-sky-600">{activeOpportunities}</span>
            <span className="text-xs text-neutral-500">active opportunities</span>
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-neutral-400">No opportunities yet</p>
          <p className="text-xs text-neutral-300 mt-1">Add clients or tasks as opportunities</p>
        </div>
      )}
    </div>
  )
}

// Pipeline Confidence - Shows opportunity close likelihood with accordion
function PipelineConfidence({ 
  clients, 
  onClientClick,
}: { 
  clients: Client[]
  onClientClick: (client: Client) => void
}) {
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  
  const opportunityClients = clients.filter(c => c.is_opportunity && c.disposition !== "closed_won" && c.disposition !== "closed_lost")

  // Group opportunities by DOC
  const docData: Array<{ 
    label: string
    value: string
    count: number
    amount: number
    color: string
    description: string
    items: Array<{ data: Client; title: string; companyName: string; value?: number }>
  }> = [
    { label: "Low", value: "25", count: 0, amount: 0, color: "#fbbf24", description: "Early stage, needs nurturing", items: [] },
    { label: "Medium", value: "50", count: 0, amount: 0, color: "#0ea5e9", description: "Engaged, building relationship", items: [] },
    { label: "High", value: "75", count: 0, amount: 0, color: "#14b8a6", description: "Strong interest, likely to close", items: [] },
    { label: "Very High", value: "90", count: 0, amount: 0, color: "#22c55e", description: "Ready to close", items: [] },
  ]

  opportunityClients.forEach(c => {
    const doc = docData.find(d => d.value === c.doc)
    if (doc) {
      doc.count++
      doc.amount += c.pitch_value || 0
      doc.items.push({ 
        data: c, 
        title: c.title || c.company_name || c.name,
        companyName: c.company_name || c.name || "",
        value: c.pitch_value 
      })
    }
  })

  const totalActive = opportunityClients.length
  const expectedValue = docData.reduce((sum, d) => sum + (d.amount * (parseInt(d.value) / 100)), 0)

  const toggleDoc = (value: string) => {
    setExpandedDoc(prev => prev === value ? null : value)
  }

  return (
    <div className="p-4 md:p-5 rounded-xl bg-white border border-neutral-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-teal-50">
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Pipeline Confidence</h3>
            <p className="text-[10px] text-neutral-500">Click to view deals by confidence</p>
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {docData.map(doc => (
          <div key={doc.value} className="rounded-lg overflow-hidden border border-neutral-100">
            {/* Accordion Header */}
            <button
              onClick={() => doc.count > 0 && toggleDoc(doc.value)}
              className={`w-full p-3 flex items-center justify-between transition-colors ${
                doc.count > 0 ? "hover:bg-neutral-50 cursor-pointer" : "cursor-default opacity-60"
              } ${expandedDoc === doc.value ? "bg-neutral-50" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: doc.color }} />
                <span className="text-xs font-medium text-neutral-700">{doc.label} ({doc.value}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-xs font-semibold text-neutral-900">{doc.count} deals</span>
                  {doc.amount > 0 && (
                    <span className="text-xs text-neutral-400 ml-1">• {formatCurrency(doc.amount, true)}</span>
                  )}
                </div>
                {doc.count > 0 && (
                  <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${expandedDoc === doc.value ? "rotate-180" : ""}`} />
                )}
              </div>
            </button>

            {/* Accordion Content - List of deals */}
            {expandedDoc === doc.value && doc.count > 0 && (
              <div className="border-t border-neutral-100 divide-y divide-neutral-50 bg-neutral-25">
                {doc.items.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onClientClick(item.data)}
                    className="w-full p-2.5 pl-7 hover:bg-neutral-100 transition-colors text-left flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-semibold text-neutral-900 truncate">{item.title}</span>
                      {item.companyName && item.title !== item.companyName && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-medium rounded bg-neutral-100 text-neutral-500">
                          {item.companyName}
                        </span>
                      )}
                    </div>
                    {item.value !== undefined && item.value > 0 && (
                      <span className="shrink-0 text-xs font-medium text-neutral-600">{formatCurrency(item.value, true)}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {totalActive > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Expected Close Value</span>
            <span className="text-sm font-bold text-teal-600">{formatCurrency(expectedValue, true)}</span>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1">Based on {totalActive} active opportunities × confidence %</p>
        </div>
      )}
    </div>
  )
}

// Disposition Summary Pills
function DispositionSummary({ clients }: { clients: Client[] }) {
  const opportunityClients = clients.filter(c => c.is_opportunity)

  const counts: Record<Disposition, { count: number; value: number }> = {
    pitched: { count: 0, value: 0 },
    closed_won: { count: 0, value: 0 },
    closed_lost: { count: 0, value: 0 },
  }

  opportunityClients.forEach(c => {
    const disp = c.disposition || "pitched"
    counts[disp].count++
    counts[disp].value += c.pitch_value || 0
  })

  return (
    <div className="grid grid-cols-3 gap-3">
      {DISPOSITION_OPTIONS.map(opt => (
        <div
          key={opt.value}
          className="p-3 rounded-lg border border-neutral-200 bg-white hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: opt.color }} />
            <span className="text-xs font-medium text-neutral-600">{opt.label}</span>
          </div>
          <p className="text-xl font-bold text-neutral-900">{counts[opt.value].count}</p>
          {counts[opt.value].value > 0 && (
            <p className="text-xs text-neutral-400">{formatCurrency(counts[opt.value].value, true)}</p>
          )}
        </div>
      ))}
    </div>
  )
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
        disposition: DISPOSITION_OPTIONS.find(d => d.value === (c.disposition || "pitched"))?.label || "Pitched",
        dispositionValue: c.disposition || "pitched",
        dispositionColor: DISPOSITION_OPTIONS.find(d => d.value === (c.disposition || "pitched"))?.color || "#0ea5e9",
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
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Active Opportunities</h3>
            <span className="text-xs text-neutral-400">({activeOpportunities.length})</span>
          </div>
          <button
            onClick={() => {
              onViewAll()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            View All
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-neutral-100 max-h-[400px] overflow-y-auto">
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
                    <h4 className="text-sm font-semibold text-neutral-900 truncate">{item.title}</h4>
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
                  {/* Due date row with emphasis */}
                  {item.followUpDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">
                        Follow-up: {formatDate(item.followUpDate)}
                      </span>
                    </div>
                  )}
                </div>
                {/* Right side - Status and value */}
                <div className="shrink-0 text-right space-y-1">
                  <span
                    className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full"
                    style={{
                      backgroundColor: `${item.dispositionColor}15`,
                      color: item.dispositionColor,
                    }}
                  >
                    {item.disposition}
                  </span>
                  {item.value !== undefined && item.value > 0 && (
                    <p className="text-sm font-bold text-neutral-900">{formatCurrency(item.value, true)}</p>
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

// Recent Clients List Component
function RecentClientsList({
  clients,
  onClientClick,
  onViewAll,
  onAdd,
}: {
  clients: Client[]
  onClientClick: (client: Client) => void
  onViewAll: () => void
  onAdd: () => void
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const isSearching = searchQuery.trim().length > 0

  const recentClients = clients
    // When searching, include ALL clients (including opportunities)
    // When not searching, only show non-opportunity clients
    .filter(c => isSearching ? true : !c.is_opportunity)
    .filter(c => {
      if (!isSearching) return true
      const query = searchQuery.toLowerCase()
      const companyName = (c.company_name || "").toLowerCase()
      const name = (c.name || "").toLowerCase()
      const contactName = (c.contacts?.[0]?.name || "").toLowerCase()
      const email = (c.email || "").toLowerCase()
      return companyName.includes(query) || name.includes(query) || contactName.includes(query) || email.includes(query)
    })
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
    .slice(0, isSearching ? 15 : 5)

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Recent Clients</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAdd}
              className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-500 hover:text-neutral-700"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onViewAll()
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="divide-y divide-neutral-100 max-h-[300px] overflow-y-auto">
        {recentClients.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-400">
            {searchQuery.trim() 
              ? `No clients matching "${searchQuery}".`
              : "No clients yet. Add your first client to get started."
            }
          </div>
        ) : (
          recentClients.map((client) => (
            <button
              key={client.id}
              onClick={() => onClientClick(client)}
              className="w-full p-3 hover:bg-neutral-50 transition-colors text-left flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-neutral-900 truncate">{client.company_name || client.name}</p>
                  {client.is_opportunity && (
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700">
                      Opportunity
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 truncate">
                  {client.contacts?.[0]?.name || client.name || "No contact"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {client.brand && (
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-600">
                    {client.brand}
                  </span>
                )}
                {client.source && (
                  <p className="text-[10px] text-neutral-400 mt-0.5 capitalize">{client.source.replace("_", " ")}</p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Platform Goals Progress (uses opportunity clients only for budget tracking)
function PlatformGoalsProgress({ clients }: { clients: Client[] }) {
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
        {BRAND_GOALS.map((goal) => {
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
                <span>{Math.round(progress)}% achieved</span>
                <span>{formatCurrency(pipelineValue, true)} in pipeline</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Task Summary Card with expandable sections
function TaskSummaryCard({
  tasks,
  onTaskClick,
  onViewAll,
}: {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onViewAll: () => void
}) {
  const [expandedSection, setExpandedSection] = useState<"today" | "overdue" | "inProgress" | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const tasksDueToday = tasks.filter(t => {
    if (!t.due_date || t.status === "completed") return false
    return t.due_date.split("T")[0] === today
  })

  const tasksOverdue = tasks.filter(t => {
    if (!t.due_date || t.status === "completed") return false
    return t.due_date.split("T")[0] < today
  })

  const tasksInProgress = tasks.filter(t => t.status === "in_progress")

  const toggleSection = (section: "today" | "overdue" | "inProgress") => {
    setExpandedSection(prev => prev === section ? null : section)
  }

  const renderTaskList = (taskList: Task[]) => (
    <div className="divide-y divide-neutral-100 border-t border-neutral-100">
      {taskList.length === 0 ? (
        <p className="p-3 text-xs text-neutral-400 text-center">No tasks</p>
      ) : (
        taskList.slice(0, 5).map(task => (
          <button
            key={task.id}
            onClick={(e) => {
              e.stopPropagation()
              onTaskClick(task)
            }}
            className="w-full p-3 hover:bg-neutral-50 transition-colors text-left flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-neutral-900 truncate">{task.title}</p>
                {task.brand && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 text-neutral-600">
                    {task.brand}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 truncate">
                {task.assigned_to ? `Assigned to ${task.assigned_to}` : "Unassigned"}
                {task.due_date && ` • Due ${formatDate(task.due_date)}`}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </button>
        ))
      )}
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-semibold text-neutral-900">Task Summary</h3>
          <span className="text-xs text-neutral-400">({tasks.filter(t => t.status !== "completed").length} pending)</span>
        </div>
        <button
          onClick={() => {
            onViewAll()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View All
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div>
        {/* Due Today */}
        <button
          onClick={() => toggleSection("today")}
          className="w-full p-3 hover:bg-neutral-50 transition-colors flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">Due Today</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-neutral-900">{tasksDueToday.length}</span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${expandedSection === "today" ? "rotate-180" : ""}`} />
          </div>
        </button>
        {expandedSection === "today" && renderTaskList(tasksDueToday)}

        {/* Overdue */}
        <button
          onClick={() => toggleSection("overdue")}
          className="w-full p-3 hover:bg-red-50/50 transition-colors flex items-center justify-between border-t border-neutral-100"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-50">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">Overdue</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-red-600">{tasksOverdue.length}</span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${expandedSection === "overdue" ? "rotate-180" : ""}`} />
          </div>
        </button>
        {expandedSection === "overdue" && renderTaskList(tasksOverdue)}

        {/* In Progress */}
        <button
          onClick={() => toggleSection("inProgress")}
          className="w-full p-3 hover:bg-neutral-50 transition-colors flex items-center justify-between border-t border-neutral-100"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-sm font-medium text-neutral-700">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-neutral-900">{tasksInProgress.length}</span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${expandedSection === "inProgress" ? "rotate-180" : ""}`} />
          </div>
        </button>
        {expandedSection === "inProgress" && renderTaskList(tasksInProgress)}
      </div>
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
  // Fixed annual budget target
  const totalBudget = 1500000
  
  // Handler that opens opportunity modal for opportunities, contact modal for contacts
  const handleClientClick = (client: Client) => {
    if (client.is_opportunity && onOpportunityClick) {
      onOpportunityClick(client)
    } else {
      onClientClick(client)
    }
  }
  
  // Use clients with is_opportunity=true - same data source as the Kanban view
  // This ensures Dashboard KPI calculations match what's shown in the Opportunities Kanban
  const opportunityClients = clients.filter(c => c.is_opportunity)
  
  // Calculate revenue by disposition from opportunity clients
  // CORRECTED: Closed Won at 100% DOC only counts towards Remaining and Pacing
  const closedWon100DocRevenue = opportunityClients
    .filter(c => c.disposition === "closed_won" && c.doc === "100")
    .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
  
  // All Closed Won revenue (for total pitched calculation)
  const closedWonRevenue = opportunityClients
    .filter(c => c.disposition === "closed_won")
    .reduce((sum, c) => sum + (c.pitch_value || 0), 0)

  const closedLostRevenue = opportunityClients
    .filter(c => c.disposition === "closed_lost")
    .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
  
  // Pitched at 90% DOC for Pacing calculation
  const pitched90DocValue = opportunityClients
    .filter(c => c.disposition === "pitched" && c.doc === "90")
    .reduce((sum, c) => sum + (c.pitch_value || 0), 0)
  
  // Pipeline value = opportunities that are not closed (pitched or no disposition)
  const pipelineValue = opportunityClients
    .filter(c => c.disposition !== "closed_won" && c.disposition !== "closed_lost")
    .reduce((sum, c) => sum + (c.pitch_value || 0), 0)

  const totalPitched = closedWonRevenue + closedLostRevenue + pipelineValue
  
  // CORRECTED: Pacing = Closed Won at 100% DOC + Pitched at 90% DOC
  const pacing = closedWon100DocRevenue + pitched90DocValue
  
  // CORRECTED: Remaining = Total Budget - Closed Won at 100% DOC
  const remaining = Math.max(0, totalBudget - closedWon100DocRevenue)
  
  // Find opportunities in Closed Won that are NOT at 100% DOC (exceptions)
  const closedWonExceptions = opportunityClients
    .filter(c => c.disposition === "closed_won" && c.doc !== "100")

  // Debug: Log opportunity data from clients
  console.log("=== Dashboard Budget Debug (using clients.is_opportunity) ===")
  console.log("Total clients:", clients.length)
  console.log("Opportunity clients:", opportunityClients.length)
  console.log("Closed Won at 100% DOC:", closedWon100DocRevenue)
  console.log("Pitched at 90% DOC:", pitched90DocValue)
  console.log("Closed Won Exceptions (not 100% DOC):", closedWonExceptions.length)
  console.log("============================================================")

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Exceptions Warning - Show if there are Closed Won without 100% DOC */}
      {closedWonExceptions.length > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 mb-1">
                Exceptions Report: {closedWonExceptions.length} Closed Won {closedWonExceptions.length === 1 ? 'opportunity' : 'opportunities'} not at 100% DOC
              </h4>
              <ul className="text-xs text-red-700 space-y-1">
                {closedWonExceptions.map(c => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span className="font-medium">{c.title || c.company_name || c.name}</span>
                    <span className="px-1.5 py-0.5 bg-red-100 rounded text-red-600">DOC: {c.doc || 'Not set'}%</span>
                    {c.pitch_value && <span className="text-red-500">{formatCurrency(c.pitch_value, true)}</span>}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-2">
                These opportunities are not counted in Remaining or Pacing. Set DOC to 100% to include them.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <KPICard label="Budget" value={formatCurrency(totalBudget, true)} subLabel="Annual sales goal" icon={RocketIcon} color="neutral" />
        <KPICard label="Remaining" value={formatCurrency(remaining, false)} subLabel="Budget - Won (100% DOC)" icon={Target} color="amber" />
        <KPICard label="Pacing" value={formatCurrency(pacing, true)} subLabel="Won 100% + Pitched 90%" icon={TrendingUp} color="blue" />
        <KPICard label="Total Pitched" value={formatCurrency(totalPitched, true)} subLabel="All opportunities" icon={BarChart3} color="sky" />

        {/* Opportunity Flow Chart */}
        <div className="col-span-2 md:col-span-4 xl:col-span-1">
          <OpportunityProgressChart clients={clients} />
        </div>
      </div>

      {/* Main Content Grid - 70/30 split on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left Column - Primary content (70%) */}
        <div className="space-y-6">
          <ActiveOpportunitiesList
            clients={clients}
            tasks={tasks}
            onClientClick={handleClientClick}
            onTaskClick={onTaskClick}
            onViewAll={() => onViewChange("pipeline")}
          />

          <TaskSummaryCard
            tasks={tasks}
            onTaskClick={onTaskClick}
            onViewAll={() => onViewChange("tasks")}
          />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <PipelineConfidence 
            clients={clients} 
            onClientClick={handleClientClick}
          />

          <PlatformGoalsProgress clients={clients} />
        </div>
      </div>
    </div>
  )
}
