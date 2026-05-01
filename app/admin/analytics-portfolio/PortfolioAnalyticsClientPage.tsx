"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Loader2,
  Layers,
  Users,
  Eye,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  CalendarDays,
} from "lucide-react"
import { dateRangeFromUrl, rangeKeyFromDateRange, type RangeKey } from "@/lib/analytics-url-state"
import { buildAnalyticsUrl } from "@/lib/analytics-url"
import { InfoTooltip } from "@/components/analytics/InfoTooltip"
import type { DateRange } from "@/types/analytics"

interface PortfolioBrandRow {
  propertyId: string
  name: string
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  newUsers: number
  engagementRate: number
  averageEngagementTime: number
  sessionsChange: number
  usersChange: number
  pageViewsChange: number
  engagementRateChange: number
  sessionShare: number
  unavailable?: boolean
  error?: string
}

interface PortfolioPayload {
  total: {
    sessions: number
    users: number
    pageViews: number
    newUsers: number
    engagementRate: number
    averageEngagementTime: number
  }
  totalSessionsChange: number
  totalUsersChange: number
  totalPageViewsChange: number
  totalEngagementRateChange: number
  brands: PortfolioBrandRow[]
  configuredCount: number
  totalCount: number
  generatedAt: string
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
]

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

function DeltaBadge({ change }: { change: number }) {
  if (!change) return <span className="text-[11px] text-neutral-300">—</span>
  const isUp = change > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold tabular-nums ${
        isUp
          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
          : "bg-red-100 text-red-700 border border-red-200"
      }`}
    >
      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

export default function PortfolioAnalyticsClientPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() =>
    dateRangeFromUrl(new URLSearchParams(searchParams?.toString() ?? "")),
  )
  const [data, setData] = useState<PortfolioPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // URL ↔ state — same pattern as the GA4 page (PR 3a)
  useEffect(() => {
    const current = new URLSearchParams(searchParams?.toString() ?? "")
    const next = new URLSearchParams(current.toString())
    const desiredKey = rangeKeyFromDateRange(selectedDateRange)
    next.set("range", desiredKey)
    if (desiredKey === "custom") {
      next.set("start", selectedDateRange.startDate)
      next.set("end", selectedDateRange.endDate)
    } else {
      next.delete("start")
      next.delete("end")
    }
    if (next.toString() !== current.toString()) {
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateRange])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(
          buildAnalyticsUrl({ endpoint: "portfolio", dateRange: selectedDateRange }),
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const payload = (await res.json()) as PortfolioPayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load portfolio")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedDateRange])

  return (
    <div className="w-full bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-lg sm:rounded-xl border border-neutral-200 shrink-0">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                Portfolio rollup
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-snug mt-0.5">
                {data
                  ? `${data.configuredCount} of ${data.totalCount} GA4 properties · ${selectedDateRange.label}`
                  : "Aggregating across all configured GA4 properties…"}
              </p>
            </div>
          </div>
        </div>

        {/* Range chips */}
        <div className="border-t border-neutral-100 bg-neutral-50">
          <div className="px-4 sm:px-5 lg:px-6 py-3 flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 text-teal-600 shrink-0" />
            {RANGE_OPTIONS.map((opt) => {
              const active = rangeKeyFromDateRange(selectedDateRange) === opt.key
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (opt.key === "today") {
                      setSelectedDateRange({ startDate: "today", endDate: "today", label: "Today" })
                    } else if (opt.key === "7d") {
                      setSelectedDateRange({ startDate: "7daysAgo", endDate: "today", label: "Last 7 days" })
                    } else if (opt.key === "30d") {
                      setSelectedDateRange({ startDate: "30daysAgo", endDate: "today", label: "Last 30 days" })
                    } else if (opt.key === "90d") {
                      setSelectedDateRange({ startDate: "90daysAgo", endDate: "today", label: "Last 90 days" })
                    }
                  }}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                    active
                      ? "bg-teal-600 text-white border border-teal-600"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 lg:px-6 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-600">Error</p>
            <p className="text-xs text-red-500 mt-1">{error}</p>
          </div>
        )}

        {isLoading || !data ? (
          <div className="bg-white border border-neutral-200 rounded-xl p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <>
            {/* Hero — portfolio totals */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    data.totalSessionsChange >= 0
                      ? "bg-gradient-to-r from-teal-500 to-emerald-500"
                      : "bg-gradient-to-r from-red-500 to-orange-500"
                  }`}
                />
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-neutral-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Total portfolio sessions
                  </span>
                  <DeltaBadge change={data.totalSessionsChange} />
                </div>
                <div className="mt-1 text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight tabular-nums leading-none">
                  {data.total.sessions.toLocaleString()}
                </div>
                <p className="mt-1.5 text-xs text-neutral-500">
                  Aggregated across {data.configuredCount}{" "}
                  {data.configuredCount === 1 ? "property" : "properties"} · vs previous period of same length
                </p>
              </div>

              <div className="space-y-3">
                <SecondaryStat
                  icon={Users}
                  iconColor="text-blue-600"
                  iconBg="bg-blue-100"
                  label="Total users"
                  value={formatNumber(data.total.users)}
                  change={data.totalUsersChange}
                />
                <SecondaryStat
                  icon={Eye}
                  iconColor="text-sky-600"
                  iconBg="bg-sky-100"
                  label="Total page views"
                  value={formatNumber(data.total.pageViews)}
                  change={data.totalPageViewsChange}
                />
                <SecondaryStat
                  icon={Activity}
                  iconColor="text-amber-600"
                  iconBg="bg-amber-100"
                  label="Engagement rate"
                  value={`${(data.total.engagementRate * 100).toFixed(1)}%`}
                  change={data.totalEngagementRateChange}
                  subtitle={`Avg ${formatDuration(data.total.averageEngagementTime)} engaged`}
                />
              </div>
            </div>

            {/* Brand comparison table */}
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
                <h2 className="text-base font-bold text-neutral-900">By brand</h2>
                <InfoTooltip content="Per-property breakdown sorted by sessions. Engagement rate column is GA4's primary quality signal. Properties without env-var configuration are listed at the bottom with a 'not configured' note." />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      <th className="text-left px-5 py-2.5">Brand</th>
                      <th className="text-right px-5 py-2.5">Sessions</th>
                      <th className="text-right px-5 py-2.5">Users</th>
                      <th className="text-right px-5 py-2.5">Page views</th>
                      <th className="text-right px-5 py-2.5">Engagement</th>
                      <th className="text-right px-5 py-2.5">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.brands.map((brand) => (
                      <BrandRow key={brand.propertyId} brand={brand} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-[11px] text-neutral-400">
                <span>Click any brand to drill into its full GA4 dashboard.</span>
                <span>Generated {new Date(data.generatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface SecondaryStatProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  label: string
  value: string
  change: number
  subtitle?: string
}

function SecondaryStat({ icon: Icon, iconColor, iconBg, label, value, change, subtitle }: SecondaryStatProps) {
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

function BrandRow({ brand }: { brand: PortfolioBrandRow }) {
  if (brand.unavailable) {
    return (
      <tr className="opacity-60">
        <td className="px-5 py-3" colSpan={6}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-neutral-700">{brand.name}</span>
            <span className="text-[11px] text-neutral-400 italic truncate">
              {brand.error || "Unavailable"}
            </span>
          </div>
        </td>
      </tr>
    )
  }

  // Drill-down — open this brand in the single-property GA4 page
  const drillUrl = `/admin/analytics-web?range=30d&property=${encodeURIComponent(brand.propertyId)}`

  return (
    <tr
      className="hover:bg-neutral-50 transition-colors cursor-pointer"
      onClick={() => {
        window.location.href = drillUrl
      }}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-neutral-900 truncate">{brand.name}</span>
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <span className="text-[13px] font-semibold text-neutral-900 tabular-nums">
            {brand.totalSessions.toLocaleString()}
          </span>
          <DeltaBadge change={brand.sessionsChange} />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <span className="text-[13px] text-neutral-700 tabular-nums">
            {brand.totalUsers.toLocaleString()}
          </span>
          <DeltaBadge change={brand.usersChange} />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <span className="text-[13px] text-neutral-700 tabular-nums">
            {brand.totalPageViews.toLocaleString()}
          </span>
          <DeltaBadge change={brand.pageViewsChange} />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <span className="text-[13px] text-neutral-700 tabular-nums">
            {(brand.engagementRate * 100).toFixed(1)}%
          </span>
          <DeltaBadge change={brand.engagementRateChange} />
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        {/* Inline share-of-portfolio bar — visual at-a-glance for who dominates */}
        <div className="inline-flex flex-col items-end gap-0.5 min-w-[80px]">
          <span className="text-[11px] text-neutral-500 tabular-nums">
            {(brand.sessionShare * 100).toFixed(1)}%
          </span>
          <div className="w-20 h-1 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500"
              style={{ width: `${(brand.sessionShare * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      </td>
    </tr>
  )
}
