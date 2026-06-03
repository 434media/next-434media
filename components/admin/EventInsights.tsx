"use client"

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react"
import { Calendar, Loader2, RefreshCw } from "lucide-react"
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
  optedOut: number
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

function tsOf(iso: string): number {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

export type AudienceFilter = "all" | "in-crm" | "in-mailchimp" | "untapped" | "opted-out"

interface EventInsightsProps {
  // Selected event NAME (display), not slug. Empty string = nothing selected.
  selectedEvent: string
  onSelect: (eventName: string) => void
  totalRegistrationsFallback: number
  // Drilldown — the stat chips double as table filters.
  audienceFilter?: AudienceFilter
  onAudienceFilterChange?: (filter: AudienceFilter) => void
  // ISO timestamps for every registration of the selected event — powers the
  // per-day area chart in the drilldown.
  drilldownTimestamps?: string[]
  // Right-aligned actions for the controls row (e.g. the Export menu). Lets the
  // tab retire its own header bar — the pill rows are the section's only chrome.
  actions?: ReactNode
}

/**
 * Insights panel for the Events tab. A quiet event selector — an "All" pill
 * plus one pill per event, grouped into Upcoming / Past so the time axis that
 * matters for events survives (upcoming feed reminders, past feed promote-to-
 * leads).
 *
 * Selecting an event reveals a drilldown: a light meta line (date · Past/
 * Upcoming · unique-vs-total), a row of stat chips (In CRM / In Mailchimp /
 * Not a lead yet / Opted out) that toggle the table's audience filter, and the
 * registrations-over-time area chart anchored to the event day. Lead conversion
 * lives in the table's select → Promote flow, not here.
 */
export function EventInsights({
  selectedEvent,
  onSelect,
  totalRegistrationsFallback,
  audienceFilter = "all",
  onAudienceFilterChange,
  drilldownTimestamps,
  actions,
}: EventInsightsProps) {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  const events = useMemo(() => data?.events ?? [], [data])
  const totals = data?.totals
  const mcAvailable = data?.mailchimpAvailable ?? false
  const current = events.find((e) => e.eventName === selectedEvent)

  // Upcoming: soonest first. Past: most recent first.
  const upcoming = useMemo(
    () => events.filter((e) => !e.isPast).sort((a, b) => tsOf(a.eventDate) - tsOf(b.eventDate)),
    [events],
  )
  const past = useMemo(
    () => events.filter((e) => e.isPast).sort((a, b) => tsOf(b.eventDate) - tsOf(a.eventDate)),
    [events],
  )

  const untapped = current ? Math.max(0, current.uniqueAttendees - current.inCrm) : 0
  const onFilter = (f: AudienceFilter) =>
    onAudienceFilterChange?.(audienceFilter === f ? "all" : f)

  return (
    <div className="mb-4">
      {/* Controls row — the "All" pill on the left, Export + refresh on the
          right. Replaces the old header bar + sort dropdown + all-events card. */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <EventPill
          label="All registrations"
          count={totals?.registrations ?? totalRegistrationsFallback}
          active={!selectedEvent}
          onClick={() => onSelect("")}
        />
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          {actions}
          <button
            type="button"
            onClick={load}
            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
            title="Refresh stats"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Event pills, grouped by time. */}
      {isLoading && events.length === 0 ? (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-neutral-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading events…
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <PillRow label="Upcoming" accent>
              {upcoming.map((e) => (
                <EventPill
                  key={e.event}
                  label={e.eventName}
                  count={e.totalRegistrations}
                  active={selectedEvent === e.eventName}
                  onClick={() => onSelect(e.eventName)}
                />
              ))}
            </PillRow>
          )}
          {past.length > 0 && (
            <PillRow label="Past">
              {past.map((e) => (
                <EventPill
                  key={e.event}
                  label={e.eventName}
                  count={e.totalRegistrations}
                  active={selectedEvent === e.eventName}
                  onClick={() => onSelect(e.eventName)}
                />
              ))}
            </PillRow>
          )}
        </>
      )}

      {/* Drilldown — only when an event is selected. The lit pill above names
          it, so the panel leads with a light meta line + stat-chip filters. */}
      {selectedEvent && (
        <div className="mt-3 bg-white rounded-md border border-neutral-200/70 p-3">
          {current ? (
            <>
              {/* Meta — date, status, and the registrations-vs-unique nuance
                  that's specific to events. */}
              <div className="flex items-center gap-2 mb-2.5 text-[11px] text-neutral-500 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  {formatDate(current.eventDate)}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    current.isPast ? "bg-neutral-100 text-neutral-500" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {current.isPast ? "Past" : "Upcoming"}
                </span>
                {current.totalRegistrations !== current.uniqueAttendees && (
                  <span className="text-neutral-400 tabular-nums">
                    · {current.uniqueAttendees.toLocaleString()} unique of{" "}
                    {current.totalRegistrations.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Stat chips — toggle the table's audience filter. */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatChip
                  label="In CRM"
                  value={current.inCrm.toLocaleString()}
                  dot="bg-emerald-500"
                  active={audienceFilter === "in-crm"}
                  onClick={() => onFilter("in-crm")}
                />
                <StatChip
                  label="In Mailchimp"
                  value={mcAvailable ? current.inMailchimp.toLocaleString() : "—"}
                  dot="bg-neutral-400"
                  active={audienceFilter === "in-mailchimp"}
                  onClick={mcAvailable ? () => onFilter("in-mailchimp") : undefined}
                  disabled={!mcAvailable}
                />
                <StatChip
                  label="Not a lead yet"
                  value={untapped.toLocaleString()}
                  dot={untapped > 0 ? "bg-amber-500" : "bg-neutral-300"}
                  active={audienceFilter === "untapped"}
                  onClick={() => onFilter("untapped")}
                />
                <StatChip
                  label="Opted out"
                  value={current.optedOut.toLocaleString()}
                  dot={current.optedOut > 0 ? "bg-rose-500" : "bg-neutral-300"}
                  active={audienceFilter === "opted-out"}
                  onClick={() => onFilter("opted-out")}
                />
              </div>

              {/* Registrations over time — area chart anchored to the event
                  day. The one chart that earns its place on a working list:
                  it tells you whether to time a post-event follow-up. */}
              {drilldownTimestamps && drilldownTimestamps.length >= 3 && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Registrations over time
                  </div>
                  <RegistrationSparkline timestamps={drilldownTimestamps} eventDate={current.eventDate} />
                </div>
              )}
            </>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
            </div>
          ) : (
            <p className="text-[12px] text-neutral-400">No summary available for this event.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Event pill (selector) ──

function EventPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
      }`}
    >
      <span className="truncate max-w-56">{label}</span>
      <span className={`tabular-nums ${active ? "text-white/60" : "text-neutral-400"}`}>
        {count.toLocaleString()}
      </span>
    </button>
  )
}

// ── Pill row (Upcoming / Past group) ──

function PillRow({
  label,
  accent,
  children,
}: {
  label: string
  accent?: boolean
  children: ReactNode
}) {
  return (
    <div className="mt-2 flex items-start gap-2">
      <span
        className={`mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider shrink-0 ${
          accent ? "text-emerald-600" : "text-neutral-400"
        }`}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${accent ? "bg-emerald-500" : "bg-neutral-300"}`} />
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">{children}</div>
    </div>
  )
}

// ── Stat chip (drilldown filter) ──
// Light, toggle-style filter matching the event pills and toolbar chips.

function StatChip({
  label,
  value,
  dot,
  active,
  onClick,
  disabled,
}: {
  label: string
  value: string
  dot: string
  active?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] transition-colors ${
        active
          ? "bg-neutral-900 text-white"
          : "bg-white text-neutral-600 border border-neutral-200/70 hover:bg-neutral-50 hover:text-neutral-900"
      } ${disabled ? "opacity-50 cursor-default" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white/70" : dot}`} aria-hidden="true" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className={active ? "text-white/80" : "text-neutral-500"}>{label}</span>
    </button>
  )
}
