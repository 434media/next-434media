"use client"

import { useEffect, useState } from "react"
import { ArrowUpRight, ArrowDownRight, Eye, Users, Activity, Loader2 } from "lucide-react"
import type { DateRange } from "../../types/analytics"
import { buildAnalyticsUrl } from "../../lib/analytics-url"

interface HeroMetricProps {
  dateRange: DateRange
  propertyId: string
  useSnapshot?: boolean
  setError?: (e: string | null) => void
  onSnapshotMeta?: (meta: { snapshotDate: string; generatedAt: string } | null) => void
}

interface SummaryData {
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  engagementRate: number
  averageEngagementTime: number
  sessionsChange: number
  usersChange: number
  pageViewsChange: number
  engagementRateChange: number
}

interface DailyPoint {
  date: string
  sessions: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatDuration(s: number): string {
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const r = Math.round(s % 60)
  return r > 0 ? `${m}m ${r}s` : `${m}m`
}

/**
 * Tiny inline sparkline. No chart library — just SVG path math. Sized to
 * fill its parent container; tracks the data via viewBox preserveAspectRatio.
 */
function Sparkline({ data, color = "currentColor" }: { data: number[]; color?: string }) {
  if (data.length < 2) {
    return <div className="h-12 sm:h-16 w-full bg-neutral-100 rounded animate-pulse" />
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 30

  // Map data to SVG points, leaving 1px padding so stroke doesn't clip
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1
    const y = h - ((v - min) / range) * (h - 2) - 1
    return [x, y] as const
  })

  // Smooth-ish line via simple line segments — sparklines don't need bezier
  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")

  // Closed area underneath the line for the fill
  const lastX = points[points.length - 1][0]
  const firstX = points[0][0]
  const areaPath = `${linePath} L${lastX.toFixed(1)},${h} L${firstX.toFixed(1)},${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-12 sm:h-16 overflow-visible"
      aria-hidden="true"
    >
      <path d={areaPath} fill={color} fillOpacity="0.08" />
      <path d={linePath} stroke={color} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * Renders a delta badge with the right arrow and color. Lower-is-better
 * metrics (none in this hero, but might be added later) can pass invert=true.
 */
function DeltaBadge({ change, invert = false }: { change: number; invert?: boolean }) {
  if (!change) return null
  const isUp = change > 0
  const isGood = invert ? !isUp : isUp
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
        isGood
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-red-100 text-red-700 border border-red-200"
      }`}
    >
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

export function HeroMetric({
  dateRange,
  propertyId,
  useSnapshot,
  setError,
  onSnapshotMeta,
}: HeroMetricProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!propertyId || !dateRange.startDate || !dateRange.endDate) return
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      try {
        // Two parallel fetches — totals for the hero number/delta, daily
        // points for the sparkline. Both already-cached endpoints from PR 3a.
        const [summaryRes, dailyRes] = await Promise.all([
          fetch(buildAnalyticsUrl({ endpoint: "summary", dateRange, propertyId, useSnapshot })),
          fetch(buildAnalyticsUrl({ endpoint: "daily-metrics", dateRange, propertyId, useSnapshot })),
        ])

        if (summaryRes.ok) {
          const result = await summaryRes.json()
          if (!cancelled) {
            setSummary({
              totalSessions: result.totalSessions || 0,
              totalUsers: result.totalUsers || 0,
              totalPageViews: result.totalPageViews || 0,
              engagementRate: result.engagementRate || 0,
              averageEngagementTime: result.averageEngagementTime || 0,
              sessionsChange: result.sessionsChange || 0,
              usersChange: result.usersChange || 0,
              pageViewsChange: result.pageViewsChange || 0,
              engagementRateChange: result.engagementRateChange || 0,
            })
            if (result._snapshot && onSnapshotMeta) {
              onSnapshotMeta({
                snapshotDate: result._snapshot.snapshotDate,
                generatedAt: result._snapshot.generatedAt,
              })
            }
          }
        }

        if (dailyRes.ok) {
          const result = await dailyRes.json()
          const points: DailyPoint[] = (result.data ?? []).map((d: { date: string; sessions: number }) => ({
            date: d.date,
            sessions: d.sessions || 0,
          }))
          if (!cancelled) setDaily(points)
        }
      } catch (err) {
        if (setError) setError(err instanceof Error ? err.message : "Failed to load metrics")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [dateRange, propertyId, useSnapshot, setError, onSnapshotMeta])

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-6 sm:p-8 flex items-center justify-center min-h-[180px]">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-neutral-200 p-4 h-[60px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const sparklineSeries = daily.map((d) => d.sessions)
  const sessionsUp = summary.sessionsChange >= 0
  const sparkColor = sessionsUp ? "#10b981" : "#ef4444"

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Hero — Sessions, big number, sparkline */}
      <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 relative overflow-hidden">
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${sessionsUp ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-red-500 to-orange-500"}`}
        />
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                Sessions
              </span>
              <DeltaBadge change={summary.sessionsChange} />
            </div>
            <div className="mt-1 text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight tabular-nums leading-none">
              {summary.totalSessions.toLocaleString()}
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              vs previous period of same length
            </p>
          </div>
        </div>
        <div className="mt-4" style={{ color: sparkColor }}>
          <Sparkline data={sparklineSeries} />
        </div>
      </div>

      {/* Secondary metrics — Users / Page Views / Engagement Rate */}
      <div className="space-y-3">
        <SecondaryCard
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          label="Users"
          value={formatNumber(summary.totalUsers)}
          change={summary.usersChange}
        />
        <SecondaryCard
          icon={Eye}
          iconColor="text-violet-600"
          iconBg="bg-violet-100"
          label="Page views"
          value={formatNumber(summary.totalPageViews)}
          change={summary.pageViewsChange}
        />
        <SecondaryCard
          icon={Activity}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          label="Engagement rate"
          value={`${(summary.engagementRate * 100).toFixed(1)}%`}
          change={summary.engagementRateChange}
          subtitle={`Avg ${formatDuration(summary.averageEngagementTime)} engaged`}
        />
      </div>
    </div>
  )
}

interface SecondaryCardProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  label: string
  value: string
  change: number
  subtitle?: string
}

function SecondaryCard({ icon: Icon, iconColor, iconBg, label, value, change, subtitle }: SecondaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBg} shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 truncate">
            {label}
          </span>
          <DeltaBadge change={change} />
        </div>
        <div className="mt-0.5 text-lg sm:text-xl font-bold text-neutral-900 tabular-nums leading-tight">
          {value}
        </div>
        {subtitle && <p className="text-[10px] text-neutral-400 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}
