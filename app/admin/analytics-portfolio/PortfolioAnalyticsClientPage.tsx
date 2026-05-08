"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Layers,
  Users,
  Eye,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Globe,
  CalendarDays,
  Instagram,
  TrendingUp,
  ChevronRight,
  Award,
  Download,
} from "lucide-react"
import { dateRangeFromUrl, rangeKeyFromDateRange, type RangeKey } from "@/lib/analytics-url-state"
import { buildAnalyticsUrl } from "@/lib/analytics-url"
import { InfoTooltip } from "@/components/analytics/InfoTooltip"
import { BrandPeekDrawerWeb } from "@/components/analytics/BrandPeekDrawerWeb"
import { BrandPeekDrawerInstagram } from "@/components/analytics/BrandPeekDrawerInstagram"
import { downloadPortfolioCSV, downloadPortfolioPNG } from "@/lib/portfolio-export"
import type { DateRange } from "@/types/analytics"
import type {
  InstagramPortfolioSummary,
  InstagramRangeKey,
} from "@/lib/instagram-portfolio"

export interface PortfolioBrandRow {
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

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; full: string }> = [
  { key: "today", label: "Today", full: "Today" },
  { key: "7d", label: "7d", full: "Last 7 days" },
  { key: "30d", label: "30d", full: "Last 30 days" },
  { key: "90d", label: "90d", full: "Last 90 days" },
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

// "Generated 5 min ago" rather than "Generated 12:34:21 PM" — Linear convention
// for recency. Doesn't auto-update; refreshes on next render.
function formatRelativeTime(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 30) return "just now"
  if (seconds < 60) return "less than a minute ago"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return "an hour ago"
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "yesterday"
  return `${days} days ago`
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

  // Instagram rollup runs in parallel — independent loading/error so a slow
  // IG snapshot read doesn't block the GA4 view.
  const [igData, setIgData] = useState<InstagramPortfolioSummary | null>(null)
  const [igIsLoading, setIgIsLoading] = useState(true)
  const [igError, setIgError] = useState<string | null>(null)

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

  // Instagram rollup — snapshot-only, accepts a discrete range key (today/7d/30d/90d)
  // rather than a custom date range. If the user picks a custom range we fall back
  // to 30d so something still renders for the social section.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIgIsLoading(true)
      setIgError(null)
      try {
        const key = rangeKeyFromDateRange(selectedDateRange)
        const igRange: InstagramRangeKey =
          key === "today" || key === "7d" || key === "30d" || key === "90d" ? key : "30d"
        const res = await fetch(`/api/instagram/portfolio?range=${igRange}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const payload = (await res.json()) as InstagramPortfolioSummary
        if (!cancelled) setIgData(payload)
      } catch (err) {
        if (!cancelled) {
          setIgError(err instanceof Error ? err.message : "Failed to load Instagram rollup")
        }
      } finally {
        if (!cancelled) setIgIsLoading(false)
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
          <div className="flex items-start gap-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-lg sm:rounded-xl border border-neutral-200 shrink-0">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 leading-tight">
                Portfolio rollup
              </h1>
              <p className="text-neutral-500 text-xs sm:text-sm leading-snug mt-0.5 flex items-center gap-1.5 flex-wrap">
                {data || igData ? (
                  <>
                    <Globe className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="tabular-nums">
                      {data ? `${data.configuredCount}/${data.totalCount}` : "—/—"} GA4
                    </span>
                    <span className="text-neutral-300">·</span>
                    <Instagram className="w-3 h-3 text-pink-500 shrink-0" />
                    <span className="tabular-nums">
                      {igData ? `${igData.configuredCount}/${igData.totalCount}` : "—/—"} Instagram
                    </span>
                    <span className="text-neutral-300">·</span>
                    <span>{selectedDateRange.label}</span>
                  </>
                ) : (
                  "Aggregating across GA4 properties and Instagram accounts…"
                )}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <ExportButton
                label="CSV"
                disabled={!data && !igData}
                onClick={() =>
                  downloadPortfolioCSV(
                    data,
                    igData,
                    selectedDateRange.label,
                    rangeKeyFromDateRange(selectedDateRange),
                  )
                }
              />
              <ExportButton
                label="PNG"
                disabled={!data && !igData}
                onClick={() =>
                  downloadPortfolioPNG(
                    data,
                    igData,
                    selectedDateRange.label,
                    rangeKeyFromDateRange(selectedDateRange),
                  )
                }
              />
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
                  title={opt.full}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap tabular-nums ${
                    active
                      ? "bg-neutral-900 text-white border border-neutral-900"
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
      <div className="px-4 sm:px-5 lg:px-6 py-6 space-y-8">
        {!isLoading &&
        !igIsLoading &&
        data &&
        igData &&
        data.configuredCount === 0 &&
        igData.configuredCount === 0 ? (
          <PortfolioEmptyState />
        ) : (
          <>
            <WebPortfolioSection
              summary={data}
              isLoading={isLoading}
              error={error}
              dateRange={selectedDateRange}
            />
            <SocialPortfolioSection
              summary={igData}
              isLoading={igIsLoading}
              error={igError}
            />
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

function BrandRow({
  brand,
  onPeek,
}: {
  brand: PortfolioBrandRow
  onPeek: (brand: PortfolioBrandRow) => void
}) {
  const router = useRouter()
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
      className="group hover:bg-neutral-50 transition-colors cursor-pointer"
      onClick={(e) => {
        if (e.shiftKey) {
          router.push(drillUrl)
        } else {
          onPeek(brand)
        }
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
        <div className="inline-flex items-center gap-3 justify-end">
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
          <ChevronRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </tr>
  )
}

// Shared helpers for the two sections — small enough to stay inline rather
// than splitting into their own files.

function formatSignedNumber(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`
  return n.toLocaleString()
}

interface SectionHeaderProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  label: string
}

function SectionHeader({ icon: Icon, iconColor, label }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${iconColor}`} />
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
        {label}
      </h2>
    </div>
  )
}

// Mirrors the final layout (hero card + 3 secondary stats + table rows)
// so the page feels like it's filling in rather than blanking out.
function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 sm:p-6">
          <div className="h-3 w-40 bg-neutral-100 rounded mb-3" />
          <div className="h-10 w-48 bg-neutral-200 rounded" />
          <div className="h-2.5 w-64 bg-neutral-100 rounded mt-3" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-neutral-100 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-2.5 w-24 bg-neutral-100 rounded" />
                <div className="h-4 w-32 bg-neutral-200 rounded mt-1.5" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <div className="h-4 w-24 bg-neutral-100 rounded" />
        </div>
        <div className="divide-y divide-neutral-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="h-3 w-32 bg-neutral-100 rounded" />
              <div className="h-3 w-16 bg-neutral-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200">
      <p className="text-sm font-medium text-red-600">Error</p>
      <p className="text-xs text-red-500 mt-1">{message}</p>
    </div>
  )
}

// ============================================================
// WEB — Google Analytics rollup
// ============================================================

interface WebPortfolioSectionProps {
  summary: PortfolioPayload | null
  isLoading: boolean
  error: string | null
  dateRange: DateRange
}

function WebPortfolioSection({ summary, isLoading, error, dateRange }: WebPortfolioSectionProps) {
  // Single-click row → drawer; shift-click → full dashboard (power-user fast path).
  const [peekBrand, setPeekBrand] = useState<PortfolioBrandRow | null>(null)

  return (
    <section>
      <SectionHeader icon={Globe} iconColor="text-emerald-500" label="Web — Google Analytics" />
      {error && <SectionError message={error} />}
      {isLoading || !summary ? (
        <SectionSkeleton />
      ) : (
        <>
          {/* Hero — portfolio totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 ${
                  summary.totalSessionsChange >= 0 ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-neutral-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Total portfolio sessions
                </span>
                <DeltaBadge change={summary.totalSessionsChange} />
              </div>
              <div className="mt-1 text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight tabular-nums leading-none">
                {summary.total.sessions.toLocaleString()}
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">
                Aggregated across {summary.configuredCount}{" "}
                {summary.configuredCount === 1 ? "property" : "properties"} · vs previous period of same length
              </p>
            </div>

            <div className="space-y-3">
              <SecondaryStat
                icon={Users}
                iconColor="text-blue-600"
                iconBg="bg-blue-100"
                label="Total users"
                value={formatNumber(summary.total.users)}
                change={summary.totalUsersChange}
              />
              <SecondaryStat
                icon={Eye}
                iconColor="text-sky-600"
                iconBg="bg-sky-100"
                label="Total page views"
                value={formatNumber(summary.total.pageViews)}
                change={summary.totalPageViewsChange}
              />
              <SecondaryStat
                icon={Activity}
                iconColor="text-amber-600"
                iconBg="bg-amber-100"
                label="Engagement rate"
                value={`${(summary.total.engagementRate * 100).toFixed(1)}%`}
                change={summary.totalEngagementRateChange}
                subtitle={`Avg ${formatDuration(summary.total.averageEngagementTime)} engaged`}
              />
            </div>
          </div>

          {/* Brand comparison table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">By brand</h3>
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
                  {summary.brands.map((brand) => (
                    <BrandRow key={brand.propertyId} brand={brand} onPeek={setPeekBrand} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Click for a quick peek · shift-click to open the full dashboard.</span>
              <span title={new Date(summary.generatedAt).toLocaleString()}>
                Generated {formatRelativeTime(summary.generatedAt)}
              </span>
            </div>
          </div>
        </>
      )}
      <BrandPeekDrawerWeb
        open={!!peekBrand}
        onClose={() => setPeekBrand(null)}
        brand={peekBrand}
        dateRange={dateRange}
      />
    </section>
  )
}

// ============================================================
// SOCIAL — Instagram rollup
// ============================================================

interface SocialPortfolioSectionProps {
  summary: InstagramPortfolioSummary | null
  isLoading: boolean
  error: string | null
}

function SocialPortfolioSection({ summary, isLoading, error }: SocialPortfolioSectionProps) {
  // Single-click row → drawer; shift-click → full dashboard (power-user fast path).
  const [peekBrand, setPeekBrand] = useState<
    InstagramPortfolioSummary["brands"][number] | null
  >(null)

  // Snapshot history may not cover the requested lookback window yet (e.g. the
  // cron has run for 8 days but the user picked 30d). Detect this so the UI can
  // show "—" rather than misleading 0s.
  const hasAnyBaseline = !!summary?.brands.some((b) => b.priorSnapshotDate)

  // The brand with the highest growth-rate among those that actually have a
  // baseline. Drives the "Best performer" callout — replaces the prior vanity
  // "Total posts" stat that didn't help anyone make a decision.
  const topPerformer = summary?.brands
    .filter((b) => !b.unavailable && b.priorSnapshotDate)
    .reduce<InstagramPortfolioSummary["brands"][number] | null>(
      (best, brand) =>
        best === null || brand.followerGrowthChange > best.followerGrowthChange ? brand : best,
      null,
    ) ?? null

  return (
    <section>
      <SectionHeader icon={Instagram} iconColor="text-pink-500" label="Social — Instagram" />
      {error && <SectionError message={error} />}
      {isLoading || !summary ? (
        <SectionSkeleton />
      ) : summary.configuredCount === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl p-8 text-center">
          <Instagram className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-700">
            No Instagram snapshots yet
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            The daily cron at <code className="text-[11px] bg-neutral-100 px-1 py-0.5 rounded">/api/cron/instagram-snapshot</code> hasn&apos;t produced a snapshot for any account.
          </p>
        </div>
      ) : (
        <>
          {/* Hero — Instagram totals */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 sm:p-6 relative overflow-hidden">
              <div
                className={`absolute top-0 left-0 right-0 h-0.5 ${
                  !hasAnyBaseline
                    ? "bg-neutral-200"
                    : summary.totalFollowersChange >= 0
                    ? "bg-emerald-500"
                    : "bg-red-500"
                }`}
              />
              <div className="flex items-center gap-2 mb-1">
                <Instagram className="w-4 h-4 text-neutral-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Total portfolio followers
                </span>
                {hasAnyBaseline && <DeltaBadge change={summary.totalFollowersChange} />}
              </div>
              <div className="mt-1 text-4xl sm:text-5xl font-bold text-neutral-900 tracking-tight tabular-nums leading-none">
                {summary.total.followers.toLocaleString()}
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">
                Aggregated across {summary.configuredCount}{" "}
                {summary.configuredCount === 1 ? "account" : "accounts"}
                {hasAnyBaseline
                  ? ` · snapshot diff vs ${RANGE_LABEL[summary.rangeKey]}`
                  : " · snapshot history doesn't cover this lookback yet — growth metrics will appear once enough days have been snapshotted"}
              </p>
            </div>

            <div className="space-y-3">
              <SecondaryStat
                icon={TrendingUp}
                iconColor={
                  !hasAnyBaseline
                    ? "text-neutral-400"
                    : summary.total.netFollowerGrowth >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }
                iconBg={
                  !hasAnyBaseline
                    ? "bg-neutral-100"
                    : summary.total.netFollowerGrowth >= 0
                    ? "bg-emerald-100"
                    : "bg-red-100"
                }
                label="Net follower growth"
                value={hasAnyBaseline ? formatSignedNumber(summary.total.netFollowerGrowth) : "—"}
                change={0}
                subtitle={hasAnyBaseline ? "this period" : "no baseline yet"}
              />
              <SecondaryStat
                icon={Award}
                iconColor="text-emerald-600"
                iconBg="bg-emerald-100"
                label="Best performer"
                value={topPerformer ? topPerformer.name : "—"}
                change={topPerformer ? topPerformer.followerGrowthChange : 0}
                subtitle={
                  topPerformer
                    ? `${formatSignedNumber(topPerformer.netFollowerGrowth)} new followers`
                    : "no baseline yet"
                }
              />
              <SecondaryStat
                icon={Layers}
                iconColor="text-neutral-600"
                iconBg="bg-neutral-100"
                label="Accounts active"
                value={`${summary.configuredCount} of ${summary.totalCount}`}
                change={0}
                subtitle={summary.configuredCount === summary.totalCount ? "all reporting" : "some unavailable"}
              />
            </div>
          </div>

          {/* Brand comparison table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">By account</h3>
              <InfoTooltip content="Per-account breakdown — followers and growth come from snapshot diffs. Click a row to open that account's full Instagram dashboard." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50">
                  <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="text-left px-5 py-2.5">Account</th>
                    <th className="text-right px-5 py-2.5">Followers</th>
                    <th className="text-right px-5 py-2.5">Net growth</th>
                    <th className="text-right px-5 py-2.5">Growth %</th>
                    <th className="text-right px-5 py-2.5">Posts</th>
                    <th className="text-right px-5 py-2.5">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {summary.brands.map((brand) => (
                    <InstagramBrandRow key={brand.account} brand={brand} onPeek={setPeekBrand} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between text-[11px] text-neutral-400">
              <span>Click for a quick peek · shift-click to open the full dashboard.</span>
              <span title={new Date(summary.generatedAt).toLocaleString()}>
                Generated {formatRelativeTime(summary.generatedAt)}
              </span>
            </div>
          </div>
        </>
      )}
      <BrandPeekDrawerInstagram
        open={!!peekBrand}
        onClose={() => setPeekBrand(null)}
        brand={peekBrand}
      />
    </section>
  )
}

const RANGE_LABEL: Record<InstagramRangeKey, string> = {
  today: "yesterday",
  "7d": "7 days ago",
  "30d": "30 days ago",
  "90d": "90 days ago",
}

function InstagramBrandRow({
  brand,
  onPeek,
}: {
  brand: InstagramPortfolioSummary["brands"][number]
  onPeek: (brand: InstagramPortfolioSummary["brands"][number]) => void
}) {
  const router = useRouter()
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

  const drillUrl = `/admin/analytics?tab=instagram&account=${encodeURIComponent(brand.account)}`
  // No baseline exists when the requested lookback predates the snapshot
  // history (e.g. asking for 30d growth when the cron has only run 8 days).
  // Show "—" rather than a misleading "0" / "0%".
  const hasBaseline = !!brand.priorSnapshotDate
  const growthColor =
    brand.netFollowerGrowth > 0
      ? "text-emerald-700"
      : brand.netFollowerGrowth < 0
      ? "text-red-700"
      : "text-neutral-500"

  return (
    <tr
      className="group hover:bg-neutral-50 transition-colors cursor-pointer"
      onClick={(e) => {
        if (e.shiftKey) {
          router.push(drillUrl)
        } else {
          onPeek(brand)
        }
      }}
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-neutral-900 truncate">{brand.name}</span>
          {brand.username && (
            <span className="text-[11px] text-neutral-400 truncate">@{brand.username}</span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <span className="text-[13px] font-semibold text-neutral-900 tabular-nums">
          {brand.followersCount.toLocaleString()}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        {hasBaseline ? (
          <span className={`text-[13px] font-semibold tabular-nums ${growthColor}`}>
            {formatSignedNumber(brand.netFollowerGrowth)}
          </span>
        ) : (
          <span className="text-[11px] text-neutral-300">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {hasBaseline ? (
          <DeltaBadge change={brand.followerGrowthChange} />
        ) : (
          <span className="text-[11px] text-neutral-300">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-2 justify-end">
          <span className="text-[13px] text-neutral-700 tabular-nums">
            {brand.mediaCount.toLocaleString()}
          </span>
          {brand.mediaAdded !== 0 && (
            <span className="text-[10px] text-neutral-400 tabular-nums">
              {formatSignedNumber(brand.mediaAdded)}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="inline-flex items-center gap-3 justify-end">
          <div className="inline-flex flex-col items-end gap-0.5 min-w-[80px]">
            <span className="text-[11px] text-neutral-500 tabular-nums">
              {(brand.followerShare * 100).toFixed(1)}%
            </span>
            <div className="w-20 h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-pink-500"
                style={{ width: `${(brand.followerShare * 100).toFixed(1)}%` }}
              />
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </tr>
  )
}

// ============================================================
// Empty state — both sources unconfigured
// ============================================================

function PortfolioEmptyState() {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-8 sm:p-12 max-w-2xl mx-auto">
      <div className="text-center">
        <div className="inline-flex p-3 bg-neutral-100 rounded-xl mb-4">
          <Layers className="w-6 h-6 text-neutral-400" />
        </div>
        <h2 className="text-lg font-bold text-neutral-900">No analytics sources configured</h2>
        <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto">
          Connect a GA4 property or set up the Instagram snapshot cron, then refresh this page.
          The rollup populates automatically as data arrives.
        </p>
      </div>
      <div className="mt-6 grid sm:grid-cols-2 gap-3">
        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-emerald-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              Google Analytics
            </span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Set <code className="text-[11px] bg-neutral-100 px-1 py-0.5 rounded">ANALYTICS_PROPERTY_ID_*</code>{" "}
            env vars and grant the service account viewer access on each GA4 property.
          </p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Instagram className="w-4 h-4 text-pink-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
              Instagram
            </span>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Configure <code className="text-[11px] bg-neutral-100 px-1 py-0.5 rounded">INSTAGRAM_ACCESS_TOKEN_*</code>{" "}
            and <code className="text-[11px] bg-neutral-100 px-1 py-0.5 rounded">FACEBOOK_PAGE_ID_*</code> env vars,
            then wait for the daily snapshot cron.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Export button — small icon button used in the header
// ============================================================

interface ExportButtonProps {
  label: string
  disabled?: boolean
  onClick: () => void
}

function ExportButton({ label, disabled, onClick }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Download ${label}`}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  )
}
