"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react"
import type { DateRange, AnalyticsFilters } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface WhatChangedPanelProps {
  dateRange: DateRange
  propertyId: string
  useSnapshot?: boolean
  filters?: AnalyticsFilters
  setError?: (e: string | null) => void
}

interface PageRow {
  path: string
  title: string
  pageViews: number
}

interface MoverRow {
  path: string
  title: string
  current: number
  previous: number
  /** Absolute % change. Positive = grew, negative = declined. */
  change: number
}

const TOP_N = 5
const MIN_VIEWS_THRESHOLD = 20 // Filter out tiny pages so 5 → 25 doesn't dominate the "+400%" board

/**
 * Resolve a relative GA4 date shortcut like "30daysAgo" to YYYY-MM-DD,
 * then return the matching previous period of identical length.
 */
function previousPeriodDates(range: DateRange): { startDate: string; endDate: string } {
  // Normalize relative shortcuts (e.g. "30daysAgo" / "today") to absolute dates.
  const today = new Date()
  const toIso = (d: Date) => d.toISOString().split("T")[0]

  const resolveAbs = (s: string): Date => {
    if (s === "today") return today
    if (s === "yesterday") {
      const d = new Date(today)
      d.setDate(d.getDate() - 1)
      return d
    }
    const m = s.match(/^(\d+)daysAgo$/)
    if (m) {
      const d = new Date(today)
      d.setDate(d.getDate() - Number(m[1]))
      return d
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s)
    return today
  }

  const start = resolveAbs(range.startDate)
  const end = resolveAbs(range.endDate)
  const dayMs = 1000 * 60 * 60 * 24
  const lengthDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1)

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (lengthDays - 1))

  return { startDate: toIso(prevStart), endDate: toIso(prevEnd) }
}

export function WhatChangedPanel({
  dateRange,
  propertyId,
  useSnapshot,
  filters,
  setError,
}: WhatChangedPanelProps) {
  const [risers, setRisers] = useState<MoverRow[]>([])
  const [fallers, setFallers] = useState<MoverRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasData, setHasData] = useState(false)

  useEffect(() => {
    if (!propertyId || !dateRange.startDate || !dateRange.endDate) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        // Build a date range for the previous period of identical length.
        // The summary endpoint computes this server-side via GA4's two-range
        // support, but top-pages doesn't — so we make the second fetch here.
        const prev = previousPeriodDates(dateRange)
        const prevRange: DateRange = {
          startDate: prev.startDate,
          endDate: prev.endDate,
          label: "previous period",
        }

        // Previous-period data has no precomputed snapshot, so always go live
        // for that fetch. Current period respects the user's snapshot toggle.
        const [currentRes, previousRes] = await Promise.all([
          fetch(buildAnalyticsUrl({ endpoint: "top-pages", dateRange, propertyId, useSnapshot, filters })),
          fetch(buildAnalyticsUrl({ endpoint: "top-pages", dateRange: prevRange, propertyId, useSnapshot: false, filters })),
        ])

        if (!currentRes.ok || !previousRes.ok) {
          if (!cancelled) setHasData(false)
          return
        }

        const currentData = await currentRes.json()
        const previousData = await previousRes.json()
        const currentRows: PageRow[] = currentData.data ?? []
        const previousRows: PageRow[] = previousData.data ?? []

        // Index previous by path for O(1) joins
        const prevByPath = new Map<string, number>()
        for (const r of previousRows) {
          prevByPath.set(r.path, r.pageViews)
        }
        // Also index current to detect pages that disappeared
        const currByPath = new Map<string, number>()
        for (const r of currentRows) {
          currByPath.set(r.path, r.pageViews)
        }

        // Build mover rows. Filter out tiny pages so noise doesn't dominate.
        const movers: MoverRow[] = []

        for (const row of currentRows) {
          const previous = prevByPath.get(row.path) ?? 0
          const meetsThreshold = row.pageViews >= MIN_VIEWS_THRESHOLD || previous >= MIN_VIEWS_THRESHOLD
          if (!meetsThreshold) continue
          const change = previous === 0
            ? row.pageViews > 0 ? 100 : 0
            : ((row.pageViews - previous) / previous) * 100
          movers.push({
            path: row.path,
            title: row.title,
            current: row.pageViews,
            previous,
            change,
          })
        }

        // Pages that existed in previous period but vanished from current top-N
        for (const row of previousRows) {
          if (currByPath.has(row.path)) continue
          if (row.pageViews < MIN_VIEWS_THRESHOLD) continue
          movers.push({
            path: row.path,
            title: row.title,
            current: 0,
            previous: row.pageViews,
            change: -100,
          })
        }

        // Sort + slice into top risers and top fallers.
        const sortedRisers = movers
          .filter((m) => m.change > 0)
          .sort((a, b) => b.change - a.change)
          .slice(0, TOP_N)

        const sortedFallers = movers
          .filter((m) => m.change < 0)
          .sort((a, b) => a.change - b.change)
          .slice(0, TOP_N)

        if (!cancelled) {
          setRisers(sortedRisers)
          setFallers(sortedFallers)
          setHasData(sortedRisers.length > 0 || sortedFallers.length > 0)
        }
      } catch (err) {
        if (setError) setError(err instanceof Error ? err.message : "Failed to load page changes")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId, useSnapshot, filters, setError])

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <TrendingUp className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">No significant page-level changes</p>
        <p className="text-xs text-neutral-500 mt-1">
          Either no pages crossed the {MIN_VIEWS_THRESHOLD}-view threshold, or this period
          looks just like the previous one.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MoverList title="Biggest risers" rows={risers} kind="up" />
      <MoverList title="Biggest fallers" rows={fallers} kind="down" />
    </div>
  )
}

function MoverList({ title, rows, kind }: { title: string; rows: MoverRow[]; kind: "up" | "down" }) {
  const Icon = kind === "up" ? TrendingUp : TrendingDown
  const iconColor = kind === "up" ? "text-emerald-600" : "text-red-600"

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          {title}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-neutral-400">
          {kind === "up" ? "No risers in this period" : "No fallers in this period"}
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {rows.map((row) => {
            const isUp = row.change >= 0
            return (
              <li key={row.path} className="px-4 py-3 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-neutral-900 truncate">
                      {row.title || row.path}
                    </p>
                    <p className="text-[11px] text-neutral-500 truncate font-mono">{row.path}</p>
                    <p className="text-[11px] text-neutral-400 mt-1 tabular-nums">
                      {row.current.toLocaleString()} views
                      {row.previous > 0 && (
                        <span className="text-neutral-300"> · was {row.previous.toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                      isUp
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                    }`}
                  >
                    {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {row.change >= 100 || row.change <= -100
                      ? `${row.change > 0 ? "+" : ""}${Math.round(row.change)}%`
                      : `${row.change > 0 ? "+" : ""}${row.change.toFixed(1)}%`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
