"use client"

import { useRef, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Calendar,
  Check,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Ticket,
} from "lucide-react"
import { LeadCrossLink, useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import { TagList } from "@/components/admin/Tag"
import { parseTag } from "@/lib/tag-taxonomy"
import {
  StateBadge,
  getStateOrNew,
  type SubmissionState,
  type SubmissionSource,
} from "@/components/admin/SubmissionStateUI"

// ── Types ──

export interface EventRegistrationRow {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  pageUrl: string
}

export type SortColumn = "name" | "email" | "company" | "event" | "registeredAt"
export type SortDirection = "asc" | "desc"

export interface SortState {
  column: SortColumn
  direction: SortDirection
}

interface Props {
  rows: EventRegistrationRow[]
  // Sort
  sort: SortState
  onSortChange: (next: SortState) => void
  // Selection
  selected: Set<string>
  onToggleSelect: (id: string) => void
  // Submission states
  source: SubmissionSource
  states: Map<string, SubmissionState>
  onLocalState: (id: string, state: SubmissionState) => void
  // Cross-system map for the inline lead cross-link icon. Mailchimp pill
  // lives in the detail drawer, not the row, to keep the name column readable.
  leadsByEmail: ReturnType<typeof useLeadsByEmail>
  // Row actions
  onSelectRow: (row: EventRegistrationRow) => void
  onDelete: (id: string, email: string) => void
  isDeleting: string | null
  // Empty state
  searchQuery: string
}

// Approximate row height in px. Used as the initial estimate for the
// virtualizer; measured rows replace this once mounted, so this is just a
// scrollbar-position seed.
const ROW_HEIGHT_PX = 44

// Grid template — header + body share the same template so columns line up.
// At lg: 7 columns (name, email, company, event, registered, feed, actions).
// At md: 5 columns — company + feed are display:none, so the grid drops them.
// Using arbitrary Tailwind values rather than inline `style` so the template
// reacts to viewport resize via media queries.
const GRID_COLS =
  "grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.4fr)_minmax(220px,1.8fr)_110px_90px] " +
  "lg:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.2fr)_minmax(120px,1fr)_minmax(220px,1.6fr)_110px_60px_90px]"

export function EventRegistrationsTable({
  rows,
  sort,
  onSortChange,
  selected,
  onToggleSelect,
  source,
  states,
  onLocalState,
  leadsByEmail,
  onSelectRow,
  onDelete,
  isDeleting,
  searchQuery,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
  })

  const virtualRows = virtualizer.getVirtualItems()
  const totalHeight = virtualizer.getTotalSize()

  // Pre-compute formatted dates so the row render loop stays cheap. Memo keyed
  // on rows identity so re-sorting doesn't reformat unchanged values.
  const dateLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.registeredAt && !map.has(r.registeredAt)) {
        try {
          map.set(
            r.registeredAt,
            new Date(r.registeredAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          )
        } catch {
          map.set(r.registeredAt, "—")
        }
      }
    }
    return map
  }, [rows])

  return (
    <div
      ref={scrollRef}
      className="hidden md:block overflow-y-auto overflow-x-auto max-h-[65vh] relative"
    >
      {/* Header — sticky, grid layout matches body rows */}
      <div
        className={`sticky top-0 z-10 grid bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest ${GRID_COLS}`}
      >
        <SortHeader column="name" label="Name" sort={sort} onSortChange={onSortChange} />
        <SortHeader column="email" label="Email" sort={sort} onSortChange={onSortChange} />
        <SortHeader
          column="company"
          label="Company"
          sort={sort}
          onSortChange={onSortChange}
          className="hidden lg:flex"
        />
        <SortHeader column="event" label="Event" sort={sort} onSortChange={onSortChange} />
        <SortHeader
          column="registeredAt"
          label={
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Registered
            </span>
          }
          sort={sort}
          onSortChange={onSortChange}
        />
        <div className="px-5 py-3 hidden lg:flex items-center justify-center">Feed</div>
        <div className="px-5 py-3 flex items-center justify-end">Actions</div>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-neutral-400">
          <Ticket className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-500">No registrations found</p>
          {searchQuery && (
            <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
          )}
        </div>
      ) : (
        <div
          className="relative"
          style={{ height: totalHeight }}
        >
          {virtualRows.map((vr) => {
            const reg = rows[vr.index]
            // Filter event-context tags worth surfacing inline. site:/event:
            // are redundant with the event pill; keep role:/intent:/quality:.
            const inlineTags = (reg.tags ?? []).filter((t) => {
              const ns = parseTag(t).namespace
              return ns === "role" || ns === "intent" || ns === "quality"
            })
            const formattedDate = reg.registeredAt
              ? dateLookup.get(reg.registeredAt) ?? "—"
              : "N/A"

            return (
              <div
                key={reg.id}
                ref={virtualizer.measureElement}
                data-index={vr.index}
                onClick={() => onSelectRow(reg)}
                className={`absolute left-0 right-0 grid border-b border-neutral-100 bg-white hover:bg-neutral-50 transition-colors cursor-pointer ${GRID_COLS}`}
                style={{ transform: `translateY(${vr.start}px)` }}
              >
                {/* Name */}
                <div className="px-5 py-2.5 flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected.has(reg.id)}
                    onChange={() => onToggleSelect(reg.id)}
                    className="rounded border-neutral-300 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${reg.firstName} ${reg.lastName}`}
                  />
                  <span className="text-neutral-900 text-[13px] font-semibold leading-snug truncate">
                    {reg.firstName} {reg.lastName}
                  </span>
                  <LeadCrossLink email={reg.email} mapping={leadsByEmail} />
                </div>
                {/* Email */}
                <div className="px-5 py-2.5 flex items-center min-w-0">
                  <a
                    href={`mailto:${reg.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-neutral-500 text-[13px] font-normal leading-snug truncate hover:text-neutral-900 hover:underline"
                  >
                    {reg.email}
                  </a>
                </div>
                {/* Company */}
                <div className="px-5 py-2.5 hidden lg:flex items-center min-w-0">
                  <span className="text-neutral-500 text-[13px] font-normal leading-snug truncate">
                    {reg.company || "—"}
                  </span>
                </div>
                {/* Event */}
                <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap min-w-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium bg-neutral-100 text-neutral-700 tracking-wide whitespace-nowrap">
                    {reg.eventName}
                  </span>
                  {inlineTags.length > 0 && <TagList tags={inlineTags} max={3} />}
                  <StateBadge
                    source={source}
                    id={reg.id}
                    state={getStateOrNew(states, reg.id)}
                    onChange={(s) => onLocalState(reg.id, s)}
                  />
                </div>
                {/* Registered */}
                <div className="px-5 py-2.5 flex items-center text-neutral-400 text-[13px] font-normal whitespace-nowrap tabular-nums">
                  {formattedDate}
                </div>
                {/* Feed */}
                <div className="px-5 py-2.5 hidden lg:flex items-center justify-center">
                  {reg.subscribeToFeed ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </div>
                {/* Actions — always visible (low opacity), per Sprint 2 spec */}
                <div className="px-5 py-2.5 flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(reg.id, reg.email)
                    }}
                    disabled={isDeleting === reg.id}
                    className="p-1.5 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                    title={`Delete ${reg.email}`}
                  >
                    {isDeleting === reg.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Sortable column header ──

function SortHeader({
  column,
  label,
  sort,
  onSortChange,
  className = "",
}: {
  column: SortColumn
  label: React.ReactNode
  sort: SortState
  onSortChange: (next: SortState) => void
  className?: string
}) {
  const isActive = sort.column === column
  const Icon = isActive ? (sort.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={() =>
        onSortChange({
          column,
          // Toggle direction on the same column; new column starts ascending
          // for text/date except registeredAt which makes more sense desc-first.
          direction: isActive
            ? sort.direction === "asc" ? "desc" : "asc"
            : column === "registeredAt"
              ? "desc"
              : "asc",
        })
      }
      className={`group px-5 py-3 flex items-center gap-1 text-left hover:text-neutral-700 transition-colors ${
        isActive ? "text-neutral-700" : ""
      } ${className}`}
    >
      <span>{label}</span>
      <Icon
        className={`w-3 h-3 ${
          isActive ? "text-neutral-700" : "text-neutral-300 group-hover:text-neutral-400"
        }`}
      />
    </button>
  )
}

// ── Comparator (exported so the parent can sort before passing rows) ──

export function compareRows(a: EventRegistrationRow, b: EventRegistrationRow, sort: SortState): number {
  let cmp = 0
  switch (sort.column) {
    case "name":
      cmp = (`${a.firstName} ${a.lastName}`.trim() || a.email).localeCompare(
        `${b.firstName} ${b.lastName}`.trim() || b.email,
      )
      break
    case "email":
      cmp = a.email.localeCompare(b.email)
      break
    case "company":
      cmp = (a.company || "").localeCompare(b.company || "")
      break
    case "event":
      cmp = a.eventName.localeCompare(b.eventName)
      break
    case "registeredAt": {
      const aTs = a.registeredAt ? new Date(a.registeredAt).getTime() : 0
      const bTs = b.registeredAt ? new Date(b.registeredAt).getTime() : 0
      cmp = aTs - bTs
      break
    }
  }
  return sort.direction === "asc" ? cmp : -cmp
}
