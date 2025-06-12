// Date range interface
export interface DateRange {
  startDate: string
  endDate: string
  label: string
}

// Core analytics data structures
export interface AnalyticsSummary {
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  bounceRate: number
  averageSessionDuration: number
  // Additional fields for UI
  pageViewsChange?: number
  sessionsChange?: number
  usersChange?: number
  bounceRateChange?: number
  activeUsers?: number
  _source?: string
}

export interface DailyMetricsData {
  date: string
  pageViews: number
  sessions: number
  users: number
  bounceRate: number
}

export interface DailyMetricsResponse {
  data: DailyMetricsData[]
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  _source?: string
}

export interface TopPageData {
  path: string
  title: string
  pageViews: number
  sessions: number
  bounceRate: number
}

export interface PageViewsResponse {
  data: TopPageData[]
  _source?: string
}

export interface TrafficSourceData {
  source: string
  medium: string
  sessions: number
  users: number
  newUsers: number
}

export interface TrafficSourcesResponse {
  data: TrafficSourceData[]
  _source?: string
}

export interface DeviceData {
  deviceCategory: string
  sessions: number
  users: number
}

export interface DeviceDataResponse {
  data: DeviceData[]
  _source?: string
}

export interface GeographicData {
  country: string
  city: string
  sessions: number
  users: number
  newUsers: number
}

export interface GeographicDataResponse {
  data: GeographicData[]
  _source?: string
}

export interface RealtimeData {
  totalActiveUsers: number
  topCountries: Array<{
    country: string
    activeUsers: number
  }>
  _source?: string
}

// Connection status - simplified
export interface AnalyticsConnectionStatus {
  success: boolean
  error?: string
  propertyId?: string
  dimensionCount?: number
  metricCount?: number
  projectId?: string
}

// Configuration status - simplified
export interface ConfigurationStatus {
  configured: boolean
  missingVariables: string[]
  propertyId?: string
  projectId?: string
  hasServiceAccountKey: boolean
  hasAdminPassword: boolean
}
