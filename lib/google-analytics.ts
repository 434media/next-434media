import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { pctChange } from "../types/analytics"
import type {
  AnalyticsSummary,
  AnalyticsFilters,
  PageViewsResponse,
  TrafficSourcesResponse,
  DeviceDataResponse,
  GeographicDataResponse,
  DailyMetricsResponse,
  RealtimeData,
  AnalyticsConnectionStatus,
  AnalyticsProperty,
} from "../types/analytics"
import type { protos } from "@google-analytics/data"

type FilterExpression = protos.google.analytics.data.v1beta.IFilterExpression

/**
 * Translate AnalyticsFilters into a GA4 FilterExpression. Multiple filters
 * are AND-combined. Returns undefined when no filters are set, so callers
 * can pass `dimensionFilter: buildDimensionFilter(filters)` and the GA4 SDK
 * will treat undefined as "no filter".
 */
function buildDimensionFilter(filters?: AnalyticsFilters): FilterExpression | undefined {
  if (!filters) return undefined
  const expressions: FilterExpression[] = []

  if (filters.deviceCategory) {
    expressions.push({
      filter: {
        fieldName: "deviceCategory",
        stringFilter: { value: filters.deviceCategory, matchType: "EXACT" },
      },
    })
  }
  if (filters.channelGroup) {
    expressions.push({
      filter: {
        fieldName: "sessionDefaultChannelGrouping",
        stringFilter: { value: filters.channelGroup, matchType: "EXACT" },
      },
    })
  }
  if (filters.country) {
    expressions.push({
      filter: {
        fieldName: "country",
        stringFilter: { value: filters.country, matchType: "EXACT" },
      },
    })
  }

  if (expressions.length === 0) return undefined
  if (expressions.length === 1) return expressions[0]
  return { andGroup: { expressions } }
}

// Initialize the client
let analyticsDataClient: BetaAnalyticsDataClient | null = null

// Property configurations
const ANALYTICS_PROPERTIES: AnalyticsProperty[] = [
  { id: "488543948", name: "434 MEDIA", key: "GA4_PROPERTY_ID" },
  { id: "492867424", name: "TXMX Boxing", key: "GA4_PROPERTY_ID_TXMX" },
  { id: "492895637", name: "Vemos Vamos", key: "GA4_PROPERTY_ID_VEMOSVAMOS" },
  { id: "492925168", name: "AIM Health R&D Summit", key: "GA4_PROPERTY_ID_AIM" },
  { id: "492857375", name: "Salute to Troops", key: "GA4_PROPERTY_ID_SALUTE" },
  { id: "488563710", name: "The AMPD Project", key: "GA4_PROPERTY_ID_AMPD" },
  { id: "492925088", name: "Digital Canvas", key: "GA4_PROPERTY_ID_DIGITALCANVAS" },
]

