"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
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
  Target,
  X,
  Archive,
  ArrowUpDown,
  Loader2,
} from "lucide-react"
import type { Lead, LeadPriority, LeadStatus } from "@/types/crm-types"
import { HowItWorks } from "@/components/admin/HowItWorks"
import { useSelection } from "@/components/admin/SubmissionStateUI"
import { Dropdown } from "@/components/crm/Dropdown"
import { TEAM_MEMBERS } from "@/components/crm/types"

type LeadView = "priority" | "all" | "followup"
type LeadSort = "score" | "recent" | "contacted" | "company"
type AssignedFilter = "all" | "mine" | "unassigned"

interface LeadsViewProps {
  leads: Lead[]
  view: LeadView
  searchQuery: string
  onViewChange: (v: LeadView) => void
  onSearchChange: (q: string) => void
  onRefresh: () => void
  onOpenLead: (lead: Lead) => void
  onCreateLead: () => void
  /** Bulk-patch selected leads (status / assigned_to / addTags). Returns count saved. */
  onBulkUpdate?: (
    ids: string[],
    patch: { status?: LeadStatus; assigned_to?: string; addTags?: string[] },
  ) => Promise<number>
  /** Current admin's name, for the "Assigned to me" filter. */
  currentUserName?: string
}

const PRIORITY_BADGE: Record<LeadPriority, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-neutral-200 text-neutral-700",
}

