"use client"

import { useMemo, useState } from "react"
import {
  Plus,
  Search,
  RefreshCw,
  Flag,
  Mail,
  Phone,
  Calendar,
  Building2,
  Inbox,
  AlertCircle,
  Clock,
} from "lucide-react"
import type { Lead, LeadPriority, LeadStatus } from "@/types/crm-types"

type LeadView = "priority" | "all" | "followup"

interface LeadsViewProps {
  leads: Lead[]
  view: LeadView
  searchQuery: string
  onViewChange: (v: LeadView) => void
  onSearchChange: (q: string) => void
  onRefresh: () => void
  onOpenLead: (lead: Lead) => void
  onCreateLead: () => void
}

const PRIORITY_BADGE: Record<LeadPriority, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-neutral-200 text-neutral-700",
}

const STATUS_PILL: Record<LeadStatus, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-100",
  ready: "bg-sky-50 text-sky-700 border-sky-100",
  contacted: "bg-amber-50 text-amber-700 border-amber-100",
  engaged: "bg-green-50 text-green-700 border-green-100",
  converted: "bg-emerald-50 text-emerald-700 border-emerald-100",
  archived: "bg-neutral-50 text-neutral-500 border-neutral-100",
}

function formatRelative(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m`
  if (hrs < 24) return `${hrs}h`
  if (days < 7) return `${days}d`
  return d.toLocaleDateString()
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0]
}

export function LeadsView({
  leads,
  view,
  searchQuery,
  onViewChange,
  onSearchChange,
  onRefresh,
  onOpenLead,
  onCreateLead,
}: LeadsViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Counts for chip badges (computed from full set so they're stable across views)
  const counts = useMemo(() => {
    const today = todayIso()
    return {
      priority: leads.filter(
        (l) => l.priority === "high" && (l.status === "new" || l.status === "ready"),
      ).length,
      followup: leads.filter(
        (l) => l.status === "contacted" && l.next_followup_date && l.next_followup_date.split("T")[0] <= today,
      ).length,
      all: leads.filter((l) => l.status !== "archived").length,
    }
  }, [leads])

  // Apply view filter, then search filter
  const filtered = useMemo(() => {
    const today = todayIso()
    let pool: Lead[]
    if (view === "priority") {
      pool = leads
        .filter((l) => l.priority === "high" && (l.status === "new" || l.status === "ready"))
        .sort((a, b) => b.score - a.score)
    } else if (view === "followup") {
      pool = leads
        .filter(
          (l) =>
            l.status === "contacted" &&
            l.next_followup_date &&
            l.next_followup_date.split("T")[0] <= today,
        )
        .sort((a, b) => (a.next_followup_date ?? "").localeCompare(b.next_followup_date ?? ""))
    } else {
      pool = leads
        .filter((l) => l.status !== "archived")
        .sort((a, b) => b.score - a.score)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      pool = pool.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.industry?.toLowerCase().includes(q) ?? false) ||
          (l.location?.toLowerCase().includes(q) ?? false) ||
          (l.tags?.some((t) => t.toLowerCase().includes(q)) ?? false),
      )
    }
    return pool
  }, [leads, view, searchQuery])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  const totalScoreSum = filtered.reduce((sum, l) => sum + l.score, 0)
  const avgScore = filtered.length > 0 ? Math.round(totalScoreSum / filtered.length) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Leads
          </h2>
          <p className="text-[13px] text-neutral-500 mt-1">
            Sourced, scored, and waiting to be worked. Convert to clients when qualified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onCreateLead}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Add lead
          </button>
        </div>
      </div>

      {/* Sub-view chips */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ViewChip
          active={view === "priority"}
          onClick={() => onViewChange("priority")}
          icon={Flag}
          label="Priority queue"
          count={counts.priority}
        />
        <ViewChip
          active={view === "followup"}
          onClick={() => onViewChange("followup")}
          icon={Clock}
          label="Follow-ups due"
          count={counts.followup}
          urgent={counts.followup > 0}
        />
        <ViewChip
          active={view === "all"}
          onClick={() => onViewChange("all")}
          icon={Inbox}
          label="All leads"
          count={counts.all}
        />
      </div>

      {/* Search row */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 mb-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
          <input
            type="text"
            placeholder="Search by name, company, email, industry, location, tag…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 text-[13px]"
          />
        </div>
      </div>

      {/* Summary line */}
      <div className="flex items-center gap-3 text-[12px] text-neutral-500 mb-3">
        <span>
          <strong className="text-neutral-900 font-semibold">{filtered.length.toLocaleString()}</strong>{" "}
          {filtered.length === 1 ? "lead" : "leads"}
        </span>
        {filtered.length > 0 && (
          <span>
            avg score <strong className="text-neutral-900 font-semibold tabular-nums">{avgScore}</strong>
          </span>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState view={view} hasQuery={!!searchQuery.trim()} onClear={() => onSearchChange("")} onCreate={onCreateLead} />
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[80px_1fr_140px_140px_120px_80px] gap-3 px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            <div>Score</div>
            <div>Lead</div>
            <div>Status</div>
            <div>Source / Platform</div>
            <div>Follow-up</div>
            <div className="text-right">Updated</div>
          </div>
          <div className="divide-y divide-neutral-100">
            {filtered.map((lead) => (
              <LeadRow key={lead.id} lead={lead} onClick={() => onOpenLead(lead)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────── sub-components ───────────

function ViewChip({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  urgent,
}: {
  active: boolean
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  urgent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span
        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full ${
          active
            ? "bg-white/20 text-white"
            : urgent
              ? "bg-red-100 text-red-700"
              : "bg-neutral-100 text-neutral-600"
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function LeadRow({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const priorityClass = PRIORITY_BADGE[lead.priority] || PRIORITY_BADGE.low
  const statusClass = STATUS_PILL[lead.status] || STATUS_PILL.new
  const today = todayIso()
  const followupOverdue =
    lead.next_followup_date && lead.next_followup_date.split("T")[0] < today

  return (
    <button
      onClick={onClick}
      className="w-full text-left grid grid-cols-1 md:grid-cols-[80px_1fr_140px_140px_120px_80px] gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors items-center"
    >
      {/* Score */}
      <div className="flex items-center gap-1.5">
        <span
          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-bold tabular-nums ${priorityClass}`}
        >
          {lead.score}
        </span>
      </div>

      {/* Lead identity */}
      <div className="min-w-0">
        <div className="font-semibold text-[13px] text-neutral-900 truncate">{lead.name || lead.email}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5 truncate">
          <Building2 className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.company || "(no company)"}</span>
          {lead.title && <span className="text-neutral-300">·</span>}
          {lead.title && <span className="truncate">{lead.title}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-0.5">
          <Mail className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.email}</span>
          {lead.phone && (
            <>
              <Phone className="w-3 h-3 shrink-0 ml-2" />
              <span className="truncate">{lead.phone}</span>
            </>
          )}
        </div>
      </div>

      {/* Status pill */}
      <div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusClass}`}>
          {lead.status}
        </span>
      </div>

      {/* Source + platform */}
      <div className="text-[11px] text-neutral-600">
        <div className="capitalize">{lead.source}</div>
        {lead.platform && <div className="text-neutral-400">{lead.platform}</div>}
      </div>

      {/* Follow-up */}
      <div className="flex items-center gap-1.5 text-[11px]">
        {lead.next_followup_date ? (
          <>
            <Calendar className={`w-3 h-3 ${followupOverdue ? "text-red-500" : "text-neutral-400"}`} />
            <span className={followupOverdue ? "text-red-600 font-medium" : "text-neutral-600"}>
              {lead.next_followup_date.split("T")[0]}
            </span>
          </>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </div>

      {/* Updated */}
      <div className="text-right text-[11px] text-neutral-400 tabular-nums">
        {formatRelative(lead.updated_at)}
      </div>
    </button>
  )
}

function EmptyState({
  view,
  hasQuery,
  onClear,
  onCreate,
}: {
  view: LeadView
  hasQuery: boolean
  onClear: () => void
  onCreate: () => void
}) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-xl border border-neutral-200">
        <Search className="w-8 h-8 text-neutral-300 mb-3" />
        <p className="text-sm font-medium text-neutral-700">No leads match your search</p>
        <button onClick={onClear} className="mt-3 text-[13px] text-neutral-600 hover:text-neutral-900 underline">
          Clear search
        </button>
      </div>
    )
  }
  const config = {
    priority: {
      icon: Flag,
      title: "No high-priority leads right now",
      hint: "Leads with score ≥ 65 in status New or Ready will appear here.",
    },
    followup: {
      icon: AlertCircle,
      title: "No follow-ups due",
      hint: "Contacted leads with a follow-up date on or before today will appear here.",
    },
    all: {
      icon: Inbox,
      title: "No leads yet",
      hint: "Capture leads from public forms, the newsletter, or add manually.",
    },
  }[view]
  const Icon = config.icon
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-xl border border-neutral-200">
      <Icon className="w-8 h-8 text-neutral-300 mb-3" />
      <p className="text-sm font-medium text-neutral-700">{config.title}</p>
      <p className="text-[12px] text-neutral-500 mt-1 max-w-md">{config.hint}</p>
      {view === "all" && (
        <button
          onClick={onCreate}
          className="mt-4 flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800"
        >
          <Plus className="w-3.5 h-3.5" />
          Add first lead
        </button>
      )}
    </div>
  )
}
