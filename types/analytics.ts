// Base analytics interfaces
export interface AnalyticsProperty {
  id: string
  name: string
  isConfigured?: boolean
}

export interface AnalyticsConnectionStatus {
  configured: boolean
  connected: boolean
  success?: boolean
  propertyId?: string
  dimensionCount?: number
  metricCount?: number
  error?: string
  lastChecked?: string
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
