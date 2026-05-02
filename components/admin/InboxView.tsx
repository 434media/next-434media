"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import Link from "next/link"
import {
  Inbox,
  Mail,
  MessageSquare,
  Ticket,
  Search,
  Loader2,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  ArrowUpRight,
  Calendar,
  Building2,
  Phone,
  Globe,
  Eye as EyeIcon,
  MessageSquare as MsgIcon,
  Archive as ArchiveIcon,
  Mail as MailIcon,
  UserPlus as UserPlusIcon,
  Ban as BanIcon,
} from "lucide-react"
import {
  StateBadge,
  StateFilterChips,
  BulkActionBar,
  useSelection,
  type SubmissionState,
  type SubmissionSource,
} from "@/components/admin/SubmissionStateUI"
import { MailchimpPushModal, type PushMember } from "@/components/admin/MailchimpPushModal"

interface InboxRow {
  rowKey: string
  source: SubmissionSource
  id: string
  email: string
  name?: string
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  message?: string
  sourceSite: string
  eventName?: string
  eventDate?: string
  pageUrl?: string
  createdAt: string
  state: SubmissionState
  crmLeadId?: string
  mailchimpSubscribed: boolean
}

interface InboxStats {
  total: number
  bySource: Record<SubmissionSource, number>
  byState: Record<SubmissionState, number>
  inCrm: number
  inMailchimp: number
}

interface InboxResponse {
  ok: boolean
  rows: InboxRow[]
  stats: InboxStats
  mailchimpAvailable: boolean
}

type SourceFilter = "all" | SubmissionSource

const SOURCE_META: Record<
  SubmissionSource,
  { label: string; icon: typeof Mail; pill: string }
> = {
  email_signups: {
    label: "Newsletter",
    icon: Mail,
    pill: "bg-blue-50 text-blue-700 border-blue-100",
  },
  contact_forms: {
    label: "Form",
    icon: MessageSquare,
    pill: "bg-violet-50 text-violet-700 border-violet-100",
  },
  event_registrations: {
    label: "Event",
    icon: Ticket,
    pill: "bg-amber-50 text-amber-700 border-amber-100",
  },
}

