"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { AnalyticsHeader } from "@/components/analytics/AnalyticsHeader"
import { HeroMetric } from "@/components/analytics/HeroMetric"
import { WhatChangedPanel } from "@/components/analytics/WhatChangedPanel"
import { PageViewsChart } from "@/components/analytics/PageViewsChart"
import { TopPagesTable } from "@/components/analytics/TopPagesTable"
import { TrafficSourcesChart } from "@/components/analytics/TrafficSourcesChart"
import { DeviceBreakdown } from "@/components/analytics/DeviceBreakdown"
import { GeographicMap } from "@/components/analytics/GeographicMap"
import { InfoTooltip } from "@/components/analytics/InfoTooltip"
import { EventsConversionsPanel } from "@/components/analytics/EventsConversionsPanel"
import { SearchPerformancePanel } from "@/components/analytics/SearchPerformancePanel"
import { CoreWebVitalsPanel } from "@/components/analytics/CoreWebVitalsPanel"
import { CohortRetentionPanel } from "@/components/analytics/CohortRetentionPanel"
import { InsightsPanel } from "@/components/analytics/InsightsPanel"
import { AnnotationManager, type ChartAnnotation } from "@/components/analytics/AnnotationManager"
import { GoalsKpiPanel } from "@/components/analytics/GoalsKpiPanel"
import { AnalyticsFilterBar } from "@/components/analytics/AnalyticsFilterBar"
import { dateRangeFromUrl, rangeKeyFromDateRange } from "@/lib/analytics-url-state"
import type { DateRange, AnalyticsConnectionStatus, AnalyticsProperty, AnalyticsFilters } from "@/types/analytics"

/**
 * CSV export — refreshed for Phases 2–5. Honors the active filter set,
 * includes engagement metrics, channel grouping, period-over-period deltas,
 * conversions, geographic, and goals progress when present. Stamps the
 * header with the active filters so the recipient knows what they're looking at.
 */
