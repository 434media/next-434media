"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import {
  Ticket,
  CheckCircle2,
  Mail,
  Calendar,
  ArrowLeft,
  Loader2,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  UserPlus,
} from "lucide-react"
import { RegistrationSparkline } from "@/components/admin/RegistrationSparkline"

interface EventSummary {
  event: string
  eventName: string
  eventDate: string
  isPast: boolean
  totalRegistrations: number
  uniqueAttendees: number
  inCrm: number
  inMailchimp: number
  conversionRate: number
}

interface SummaryResponse {
  ok: boolean
  events: EventSummary[]
  totals: { events: number; registrations: number; uniqueAttendees: number }
  mailchimpAvailable: boolean
}

function formatDate(iso: string): string {
  if (!iso) return "Date TBD"
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
  } catch {
    return "Date TBD"
  }
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

export type AudienceFilter = "all" | "in-crm" | "in-mailchimp" | "untapped"

type SortKey = "date" | "registrations" | "conversion" | "untapped"

const SORT_LABELS: Record<SortKey, string> = {
  date: "Date",
  registrations: "Registrations",
  conversion: "Conversion %",
  untapped: "Untapped",
}

interface EventInsightsProps {
  // Selected event NAME (display), not slug. Empty string = overview mode.
  selectedEvent: string
  onSelect: (eventName: string) => void
  totalRegistrationsFallback: number
  // Drilldown-only — wired from the parent so the four stat tiles double as
  // table filters and the header exposes high-leverage actions.
  audienceFilter?: AudienceFilter
  onAudienceFilterChange?: (filter: AudienceFilter) => void
  onConvertAll?: () => void
  onPushToMailchimp?: () => void
  convertAllDisabled?: boolean
  pushToMailchimpDisabled?: boolean
  // ISO timestamps for every registration of the currently-selected event —
  // powers the per-day sparkline shown above the table.
  drilldownTimestamps?: string[]
}

/**
 * Two-mode insights panel for the Events tab.
 *
 * Overview mode (no event selected): events grouped by Upcoming/Past with a
 * sort dropdown. Each card promotes the registration count as the headline
 * and shows a thin conversion bar so the user can spot opportunity at a glance.
 *
 * Drilldown mode (event selected): the four stat tiles act as table filters
 * (toggleable), the header exposes Convert-all / Push-to-Mailchimp actions,
 * and the back link sits in a breadcrumb-style row.
 */
