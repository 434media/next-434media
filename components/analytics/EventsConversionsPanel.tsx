"use client"

import { useEffect, useState } from "react"
import { Activity, Target, Loader2, TrendingUp } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface EventRow {
  eventName: string
  eventCount: number
  totalUsers: number
  eventValue: number
}

interface ConversionRow {
  eventName: string
  conversions: number
  totalRevenue: number
  conversionRate: number
}

interface EventsConversionsPanelProps {
  dateRange: DateRange
  propertyId: string
  useSnapshot?: boolean
  isLoading?: boolean
  setError?: (e: string | null) => void
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCurrency(n: number): string {
  if (!n) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

/**
 * Humanize the GA4 event names so the table reads cleanly. We keep our own
 * snake_case names (e.g. lead_capture) but render them as "Lead capture" in
 * the UI. GA4's own built-in events (page_view, scroll, click) get the same
 * treatment for consistency.
 */
function humanizeEvent(name: string): string {
  if (!name) return "(unnamed)"
  return name
    .split("_")
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ")
}

export function EventsConversionsPanel({
  dateRange,
  propertyId,
  useSnapshot,
  setError,
}: EventsConversionsPanelProps) {
  const [events, setEvents] = useState<EventRow[]>([])
  const [conversions, setConversions] = useState<ConversionRow[]>([])
  const [totalConversions, setTotalConversions] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!propertyId || !dateRange.startDate || !dateRange.endDate) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        const [evRes, convRes] = await Promise.all([
          fetch(buildAnalyticsUrl({ endpoint: "events", dateRange, propertyId, useSnapshot })),
          fetch(buildAnalyticsUrl({ endpoint: "conversions", dateRange, propertyId, useSnapshot })),
        ])

        if (evRes.ok) {
          const data = await evRes.json()
          if (!cancelled) setEvents((data.data ?? []).slice(0, 8))
        }
        if (convRes.ok) {
          const data = await convRes.json()
          if (!cancelled) {
            setConversions((data.data ?? []).slice(0, 5))
            setTotalConversions(data.totalConversions ?? 0)
            setTotalRevenue(data.totalRevenue ?? 0)
          }
        }
      } catch (err) {
        if (setError) setError(err instanceof Error ? err.message : "Failed to load events")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId, useSnapshot, setError])

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  const noEvents = events.length === 0
  const noConversions = conversions.length === 0

  if (noEvents && noConversions) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <Activity className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">No events yet for this period</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
          GA4 captures page_view automatically. Custom events (lead_capture, newsletter_signup,
          opportunity_won, etc.) flow in once Measurement Protocol is configured server-side and
          gtag.js fires them client-side.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Conversions hero — single big number + revenue */}
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-xl p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-emerald-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            Conversions
          </span>
        </div>
        <div className="text-3xl font-bold text-neutral-900 tabular-nums leading-none">
          {totalConversions.toLocaleString()}
        </div>
        <div className="text-xs text-neutral-500 mt-1">key events triggered</div>
        {totalRevenue > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                Attributed revenue
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-700 tabular-nums">
              {formatCurrency(totalRevenue)}
            </div>
          </div>
        )}
        {conversions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-100 space-y-1.5">
            {conversions.map((c) => (
              <div key={c.eventName} className="flex items-center justify-between text-xs">
                <span className="text-neutral-700 truncate">{humanizeEvent(c.eventName)}</span>
                <span className="font-semibold text-neutral-900 tabular-nums shrink-0 ml-2">
                  {c.conversions.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top events table — 2 columns wide on desktop */}
      <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-neutral-100">
          <Activity className="w-4 h-4 text-neutral-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Top events
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-50">
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
              <th className="text-left px-5 py-2">Event</th>
              <th className="text-right px-5 py-2">Count</th>
              <th className="text-right px-5 py-2">Users</th>
              <th className="text-right px-5 py-2">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-xs text-neutral-400">
                  No events captured yet
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.eventName} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-2.5 text-[13px] font-medium text-neutral-900">
                    {humanizeEvent(e.eventName)}
                  </td>
                  <td className="px-5 py-2.5 text-[13px] text-neutral-700 text-right tabular-nums">
                    {formatNumber(e.eventCount)}
                  </td>
                  <td className="px-5 py-2.5 text-[12px] text-neutral-500 text-right tabular-nums">
                    {formatNumber(e.totalUsers)}
                  </td>
                  <td className="px-5 py-2.5 text-[12px] text-neutral-500 text-right tabular-nums">
                    {e.eventValue > 0 ? formatCurrency(e.eventValue) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
