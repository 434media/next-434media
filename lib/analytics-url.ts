import type { DateRange, AnalyticsFilters } from "../types/analytics"

export type AnalyticsEndpoint =
  | "summary"
  | "daily-metrics"
  | "top-pages"
  | "toppages"
  | "trafficsources"
  | "traffic-sources"
  | "devices"
  | "geographic"
  | "events"
  | "conversions"
  | "portfolio"

interface BuildOpts {
  endpoint: AnalyticsEndpoint
  dateRange: DateRange
  propertyId?: string
  useSnapshot?: boolean
  /** Phase 3d filters — only applied to summary / daily-metrics / top-pages. */
  filters?: AnalyticsFilters
}

// Phase 3d — only audience charts respect filters. Source/device/geography
// breakdown charts are intentionally excluded so we don't render degenerate
// "filter the device chart by device" views.
const FILTER_AWARE_ENDPOINTS = new Set<AnalyticsEndpoint>([
  "summary",
  "daily-metrics",
  "top-pages",
  "toppages",
])

const SNAPSHOT_RANGE_MAP: Record<string, "7d" | "30d"> = {
  "7daysAgo": "7d",
  "30daysAgo": "30d",
}

// Endpoints with no precomputed snapshot — always route live.
// Events / conversions / portfolio don't have a cron writing snapshots yet.
const LIVE_ONLY_ENDPOINTS = new Set<AnalyticsEndpoint>(["events", "conversions", "portfolio"])

export function buildAnalyticsUrl(opts: BuildOpts): string {
  const { endpoint, dateRange, propertyId, useSnapshot, filters } = opts

  // Snapshots are precomputed without filter awareness — when the user has
  // any filter active, force a live query so the result actually reflects it.
  const wantsFiltered = !!filters && FILTER_AWARE_ENDPOINTS.has(endpoint) &&
    (!!filters.deviceCategory || !!filters.channelGroup || !!filters.country)

  if (useSnapshot && !wantsFiltered && !LIVE_ONLY_ENDPOINTS.has(endpoint)) {
    const range = SNAPSHOT_RANGE_MAP[dateRange.startDate]
    if (range) {
      const params = new URLSearchParams({ endpoint, range })
      if (propertyId) params.append("propertyId", propertyId)
      return `/api/analytics/snapshot?${params}`
    }
    // Snapshot only has 7d / 30d precomputed; custom/longer ranges fall through to live.
  }

  const params = new URLSearchParams({
    endpoint,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  })
  if (propertyId) params.append("propertyId", propertyId)
  if (wantsFiltered) {
    if (filters?.deviceCategory) params.append("device", filters.deviceCategory)
    if (filters?.channelGroup) params.append("channel", filters.channelGroup)
    if (filters?.country) params.append("country", filters.country)
  }
  return `/api/analytics?${params}`
}