export function EventInsights({
  selectedEvent,
  onSelect,
  totalRegistrationsFallback,
  audienceFilter = "all",
  onAudienceFilterChange,
  onConvertAll,
  onPushToMailchimp,
  convertAllDisabled,
  pushToMailchimpDisabled,
  drilldownTimestamps,
}: EventInsightsProps) {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>("date")
  const [overviewQuery, setOverviewQuery] = useState("")

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/admin/events/summary", { cache: "no-store" })
      if (!res.ok) {
        setData(null)
        return
      }
      const json = (await res.json()) as SummaryResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const events = data?.events ?? []
  const totals = data?.totals
  const mcAvailable = data?.mailchimpAvailable ?? false
  const current = events.find((e) => e.eventName === selectedEvent)

  // Hooks must run on every render — call them BEFORE any conditional return
  // so the hook count stays stable when the user toggles into drilldown mode.
  const filteredEvents = useMemo(() => {
    const q = overviewQuery.trim().toLowerCase()
    if (!q) return events
    return events.filter((e) => e.eventName.toLowerCase().includes(q))
  }, [events, overviewQuery])
  const upcoming = useSortedEvents(filteredEvents.filter((e) => !e.isPast), sortKey)
  const past = useSortedEvents(filteredEvents.filter((e) => e.isPast), sortKey)
  // Surface the search input progressively — it adds chrome that a 3-event
  // page doesn't need, but earns its space once the grid grows past 6.
  const showSearch = events.length > 6

  // ── Drilldown mode ──
  if (selectedEvent) {
    const untapped = current ? Math.max(0, current.uniqueAttendees - current.inCrm) : 0
    return (
      <div className="bg-white rounded-md border border-neutral-200/70 p-4 sm:p-5 mb-4">
        {/* Breadcrumb + actions. Trail is `Events / <event name>`; clicking
            "Events" returns to the overview grid. The current event is the
            active leaf and isn't clickable. */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] min-w-0">
            <button
              type="button"
              onClick={() => onSelect("")}
              className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Events
            </button>
            <span className="text-neutral-300" aria-hidden>
              /
            </span>
            <span className="text-neutral-700 font-medium truncate" aria-current="page">
              {selectedEvent}
            </span>
          </nav>
          <div className="flex items-center gap-1.5">
            {onPushToMailchimp && (
              <button
                type="button"
                onClick={onPushToMailchimp}
                disabled={pushToMailchimpDisabled}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-700 bg-white border border-neutral-200 rounded hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Push attendees to Mailchimp with an event tag"
              >
                <Mail className="w-3.5 h-3.5" />
                Push to Mailchimp
              </button>
            )}
            {onConvertAll && (
              <button
                type="button"
                onClick={onConvertAll}
                disabled={convertAllDisabled}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Convert every visible registration into a CRM lead"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Convert all to leads
              </button>
            )}
            <button
              type="button"
              onClick={load}
              className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
              title="Refresh stats"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Title + meta */}
        <div className="flex items-center gap-3 mb-4 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-neutral-900 leading-tight tracking-tight truncate">
            {selectedEvent}
          </h3>
          {current && (
            <div className="flex items-center gap-2 shrink-0">
              <Calendar className="w-3 h-3 text-neutral-400" />
              <span className="text-[11px] text-neutral-500">{formatDate(current.eventDate)}</span>
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                  current.isPast
                    ? "bg-neutral-100 text-neutral-500"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {current.isPast ? "Past" : "Upcoming"}
              </span>
            </div>
          )}
        </div>

        {/* Stats — clickable filters */}
        {current ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <FilterTile
              icon={Ticket}
              label="Registrations"
              value={current.totalRegistrations.toLocaleString()}
              hint={
                current.totalRegistrations !== current.uniqueAttendees
                  ? `${current.uniqueAttendees.toLocaleString()} unique`
                  : "all unique"
              }
              active={audienceFilter === "all"}
              onClick={() => onAudienceFilterChange?.("all")}
            />
            <FilterTile
              icon={CheckCircle2}
              label="In CRM"
              value={current.inCrm.toLocaleString()}
              hint={pct(current.conversionRate) + " conversion"}
              valueClass="text-emerald-700"
              active={audienceFilter === "in-crm"}
              onClick={() => onAudienceFilterChange?.("in-crm")}
            />
            <FilterTile
              icon={Mail}
              label="In Mailchimp"
              value={mcAvailable ? current.inMailchimp.toLocaleString() : "—"}
              hint={mcAvailable ? "subscribed" : "Mailchimp offline"}
              active={audienceFilter === "in-mailchimp"}
              onClick={mcAvailable ? () => onAudienceFilterChange?.("in-mailchimp") : undefined}
              disabled={!mcAvailable}
            />
            <FilterTile
              icon={TrendingUp}
              label="Not a lead yet"
              value={untapped.toLocaleString()}
              hint="conversion opportunity"
              valueClass={untapped > 0 ? "text-amber-700" : "text-neutral-400"}
              active={audienceFilter === "untapped"}
              onClick={() => onAudienceFilterChange?.("untapped")}
            />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
          </div>
        ) : (
          <p className="text-[12px] text-neutral-400">No summary available for this event.</p>
        )}

        {/* Per-day sparkline — only render when the parent supplies timestamps
            and there are enough data points to be meaningful. The dashed
            emerald line marks the event date so the user can read pre-event /
            day-of / post-event activity at a glance. */}
        {drilldownTimestamps && drilldownTimestamps.length >= 3 && (
          <div className="mt-4 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Registrations over time
              </span>
            </div>
            <RegistrationSparkline
              timestamps={drilldownTimestamps}
              eventDate={current?.eventDate}
            />
          </div>
        )}
      </div>
    )
  }

  // ── Overview mode ──
  return (
    <div className="mb-6">
      {/* Header row — title left, sort + refresh right */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Ticket className="w-4 h-4 text-neutral-400 shrink-0" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
            Events
          </h3>
          {totals && (
            <span className="text-[11px] text-neutral-400 truncate">
              {totals.events} {totals.events === 1 ? "event" : "events"} ·{" "}
              {totals.registrations.toLocaleString()} registrations
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <SortDropdown value={sortKey} onChange={setSortKey} />
          <button
            type="button"
            onClick={load}
            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search — only renders when the grid is big enough to warrant it */}
      {showSearch && (
        <div className="relative mb-3">
          <input
            type="text"
            value={overviewQuery}
            onChange={(e) => setOverviewQuery(e.target.value)}
            placeholder={`Search ${events.length} events...`}
            className="w-full pl-3 pr-8 py-1.5 text-[12px] font-normal text-neutral-700 bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 placeholder:text-neutral-400"
          />
          {overviewQuery && (
            <button
              type="button"
              onClick={() => setOverviewQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400 hover:text-neutral-700 px-1 rounded"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* "All Events" pill — single global tile, no longer a peer card */}
      <button
        type="button"
        onClick={() => onSelect("")}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-md border border-neutral-200/70 bg-white hover:bg-neutral-50 transition-colors text-left group"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            All registrations
          </span>
        </div>
        <span className="text-[14px] font-semibold tabular-nums text-neutral-900 group-hover:text-black">
          {(totals?.registrations ?? totalRegistrationsFallback).toLocaleString()}
        </span>
      </button>

      {/* Loading skeleton */}
      {isLoading && events.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-3 rounded-md border border-neutral-200/70 bg-neutral-50 animate-pulse h-22"
            />
          ))}
        </div>
      )}

      {/* Upcoming group */}
      {upcoming.length > 0 && (
        <SectionGroup label="Upcoming" count={upcoming.length} accent="emerald">
          {upcoming.map((e) => (
            <EventCard key={e.event} event={e} mailchimpAvailable={mcAvailable} onClick={onSelect} />
          ))}
        </SectionGroup>
      )}

      {/* Past group */}
      {past.length > 0 && (
        <SectionGroup label="Past" count={past.length}>
          {past.map((e) => (
            <EventCard key={e.event} event={e} mailchimpAvailable={mcAvailable} onClick={onSelect} />
          ))}
        </SectionGroup>
      )}

      {/* Empty search state */}
      {!isLoading && upcoming.length === 0 && past.length === 0 && events.length > 0 && (
        <div className="py-8 text-center text-[12px] text-neutral-400">
          No events match{" "}
          <span className="text-neutral-700 font-medium">&ldquo;{overviewQuery}&rdquo;</span>
          <button
            type="button"
            onClick={() => setOverviewQuery("")}
            className="ml-2 text-neutral-500 hover:text-neutral-900 underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sort dropdown ──

function SortDropdown({ value, onChange }: { value: SortKey; onChange: (k: SortKey) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded hover:bg-neutral-50 transition-colors"
      >
        <span className="text-neutral-400">Sort:</span>
        {SORT_LABELS[value]}
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-35 py-1 rounded-md border border-neutral-200 bg-white shadow-md">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(k)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-neutral-50 transition-colors ${
                k === value ? "text-neutral-900 font-medium" : "text-neutral-600"
              }`}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function useSortedEvents(events: EventSummary[], key: SortKey): EventSummary[] {
  return useMemo(() => {
    const arr = [...events]
    arr.sort((a, b) => {
      switch (key) {
        case "registrations":
          return b.totalRegistrations - a.totalRegistrations
        case "conversion":
          return b.conversionRate - a.conversionRate
        case "untapped":
          return (b.uniqueAttendees - b.inCrm) - (a.uniqueAttendees - a.inCrm)
        case "date":
        default: {
          const aTs = a.eventDate ? new Date(a.eventDate).getTime() : 0
          const bTs = b.eventDate ? new Date(b.eventDate).getTime() : 0
          // Within Upcoming: ascending (soonest first). Within Past: descending (most recent first).
          return a.isPast ? bTs - aTs : aTs - bTs
        }
      }
    })
    return arr
  }, [events, key])
}

// ── Section group with sticky header ──

function SectionGroup({
  label,
  count,
  accent,
  children,
}: {
  label: string
  count: number
  accent?: "emerald"
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="sticky top-0 z-10 -mx-1 px-1 py-1.5 bg-white/80 backdrop-blur-sm flex items-center gap-2 mb-2">
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            accent === "emerald" ? "bg-emerald-500" : "bg-neutral-300"
          }`}
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
        <span className="text-[11px] text-neutral-400 tabular-nums">{count}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {children}
      </div>
    </div>
  )
}

// ── Filter tile (drilldown — clickable) ──

function FilterTile({
  icon: Icon,
  label,
  value,
  hint,
  valueClass = "text-neutral-900",
  active,
  onClick,
  disabled,
}: {
  icon: typeof Ticket
  label: string
  value: string
  hint: string
  valueClass?: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const interactive = !!onClick && !disabled
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-md border text-left transition-all ${
        active
          ? "border-neutral-900 bg-neutral-900/3"
          : "border-neutral-200/70 bg-white hover:bg-neutral-50"
      } ${interactive ? "cursor-pointer" : "cursor-default"} ${disabled ? "opacity-50" : ""}`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${active ? "text-neutral-900" : "text-neutral-400"}`} />
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${
            active ? "text-neutral-900" : "text-neutral-500"
          }`}
        >
          {label}
        </span>
      </div>
      <div className={`text-lg font-semibold tabular-nums leading-tight ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-neutral-400 font-normal leading-snug mt-0.5">{hint}</div>
    </button>
  )
}

// ── Event card (overview) ──

function EventCard({
  event,
  mailchimpAvailable,
  onClick,
}: {
  event: EventSummary
  mailchimpAvailable: boolean
  onClick: (name: string) => void
}) {
  const untapped = Math.max(0, event.uniqueAttendees - event.inCrm)
  const conversionPct = Math.round(event.conversionRate * 100)
  return (
    <button
      type="button"
      onClick={() => onClick(event.eventName)}
      className="group relative p-3 pb-4 rounded-md border bg-white text-neutral-900 border-neutral-200/70 hover:border-neutral-300 hover:bg-neutral-50/50 transition-all text-left overflow-hidden"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[12px] font-semibold text-neutral-900 leading-snug truncate min-w-0">
          {event.eventName}
        </span>
        <span className="text-[10px] text-neutral-400 tabular-nums shrink-0">
          {formatDate(event.eventDate)}
        </span>
      </div>
      {/* Headline metric */}
      <div className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {event.totalRegistrations.toLocaleString()}
      </div>
      <div className="text-[11px] text-neutral-500 font-normal mt-0.5">
        registrations
      </div>
      {/* Secondary line — single muted row */}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500 tabular-nums">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          {event.inCrm} CRM
        </span>
        {mailchimpAvailable && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1">
              <Mail className="w-2.5 h-2.5 text-neutral-400" />
              {event.inMailchimp} reachable
            </span>
          </>
        )}
        {untapped > 0 && (
          <>
            <span className="text-neutral-300">·</span>
            <span className="inline-flex items-center gap-1 text-amber-700">
              {untapped} not a lead
            </span>
          </>
        )}
      </div>
      {/* Conversion bar — bottom edge, 2px */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-100"
        aria-hidden
      >
        <div
          className={`h-full transition-all ${
            conversionPct >= 50
              ? "bg-emerald-500"
              : conversionPct >= 20
                ? "bg-amber-500"
                : "bg-neutral-300"
          }`}
          style={{ width: `${Math.max(2, Math.min(100, conversionPct))}%` }}
        />
      </div>
    </button>
  )
}