const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-blue-500",
  ready: "bg-sky-500",
  contacted: "bg-amber-500",
  engaged: "bg-green-500",
  converted: "bg-emerald-500",
  archived: "bg-neutral-400",
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
  onBulkUpdate,
  currentUserName,
}: LeadsViewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sort, setSort] = useState<LeadSort>("score")
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>("all")
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()
  // Partner-shared rosters live in `partner_list_members` (audience-side) and
  // never appear in the leads collection by default. Promotion to lead is an
  // explicit step from /admin/audiences > Lists, at which point a Lead record
  // is created. No filtering needed here — leads are always active work.

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
      // Strictly past-due (yesterday or earlier) — the urgent subset.
      overdue: leads.filter(
        (l) => l.status === "contacted" && l.next_followup_date && l.next_followup_date.split("T")[0] < today,
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
    // Ownership filter
    if (assignedFilter === "unassigned") {
      pool = pool.filter((l) => !l.assigned_to)
    } else if (assignedFilter === "mine" && currentUserName) {
      pool = pool.filter((l) => l.assigned_to === currentUserName)
    }
    // Explicit sort overrides the view's default ordering.
    const sorted = [...pool]
    if (sort === "score") sorted.sort((a, b) => b.score - a.score)
    else if (sort === "recent") sorted.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    else if (sort === "contacted") sorted.sort((a, b) => (b.last_contacted_at ?? "").localeCompare(a.last_contacted_at ?? ""))
    else if (sort === "company") sorted.sort((a, b) => a.company.localeCompare(b.company))
    return sorted
  }, [leads, view, searchQuery, assignedFilter, currentUserName, sort])

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
          {/* Stage 4 — discovery entry point for the prospecting feature.
              Routes to /admin/leads/prospect where reps can run NL ICP queries
              against Apollo. Approval lands those candidates back into this
              queue with source="prospected" (Stage 5). */}
          <Link
            href="/admin/leads/prospect"
            className="flex items-center gap-1.5 px-3 py-2 text-neutral-700 bg-white border border-neutral-200 text-[13px] font-medium rounded-lg hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            Find prospects
          </Link>
          <button
            onClick={onCreateLead}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            Add lead
          </button>
        </div>
      </div>

      {/* How it works — dismissible first-run intro; connects to the sibling
          pipeline surfaces leads arrive from. */}
      <HowItWorks
        className="mb-4"
        storageKey="leadsIntroDismissed"
        steps={[
          { title: "Leads arrive here", detail: "From Audiences (promoted), the Inbox (converted), and prospecting." },
          { title: "Scored & prioritized", detail: "A 0–100 fit score ranks each lead — work the Priority queue first." },
          { title: "Convert to a Client", detail: "Once qualified, convert the lead into a client in the CRM." },
        ]}
      />

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

      {/* Search — flush, no card chrome (matches the Audiences/Inbox surfaces). */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, company, email, industry, location, tag…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 text-[13px] font-normal text-neutral-700 placeholder:text-neutral-400"
        />
      </div>

      {/* Summary line */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 text-[12px] text-neutral-500">
          <span>
            <strong className="text-neutral-900 font-semibold">{filtered.length.toLocaleString()}</strong>{" "}
            {filtered.length === 1 ? "lead" : "leads"}
          </span>
          {filtered.length > 0 && (
            <span
              title="Fit score (0–100): how well a lead matches the ideal-customer profile. Higher = stronger fit. The colored badge shows priority — red = high, amber = medium."
              className="cursor-help underline decoration-dotted decoration-neutral-300 underline-offset-2"
            >
              avg score <strong className="text-neutral-900 font-semibold tabular-nums">{avgScore}</strong>
            </span>
          )}
          {counts.overdue > 0 && (
            <button
              type="button"
              onClick={() => onViewChange("followup")}
              title="Jump to follow-ups due"
              className="inline-flex items-center gap-1 rounded-full bg-red-50 ring-1 ring-red-200 px-2 py-0.5 text-red-700 hover:bg-red-100 transition-colors"
            >
              <strong className="font-semibold tabular-nums">{counts.overdue}</strong> overdue
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Ownership filter — custom dropdown to match the app's idiom. */}
          <Dropdown
            ariaLabel="Filter by owner"
            value={assignedFilter}
            onChange={(v) => setAssignedFilter(v as AssignedFilter)}
            options={[
              { value: "all", label: "All owners" },
              ...(currentUserName ? [{ value: "mine", label: "Assigned to me" }] : []),
              { value: "unassigned", label: "Unassigned" },
            ]}
          />
          {/* Sort */}
          <Dropdown
            ariaLabel="Sort leads"
            label="Sort"
            icon={<ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />}
            value={sort}
            onChange={(v) => setSort(v as LeadSort)}
            options={[
              { value: "score", label: "Score" },
              { value: "recent", label: "Recently updated" },
              { value: "contacted", label: "Last contacted" },
              { value: "company", label: "Company" },
            ]}
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <EmptyState view={view} hasQuery={!!searchQuery.trim()} onClear={() => onSearchChange("")} onCreate={onCreateLead} />
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="hidden md:grid grid-cols-[36px_80px_1fr_140px_140px_120px_80px] gap-3 px-4 py-2 bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
            {onBulkUpdate ? (
              <input
                type="checkbox"
                aria-label="Select all"
                checked={filtered.length > 0 && filtered.every((l) => selected.has(l.id))}
                onChange={(e) => (e.target.checked ? setSelected(filtered.map((l) => l.id)) : clearSelected())}
                className="rounded border-neutral-300 self-center"
              />
            ) : (
              <div />
            )}
            <div
              title="Fit score (0–100): how well a lead matches the ideal-customer profile. Higher = stronger fit. Badge color = priority (red high, amber medium)."
              className="cursor-help"
            >
              Score
            </div>
            <div>Lead</div>
            <div>Status</div>
            <div>Source / Platform</div>
            <div>Follow-up</div>
            <div className="text-right">Updated</div>
          </div>
          <div className="divide-y divide-neutral-100">
            {filtered.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onClick={() => onOpenLead(lead)}
                selectable={!!onBulkUpdate}
                selected={selected.has(lead.id)}
                onToggleSelect={() => toggleSelect(lead.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating bulk-action bar — appears when leads are selected */}
      {onBulkUpdate && selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onClear={clearSelected}
          onApply={async (patch) => {
            await onBulkUpdate(Array.from(selected), patch)
            clearSelected()
          }}
        />
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
        className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-semibold rounded-full ${
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

function LeadRow({
  lead,
  onClick,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  lead: Lead
  onClick: () => void
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const priorityClass = PRIORITY_BADGE[lead.priority] || PRIORITY_BADGE.low
  const statusDot = STATUS_DOT[lead.status] || STATUS_DOT.new
  const today = todayIso()
  const followupOverdue =
    lead.next_followup_date && lead.next_followup_date.split("T")[0] < today

  return (
    <div
      className={`group relative grid grid-cols-1 md:grid-cols-[36px_60px_1fr_140px_140px_120px_80px] gap-3 px-4 py-2 transition-colors items-center ${
        selected ? "bg-neutral-50" : "hover:bg-neutral-50"
      }`}
    >
      {/* Select checkbox — its own cell; not inside the open-button so it
          doesn't open the drawer when toggled. */}
      {selectable ? (
        <input
          type="checkbox"
          aria-label={`Select ${lead.name || lead.email}`}
          checked={selected}
          onChange={onToggleSelect}
          className="rounded border-neutral-300 justify-self-center hidden md:block"
        />
      ) : (
        <div className="hidden md:block" />
      )}

      {/* Whole-row open trigger overlays the data cells (below the checkbox).
          Data cells use pointer-events-none so clicks fall through to this. */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Open ${lead.name || lead.email}`}
        className="absolute inset-0 md:left-9 cursor-pointer"
      />

      {/* Score */}
      <div className="flex items-center gap-1.5 relative pointer-events-none">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-sm text-[12px] font-semibold tabular-nums ${priorityClass}`}
        >
          {lead.score}
        </span>
      </div>

      {/* Lead identity */}
      <div className="min-w-0 relative pointer-events-none">
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

      {/* Status — Linear-style dot + neutral label */}
      <div className="relative pointer-events-none">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-neutral-700 capitalize">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} aria-hidden="true" />
          {lead.status}
        </span>
      </div>

      {/* Source + platform */}
      <div className="text-[11px] text-neutral-600 relative pointer-events-none">
        <div className="capitalize">{lead.source}</div>
        {lead.platform && <div className="text-neutral-400">{lead.platform}</div>}
      </div>

      {/* Follow-up */}
      <div className="flex items-center gap-1.5 text-[11px] relative pointer-events-none">
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
      <div className="text-right text-[11px] text-neutral-400 tabular-nums relative pointer-events-none">
        {formatRelative(lead.updated_at)}
      </div>
    </div>
  )
}

// Floating bulk-action bar — Vercel/Linear pattern: a pill that slides up from
// the bottom while rows are selected. Set status, assign (TEAM_MEMBERS), or
// archive the selection in one action.
function BulkBar({
  count,
  onClear,
  onApply,
}: {
  count: number
  onClear: () => void
  onApply: (patch: { status?: LeadStatus; assigned_to?: string; addTags?: string[] }) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const apply = async (patch: { status?: LeadStatus; assigned_to?: string }) => {
    setBusy(true)
    try {
      await onApply(patch)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-neutral-900 text-white shadow-2xl px-3 py-2 max-w-[calc(100vw-1.5rem)] flex-wrap">
      <span className="text-[12px] font-medium tabular-nums pl-1">{count} selected</span>
      <div className="h-4 w-px bg-neutral-700 mx-0.5" />

      {/* Set status */}
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value as LeadStatus | ""
          if (v) apply({ status: v })
          e.target.value = ""
        }}
        aria-label="Set status"
        className="h-7 px-2 text-[12px] bg-neutral-800 text-neutral-100 rounded-md focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled>Set status…</option>
        {(["new", "ready", "contacted", "engaged", "converted", "archived"] as LeadStatus[]).map((s) => (
          <option key={s} value={s} className="capitalize">{s}</option>
        ))}
      </select>

      {/* Assign */}
      <select
        defaultValue=""
        disabled={busy}
        onChange={(e) => {
          const v = e.target.value
          if (v) apply({ assigned_to: v })
          e.target.value = ""
        }}
        aria-label="Assign to"
        className="h-7 px-2 text-[12px] bg-neutral-800 text-neutral-100 rounded-md focus:outline-none disabled:opacity-50"
      >
        <option value="" disabled>Assign to…</option>
        {TEAM_MEMBERS.map((m) => (
          <option key={m.email} value={m.name}>{m.name}</option>
        ))}
      </select>

      {/* Archive shortcut */}
      <button
        type="button"
        disabled={busy}
        onClick={() => apply({ status: "archived" })}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-medium text-neutral-100 hover:bg-neutral-700 rounded-md disabled:opacity-50"
      >
        <Archive className="w-3.5 h-3.5" />
        Archive
      </button>

      <div className="h-4 w-px bg-neutral-700 mx-0.5" />
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="grid place-items-center h-7 w-7 rounded-md text-neutral-300 hover:bg-neutral-700 hover:text-white"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
      </button>
    </div>
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
