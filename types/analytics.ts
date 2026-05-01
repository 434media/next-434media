// Base analytics interfaces
export interface AnalyticsProperty {
  id: string
  name: string
  /** Env var name that holds the GA4 property id (e.g. "GA4_PROPERTY_ID_TXMX"). */
  key?: string
  isConfigured?: boolean
  /** True for the property the dashboard should select on first load. */
  isDefault?: boolean
}

export interface AnalyticsConnectionStatus {
  configured?: boolean
  connected?: boolean
  success?: boolean
  propertyId?: string
  dimensionCount?: number
  metricCount?: number
  error?: string
  lastChecked?: string
  /** GCP project id of the service account — populated by the test-connection endpoint. */
  projectId?: string
  /** All known properties + their configured/default status. */
  availableProperties?: AnalyticsProperty[]
  /** The property id used when no property is selected. */
  defaultPropertyId?: string
}

export interface DateRange {
  startDate: string
  endDate: string
  label?: string
}

// Google Analytics specific interfaces
export interface GoogleAnalyticsProperty extends AnalyticsProperty {
  propertyId: string
  accountId: string
  displayName: string
  createTime: string
  updateTime: string
  parent: string
  currencyCode: string
  timeZone: string
  industryCategory: string
  serviceLevel: string
}

export interface GoogleAnalyticsConnectionStatus extends AnalyticsConnectionStatus {
  accountId?: string
  webDataStreamId?: string
  measurementId?: string
  properties?: GoogleAnalyticsProperty[]
}

export interface GoogleAnalyticsData {
  pageViews: number
  sessions: number
  users: number
  bounceRate: number
  avgSessionDuration: number
  conversionRate: number
  topPages: Array<{
    page: string
    views: number
    uniqueViews: number
  }>
  trafficSources: Array<{
    source: string
    sessions: number
    percentage: number
  }>
  deviceBreakdown: Array<{
    device: string
    sessions: number
    percentage: number
  }>
  geographicData: Array<{
    country: string
    sessions: number
    percentage: number
  }>
}

export interface GoogleAnalyticsMetrics {
  totalUsers: number
  totalSessions: number
  totalPageViews: number
  averageSessionDuration: number
  bounceRate: number
  conversionRate: number
  usersChange: number
  sessionsChange: number
  pageViewsChange: number
  durationChange: number
  bounceRateChange: number
  conversionRateChange: number
}

// Chart data interfaces
export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface TrafficSourceData {
  source: string
  sessions: number
  users: number
  percentage: number
  change: number
}

export interface DeviceData {
  device: string
  sessions: number
  users: number
  percentage: number
  bounceRate: number
}

export interface GeographicData {
  country: string
  countryCode: string
  sessions: number
  users: number
  percentage: number
  bounceRate: number
}

export interface TopPageData {
  page: string
  title: string
  views: number
  uniqueViews: number
  avgTimeOnPage: number
  bounceRate: number
  exitRate: number
}

// API Response interfaces
export interface AnalyticsApiResponse<T> {
  data: T
  success: boolean
  error?: string
  timestamp: string
}

export interface AnalyticsConfigResponse {
  configured: boolean
  connected: boolean
  properties: AnalyticsProperty[]
  error?: string
}

// Component prop interfaces
export interface AnalyticsMetricsProps {
  data: GoogleAnalyticsMetrics
  loading?: boolean
}

export interface AnalyticsChartProps {
  data: ChartDataPoint[]
  title: string
  loading?: boolean
}

export interface AnalyticsTableProps {
  data: TopPageData[]
  loading?: boolean
}

export interface AnalyticsDateRangeProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
}

// Performance types
export type PerformanceMetric =
  | "pageViews"
  | "sessions"
  | "users"
  | "bounceRate"
  | "avgSessionDuration"
  | "conversionRate"

export interface PerformanceBadge {
  metric: PerformanceMetric
  value: number
  change: number
  trend: "up" | "down" | "neutral"
  level: "excellent" | "good" | "average" | "poor"
}

// ============================================
// GA4 ANALYTICS FILTERS
// (Phase 3d — translated into GA4 dimensionFilter on the server)
// ============================================

/**
 * Per-page filters that narrow every audience chart on the GA4 page.
 * Three dimensions today (device / channel / country); add more by
 * extending this interface and the buildDimensionFilter translator.
 */
export interface AnalyticsFilters {
  /** "mobile" | "tablet" | "desktop" — GA4's deviceCategory closed enum. */
  deviceCategory?: string
  /** GA4's defaultChannelGroup (Direct / Organic Search / Email / …). */
  channelGroup?: string
  /** Country dimension value (e.g. "United States"). */
  country?: string
}

/** True when at least one filter slot is populated. */
export function hasAnyFilter(filters: AnalyticsFilters | undefined): boolean {
  if (!filters) return false
  return !!(filters.deviceCategory || filters.channelGroup || filters.country)
}

// ============================================
// GA4 LIB RESPONSE TYPES
// (used by lib/google-analytics.ts and app/api/analytics/route.ts)
// ============================================

/** Helper — percent change from previous to current. Positive = growth. */
export function pctChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

/**
 * Per-period totals returned by getAnalyticsSummary. Now includes GA4-native
 * engagement metrics (engagementRate, engagedSessions, averageEngagementTime)
 * alongside legacy bounceRate. Engagement rate is the modern primary metric;
 * bounce rate stays for back-compat.
 */
export interface AnalyticsSummary {
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  newUsers: number
  bounceRate: number
  engagementRate: number
  engagedSessions: number
  /** Seconds */
  averageSessionDuration: number
  /** Seconds — GA4 native engagement time */
  averageEngagementTime: number
  propertyId: string
  /**
   * Same metrics for the immediately preceding period of the same length.
   * Set when the summary call requests comparison; null otherwise.
   */
  previousPeriod?: {
    totalPageViews: number
    totalSessions: number
    totalUsers: number
    newUsers: number
    bounceRate: number
    engagementRate: number
    engagedSessions: number
    averageSessionDuration: number
    averageEngagementTime: number
  } | null
  _source?: "google-analytics" | "snapshot"
}

export interface DailyMetricsRow {
  date: string
  pageViews: number
  sessions: number
  users: number
  bounceRate: number
  engagementRate: number
}

export interface DailyMetricsResponse {
  data: DailyMetricsRow[]
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

export interface PageViewsRow {
  path: string
  title: string
  pageViews: number
  sessions: number
  bounceRate: number
}

export interface PageViewsResponse {
  data: PageViewsRow[]
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

export interface TrafficSourceRow {
  source: string
  medium: string
  /** GA4 default channel grouping — Direct/Organic Search/Organic Social/Email/Referral/Paid Search/Display/Other. */
  channelGroup: string
  sessions: number
  users: number
  newUsers: number
  engagedSessions: number
  engagementRate: number
}

export interface TrafficSourcesResponse {
  data: TrafficSourceRow[]
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

export interface DeviceRow {
  deviceCategory: string
  sessions: number
  users: number
}

export interface DeviceDataResponse {
  data: DeviceRow[]
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

export interface GeographicRow {
  country: string
  city: string
  sessions: number
  users: number
  newUsers: number
}

export interface GeographicDataResponse {
  data: GeographicRow[]
  propertyId: string
  _source?: "google-analytics" | "snapshot"
}

export interface RealtimeData {
  totalActiveUsers: number
  topCountries: Array<{ country: string; activeUsers: number }>
  topPages?: Array<{ path: string; activeUsers: number }>
  propertyId: string
  _source?: "google-analytics"
}
