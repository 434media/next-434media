import type { DateRange } from "../types/analytics"

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

interface BuildOpts {
  endpoint: AnalyticsEndpoint
  dateRange: DateRange
  propertyId?: string
  useSnapshot?: boolean
}

const SNAPSHOT_RANGE_MAP: Record<string, "7d" | "30d"> = {
  "7daysAgo": "7d",
  "30daysAgo": "30d",
}

// Endpoints with no precomputed snapshot — always route live.
// Phase 2 events/conversions don't have a cron writing snapshots yet.
const LIVE_ONLY_ENDPOINTS = new Set<AnalyticsEndpoint>(["events", "conversions"])

export function buildAnalyticsUrl(opts: BuildOpts): string {
  const { endpoint, dateRange, propertyId, useSnapshot } = opts

  if (useSnapshot && !LIVE_ONLY_ENDPOINTS.has(endpoint)) {
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
  return `/api/analytics?${params}`
}
