"use client"

import { useEffect, useState } from "react"
import { Loader2, Repeat, ExternalLink } from "lucide-react"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface CohortRetentionPanelProps {
  propertyId: string
  setError?: (e: string | null) => void
}

interface CohortRow {
  cohortStart: string
  cohortLabel: string
  size: number
  retention: number[]
}

interface CohortPayload {
  data: CohortRow[]
  weeks: number
  propertyId: string
  unavailable?: boolean
  reason?: string
}

/**
 * Color a cell by retention %. Linear/Mixpanel pattern: indigo gets darker
 * as retention rises. Week 0 is always 100% so we render it as a baseline.
 */
function cellStyle(pct: number, isWeekZero: boolean): { bg: string; text: string } {
  if (isWeekZero) return { bg: "bg-teal-700", text: "text-white" }
  if (pct === 0) return { bg: "bg-neutral-50", text: "text-neutral-300" }
  if (pct >= 0.5) return { bg: "bg-teal-600", text: "text-white" }
  if (pct >= 0.3) return { bg: "bg-teal-500", text: "text-white" }
  if (pct >= 0.2) return { bg: "bg-teal-400", text: "text-white" }
  if (pct >= 0.1) return { bg: "bg-teal-200", text: "text-teal-900" }
  if (pct >= 0.05) return { bg: "bg-teal-100", text: "text-teal-800" }
  return { bg: "bg-teal-50", text: "text-teal-700" }
}

function formatPct(v: number): string {
  if (!v) return "—"
  if (v >= 0.995) return "100%"
  return `${(v * 100).toFixed(1)}%`
}

