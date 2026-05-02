"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Ticket,
  CheckCircle2,
  Mail,
  Calendar,
  ArrowLeft,
  Loader2,
  TrendingUp,
  RefreshCw,
} from "lucide-react"

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

interface EventInsightsProps {
  // Selected event NAME (display), not slug. Empty string = overview mode.
  selectedEvent: string
  onSelect: (eventName: string) => void
  totalRegistrationsFallback: number
}

/**
 * Two-mode insights panel for the Events tab.
 *
 * Overview mode (no event selected): grid of event cards each showing
 * registration count, conversion-to-CRM rate, Mailchimp coverage, and past/
 * upcoming status. Click drills down.
 *
 * Drilldown mode (event selected): compact stats strip with the same metrics
 * for the chosen event, a back link, and the event date. The registrations
 * table renders below this component, filtered to the selected event.
 */
export function EventInsights({ selectedEvent, onSelect, totalRegistrationsFallback }: EventInsightsProps) {
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

  const events = data?.events ?? []
  const totals = data?.totals
  const mcAvailable = data?.mailchimpAvailable ?? false
  const current = events.find((e) => e.eventName === selectedEvent)

  // ── Drilldown mode ──
  if (selectedEvent) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 mb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onSelect("")}
              className="inline-flex items-center gap-1 px-2 py-1 -ml-1 text-[12px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              All events
            </button>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-neutral-900 leading-tight tracking-tight truncate">
                {selectedEvent}
              </h3>
              {current && (
                <div className="flex items-center gap-2 mt-0.5">
                  <Calendar className="w-3 h-3 text-neutral-400" />
                  <span className="text-[11px] text-neutral-500">{formatDate(current.eventDate)}</span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      current.isPast
                        ? "bg-neutral-100 text-neutral-500"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                    }`}
                  >
                    {current.isPast ? "Past" : "Upcoming"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors shrink-0"
            title="Refresh stats"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats strip */}
        {current ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              icon={Ticket}
              label="Registrations"
              value={current.totalRegistrations.toLocaleString()}
              hint={
                current.totalRegistrations !== current.uniqueAttendees
                  ? `${current.uniqueAttendees.toLocaleString()} unique`
                  : "all unique"
              }
            />
            <Stat
              icon={CheckCircle2}
              label="In CRM"
              value={current.inCrm.toLocaleString()}
              hint={`${pct(current.conversionRate)} conversion`}
              valueClass="text-emerald-700"
            />
            <Stat
              icon={Mail}
              label="In Mailchimp"
              value={mcAvailable ? current.inMailchimp.toLocaleString() : "—"}
              hint={mcAvailable ? "subscribed" : "Mailchimp offline"}
            />
            <Stat
              icon={TrendingUp}
              label="Untapped"
              value={Math.max(0, current.uniqueAttendees - current.inCrm).toLocaleString()}
              hint="not yet leads"
              valueClass={
                current.uniqueAttendees - current.inCrm > 0 ? "text-amber-700" : "text-neutral-400"
              }
            />
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
          </div>
        ) : (
          <p className="text-[12px] text-neutral-400">No summary available for this event.</p>
        )}

        <p className="mt-3 text-[11px] text-neutral-400 leading-relaxed">
          Use the bulk action bar below to push registrants to Mailchimp with the{" "}
          <code className="px-1 py-0.5 bg-neutral-100 rounded text-[10px]">
            event-{selectedEvent.toLowerCase().replace(/\s+/g, "-")}
          </code>{" "}
          tag, or convert them all into CRM leads.
        </p>
      </div>
    )
  }

  // ── Overview mode ──
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-neutral-400" />
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
            Events
          </h3>
          {totals && (
            <span className="text-[11px] text-neutral-400">
              {totals.events} {totals.events === 1 ? "event" : "events"} ·{" "}
              {totals.registrations.toLocaleString()} registrations
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={load}
          className="p-1 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded transition-colors"
          title="Refresh"
          disabled={isLoading}
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {/* "All Events" card always first */}
        <button
          type="button"
          onClick={() => onSelect("")}
          className="p-3 rounded-xl border bg-neutral-900 text-white border-neutral-900 shadow-md text-left"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Ticket className="w-3 h-3 opacity-50" />
            <span className="text-[11px] font-semibold uppercase tracking-wider">All Events</span>
          </div>
          <div className="text-xl font-bold leading-tight">
            {(totals?.registrations ?? totalRegistrationsFallback).toLocaleString()}
          </div>
          <div className="text-[11px] opacity-50 font-normal leading-snug">total registrations</div>
        </button>

        {isLoading && events.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 animate-pulse h-27.5"
              />
            ))
          : events.map((e) => (
              <EventCard key={e.event} event={e} mailchimpAvailable={mcAvailable} onClick={onSelect} />
            ))}
      </div>
    </div>
  )
}

// ── Stat tile (drilldown) ──

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  valueClass = "text-neutral-900",
}: {
  icon: typeof Ticket
  label: string
  value: string
  hint: string
  valueClass?: string
}) {
  return (
    <div className="p-3 rounded-lg border border-neutral-100 bg-neutral-50/50">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-neutral-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      </div>
      <div className={`text-lg font-semibold tabular-nums leading-tight ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-neutral-400 font-normal leading-snug mt-0.5">{hint}</div>
    </div>
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
  return (
    <button
      type="button"
      onClick={() => onClick(event.eventName)}
      className="p-3 rounded-xl border bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition-all text-left"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Ticket className="w-3 h-3 text-neutral-400 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
            {event.eventName}
          </span>
        </div>
        <span
          className={`text-[9px] font-medium px-1 py-0.5 rounded uppercase tracking-wider shrink-0 ${
            event.isPast
              ? "bg-neutral-100 text-neutral-500"
              : "bg-emerald-50 text-emerald-700 border border-emerald-100"
          }`}
        >
          {event.isPast ? "Past" : "Soon"}
        </span>
      </div>
      <div className="text-xl font-bold leading-tight tabular-nums">
        {event.totalRegistrations.toLocaleString()}
      </div>
      <div className="text-[11px] text-neutral-500 font-normal leading-snug">
        registrations · {formatDate(event.eventDate)}
      </div>
      {/* Coverage row */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1 text-[10px] text-emerald-700"
          title="Unique attendees that exist as CRM leads"
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          {event.inCrm} CRM
          <span className="text-neutral-400">({pct(event.conversionRate)})</span>
        </span>
        {mailchimpAvailable && (
          <span
            className="inline-flex items-center gap-1 text-[10px] text-neutral-600"
            title="Unique attendees subscribed in Mailchimp"
          >
            <Mail className="w-2.5 h-2.5" />
            {event.inMailchimp} MC
          </span>
        )}
        {untapped > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] text-amber-700 ml-auto"
            title="Attendees not yet captured as CRM leads — convert in the drilldown"
          >
            <TrendingUp className="w-2.5 h-2.5" />
            {untapped} untapped
          </span>
        )}
      </div>
    </button>
  )
}

