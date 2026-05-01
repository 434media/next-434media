"use client"

import { useEffect, useState } from "react"
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import type { DateRange, AnalyticsFilters } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface InsightsPanelProps {
  dateRange: DateRange
  propertyId: string
  filters?: AnalyticsFilters
}

type Severity = "low" | "medium" | "high"

interface Anomaly {
  metric: string
  metricKey: "sessions" | "users" | "pageViews" | "engagementRate" | "bounceRate"
  current: number
  expected: number
  change: number
  severity: Severity
  bad: boolean
  message: string
}

interface AnomaliesPayload {
  data: Anomaly[]
  baselinePeriods: number
}

const SEVERITY_STYLE: Record<Severity, { bar: string; bg: string; border: string; icon: string; text: string }> = {
  high: {
    bar: "bg-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
    text: "text-red-900",
  },
  medium: {
    bar: "bg-amber-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-600",
    text: "text-amber-900",
  },
  low: {
    bar: "bg-blue-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-600",
    text: "text-blue-900",
  },
}

function formatValue(metricKey: Anomaly["metricKey"], value: number): string {
  if (metricKey === "engagementRate" || metricKey === "bounceRate") {
    return `${(value * 100).toFixed(1)}%`
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export function InsightsPanel({ dateRange, propertyId, filters }: InsightsPanelProps) {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasFiredOnce, setHasFiredOnce] = useState(false)

  useEffect(() => {
    if (!propertyId || !dateRange.startDate || !dateRange.endDate) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const url = buildAnalyticsUrl({
          endpoint: "anomalies",
          dateRange,
          propertyId,
          filters,
        })
        const res = await fetch(url)
        if (!res.ok) {
          // Silently no-op — anomalies panel is non-critical, doesn't deserve
          // a toast. The panel just doesn't render when there's an error.
          if (!cancelled) {
            setAnomalies([])
            setHasFiredOnce(true)
          }
          return
        }
        const data = (await res.json()) as AnomaliesPayload
        if (!cancelled) {
          setAnomalies(data.data ?? [])
          setHasFiredOnce(true)
        }
      } catch {
        if (!cancelled) {
          setAnomalies([])
          setHasFiredOnce(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId, filters])

  // Hide entirely on first load (no flash) and when nothing's anomalous.
  // Quiet by design — no flag = nothing to do, don't take screen real estate.
  if (isLoading || !hasFiredOnce) return null
  if (anomalies.length === 0) return null

  // Cap to 3 — beyond that the panel becomes its own noise.
  const visible = anomalies.slice(0, 3)

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
        <Lightbulb className="w-4 h-4 text-neutral-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Insights
        </span>
        <span className="text-[10px] text-neutral-400 ml-auto">
          vs trailing average · {anomalies.length} flagged
        </span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {visible.map((a) => {
          const style = SEVERITY_STYLE[a.severity]
          const isUp = a.change > 0
          const Icon = a.bad ? AlertTriangle : a.severity === "low" ? Info : isUp ? TrendingUp : TrendingDown
          return (
            <li key={a.metricKey} className="flex items-stretch">
              <div className={`w-1 ${style.bar}`} aria-hidden="true" />
              <div className={`flex-1 px-4 py-3 ${style.bg} flex items-center gap-3`}>
                <Icon className={`w-4 h-4 shrink-0 ${style.icon}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-[13px] font-medium ${style.text}`}>{a.message}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    Now {formatValue(a.metricKey, a.current)} · expected ~
                    {formatValue(a.metricKey, a.expected)}
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
                    a.bad
                      ? "bg-white text-red-700 border border-red-200"
                      : "bg-white text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(a.change).toFixed(1)}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
