import type { DateRange } from "../types/analytics"

/**
 * URL-friendly keys for the predefined date ranges. The verbose GA4 strings
 * ("30daysAgo") stay internal; URLs use compact keys ("30d") so they're
 * shareable and readable.
 */
export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom"

const PRESET_RANGES: Record<Exclude<RangeKey, "custom">, DateRange> = {
  today: { startDate: "today", endDate: "today", label: "Today" },
  "7d": { startDate: "7daysAgo", endDate: "today", label: "Last 7 days" },
  "30d": { startDate: "30daysAgo", endDate: "today", label: "Last 30 days" },
  "90d": { startDate: "90daysAgo", endDate: "today", label: "Last 90 days" },
}

/**
 * Resolve a URL `?range=` (and optional `?start=`/`?end=`) to a DateRange.
 * Falls back to "30d" when the key is missing or invalid.
 */
export function dateRangeFromUrl(params: URLSearchParams): DateRange {
  const key = params.get("range") as RangeKey | null

  if (key === "custom") {
    const start = params.get("start") ?? ""
    const end = params.get("end") ?? ""
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return { startDate: start, endDate: end, label: `${start} to ${end}` }
    }
  }

  if (key && key in PRESET_RANGES) {
    return PRESET_RANGES[key as Exclude<RangeKey, "custom">]
  }

  return PRESET_RANGES["30d"]
}

/**
 * Reverse: derive the URL-friendly key from a DateRange. Used when the user
 * picks a preset and we need to encode it back into the URL.
 */
export function rangeKeyFromDateRange(range: DateRange): RangeKey {
  if (range.startDate === "today" && range.endDate === "today") return "today"
  if (range.startDate === "7daysAgo") return "7d"
  if (range.startDate === "30daysAgo") return "30d"
  if (range.startDate === "90daysAgo") return "90d"
  return "custom"
}

/**
 * Build the query-string suffix for a given analytics view. Used by Cmd+K
 * commands and "share this view" links.
 */
export function buildAnalyticsQueryString(opts: {
  range?: RangeKey | DateRange
  propertyId?: string
  live?: boolean
}): string {
  const params = new URLSearchParams()

  if (opts.range) {
    if (typeof opts.range === "string") {
      params.set("range", opts.range)
    } else {
      const key = rangeKeyFromDateRange(opts.range)
      params.set("range", key)
      if (key === "custom") {
        params.set("start", opts.range.startDate)
        params.set("end", opts.range.endDate)
      }
    }
  }

  if (opts.propertyId) params.set("property", opts.propertyId)
  if (opts.live) params.set("live", "1")

  const qs = params.toString()
  return qs ? `?${qs}` : ""
}