async function downloadAnalyticsCSV(
  dateRange: DateRange,
  propertyId?: string,
  propertyName?: string,
  filters?: AnalyticsFilters,
) {
  try {
    // Build filter query suffix once — applies only to filter-aware endpoints.
    const filterParams = new URLSearchParams()
    if (filters?.deviceCategory) filterParams.set("device", filters.deviceCategory)
    if (filters?.channelGroup) filterParams.set("channel", filters.channelGroup)
    if (filters?.country) filterParams.set("country", filters.country)
    const filterSuffix = filterParams.toString() ? `&${filterParams.toString()}` : ""

    const url = (endpoint: string, withFilters: boolean) =>
      `/api/analytics?endpoint=${endpoint}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${propertyId ? `&propertyId=${propertyId}` : ""}${withFilters ? filterSuffix : ""}`

    // Parallel fetch — summary/pages respect filters, source/device/geo/conversions/goals don't
    const [summaryRes, pagesRes, trafficRes, devicesRes, geoRes, conversionsRes, goalsRes] =
      await Promise.all([
        fetch(url("summary", true)),
        fetch(url("top-pages", true)),
        fetch(url("trafficsources", false)),
        fetch(url("devices", false)),
        fetch(url("geographic", false)),
        fetch(url("conversions", false)),
        propertyId
          ? fetch(`/api/admin/analytics/goals/evaluate?propertyId=${encodeURIComponent(propertyId)}`)
          : Promise.resolve(null),
      ])

    if (!summaryRes.ok) {
      throw new Error("Failed to fetch analytics data")
    }

    const summary = await summaryRes.json()
    const pages = pagesRes.ok ? (await pagesRes.json()).data ?? [] : []
    const traffic = trafficRes.ok ? (await trafficRes.json()).data ?? [] : []
    const devices = devicesRes.ok ? (await devicesRes.json()).data ?? [] : []
    const geo = geoRes.ok ? (await geoRes.json()).data ?? [] : []
    const conversions = conversionsRes.ok ? (await conversionsRes.json()).data ?? [] : []
    const goals = goalsRes && goalsRes.ok ? (await goalsRes.json()).evaluations ?? [] : []

    // Property identification
    const displayPropertyId = propertyId || summary.propertyId || "488543948"
    const displayPropertyName = propertyName || PROPERTY_NAMES[displayPropertyId] || "434 MEDIA"

    // Filename: <brand>-analytics-<range>-<today>.csv
    const today = new Date().toISOString().split("T")[0]
    const labelSlug = (dateRange.label || "custom").replace(/\s+/g, "-").toLowerCase()
    const propertySlug = displayPropertyName.replace(/\s+/g, "-").toLowerCase()
    const filename = `${propertySlug}-analytics-${labelSlug}-${today}.csv`

    // CSV value formatters
    const fmtPct = (v: number) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "")
    const fmtDuration = (s: number) => {
      if (!s) return "0s"
      if (s < 60) return `${Math.round(s)}s`
      const m = Math.floor(s / 60)
      const r = Math.round(s % 60)
      return r > 0 ? `${m}m ${r}s` : `${m}m`
    }
    const fmtChange = (v: number) => (typeof v === "number" && v !== 0 ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : "")
    const csvEscape = (v: string | number | undefined) => {
      const str = String(v ?? "")
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    // Build CSV content
    let csv = ""

    // Header block — context the recipient needs
    csv += `${displayPropertyName} Analytics Report\n`
    csv += `Property ID: ${displayPropertyId}\n`
    csv += `Date Range: ${dateRange.label || "Custom"} (${dateRange.startDate} to ${dateRange.endDate})\n`
    if (filterParams.toString()) {
      const activeFilters: string[] = []
      if (filters?.deviceCategory) activeFilters.push(`Device = ${filters.deviceCategory}`)
      if (filters?.channelGroup) activeFilters.push(`Channel = ${filters.channelGroup}`)
      if (filters?.country) activeFilters.push(`Country = ${filters.country}`)
      csv += `Active filters: ${activeFilters.join(" · ")}\n`
    }
    csv += `Generated: ${new Date().toLocaleString()}\n\n`

    // === Key Metrics === — current + previous + delta in three columns
    csv += "=== KEY METRICS ===\n"
    csv += "Metric,Current,Previous,Change %\n"
    const prev = summary.previousPeriod
    const metricRows: Array<[string, number | string, number | string, string]> = [
      ["Sessions", summary.totalSessions, prev?.totalSessions ?? "", fmtChange(summary.sessionsChange)],
      ["Users", summary.totalUsers, prev?.totalUsers ?? "", fmtChange(summary.usersChange)],
      ["New users", summary.newUsers, prev?.newUsers ?? "", fmtChange(summary.newUsersChange)],
      ["Page views", summary.totalPageViews, prev?.totalPageViews ?? "", fmtChange(summary.pageViewsChange)],
      ["Engaged sessions", summary.engagedSessions, prev?.engagedSessions ?? "", fmtChange(summary.engagedSessionsChange)],
      ["Engagement rate", fmtPct(summary.engagementRate), prev ? fmtPct(prev.engagementRate) : "", fmtChange(summary.engagementRateChange)],
      ["Avg engagement time", fmtDuration(summary.averageEngagementTime), prev ? fmtDuration(prev.averageEngagementTime) : "", fmtChange(summary.averageEngagementTimeChange)],
      ["Bounce rate", fmtPct(summary.bounceRate), prev ? fmtPct(prev.bounceRate) : "", fmtChange(summary.bounceRateChange)],
    ]
    for (const row of metricRows) {
      csv += row.map(csvEscape).join(",") + "\n"
    }

    // === Top Pages === — now with engagement rate
    if (pages.length > 0) {
      csv += "\n=== TOP PAGES ===\n"
      csv += "Path,Title,Views,Sessions,Engagement Rate\n"
      for (const page of pages.slice(0, 20)) {
        csv +=
          [
            csvEscape(page.path || "/"),
            csvEscape(page.title || ""),
            page.pageViews ?? 0,
            page.sessions ?? 0,
            fmtPct(page.engagementRate ?? 0),
          ].join(",") + "\n"
      }
    }

    // === Traffic by Channel === — bucket source/medium rows by channelGroup,
    // sessions-weighted engagement rate. Same logic as the dashboard panel.
    if (traffic.length > 0) {
      type SourceRow = {
        source: string
        medium: string
        channelGroup: string
        sessions: number
        users: number
        engagedSessions: number
      }
      const buckets = new Map<string, { sessions: number; users: number; engaged: number }>()
      for (const row of traffic as SourceRow[]) {
        const key = row.channelGroup || "Other"
        const b = buckets.get(key) || { sessions: 0, users: 0, engaged: 0 }
        b.sessions += row.sessions || 0
        b.users += row.users || 0
        b.engaged += row.engagedSessions || 0
        buckets.set(key, b)
      }
      csv += "\n=== TRAFFIC BY CHANNEL ===\n"
      csv += "Channel,Sessions,Users,Engagement Rate,Share %\n"
      const totalSessions = Array.from(buckets.values()).reduce((s, b) => s + b.sessions, 0)
      const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => b[1].sessions - a[1].sessions)
      for (const [channel, b] of sortedBuckets) {
        const engRate = b.sessions > 0 ? b.engaged / b.sessions : 0
        const share = totalSessions > 0 ? b.sessions / totalSessions : 0
        csv +=
          [csvEscape(channel), b.sessions, b.users, fmtPct(engRate), fmtPct(share)].join(",") + "\n"
      }
    }

    // === Device Types === — share % column
    if (devices.length > 0) {
      csv += "\n=== DEVICE TYPES ===\n"
      csv += "Device,Sessions,Users,Share %\n"
      const total = devices.reduce(
        (sum: number, d: { sessions?: number }) => sum + (d.sessions || 0),
        0,
      )
      for (const device of devices) {
        const share = total > 0 ? device.sessions / total : 0
        csv +=
          [csvEscape(device.deviceCategory), device.sessions ?? 0, device.users ?? 0, fmtPct(share)].join(",") +
          "\n"
      }
    }

    // === Geographic — Top 15 ===
    if (geo.length > 0) {
      // Aggregate by country (GA4 returns country/city pairs)
      const countryMap = new Map<string, { sessions: number; newUsers: number }>()
      for (const row of geo as Array<{ country: string; city: string; sessions: number; newUsers: number }>) {
        if (!row.country || row.country === "(not set)") continue
        const c = countryMap.get(row.country) || { sessions: 0, newUsers: 0 }
        c.sessions += row.sessions || 0
        c.newUsers += row.newUsers || 0
        countryMap.set(row.country, c)
      }
      const totalGeoSessions = Array.from(countryMap.values()).reduce((s, c) => s + c.sessions, 0)
      const sortedCountries = Array.from(countryMap.entries())
        .sort((a, b) => b[1].sessions - a[1].sessions)
        .slice(0, 15)
      if (sortedCountries.length > 0) {
        csv += "\n=== GEOGRAPHIC — TOP COUNTRIES ===\n"
        csv += "Country,Sessions,New Users,Share %\n"
        for (const [country, c] of sortedCountries) {
          const share = totalGeoSessions > 0 ? c.sessions / totalGeoSessions : 0
          csv += [csvEscape(country), c.sessions, c.newUsers, fmtPct(share)].join(",") + "\n"
        }
      }
    }

    // === Conversions === (only when present)
    if (conversions.length > 0) {
      csv += "\n=== CONVERSIONS ===\n"
      csv += "Event,Conversions,Total Revenue,Conversion Rate\n"
      for (const c of conversions as Array<{
        eventName: string
        conversions: number
        totalRevenue: number
        conversionRate: number
      }>) {
        csv +=
          [
            csvEscape(c.eventName),
            c.conversions,
            c.totalRevenue ? `$${c.totalRevenue.toFixed(2)}` : "",
            fmtPct(c.conversionRate ?? 0),
          ].join(",") + "\n"
      }
    }

    // === Goals Progress === (only when goals exist)
    if (goals.length > 0) {
      csv += "\n=== GOALS PROGRESS ===\n"
      csv += "Name,Source,Period,Current,Target,% to Goal,Status\n"
      for (const g of goals) {
        csv +=
          [
            csvEscape(g.goal.name),
            csvEscape(g.goal.source),
            csvEscape(g.goal.period),
            g.current,
            g.goal.target,
            `${(g.progress * 100).toFixed(1)}%`,
            csvEscape(g.status),
          ].join(",") + "\n"
      }
    }

    // Trigger download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error('Download failed:', error)
    alert('Failed to download analytics report. Please try again.')
  }
}