function formatRelative(iso: string): string {
  if (!iso) return ""
  try {
    const d = new Date(iso).getTime()
    const diff = Date.now() - d
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

interface InboxViewProps {
  setToast: (t: { message: string; type: "success" | "error" } | null) => void
  initialSearch?: string
}

/**
 * Unified inbox — single list across all 3 submission collections with source
 * chips, state chips, and a unified bulk action bar that fans out per-source
 * to the existing batch endpoints. Default landing tab on /admin/leads.
 *
 * Each row is independent of the others; selection works across sources. The
 * bulk bar buckets the selected rows by source on submit.
 */
export function InboxView({ setToast, initialSearch = "" }: InboxViewProps) {
  const [data, setData] = useState<InboxResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [stateFilter, setStateFilter] = useState<"all" | SubmissionState>("all")
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [showPushModal, setShowPushModal] = useState(false)
  // Local per-row state overrides so bulk actions feel instant before the
  // server round-trip completes.
  const [localStates, setLocalStates] = useState<Record<string, SubmissionState>>({})

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/admin/submissions/inbox", { cache: "no-store" })
      if (!res.ok) {
        setData(null)
        return
      }
      const json = (await res.json()) as InboxResponse
      setData(json)
      setLocalStates({})
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const allRows = data?.rows ?? []
  const stats = data?.stats
  const mcAvailable = data?.mailchimpAvailable ?? false

  // Resolve effective state with local override
  const effectiveState = useCallback(
    (row: InboxRow): SubmissionState => localStates[row.rowKey] ?? row.state,
    [localStates],
  )

  // Filter pipeline: source → state → search
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allRows.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false
      if (stateFilter !== "all" && effectiveState(r) !== stateFilter) return false
      if (!q) return true
      const haystack = [
        r.email,
        r.name,
        r.company,
        r.sourceSite,
        r.eventName,
        r.message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [allRows, sourceFilter, stateFilter, searchQuery, effectiveState])

  // Counts for state chips — computed against the source-filtered subset so
  // the counts reflect "what you'd see if you cleared the state filter"
  const stateCounts = useMemo(() => {
    const subset = sourceFilter === "all" ? allRows : allRows.filter((r) => r.source === sourceFilter)
    const counts: Partial<Record<"all" | SubmissionState, number>> = {
      all: subset.length,
      new: 0,
      triaged: 0,
      replied: 0,
      archived: 0,
      spam: 0,
    }
    for (const r of subset) {
      const st = effectiveState(r)
      counts[st] = (counts[st] ?? 0) + 1
    }
    return counts
  }, [allRows, sourceFilter, effectiveState])

  // Visible row keys for select-all
  const visibleKeys = useMemo(() => filtered.map((r) => r.rowKey), [filtered])
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => selected.has(k))
  const toggleAll = () => {
    if (allVisibleSelected) clearSelected()
    else setSelected(visibleKeys)
  }

  // ── Bulk handlers ──

  // Project selected row keys back to the rows themselves
  const selectedRows = useMemo(() => allRows.filter((r) => selected.has(r.rowKey)), [allRows, selected])

  // Bucket selected rows by source for source-aware fanout
  const bucketBySource = useCallback(
    (rows: InboxRow[]): Record<SubmissionSource, InboxRow[]> => {
      const buckets: Record<SubmissionSource, InboxRow[]> = {
        email_signups: [],
        contact_forms: [],
        event_registrations: [],
      }
      for (const r of rows) buckets[r.source].push(r)
      return buckets
    },
    [],
  )

  const runBulkState = async (target: SubmissionState) => {
    if (selectedRows.length === 0) return
    const updates = selectedRows.map((r) => ({ source: r.source, id: r.id, state: target }))
    try {
      const res = await fetch("/api/admin/submissions/states/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        setToast({ message: "Bulk update failed", type: "error" })
        return
      }
      // Optimistic local override — keeps the rows visible if their state
      // matches the active filter, hides them if it doesn't, without a refetch.
      setLocalStates((prev) => {
        const next = { ...prev }
        for (const r of selectedRows) next[r.rowKey] = target
        return next
      })
      setToast({
        message: `${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"} marked ${target}`,
        type: "success",
      })
      clearSelected()
    } catch {
      setToast({ message: "Bulk update failed", type: "error" })
    }
  }

  const runConvert = async () => {
    if (selectedRows.length === 0) return
    const buckets = bucketBySource(selectedRows)
    let totalCreated = 0
    let totalUpdated = 0
    let totalFailed = 0
    try {
      for (const source of Object.keys(buckets) as SubmissionSource[]) {
        const rows = buckets[source]
        if (rows.length === 0) continue
        const items = rows.map((r) => ({
          id: r.id,
          email: r.email,
          firstName: r.firstName,
          lastName: r.lastName,
          company: r.company,
          phone: r.phone,
          message: r.message,
          sourceSite: r.sourceSite,
          eventName: r.eventName,
          eventDate: r.eventDate,
        }))
        const res = await fetch("/api/admin/submissions/bulk-convert-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, items }),
        })
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.ok) {
          totalFailed += rows.length
          continue
        }
        totalCreated += body.result.created
        totalUpdated += body.result.updated
        totalFailed += body.result.failed
      }
      setToast({
        message: `Converted: ${totalCreated} new, ${totalUpdated} updated${totalFailed > 0 ? `, ${totalFailed} failed` : ""}`,
        type: totalFailed === 0 ? "success" : "error",
      })
      if (totalFailed === 0) {
        clearSelected()
        // Refresh so CRM cross-link pills update on the rows
        load()
      }
    } catch {
      setToast({ message: "Convert failed", type: "error" })
    }
  }

  // Default tag for the Mailchimp push — uses the dominant source in the selection
  const dominantSourceTag = useMemo(() => {
    if (selectedRows.length === 0) return undefined
    const buckets = bucketBySource(selectedRows)
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
    if (buckets.event_registrations.length > 0) {
      const firstEvent = buckets.event_registrations[0].sourceSite
      return `event-${firstEvent.toLowerCase().replace(/\s+/g, "-")}`
    }
    if (buckets.contact_forms.length >= buckets.email_signups.length) {
      return `from-contact-form-${ym}`
    }
    return `from-newsletter-${ym}`
  }, [selectedRows, bucketBySource])

  return (
    <div>
      {/* Header strip with stats + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight flex items-center gap-2">
            <Inbox className="w-4 h-4 text-neutral-400" />
            Inbox
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Every new submission across newsletter signups, contact forms, and event registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-[11px] text-neutral-400">
              {stats.total.toLocaleString()} total · {stats.inCrm} in CRM
              {mcAvailable ? ` · ${stats.inMailchimp} in MC` : ""}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <SourceChip
          label="All sources"
          icon={Inbox}
          isActive={sourceFilter === "all"}
          count={stats?.total}
          onClick={() => setSourceFilter("all")}
        />
        {(Object.keys(SOURCE_META) as SubmissionSource[]).map((src) => {
          const meta = SOURCE_META[src]
          return (
            <SourceChip
              key={src}
              label={meta.label}
              icon={meta.icon}
              isActive={sourceFilter === src}
              count={stats?.bySource[src]}
              onClick={() => setSourceFilter(src)}
            />
          )
        })}
      </div>

      {/* State filter chips */}
      <div className="mb-4">
        <StateFilterChips active={stateFilter} onChange={setStateFilter} counts={stateCounts} />
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-neutral-200 p-3 mb-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
          <input
            type="text"
            placeholder="Search by email, name, company, source, event, or message…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-700"
          />
        </div>
      </div>

      {/* Result strip */}
      <div className="flex items-center justify-between gap-2 text-neutral-500 mb-3">
        <span className="text-[12px]">
          Showing <strong className="text-neutral-900 font-semibold">{filtered.length.toLocaleString()}</strong>
          {sourceFilter !== "all" || stateFilter !== "all" || searchQuery
            ? ` of ${allRows.length.toLocaleString()}`
            : ""}
        </span>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[12px] font-medium text-neutral-600 hover:text-neutral-900"
          >
            {allVisibleSelected ? "Clear selection" : "Select all visible"}
          </button>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {isLoading && allRows.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-neutral-400">
            {allRows.length === 0
              ? "No submissions yet."
              : "Nothing matches the current filters."}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((row) => (
              <InboxRowItem
                key={row.rowKey}
                row={row}
                effectiveState={effectiveState(row)}
                isSelected={selected.has(row.rowKey)}
                isExpanded={expandedKey === row.rowKey}
                onToggleSelect={() => toggleSelect(row.rowKey)}
                onToggleExpand={() =>
                  setExpandedKey((prev) => (prev === row.rowKey ? null : row.rowKey))
                }
                onStateChange={(next) =>
                  setLocalStates((prev) => ({ ...prev, [row.rowKey]: next }))
                }
                mcAvailable={mcAvailable}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelected}
        actions={[
          {
            key: "push-mc",
            label: "Push to Mailchimp",
            icon: MailIcon,
            run: () => setShowPushModal(true),
          },
          {
            key: "convert-crm",
            label: "Convert to CRM",
            icon: UserPlusIcon,
            run: runConvert,
          },
          {
            key: "triage",
            label: "Mark triaged",
            icon: EyeIcon,
            run: () => runBulkState("triaged"),
          },
          {
            key: "reply",
            label: "Mark replied",
            icon: MsgIcon,
            run: () => runBulkState("replied"),
          },
          {
            key: "archive",
            label: "Archive",
            icon: ArchiveIcon,
            destructive: true,
            run: () => runBulkState("archived"),
          },
          {
            key: "spam",
            label: "Mark spam",
            icon: BanIcon,
            destructive: true,
            run: () => runBulkState("spam"),
          },
        ]}
      />

      <MailchimpPushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
        members={selectedRows
          .filter((r) => r.email)
          .map<PushMember>((r) => ({
            email: r.email,
            firstName: r.firstName || undefined,
            lastName: r.lastName || undefined,
          }))}
        defaultTag={dominantSourceTag}
        onComplete={(result) => {
          setToast({
            message: `Pushed: ${result.newMembers} new, ${result.updatedMembers} updated${result.errors.length > 0 ? `, ${result.errors.length} failed` : ""}`,
            type: result.errors.length === 0 ? "success" : "error",
          })
          if (result.errors.length === 0) {
            clearSelected()
            load()
          }
        }}
      />
    </div>
  )
}

// ── Source chip (top filter row) ──

function SourceChip({
  label,
  icon: Icon,
  isActive,
  count,
  onClick,
}: {
  label: string
  icon: typeof Mail
  isActive: boolean
  count: number | undefined
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors ${
        isActive
          ? "bg-neutral-900 text-white border-neutral-900"
          : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
      {typeof count === "number" && (
        <span className={`tabular-nums ${isActive ? "text-white/70" : "text-neutral-400"}`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Per-row item ──

function InboxRowItem({
  row,
  effectiveState,
  isSelected,
  isExpanded,
  onToggleSelect,
  onToggleExpand,
  onStateChange,
  mcAvailable,
}: {
  row: InboxRow
  effectiveState: SubmissionState
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onStateChange: (next: SubmissionState) => void
  mcAvailable: boolean
}) {
  const sourceMeta = SOURCE_META[row.source]
  const SourceIcon = sourceMeta.icon
  const displayName = row.name || row.email

  return (
    <li
      className={`px-3 sm:px-4 py-2.5 transition-colors ${
        isSelected ? "bg-blue-50/40" : "hover:bg-neutral-50/40"
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-3.5 h-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 focus:ring-offset-0 cursor-pointer"
        />

        {/* Source chip */}
        <span
          className={`mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${sourceMeta.pill}`}
        >
          <SourceIcon className="w-2.5 h-2.5" />
          {sourceMeta.label}
        </span>

        {/* Main content (clickable to expand) */}
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-neutral-900 truncate">
              {displayName}
            </span>
            {row.name && (
              <span className="text-[11px] text-neutral-500 truncate">{row.email}</span>
            )}
            {row.company && (
              <span className="text-[11px] text-neutral-400 truncate">· {row.company}</span>
            )}
            {row.crmLeadId && (
              <Link
                href={`/admin/crm?tab=leads&openLead=${encodeURIComponent(row.crmLeadId)}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 shrink-0"
                title="Open lead in CRM"
              >
                CRM
                <ArrowUpRight className="w-2.5 h-2.5" />
              </Link>
            )}
            {mcAvailable && row.mailchimpSubscribed && (
              <span
                title="Subscribed in Mailchimp"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 shrink-0"
              >
                <Mail className="w-2.5 h-2.5" />
                MC
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-500 flex-wrap">
            <span className="font-medium text-neutral-600 truncate">
              {row.source === "event_registrations" ? row.eventName || row.sourceSite : row.sourceSite}
            </span>
            {row.message && (
              <span className="text-neutral-400 truncate max-w-md">— {row.message}</span>
            )}
            <span className="text-neutral-400 shrink-0 ml-auto">{formatRelative(row.createdAt)}</span>
          </div>
        </button>

        {/* State dropdown + expand caret */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StateBadge
            source={row.source}
            id={row.id}
            state={effectiveState}
            onChange={onStateChange}
          />
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            className="p-1 text-neutral-300 hover:text-neutral-700 rounded transition-colors"
          >
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {isExpanded && (
        <div className="mt-3 ml-7 pl-3 border-l-2 border-neutral-100 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
          {row.firstName && (
            <Detail label="First name" value={row.firstName} />
          )}
          {row.lastName && (
            <Detail label="Last name" value={row.lastName} />
          )}
          {row.company && <Detail label="Company" value={row.company} icon={Building2} />}
          {row.phone && <Detail label="Phone" value={row.phone} icon={Phone} />}
          {row.eventName && <Detail label="Event" value={row.eventName} icon={Ticket} />}
          {row.eventDate && (
            <Detail label="Event date" value={new Date(row.eventDate).toLocaleDateString()} icon={Calendar} />
          )}
          {row.pageUrl && (
            <Detail
              label="Page URL"
              value={
                <a
                  href={row.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {row.pageUrl}
                </a>
              }
              icon={Globe}
            />
          )}
          <Detail label="Created" value={new Date(row.createdAt).toLocaleString()} icon={Calendar} />
          {row.message && (
            <div className="col-span-full mt-2 p-3 bg-neutral-50 rounded-lg">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Message
              </div>
              <p className="text-[12px] text-neutral-700 whitespace-pre-wrap">{row.message}</p>
            </div>
          )}
          {row.crmLeadId && (
            <div className="col-span-full mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Already a CRM lead
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  icon?: typeof Mail
}) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 shrink-0 inline-flex items-center gap-1">
        {Icon && <Icon className="w-2.5 h-2.5" />}
        {label}
      </span>
      <span className="text-[12px] text-neutral-700 truncate">{value}</span>
    </div>
  )
}
