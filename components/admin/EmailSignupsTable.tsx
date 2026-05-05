"use client"

import { useRef, useMemo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  Calendar,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Mail,
  Send,
  Layers,
} from "lucide-react"
import { LeadCrossLink, useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import { useMailchimpSubscribers } from "@/components/admin/MailchimpSubscribedPill"
import {
  StateBadge,
  getStateOrNew,
  type SubmissionState,
  type SubmissionSource,
} from "@/components/admin/SubmissionStateUI"

// ── Types ──

export interface EmailSignupRow {
  id: string
  email: string
  source: string
  created_at: string
}

export type SignupSortColumn = "email" | "source" | "created_at"
export type SortDirection = "asc" | "desc"

export interface SignupSortState {
  column: SignupSortColumn
  direction: SortDirection
}

interface Props {
  rows: EmailSignupRow[]
  // Sort
  sort: SignupSortState
  onSortChange: (next: SignupSortState) => void
  // Selection
  selected: Set<string>
  onToggleSelect: (id: string) => void
  // Submission states
  source: SubmissionSource
  states: Map<string, SubmissionState>
  onLocalState: (id: string, state: SubmissionState) => void
  // CRM cross-link map (Mailchimp pill moved to drawer)
  leadsByEmail: ReturnType<typeof useLeadsByEmail>
  // Mailchimp subscriber map — used to decide whether to show the per-row
  // push button. Subscribed rows hide it; unsubscribed rows expose it.
  subscriberMap: ReturnType<typeof useMailchimpSubscribers>
  // Cross-source dupes lookup — lowercased email → Set<source>. When the
  // set has 2+ entries, the row gets a small "+N sources" badge.
  sourcesByEmail: Map<string, Set<string>>
  // Cross-collection signal — lowercased email → counts of contact-form /
  // event-registration rows for the same email. Surfaces upstream dedup
  // candidates that don't show up in the email_signups source set.
  crossCollectionMap: Map<string, { contactForms: number; eventRegistrations: number }>
  // Row actions
  onSelectRow: (row: EmailSignupRow) => void
  onDelete: (id: string, email: string) => void
  onPushOne: (email: string) => void
  isDeleting: string | null
  // Empty state
  searchQuery: string
}

const ROW_HEIGHT_PX = 44

// Grid template — 4 columns at all breakpoints (Email / Source+state / Date / Actions).
const GRID_COLS =
  "grid-cols-[minmax(220px,2fr)_minmax(180px,1.5fr)_110px_80px]"

export function EmailSignupsTable({
  rows,
  sort,
  onSortChange,
  selected,
  onToggleSelect,
  source,
  states,
  onLocalState,
  leadsByEmail,
  subscriberMap,
  sourcesByEmail,
  crossCollectionMap,
  onSelectRow,
  onDelete,
  onPushOne,
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

  // Pre-compute formatted dates so re-sort doesn't reformat unchanged rows.
  const dateLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.created_at && !map.has(r.created_at)) {
        try {
          map.set(
            r.created_at,
            new Date(r.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          )
        } catch {
          map.set(r.created_at, "—")
        }
      }
    }
    return map
  }, [rows])

  return (
    <div
      ref={scrollRef}
      className="hidden sm:block overflow-y-auto overflow-x-auto max-h-[65vh] relative"
    >
      {/* Header — sticky */}
      <div
        className={`sticky top-0 z-10 grid bg-neutral-50 border-b border-neutral-200 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest ${GRID_COLS}`}
      >
        <SortHeader column="email" label="Email" sort={sort} onSortChange={onSortChange} />
        <SortHeader column="source" label="Source" sort={sort} onSortChange={onSortChange} />
        <SortHeader
          column="created_at"
          label={
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Date
            </span>
          }
          sort={sort}
          onSortChange={onSortChange}
        />
        <div className="px-5 py-3 flex items-center justify-end">Actions</div>
      </div>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="px-5 py-12 text-center text-neutral-400">
          <Mail className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-500">No email signups found</p>
          {searchQuery && (
            <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
          )}
        </div>
      ) : (
        <div className="relative" style={{ height: totalHeight }}>
          {virtualRows.map((vr) => {
            const signup = rows[vr.index]
            const formattedDate = signup.created_at
              ? dateLookup.get(signup.created_at) ?? "—"
              : "N/A"
            const emailKey = signup.email.toLowerCase()
            const isSubscribed = subscriberMap.has(emailKey)
            const sourceSet = sourcesByEmail.get(emailKey)
            // "+N" rolls up two signals: other email_signup sources for the
            // same email + cross-collection counts (contact forms, event
            // registrations). Either kind of duplication is worth flagging
            // since both are upstream dedup candidates.
            const otherSourceCount = sourceSet ? sourceSet.size - 1 : 0
            const cross = crossCollectionMap.get(emailKey)
            const crossCount =
              (cross?.contactForms ?? 0) + (cross?.eventRegistrations ?? 0)
            const totalDupeSignal = otherSourceCount + crossCount

            return (
              <div
                key={signup.id}
                ref={virtualizer.measureElement}
                data-index={vr.index}
                onClick={() => onSelectRow(signup)}
                className={`absolute left-0 right-0 grid border-b border-neutral-100 bg-white hover:bg-neutral-50 transition-colors cursor-pointer ${GRID_COLS}`}
                style={{ transform: `translateY(${vr.start}px)` }}
              >
                {/* Email */}
                <div className="px-5 py-2.5 flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={selected.has(signup.id)}
                    onChange={() => onToggleSelect(signup.id)}
                    className="rounded border-neutral-300 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${signup.email}`}
                  />
                  <a
                    href={`mailto:${signup.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-neutral-900 text-[13px] font-semibold leading-snug truncate hover:underline"
                  >
                    {signup.email}
                  </a>
                  <LeadCrossLink email={signup.email} mapping={leadsByEmail} variant="icon" />
                  {totalDupeSignal > 0 && (
                    <span
                      title={(() => {
                        const parts: string[] = []
                        if (sourceSet && otherSourceCount > 0) {
                          const names: string[] = Array.from(sourceSet).filter(
                            (s) => s !== signup.source,
                          )
                          parts.push(`Other lists: ${names.join(", ")}`)
                        }
                        if (cross?.contactForms) {
                          parts.push(
                            `${cross.contactForms} contact form${cross.contactForms === 1 ? "" : "s"}`,
                          )
                        }
                        if (cross?.eventRegistrations) {
                          parts.push(
                            `${cross.eventRegistrations} event reg${cross.eventRegistrations === 1 ? "" : "s"}`,
                          )
                        }
                        return parts.join(" · ")
                      })()}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-indigo-700 bg-indigo-50 tabular-nums"
                    >
                      <Layers className="w-2.5 h-2.5" />+{totalDupeSignal}
                    </span>
                  )}
                </div>
                {/* Source + state badge */}
                <div className="px-5 py-2.5 flex items-center gap-2 flex-wrap min-w-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-medium bg-neutral-100 text-neutral-700 tracking-wide whitespace-nowrap">
                    {signup.source}
                  </span>
                  <StateBadge
                    source={source}
                    id={signup.id}
                    state={getStateOrNew(states, signup.id)}
                    onChange={(s) => onLocalState(signup.id, s)}
                  />
                </div>
                {/* Date */}
                <div className="px-5 py-2.5 flex items-center text-neutral-400 text-[13px] font-normal whitespace-nowrap tabular-nums">
                  {formattedDate}
                </div>
                {/* Actions */}
                <div className="px-5 py-2.5 flex items-center justify-end gap-0.5">
                  {!isSubscribed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onPushOne(signup.email)
                      }}
                      className="p-1.5 text-neutral-300 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                      title={`Push ${signup.email} to Mailchimp`}
                      aria-label={`Push ${signup.email} to Mailchimp`}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(signup.id, signup.email)
                    }}
                    disabled={isDeleting === signup.id}
                    className="p-1.5 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-50"
                    title={`Delete ${signup.email}`}
                  >
                    {isDeleting === signup.id ? (
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
}: {
  column: SignupSortColumn
  label: React.ReactNode
  sort: SignupSortState
  onSortChange: (next: SignupSortState) => void
}) {
  const isActive = sort.column === column
  const Icon = isActive ? (sort.direction === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <button
      type="button"
      onClick={() =>
        onSortChange({
          column,
          direction: isActive
            ? sort.direction === "asc" ? "desc" : "asc"
            : column === "created_at" ? "desc" : "asc",
        })
      }
      className={`group px-5 py-3 flex items-center gap-1 text-left hover:text-neutral-700 transition-colors ${
        isActive ? "text-neutral-700" : ""
      }`}
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

// ── Comparator ──

export function compareSignupRows(
  a: EmailSignupRow,
  b: EmailSignupRow,
  sort: SignupSortState,
): number {
  let cmp = 0
  switch (sort.column) {
    case "email":
      cmp = a.email.localeCompare(b.email)
      break
    case "source":
      cmp = a.source.localeCompare(b.source)
      break
    case "created_at": {
      const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
      const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
      cmp = aTs - bTs
      break
    }
  }
  return sort.direction === "asc" ? cmp : -cmp
}