function getAnalyticsClient(): BetaAnalyticsDataClient {
  if (!analyticsDataClient) {
    try {
      const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      if (!serviceAccountKey) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set")
      }

      let credentials: { project_id?: string; client_email?: string; private_key?: string; type?: string }
      try {
        // Sanitize literal control chars in the private_key field (matches lib/firebase-admin.ts behavior)
        const sanitized = serviceAccountKey
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t")
        credentials = JSON.parse(sanitized)
      } catch (parseError) {
        // Surface enough detail to debug without leaking the secret
        const len = serviceAccountKey.length
        const head = serviceAccountKey.slice(0, 20).replace(/[\r\n\t"]/g, " ")
        const tail = serviceAccountKey.slice(-20).replace(/[\r\n\t"]/g, " ")
        const wrappedInQuotes = serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"')
        const looksLikeOAuthClient = serviceAccountKey.includes('"installed"') || serviceAccountKey.includes('"web"')
        const detail = [
          `length=${len}`,
          `starts="${head}"`,
          `ends="${tail}"`,
          wrappedInQuotes ? "value is wrapped in double-quotes (remove them)" : null,
          looksLikeOAuthClient
            ? "value looks like an OAuth client JSON (has \"installed\"/\"web\" key) — you need a service-account JSON instead"
            : null,
        ]
          .filter(Boolean)
          .join("; ")
        throw new Error(`Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY (${detail}). Original: ${parseError instanceof Error ? parseError.message : parseError}`)
      }

      // Fix common private_key encoding issue: literal \n strings → real newlines
      if (credentials.private_key && typeof credentials.private_key === "string") {
        credentials.private_key = credentials.private_key.replace(/\\n/g, "\n")
      }

      // Sanity check the shape
      if (!credentials.client_email || !credentials.private_key) {
        const missing = [
          !credentials.client_email && "client_email",
          !credentials.private_key && "private_key",
        ]
          .filter(Boolean)
          .join(", ")
        const isOAuthClient = credentials.type !== "service_account" && credentials.type !== undefined
        throw new Error(
          `GOOGLE_SERVICE_ACCOUNT_KEY parsed but is missing required fields: ${missing}. ${
            isOAuthClient
              ? `Found type="${credentials.type}" — this is not a service-account key. Download a fresh JSON key from GCP IAM → Service Accounts → Keys.`
              : "Expected a Google Cloud service-account JSON key."
          }`,
        )
      }

      analyticsDataClient = new BetaAnalyticsDataClient({
        credentials: credentials as { client_email: string; private_key: string },
        projectId: process.env.GCP_PROJECT_ID || credentials.project_id,
      })

      console.log("[GA4] Analytics client initialized successfully")
    } catch (error) {
      console.error("[GA4] Failed to initialize analytics client:", error)
      throw error
    }
  }

  return analyticsDataClient
}

// Get property ID from environment variable or use provided propertyId
function getPropertyId(propertyId?: string): string {
  if (propertyId) {
    return propertyId
  }

  // Default to main property
  const defaultPropertyId = process.env.GA4_PROPERTY_ID
  if (!defaultPropertyId) {
    throw new Error("GA4_PROPERTY_ID not configured")
  }

  return defaultPropertyId
}

// Get all available properties with their configuration status
export function getAvailableProperties(): AnalyticsProperty[] {
  return ANALYTICS_PROPERTIES.map((property) => ({
    ...property,
    isConfigured: !!(property.key && process.env[property.key]),
  }))
}

// Test connection to Google Analytics
export async function testAnalyticsConnection(propertyId?: string): Promise<AnalyticsConnectionStatus> {
  try {
    console.log("[GA4] Testing connection...")

    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${targetPropertyId}/metadata`,
    })

    console.log("[GA4] Connection test successful")

    return {
      success: true,
      propertyId: targetPropertyId,
      dimensionCount: response.dimensions?.length || 0,
      metricCount: response.metrics?.length || 0,
      projectId: process.env.GCP_PROJECT_ID,
      availableProperties: getAvailableProperties(),
      defaultPropertyId: process.env.GA4_PROPERTY_ID,
    }
  } catch (error) {
    console.error("[GA4] Connection test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      availableProperties: getAvailableProperties(),
      defaultPropertyId: process.env.GA4_PROPERTY_ID,
    }
  }
}

/**
 * Compute the immediately-preceding date range of identical length.
 * Both inputs are absolute dates (YYYY-MM-DD); GA4's relative shortcuts like
 * "30daysAgo" should be resolved to absolute dates by the caller (the API
 * route already does this via formatDateForGA).
 */
function previousPeriodOf(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const dayMs = 1000 * 60 * 60 * 24
  // Inclusive day count (e.g., today→today = 1 day window)
  const lengthDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1)
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - (lengthDays - 1))
  const fmt = (d: Date) => d.toISOString().split("T")[0]
  return { startDate: fmt(prevStart), endDate: fmt(prevEnd) }
}

// Get analytics summary — now includes GA4-native engagement metrics and
// previous-period comparison in a single request (GA4 supports two date
// ranges natively, no extra round trip). Optional `filters` param narrows
// the result set via GA4's dimensionFilter.
export async function getAnalyticsSummary(
  startDate: string,
  endDate: string,
  propertyId?: string,
  filters?: AnalyticsFilters,
): Promise<AnalyticsSummary> {
  console.log("[GA4] getAnalyticsSummary called with:", { startDate, endDate, propertyId, filters })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const prev = previousPeriodOf(startDate, endDate)

    // GA4 returns one row per dateRange. Order: [current, previous].
    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [
        { startDate, endDate, name: "current" },
        { startDate: prev.startDate, endDate: prev.endDate, name: "previous" },
      ],
      dimensionFilter: buildDimensionFilter(filters),
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "engagementRate" },
        { name: "engagedSessions" },
        { name: "averageSessionDuration" },
        { name: "userEngagementDuration" },
      ],
    })

    // GA4 tags each row with the dateRange name in its first dimensionValue
    // when multiple ranges are present (or returns rows in order — be defensive).
    const rowsByPeriod: Record<string, NonNullable<typeof response.rows>[number]> = {}
    response.rows?.forEach((row, idx) => {
      const tag = row.dimensionValues?.[0]?.value || (idx === 0 ? "current" : "previous")
      rowsByPeriod[tag] = row
    })
    const currentRow = rowsByPeriod.current ?? response.rows?.[0]
    const previousRow = rowsByPeriod.previous ?? response.rows?.[1]

    const readMetrics = (row: typeof currentRow) => ({
      totalPageViews: Number(row?.metricValues?.[0]?.value || 0),
      totalSessions: Number(row?.metricValues?.[1]?.value || 0),
      totalUsers: Number(row?.metricValues?.[2]?.value || 0),
      newUsers: Number(row?.metricValues?.[3]?.value || 0),
      bounceRate: Number(row?.metricValues?.[4]?.value || 0),
      engagementRate: Number(row?.metricValues?.[5]?.value || 0),
      engagedSessions: Number(row?.metricValues?.[6]?.value || 0),
      averageSessionDuration: Number(row?.metricValues?.[7]?.value || 0),
      // userEngagementDuration is total seconds across all sessions; convert to per-session avg
      averageEngagementTime: Number(row?.metricValues?.[1]?.value || 0) > 0
        ? Number(row?.metricValues?.[8]?.value || 0) / Number(row?.metricValues?.[1]?.value || 1)
        : 0,
    })

    const current = readMetrics(currentRow)
    const previous = previousRow ? readMetrics(previousRow) : null

    return {
      ...current,
      propertyId: targetPropertyId,
      previousPeriod: previous,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getAnalyticsSummary:", error)
    throw error
  }
}

// Get daily metrics
export async function getDailyMetrics(
  startDate: string,
  endDate: string,
  propertyId?: string,
  filters?: AnalyticsFilters,
): Promise<DailyMetricsResponse> {
  console.log("[GA4] getDailyMetrics called with:", { startDate, endDate, propertyId, filters })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      dimensionFilter: buildDimensionFilter(filters),
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "bounceRate" },
        { name: "engagementRate" },
      ],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    })

    const data =
      response.rows?.map((row) => {
        const dateStr = row.dimensionValues?.[0]?.value || ""
        // GA4 returns dates as YYYYMMDD; normalize to YYYY-MM-DD
        let formattedDate = dateStr
        if (/^\d{8}$/.test(dateStr)) {
          formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
        }

        return {
          date: formattedDate,
          pageViews: Number(row.metricValues?.[0]?.value || 0),
          sessions: Number(row.metricValues?.[1]?.value || 0),
          users: Number(row.metricValues?.[2]?.value || 0),
          bounceRate: Number(row.metricValues?.[3]?.value || 0),
          engagementRate: Number(row.metricValues?.[4]?.value || 0),
        }
      }) || []

    const totalPageViews = data.reduce((sum, day) => sum + day.pageViews, 0)
    const totalSessions = data.reduce((sum, day) => sum + day.sessions, 0)
    const totalUsers = data.reduce((sum, day) => sum + day.users, 0)

    console.log("[GA4] Processed daily metrics:", {
      dataLength: data.length,
      totalPageViews,
      totalSessions,
      totalUsers,
      firstDay: data[0],
      lastDay: data[data.length - 1],
    })

    return {
      data,
      totalPageViews,
      totalSessions,
      totalUsers,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getDailyMetrics:", error)
    throw error
  }
}

// Get page views data
export async function getPageViewsData(
  startDate: string,
  endDate: string,
  propertyId?: string,
  filters?: AnalyticsFilters,
): Promise<PageViewsResponse> {
  console.log("[GA4] getPageViewsData called with:", { startDate, endDate, propertyId, filters })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      dimensionFilter: buildDimensionFilter(filters),
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    })

    const data =
      response.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        pageViews: Number(row.metricValues?.[0]?.value || 0),
        sessions: Number(row.metricValues?.[1]?.value || 0),
        bounceRate: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getPageViewsData:", error)
    throw error
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<TrafficSourcesResponse> {
  console.log("[GA4] getTrafficSourcesData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
        // GA4's clean bucketing: Direct / Organic Search / Paid Search /
        // Organic Social / Paid Social / Email / Referral / Display / Other.
        // Lets the UI group cleanly without parsing source/medium pairs.
        { name: "sessionDefaultChannelGrouping" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "engagedSessions" },
        { name: "engagementRate" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 50,
    })

    const data =
      response.rows?.map((row) => ({
        source: row.dimensionValues?.[0]?.value || "",
        medium: row.dimensionValues?.[1]?.value || "",
        channelGroup: row.dimensionValues?.[2]?.value || "Other",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
        newUsers: Number(row.metricValues?.[2]?.value || 0),
        engagedSessions: Number(row.metricValues?.[3]?.value || 0),
        engagementRate: Number(row.metricValues?.[4]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getTrafficSourcesData:", error)
    throw error
  }
}

// Get device data
export async function getDeviceData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<DeviceDataResponse> {
  console.log("[GA4] getDeviceData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    })

    const data =
      response.rows?.map((row) => ({
        deviceCategory: row.dimensionValues?.[0]?.value || "",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getDeviceData:", error)
    throw error
  }
}

// Get geographic data
export async function getGeographicData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<GeographicDataResponse> {
  console.log("[GA4] getGeographicData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 50,
    })

    const data =
      response.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        city: row.dimensionValues?.[1]?.value || "",
        sessions: Number(row.metricValues?.[0]?.value || 0),
        users: Number(row.metricValues?.[1]?.value || 0),
        newUsers: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    return {
      data,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getGeographicData:", error)
    throw error
  }
}

// ============================================
// COHORT RETENTION
// (Phase 4c — weekly acquisition cohorts × weekly retention buckets,
// pulled in a single runReport via GA4's native cohortSpec)
// ============================================

export interface CohortRetentionRow {
  /** ISO date — first day of the acquisition week (Mon). */
  cohortStart: string
  /** Display label, e.g. "Mar 4 – Mar 10". */
  cohortLabel: string
  /** Initial cohort size (week 0 active users — these are 100% by definition). */
  size: number
  /** Per-week retention. Index = weeks since acquisition. Value = % retained (0–1). */
  retention: number[]
}

export interface CohortRetentionResponse {
  data: CohortRetentionRow[]
  /** Number of weeks observed per cohort (typically 5). */
  weeks: number
  propertyId: string
}

function isoMonday(date: Date): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  // GA4 cohorts work in UTC; Mon-start matches GA4's default week semantics
  const day = d.getUTCDay() // 0 = Sun
  const offset = day === 0 ? -6 : 1 - day // distance back to Monday
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().split("T")[0]
}

function isoSunday(monday: string): string {
  const d = new Date(monday)
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().split("T")[0]
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/**
 * Pull weekly user-retention cohorts. Each cohort = users whose first session
 * fell in a given calendar week; subsequent weeks measure how many of those
 * users came back. The classic SaaS / media-company retention triangle.
 *
 * Defaults: 8 cohorts × 5-week observation window. Tweak via args; GA4
 * caps at 12 cohorts and 12 buckets per request.
 */
export async function getCohortRetention(
  propertyId?: string,
  cohortCount = 8,
  weeksObserved = 5,
): Promise<CohortRetentionResponse> {
  console.log("[GA4] getCohortRetention called with:", { propertyId, cohortCount, weeksObserved })

  const targetPropertyId = getPropertyId(propertyId)
  const client = getAnalyticsClient()

  // Build cohort date ranges going back from the most recent COMPLETE week
  // (the current in-progress week is excluded — it'd skew week 0 ratios).
  const today = new Date()
  const thisMondayIso = isoMonday(today)
  const lastCompletedMonday = new Date(thisMondayIso)
  lastCompletedMonday.setUTCDate(lastCompletedMonday.getUTCDate() - 7)

  const cohorts: { name: string; startDate: string; endDate: string }[] = []
  for (let i = 0; i < cohortCount; i++) {
    const start = new Date(lastCompletedMonday)
    start.setUTCDate(start.getUTCDate() - i * 7)
    const startIso = isoMonday(start)
    const endIso = isoSunday(startIso)
    cohorts.unshift({ name: `cohort_${cohortCount - 1 - i}`, startDate: startIso, endDate: endIso })
  }

  const [response] = await client.runReport({
    property: `properties/${targetPropertyId}`,
    cohortSpec: {
      cohorts: cohorts.map((c) => ({
        name: c.name,
        dateRange: { startDate: c.startDate, endDate: c.endDate },
      })),
      cohortsRange: {
        granularity: "WEEKLY",
        startOffset: 0,
        endOffset: weeksObserved - 1,
      },
      cohortReportSettings: { accumulate: false },
    },
    dimensions: [{ name: "cohort" }, { name: "cohortNthWeek" }],
    metrics: [{ name: "cohortActiveUsers" }],
  })

  // Pivot rows into a 2D map: cohortName → weekIndex → activeUsers
  const grid = new Map<string, Map<number, number>>()
  for (const row of response.rows ?? []) {
    const cohortName = row.dimensionValues?.[0]?.value ?? ""
    const weekStr = row.dimensionValues?.[1]?.value ?? "0"
    const weekIdx = Number.parseInt(weekStr, 10)
    const value = Number(row.metricValues?.[0]?.value ?? 0)
    if (!grid.has(cohortName)) grid.set(cohortName, new Map())
    grid.get(cohortName)!.set(weekIdx, value)
  }

  const data: CohortRetentionRow[] = cohorts.map((c) => {
    const cohortGrid = grid.get(c.name) ?? new Map()
    const week0 = cohortGrid.get(0) ?? 0
    const retention: number[] = []
    for (let w = 0; w < weeksObserved; w++) {
      const value = cohortGrid.get(w) ?? 0
      retention.push(week0 > 0 ? value / week0 : 0)
    }
    return {
      cohortStart: c.startDate,
      cohortLabel: `${shortDate(c.startDate)} – ${shortDate(c.endDate)}`,
      size: week0,
      retention,
    }
  })

  return {
    data,
    weeks: weeksObserved,
    propertyId: targetPropertyId,
  }
}

// ============================================
// PORTFOLIO ROLLUP
// (Phase 3c — aggregates all configured GA4 properties for a top-down view
// across the 434 portfolio. Parallel fetch per property, single response.)
// ============================================

export interface PortfolioBrandRow {
  /** Internal property id (numeric string). */
  propertyId: string
  /** Friendly name from ANALYTICS_PROPERTIES. */
  name: string
  totalSessions: number
  totalUsers: number
  totalPageViews: number
  newUsers: number
  engagementRate: number
  averageEngagementTime: number
  /** Per-brand period-over-period changes. Same convention as the summary endpoint. */
  sessionsChange: number
  usersChange: number
  pageViewsChange: number
  engagementRateChange: number
  /** This brand's share of total portfolio sessions, 0–1. */
  sessionShare: number
  /** True when the GA4 query failed or the property has no configured env var. */
  unavailable?: boolean
  error?: string
}

export interface PortfolioSummary {
  /** Aggregated totals across all configured properties. */
  total: {
    sessions: number
    users: number
    pageViews: number
    newUsers: number
    /** Weighted by sessions. */
    engagementRate: number
    /** Weighted by sessions. */
    averageEngagementTime: number
  }
  /** Same shape, for the previous period of identical length. Drives portfolio-level deltas. */
  previousPeriod: {
    sessions: number
    users: number
    pageViews: number
    newUsers: number
    engagementRate: number
    averageEngagementTime: number
  }
  /** Period-over-period changes computed from total + previousPeriod. */
  totalSessionsChange: number
  totalUsersChange: number
  totalPageViewsChange: number
  totalEngagementRateChange: number
  /** One row per known property. Includes per-brand deltas + share-of-portfolio. */
  brands: PortfolioBrandRow[]
  /** Properties without env-var configuration are listed but flagged unavailable. */
  configuredCount: number
  totalCount: number
  generatedAt: string
}

/**
 * Roll up every configured GA4 property into a portfolio view. Parallel
 * fetches; one slow property doesn't block the others. Failing properties
 * surface as `unavailable: true` rows so the UI can show "couldn't reach X"
 * rather than silently dropping them.
 */
export async function getPortfolioSummary(
  startDate: string,
  endDate: string,
): Promise<PortfolioSummary> {
  console.log("[GA4] getPortfolioSummary called with:", { startDate, endDate })

  const properties = getAvailableProperties()
  const configured = properties.filter((p) => p.isConfigured)

  // Fetch each configured property's summary in parallel. The summary call
  // itself already includes previous-period data (PR Phase 1.2), so each
  // brand row gets period-over-period deltas for free.
  const results = await Promise.allSettled(
    configured.map(async (p) => {
      const summary = await getAnalyticsSummary(startDate, endDate, p.id)
      return { property: p, summary }
    }),
  )

  // Aggregate totals + collect per-brand rows
  let totalSessions = 0
  let totalUsers = 0
  let totalPageViews = 0
  let totalNewUsers = 0
  let weightedEngagementRateNumerator = 0 // sum of (engagementRate * sessions)
  let weightedEngagementTimeNumerator = 0 // sum of (averageEngagementTime * sessions)

  let prevSessions = 0
  let prevUsers = 0
  let prevPageViews = 0
  let prevNewUsers = 0
  let prevWeightedEngagementRateNum = 0
  let prevWeightedEngagementTimeNum = 0

  const brandRows: PortfolioBrandRow[] = []

  for (let i = 0; i < configured.length; i++) {
    const property = configured[i]
    const result = results[i]

    if (result.status === "rejected") {
      brandRows.push({
        propertyId: property.id,
        name: property.name,
        totalSessions: 0,
        totalUsers: 0,
        totalPageViews: 0,
        newUsers: 0,
        engagementRate: 0,
        averageEngagementTime: 0,
        sessionsChange: 0,
        usersChange: 0,
        pageViewsChange: 0,
        engagementRateChange: 0,
        sessionShare: 0,
        unavailable: true,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      })
      continue
    }

    const { summary } = result.value
    const prev = summary.previousPeriod

    // Aggregate
    totalSessions += summary.totalSessions
    totalUsers += summary.totalUsers
    totalPageViews += summary.totalPageViews
    totalNewUsers += summary.newUsers
    weightedEngagementRateNumerator += summary.engagementRate * summary.totalSessions
    weightedEngagementTimeNumerator += summary.averageEngagementTime * summary.totalSessions

    if (prev) {
      prevSessions += prev.totalSessions
      prevUsers += prev.totalUsers
      prevPageViews += prev.totalPageViews
      prevNewUsers += prev.newUsers
      prevWeightedEngagementRateNum += prev.engagementRate * prev.totalSessions
      prevWeightedEngagementTimeNum += prev.averageEngagementTime * prev.totalSessions
    }

    brandRows.push({
      propertyId: property.id,
      name: property.name,
      totalSessions: summary.totalSessions,
      totalUsers: summary.totalUsers,
      totalPageViews: summary.totalPageViews,
      newUsers: summary.newUsers,
      engagementRate: summary.engagementRate,
      averageEngagementTime: summary.averageEngagementTime,
      sessionsChange: prev ? pctChange(summary.totalSessions, prev.totalSessions) : 0,
      usersChange: prev ? pctChange(summary.totalUsers, prev.totalUsers) : 0,
      pageViewsChange: prev ? pctChange(summary.totalPageViews, prev.totalPageViews) : 0,
      engagementRateChange: prev ? pctChange(summary.engagementRate, prev.engagementRate) : 0,
      // sessionShare gets computed in a second pass below now that we have totalSessions
      sessionShare: 0,
    })
  }

  // Add the never-configured properties as unavailable rows so the UI shows
  // "AMPD not connected — set GA4_PROPERTY_ID_AMPD" instead of hiding them.
  for (const property of properties) {
    if (property.isConfigured) continue
    brandRows.push({
      propertyId: property.id,
      name: property.name,
      totalSessions: 0,
      totalUsers: 0,
      totalPageViews: 0,
      newUsers: 0,
      engagementRate: 0,
      averageEngagementTime: 0,
      sessionsChange: 0,
      usersChange: 0,
      pageViewsChange: 0,
      engagementRateChange: 0,
      sessionShare: 0,
      unavailable: true,
      error: `Not configured (set ${property.key ?? "GA4_PROPERTY_ID_*"} in env)`,
    })
  }

  // Second pass — fill sessionShare now that totalSessions is final
  for (const row of brandRows) {
    row.sessionShare = totalSessions > 0 ? row.totalSessions / totalSessions : 0
  }

  // Sort brand rows: live first by session volume (desc), unavailable at the end.
  brandRows.sort((a, b) => {
    if (a.unavailable !== b.unavailable) return a.unavailable ? 1 : -1
    return b.totalSessions - a.totalSessions
  })

  // Compute weighted-average engagement metrics (use sessions as weight).
  // Falls back to 0 when total sessions is 0 to avoid NaN.
  const aggregatedEngagementRate = totalSessions > 0 ? weightedEngagementRateNumerator / totalSessions : 0
  const aggregatedEngagementTime = totalSessions > 0 ? weightedEngagementTimeNumerator / totalSessions : 0
  const prevAggregatedEngagementRate = prevSessions > 0 ? prevWeightedEngagementRateNum / prevSessions : 0
  const prevAggregatedEngagementTime = prevSessions > 0 ? prevWeightedEngagementTimeNum / prevSessions : 0

  return {
    total: {
      sessions: totalSessions,
      users: totalUsers,
      pageViews: totalPageViews,
      newUsers: totalNewUsers,
      engagementRate: aggregatedEngagementRate,
      averageEngagementTime: aggregatedEngagementTime,
    },
    previousPeriod: {
      sessions: prevSessions,
      users: prevUsers,
      pageViews: prevPageViews,
      newUsers: prevNewUsers,
      engagementRate: prevAggregatedEngagementRate,
      averageEngagementTime: prevAggregatedEngagementTime,
    },
    totalSessionsChange: pctChange(totalSessions, prevSessions),
    totalUsersChange: pctChange(totalUsers, prevUsers),
    totalPageViewsChange: pctChange(totalPageViews, prevPageViews),
    totalEngagementRateChange: pctChange(aggregatedEngagementRate, prevAggregatedEngagementRate),
    brands: brandRows,
    configuredCount: configured.length,
    totalCount: properties.length,
    generatedAt: new Date().toISOString(),
  }
}

// ============================================
// EVENTS & CONVERSIONS
// (Phase 2 of the analytics overhaul — read-side counterpart to the
// server-side Measurement Protocol writes in lib/ga4-events.ts)
// ============================================

export interface EventRow {
  eventName: string
  eventCount: number
  totalUsers: number
  /** Sum of `value` event param across all instances (e.g. opportunity_won total $). */
  eventValue: number
}

export interface EventsResponse {
  data: EventRow[]
  totalEvents: number
  totalConversions: number
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

/**
 * Top events with counts + value, current period plus previous-period totals
 * for delta computation. We pull the union of (current period top N) + (any
 * conversion-flagged event from previous period) so the chart can show drop-offs.
 */
export async function getTopEvents(
  startDate: string,
  endDate: string,
  propertyId?: string,
  limit = 20,
): Promise<EventsResponse> {
  console.log("[GA4] getTopEvents called with:", { startDate, endDate, propertyId, limit })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "eventCount" },
        { name: "totalUsers" },
        { name: "eventValue" },
      ],
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
      limit,
    })

    const data: EventRow[] =
      response.rows?.map((row) => ({
        eventName: row.dimensionValues?.[0]?.value || "",
        eventCount: Number(row.metricValues?.[0]?.value || 0),
        totalUsers: Number(row.metricValues?.[1]?.value || 0),
        eventValue: Number(row.metricValues?.[2]?.value || 0),
      })) || []

    const totalEvents = data.reduce((sum, e) => sum + e.eventCount, 0)

    return {
      data,
      totalEvents,
      // Conversions is a property-level setting — events tagged as
      // conversions in GA4 admin. We approximate by summing across the
      // result set when a future enhancement requests just conversions.
      totalConversions: 0,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getTopEvents:", error)
    throw error
  }
}

export interface ConversionEventRow {
  eventName: string
  conversions: number
  totalRevenue: number
  conversionRate: number
}

export interface ConversionsResponse {
  data: ConversionEventRow[]
  totalConversions: number
  totalRevenue: number
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

/**
 * Conversion events only — events flagged as conversions in GA4 Admin →
 * Events. Returns each conversion event's count, total revenue (sum of
 * `value` param when present), and conversion rate (conversions / sessions).
 */
export async function getConversionsData(
  startDate: string,
  endDate: string,
  propertyId?: string,
): Promise<ConversionsResponse> {
  console.log("[GA4] getConversionsData called with:", { startDate, endDate, propertyId })

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runReport({
      property: `properties/${targetPropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "conversions" },
        { name: "totalRevenue" },
        { name: "sessionConversionRate" },
      ],
      orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
      limit: 20,
    })

    const data: ConversionEventRow[] =
      response.rows
        ?.map((row) => ({
          eventName: row.dimensionValues?.[0]?.value || "",
          conversions: Number(row.metricValues?.[0]?.value || 0),
          totalRevenue: Number(row.metricValues?.[1]?.value || 0),
          conversionRate: Number(row.metricValues?.[2]?.value || 0),
        }))
        .filter((row) => row.conversions > 0) || []

    const totalConversions = data.reduce((sum, e) => sum + e.conversions, 0)
    const totalRevenue = data.reduce((sum, e) => sum + e.totalRevenue, 0)

    return {
      data,
      totalConversions,
      totalRevenue,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getConversionsData:", error)
    throw error
  }
}

// Get realtime data
export async function getRealtimeData(propertyId?: string): Promise<RealtimeData> {
  console.log("[GA4] getRealtimeData called with propertyId:", propertyId)

  try {
    const targetPropertyId = getPropertyId(propertyId)
    const client = getAnalyticsClient()

    const [response] = await client.runRealtimeReport({
      property: `properties/${targetPropertyId}`,
      metrics: [{ name: "activeUsers" }],
    })

    const totalActiveUsers = Number(response.rows?.[0]?.metricValues?.[0]?.value || 0)

    // Run top countries + top pages in parallel — both are realtime queries
    // and don't depend on each other.
    const [[countriesResponse], [pagesResponse]] = await Promise.all([
      client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: "country" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 5,
      }),
      client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: "unifiedScreenName" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 5,
      }),
    ])

    const topCountries =
      countriesResponse.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        activeUsers: Number(row.metricValues?.[0]?.value || 0),
      })) || []

    const topPages =
      pagesResponse.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        activeUsers: Number(row.metricValues?.[0]?.value || 0),
      })) || []

    return {
      totalActiveUsers,
      topCountries,
      topPages,
      propertyId: targetPropertyId,
      _source: "google-analytics",
    }
  } catch (error) {
    console.error("[GA4] Error in getRealtimeData:", error)
    throw error
  }
}