export function CohortRetentionPanel({ propertyId, setError }: CohortRetentionPanelProps) {
  const [payload, setPayload] = useState<CohortPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({
          endpoint: "cohort-retention",
          dateRange: { startDate: "today", endDate: "today" }, // ignored by the endpoint
          propertyId,
        })
        const res = await fetch(url)
        // 4xx from cohort spec usually means "property too new / not enough
        // historical data for an 8-cohort × 5-week observation window."
        // Render the empty state quietly — server-side logs hold the detail.
        if (!res.ok) {
          if (!cancelled) setPayload(null)
          if (res.status >= 500 && setError) {
            setError(`Cohort retention: HTTP ${res.status}`)
          }
          return
        }
        const data = (await res.json()) as CohortPayload
        if (!cancelled) setPayload(data)
      } catch (err) {
        // Network-level failure — log but don't toast.
        console.warn("[CohortRetentionPanel] fetch failed:", err)
        if (!cancelled) setPayload(null)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [propertyId, setError])

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  if (!payload || payload.data.length === 0 || payload.unavailable) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
        <Repeat className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-neutral-700">No cohort data</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
          {payload?.reason ??
            "GA4 needs enough historical user activity to build an 8-cohort × 5-week retention view."}
        </p>
      </div>
    )
  }

  // Compute summary stats — average retention at each week across cohorts
  // (excluding cohorts with zero size to avoid skewing the average down).
  const validCohorts = payload.data.filter((c) => c.size > 0)
  const avgRetention: number[] = Array.from({ length: payload.weeks }, (_, w) => {
    if (validCohorts.length === 0) return 0
    return (
      validCohorts.reduce((sum, c) => sum + (c.retention[w] ?? 0), 0) / validCohorts.length
    )
  })

  const totalCohortSize = validCohorts.reduce((sum, c) => sum + c.size, 0)

  return (
    <div className="space-y-4">
      {/* Quick summary card */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryStat
          label="Cohorts"
          value={validCohorts.length.toString()}
          subtitle="weekly buckets"
        />
        <SummaryStat
          label="Acquired users"
          value={totalCohortSize.toLocaleString()}
          subtitle="across all cohorts"
        />
        <SummaryStat
          label="Avg week 1 retention"
          value={formatPct(avgRetention[1] ?? 0)}
          subtitle="back the next week"
          accent={avgRetention[1] >= 0.2 ? "good" : avgRetention[1] >= 0.1 ? "ok" : "low"}
        />
        <SummaryStat
          label={`Avg week ${payload.weeks - 1} retention`}
          value={formatPct(avgRetention[payload.weeks - 1] ?? 0)}
          subtitle={`back ${payload.weeks - 1} weeks later`}
          accent={
            avgRetention[payload.weeks - 1] >= 0.1
              ? "good"
              : avgRetention[payload.weeks - 1] >= 0.05
                ? "ok"
                : "low"
          }
        />
      </div>

      {/* Triangle table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-neutral-500">
                  Cohort week
                </th>
                <th className="text-right px-3 py-2 font-semibold text-[10px] uppercase tracking-wider text-neutral-500">
                  Size
                </th>
                {Array.from({ length: payload.weeks }, (_, w) => (
                  <th
                    key={w}
                    className="text-center px-2 py-2 font-semibold text-[10px] uppercase tracking-wider text-neutral-500"
                  >
                    W{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {payload.data.map((row) => {
                // Each subsequent cohort can observe one fewer week than the
                // previous one (by definition — "week 4" requires 4 weeks
                // having passed since acquisition).
                const cohortIdx = payload.data.indexOf(row)
                const observableWeeks = payload.data.length - cohortIdx
                return (
                  <tr key={row.cohortStart}>
                    <td className="px-3 py-1.5 text-neutral-900 font-medium whitespace-nowrap">
                      {row.cohortLabel}
                    </td>
                    <td className="px-3 py-1.5 text-right text-neutral-600 tabular-nums">
                      {row.size.toLocaleString()}
                    </td>
                    {row.retention.map((r, w) => {
                      const isUnobserved = w >= observableWeeks
                      if (isUnobserved) {
                        return (
                          <td key={w} className="px-2 py-1.5 text-center text-neutral-200">
                            —
                          </td>
                        )
                      }
                      const style = cellStyle(r, w === 0)
                      return (
                        <td
                          key={w}
                          className={`px-2 py-1.5 text-center font-medium tabular-nums transition-colors ${style.bg} ${style.text}`}
                          title={`Week ${w} — ${(r * 100).toFixed(1)}% (${Math.round(r * row.size)} users)`}
                        >
                          {formatPct(r)}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {/* Average row — sum of column / count, weighted equally per cohort */}
              <tr className="bg-neutral-50 border-t-2 border-neutral-200">
                <td className="px-3 py-2 text-neutral-700 font-semibold text-[11px] uppercase tracking-wider">
                  Average
                </td>
                <td className="px-3 py-2 text-right text-neutral-700 tabular-nums font-semibold">
                  {Math.round(totalCohortSize / Math.max(1, validCohorts.length)).toLocaleString()}
                </td>
                {avgRetention.map((avg, w) => {
                  const style = cellStyle(avg, w === 0)
                  return (
                    <td
                      key={w}
                      className={`px-2 py-2 text-center font-bold tabular-nums ${style.bg} ${style.text}`}
                    >
                      {formatPct(avg)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
          <span>
            Each row = users whose first session fell in that week. Cells = % of those users back N
            weeks later. Week 0 is the cohort itself (always 100%).
          </span>
          <a
            href={`https://analytics.google.com/analytics/web/#/p${propertyId}/reports/explorer?params=_u..nav%3Dmaui&r=cohort`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 shrink-0 inline-flex items-center gap-1 hover:text-neutral-700"
          >
            Open in GA4
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string
  value: string
  subtitle: string
  accent?: "good" | "ok" | "low"
}) {
  const accentClass =
    accent === "good"
      ? "text-emerald-700"
      : accent === "ok"
        ? "text-amber-700"
        : accent === "low"
          ? "text-red-700"
          : "text-neutral-900"
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className={`mt-1 text-xl font-bold tabular-nums leading-none ${accentClass}`}>{value}</div>
      <p className="text-[10px] text-neutral-400 mt-1">{subtitle}</p>
    </div>
  )
}