// Property name lookup map
const PROPERTY_NAMES: Record<string, string> = {
  '488543948': '434 MEDIA',
  '492867424': 'TXMX Boxing',
  '492895637': 'Vemos Vamos',
  '492925168': 'AIM Health R&D Summit',
  '492857375': 'Salute to Troops',
  '488563710': 'The AMPD Project',
  '492925088': 'Digital Canvas',
}

// PNG export removed (was 270+ LOC of canvas drawing that drifted out of
// sync with everything we built in Phases 2–5). Replaced with Copy share
// link, which leverages the URL state from PR 3a — better for "show this
// to someone" use cases than a static raster.

/**
 * Snapshot freshness indicator. Tells the rep whether they're looking at
 * this morning's cached snapshot (default — fast) or a live GA4 query.
 * Click to toggle between the two modes — also flips the `?live=1` URL param.
 */
function SnapshotPill({
  meta,
  useSnapshot,
  onToggle,
}: {
  meta: { snapshotDate: string; generatedAt: string } | null
  useSnapshot: boolean
  onToggle: () => void
}) {
  const baseClasses =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer hover:brightness-95"

  if (!useSnapshot) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Click to switch to cached snapshot (faster)"
        className={`${baseClasses} bg-emerald-50 text-emerald-700 border border-emerald-100`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Live data
      </button>
    )
  }
  if (!meta) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Click to switch to live data"
        className={`${baseClasses} bg-neutral-100 text-neutral-500 border border-neutral-200`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
        Loading snapshot…
      </button>
    )
  }
  let when = meta.generatedAt
  try {
    when = new Date(meta.generatedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    /* keep raw string */
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Click to switch to live data (slower, hits GA4 directly)"
      className={`${baseClasses} bg-blue-50 text-blue-700 border border-blue-100`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
      Cached snapshot · {when}
    </button>
  )
}

/**
 * Realtime active-users pill. Polls /api/analytics?endpoint=realtime every
 * 30s. The endpoint already returns top countries + top pages; we surface
 * just the headline number and reveal the rest in the title attribute for now.
 * (Phase 3 will add a hover popover.)
 */
function RealtimePill({ propertyId }: { propertyId: string }) {
  const [active, setActive] = useState<number | null>(null)
  const [topPages, setTopPages] = useState<Array<{ path: string; activeUsers: number }>>([])

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const fetchRealtime = async () => {
      try {
        const res = await fetch(
          `/api/analytics?endpoint=realtime&propertyId=${encodeURIComponent(propertyId)}`,
          { cache: "no-store" },
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setActive(typeof data.totalActiveUsers === "number" ? data.totalActiveUsers : 0)
        setTopPages(Array.isArray(data.topPages) ? data.topPages.slice(0, 3) : [])
      } catch {
        /* silent — pill is non-critical */
      }
    }
    fetchRealtime()
    const id = setInterval(fetchRealtime, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [propertyId])

  if (active === null) return null

  const tooltip = topPages.length > 0
    ? `Top: ${topPages.map((p) => `${p.path} (${p.activeUsers})`).join(", ")}`
    : undefined

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-100"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      <span className="tabular-nums">{active}</span>
      <span>active now</span>
    </span>
  )
}

export default function AnalyticsClientPage() {
  // URL-driven state — refresh restores, share-link works, Cmd+K can deep-link.
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [isLoading, setIsLoading] = useState(false)
  // Seed from URL on first render. The `?range=` key drives the date selector;
  // `?start=`/`?end=` apply when range=custom; `?property=` drives the GA4
  // property dropdown; `?live=1` flips data source to live (default snapshot).
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(() =>
    dateRangeFromUrl(new URLSearchParams(searchParams?.toString() ?? "")),
  )
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    () => searchParams?.get("property") ?? "",
  )
  const [availableProperties, setAvailableProperties] = useState<AnalyticsProperty[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<AnalyticsConnectionStatus | null>(null)
  const [dataSource, setDataSource] = useState<"snapshot" | "live">(
    () => (searchParams?.get("live") === "1" ? "live" : "snapshot"),
  )
  const [snapshotMeta, setSnapshotMeta] = useState<{ snapshotDate: string; generatedAt: string } | null>(null)
  const useSnapshot = dataSource === "snapshot"

  // PR 3d filter state. Seeded from URL — refresh + share-link work.
  // Only summary / daily-metrics / top-pages chart components actually
  // consume `filters` (see FILTER_AWARE_ENDPOINTS in lib/analytics-url.ts);
  // breakdown charts (sources / devices / geographic) intentionally don't.
  const [filters, setFilters] = useState<AnalyticsFilters>(() => ({
    deviceCategory: searchParams?.get("device") || undefined,
    channelGroup: searchParams?.get("channel") || undefined,
    country: searchParams?.get("country") || undefined,
  }))

  // PR 5b — annotations state. Lives at the page level so the Traffic Trend
  // chart can render markers and the manager popover can mutate the list.
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>([])

  // Push state changes back to the URL. Avoids re-render loops by checking
  // each param against its current URL value before pushing.
  useEffect(() => {
    const current = new URLSearchParams(searchParams?.toString() ?? "")
    const next = new URLSearchParams(current.toString())

    const desiredRangeKey = rangeKeyFromDateRange(selectedDateRange)
    next.set("range", desiredRangeKey)
    if (desiredRangeKey === "custom") {
      next.set("start", selectedDateRange.startDate)
      next.set("end", selectedDateRange.endDate)
    } else {
      next.delete("start")
      next.delete("end")
    }

    if (selectedPropertyId) {
      next.set("property", selectedPropertyId)
    } else {
      next.delete("property")
    }

    if (dataSource === "live") {
      next.set("live", "1")
    } else {
      next.delete("live")
    }

    // Filter chips → URL. Empty values delete their key for clean URLs.
    if (filters.deviceCategory) {
      next.set("device", filters.deviceCategory)
    } else {
      next.delete("device")
    }
    if (filters.channelGroup) {
      next.set("channel", filters.channelGroup)
    } else {
      next.delete("channel")
    }
    if (filters.country) {
      next.set("country", filters.country)
    } else {
      next.delete("country")
    }

    if (next.toString() !== current.toString()) {
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateRange, selectedPropertyId, dataSource, filters])

  // React to back/forward URL changes from the browser. Mostly a no-op since
  // user-initiated changes already round-trip via the effect above, but
  // necessary for "share this view" links and browser nav to work.
  useEffect(() => {
    const next = dateRangeFromUrl(new URLSearchParams(searchParams?.toString() ?? ""))
    if (next.label !== selectedDateRange.label) setSelectedDateRange(next)
    const propertyParam = searchParams?.get("property") ?? ""
    if (propertyParam && propertyParam !== selectedPropertyId) setSelectedPropertyId(propertyParam)
    const liveParam = searchParams?.get("live") === "1" ? "live" : "snapshot"
    if (liveParam !== dataSource) setDataSource(liveParam)
    const nextFilters: AnalyticsFilters = {
      deviceCategory: searchParams?.get("device") || undefined,
      channelGroup: searchParams?.get("channel") || undefined,
      country: searchParams?.get("country") || undefined,
    }
    if (
      nextFilters.deviceCategory !== filters.deviceCategory ||
      nextFilters.channelGroup !== filters.channelGroup ||
      nextFilters.country !== filters.country
    ) {
      setFilters(nextFilters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Load properties on component mount
  useEffect(() => {
    loadAvailableProperties()
    testConnection()
  }, [])

  // Refresh data when date range or property changes
  useEffect(() => {
    if (selectedPropertyId) {
      forceRefreshData()
    }
  }, [selectedDateRange, selectedPropertyId])

  const loadAvailableProperties = async () => {
    try {
      console.log("Loading available properties...")

      const response = await fetch("/api/analytics?endpoint=properties")

      if (response.ok) {
        const result = await response.json()
        console.log("Properties API response:", result)

        // Handle different possible response formats
        let properties: AnalyticsProperty[] = []

        if (Array.isArray(result)) {
          properties = result
        } else if (result.properties && Array.isArray(result.properties)) {
          properties = result.properties
        } else if (result.data && Array.isArray(result.data)) {
          properties = result.data
        } else if (result.availableProperties && Array.isArray(result.availableProperties)) {
          properties = result.availableProperties
        } else {
          console.warn("Unexpected properties response format:", result)
          properties = []
        }

        console.log("Setting available properties:", properties)
        setAvailableProperties(properties)

        // Set default property (first configured property or first property)
        if (properties.length > 0 && !selectedPropertyId) {
          const defaultProperty = properties.find((p: AnalyticsProperty) => p.isConfigured) || properties[0]
          if (defaultProperty) {
            console.log("Setting default property:", defaultProperty)
            setSelectedPropertyId(defaultProperty.id)
          }
        }
      } else {
        console.error("Failed to load properties:", response.status, response.statusText)
      }
    } catch (err) {
      console.error("Failed to load properties:", err)
    }
  }

  // Force refresh data when needed
  const forceRefreshData = useCallback(() => {
    setIsLoading(true)
    // Create a custom event to trigger data refresh in child components
    window.dispatchEvent(
      new CustomEvent("analytics-refresh", {
        detail: {
          timestamp: Date.now(),
          propertyId: selectedPropertyId,
          dateRange: selectedDateRange,
        },
      }),
    )

    // Set a timeout to ensure loading state is visible
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }, [selectedPropertyId, selectedDateRange])

  const handleRefresh = () => {
    testConnection()
    forceRefreshData()
  }

  const handleDateRangeChange = (range: DateRange) => {
    setSelectedDateRange(range)
    setError(null)
  }

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId)
    setError(null)
  }

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    window.location.href = "/admin"
  }

  const testConnection = async () => {
    try {      const url = selectedPropertyId
        ? `/api/analytics?endpoint=test-connection&propertyId=${selectedPropertyId}`
        : "/api/analytics?endpoint=test-connection"

      const response = await fetch(url)

      if (response.ok) {
        const status = await response.json()
        setConnectionStatus(status)
      }
    } catch (err) {
      console.error("Connection test error:", err)
      // Don't set error - just continue with zero data
    }
  }

  return (
    <div className="w-full max-w-full min-w-0 bg-neutral-50">
      {/* Analytics Header */}
      <div className="w-full max-w-full">
        <AnalyticsHeader
          isLoading={isLoading}
          availableProperties={availableProperties}
          selectedPropertyId={selectedPropertyId}
          onPropertyChange={handlePropertyChange}
          selectedRange={selectedDateRange}
          onRangeChange={handleDateRangeChange}
          onDownloadCSV={() => {
            const selectedProperty = availableProperties.find(p => p.id === selectedPropertyId)
            // Pass current filters so the CSV reflects the same view the user
            // is looking at on screen (and the CSV header stamps which filters
            // were active so the recipient knows what they're getting).
            downloadAnalyticsCSV(selectedDateRange, selectedPropertyId, selectedProperty?.name, filters)
          }}
          onCopyShareLink={() => {
            // PR 3a baked every filter + range + property into the URL —
            // sharing the live view is now just copying the URL.
            navigator.clipboard.writeText(window.location.href).catch((err) => {
              console.warn("Failed to copy share link:", err)
            })
          }}
        />
      </div>
      
      <div className="py-4 sm:py-6 w-full max-w-full">
        <div className="px-4 sm:px-5 lg:px-6 w-full max-w-full min-w-0">
          {/* Error Display */}
          {error && (
            <div className="mb-4">
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-600">Error</p>
                <p className="text-xs text-red-500 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded-md transition-colors mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Status row — snapshot freshness + realtime active users.
              Tells the rep at a glance whether they're on cached or live data
              and how many people are on the site right now. */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <SnapshotPill
              meta={snapshotMeta}
              useSnapshot={useSnapshot}
              onToggle={() => setDataSource(useSnapshot ? "live" : "snapshot")}
            />
            <RealtimePill propertyId={selectedPropertyId} />
          </div>

          {/* Analytics Dashboard - Always show components */}
          <>
            {/* Phase 5c — Goals/KPI panel. Renders only when goals are
                configured for this property (or portfolio-wide). Pinned at
                the very top so the BD team's eye lands on "are we hitting
                targets?" before any of the diagnostic data below. */}
            {selectedPropertyId && <GoalsKpiPanel propertyId={selectedPropertyId} />}

            {/* Phase 5a — Insights panel. Renders only when current period
                deviates >20% from trailing 3-period average on a key metric.
                First thing the eye lands on, since "what should I look at"
                is the highest-leverage question on a dashboard. Quiet by
                design — when nothing's anomalous, this whole block disappears. */}
            {selectedPropertyId && (
              <InsightsPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                filters={filters}
              />
            )}

            {/* PR 3d filter bar — narrows audience charts (hero / what-changed /
                page-views chart / top-pages) by device, channel, country.
                Source/device/geography breakdown charts intentionally exempt. */}
            {selectedPropertyId && (
              <AnalyticsFilterBar
                filters={filters}
                onFiltersChange={setFilters}
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
              />
            )}

            {/* Hero metric — Sessions front and center with sparkline + delta,
                three secondary metrics stacked on the right. Replaces the old
                4-card equal-weight grid. (Phase 3b — Vercel pattern.) */}
            <div className="py-4 sm:py-6 relative z-10">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Key Metrics</h2>
                <InfoTooltip content="Sessions is the lead metric — overall traffic volume. Users counts unique visitors. Page Views counts every page load. Engagement Rate is GA4's primary quality signal: % of sessions where users stayed engaged for 10+ seconds, viewed multiple pages, or triggered a key event. All deltas compare to the previous period of the same length." />
              </div>
              <HeroMetric
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                filters={filters}
                setError={setError}
                onSnapshotMeta={setSnapshotMeta}
              />
            </div>

            {/* "What changed" — biggest page-level risers and fallers vs the
                previous period. (Phase 3b — Linear pattern.) Sits right under
                the hero so the team's eye lands on the most actionable signal
                before scrolling into the rest of the dashboard. */}
            <div className="mt-2 sm:mt-4 w-full max-w-full relative z-10">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">What changed</h2>
                <InfoTooltip content="Pages with the biggest week-over-week (or period-over-period) change in views. Filtered to pages with at least 20 views in either period to keep the noise out — a tiny page going from 1 to 5 views isn't a meaningful signal." />
              </div>
              <WhatChangedPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                filters={filters}
                setError={setError}
              />
            </div>

            {/* Page Views Chart */}
            <div className="mt-2 sm:mt-4 w-full max-w-full min-w-0 relative z-10">
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">Traffic Trend</h2>
                  <InfoTooltip content="Daily page view trends showing traffic patterns over time. Use this to identify peak traffic days and overall growth trends. Annotations let you pin context — campaign launches, redesigns, outages — directly on the chart." />
                </div>
                {/* PR 5b — annotation manager. Owns the list, exposes it via
                    onAnnotationsChange so the chart can render markers. */}
                {selectedPropertyId && (
                  <AnnotationManager
                    propertyId={selectedPropertyId}
                    onAnnotationsChange={setAnnotations}
                  />
                )}
              </div>
              <div className="w-full max-w-full">
                <PageViewsChart
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                  filters={filters}
                  annotations={annotations}
                />
              </div>
            </div>

            {/* Events & Conversions — Phase 2: surfaces server-side measurement
                protocol writes (lead_capture, lead_qualified, lead_converted,
                opportunity_won) plus any client-side custom events */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Events & Conversions
                </h2>
                <InfoTooltip content="Custom events fired from the public sites (page CTAs, form submits, video plays) and from CRM mutations server-side (lead_converted, opportunity_won). Conversion events are tagged in GA4 Admin → Events." />
              </div>
              <EventsConversionsPanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                isLoading={isLoading}
                setError={setError}
              />
            </div>

            {/* Phase 4a — Search Console organic-search performance.
                Sits next to Events because both surface intent (events =
                site-side action signals; queries = pre-arrival intent).
                Renders an empty-state when SEARCH_CONSOLE_SITE_<key> isn't set. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Organic search
                </h2>
                <InfoTooltip content="Top queries that drove organic search clicks to this site, with impressions, CTR, and average position. Pulled from Google Search Console — different data source from GA4. Position is averaged weighted by impressions." />
              </div>
              <SearchPerformancePanel
                dateRange={selectedDateRange}
                propertyId={selectedPropertyId}
                setError={setError}
              />
            </div>

            {/* Phase 4b — Core Web Vitals via CrUX. Real-user p75 LCP / INP /
                CLS / TTFB / FCP from Chrome's anonymous usage telemetry.
                28-day rolling window — no date selector needed (CrUX ignores
                custom ranges). Renders empty state until CRUX_API_KEY is set. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Core Web Vitals
                </h2>
                <InfoTooltip content="Real-user performance from Chrome (p75 across the last 28 days). LCP measures loading, INP measures responsiveness, CLS measures visual stability — these three are Google's official Core Web Vitals and directly affect search ranking. Green = Good, amber = Needs improvement, red = Poor." />
              </div>
              <CoreWebVitalsPanel propertyId={selectedPropertyId} setError={setError} />
            </div>

            {/* Phase 4c — Cohort retention. Weekly acquisition cohorts × weekly
                retention buckets. The triangle that tells you whether content
                creates an audience or just generates one-and-done traffic. */}
            <div className="mt-8 sm:mt-12 w-full max-w-full">
              <div className="flex items-center gap-2 mb-4 sm:mb-5">
                <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight leading-tight">
                  Audience retention
                </h2>
                <InfoTooltip content="Each row = users whose first session fell in that week (a cohort). Each column = % of that cohort that came back N weeks later. Higher right-side numbers = stickier audience. For media businesses, week-1 retention above 20% is healthy; above 30% is excellent." />
              </div>
              <CohortRetentionPanel propertyId={selectedPropertyId} setError={setError} />
            </div>

            {/* Top Pages + Traffic Sources — both panels self-headed via the
                shared DashboardCard shell, so we drop the wrapper h2/InfoTooltip
                rows. Two-up grid on desktop, stack on mobile. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8 sm:mt-10 w-full max-w-full">
              <TopPagesTable
                dateRange={selectedDateRange}
                isLoading={isLoading}
                setError={setError}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
                filters={filters}
              />
              <TrafficSourcesChart
                dateRange={selectedDateRange}
                isLoading={isLoading}
                setError={setError}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
              />
            </div>

            {/* Geographic + Devices — same self-headed pattern. Geographic is
                wider since it has its own internal Countries|Cities split. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 w-full max-w-full">
              <div className="lg:col-span-2">
                <GeographicMap
                  dateRange={selectedDateRange}
                  isLoading={isLoading}
                  setError={setError}
                  propertyId={selectedPropertyId}
                  useSnapshot={useSnapshot}
                />
              </div>
              <DeviceBreakdown
                dateRange={selectedDateRange}
                isLoading={isLoading}
                setError={setError}
                propertyId={selectedPropertyId}
                useSnapshot={useSnapshot}
              />
            </div>
          </>

          {/* Footer */}
          <div className="text-center text-neutral-500 text-xs sm:text-sm pt-8 pb-6 border-t border-neutral-200 mt-8">
            <p className="leading-relaxed">
              Powered by Google Analytics 4{" "}
              <span className="hidden sm:inline">•</span>
              <span className="block sm:inline sm:ml-1">Last updated: {new Date().toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
