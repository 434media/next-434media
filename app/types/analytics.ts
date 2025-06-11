export interface DateRange {
  startDate: string
  endDate: string
  label: string
}

export interface PageViewData {
  date: string
  pageViews: number
  sessions: number
  users: number
  bounceRate?: number
}

export interface TopPageData {
  path: string
  title: string
  pageViews: number
  sessions: number
  bounceRate: number
}

export interface TrafficSourceData {
  source: string
  medium: string
  sessions: number
  users: number
  newUsers: number
}

export interface DeviceData {
  deviceCategory: string
  sessions: number
  users: number
}

export interface GeographicData {
  country: string
  city: string
  sessions: number
  users: number
  newUsers: number
}

export interface RealtimeData {
  totalActiveUsers: number
  topCountries: Array<{
    country: string
    activeUsers: number
  }>
}

export interface SummaryData {
  totalPageViews: number
  totalSessions: number
  totalUsers: number
  bounceRate: number
  averageSessionDuration: number
}

// Alias for backward compatibility
export interface AnalyticsSummary extends SummaryData {}

// Daily metrics data structure
export interface DailyMetricsData {
  date: string
  pageViews: number
  sessions: number
  users: number
  bounceRate?: number
}

// Response structures for API endpoints
export interface PageViewsResponse {
  data: TopPageData[]
}

export interface TopPagesResponse {
  data: TopPageData[]
}

export interface TrafficSourcesResponse {
  data: TrafficSourceData[]
}

export interface DeviceDataResponse {
  data: DeviceData[]
}

export interface GeographicDataResponse {
  data: GeographicData[]
}

export interface DailyMetricsResponse {
  data: DailyMetricsData[]
  totalPageViews: number
  totalSessions: number
  totalUsers: number
}

// Enhanced Hybrid analytics response type with all required properties
export interface HybridAnalyticsResponse<T> {
  data: T[]
  // Summary metrics (optional for compatibility)
  totalPageViews?: number
  totalSessions?: number
  totalUsers?: number
  // Hybrid metadata
  _hybrid: boolean
  _strategy?: "historical-only" | "ga4-only" | "hybrid" | "no-data"
  // Data source counts
  _historicalDays?: number
  _ga4Days?: number
  _historicalPages?: number
  _ga4Pages?: number
  // Raw data for debugging
  _historicalData?: any[]
  _ga4Data?: any[]
  // Source information
  _source?: string
  _error?: string
  _normalized?: boolean
  _dataType?: string
  // Data quality metrics
  _dataQuality?: {
    validRecords: number
    totalRecords: number
    issues: number
  }
}

// Specific response types for different data types
export interface HybridDailyMetricsResponse extends HybridAnalyticsResponse<DailyMetricsData> {
  totalPageViews: number
  totalSessions: number
  totalUsers: number
}

export interface HybridTopPagesResponse extends HybridAnalyticsResponse<TopPageData> {
  _historicalPages?: number
  _ga4Pages?: number
}

export interface HybridTrafficSourcesResponse extends HybridAnalyticsResponse<TrafficSourceData> {
  _dataType?: "traffic-sources" | "referrers"
}

export interface HybridDeviceResponse extends HybridAnalyticsResponse<DeviceData> {}

export interface HybridGeographicResponse extends HybridAnalyticsResponse<GeographicData> {}

// Analytics connection status
export interface AnalyticsConnectionStatus {
  success: boolean
  error?: string
  details?: {
    hasClient?: boolean
    hasPropertyId?: boolean
    authMethod?: "vercel-oidc" | "not-configured"
    isVercelOIDC?: boolean
    propertyId?: string
    dimensionCount?: number
    metricCount?: number
    projectId?: string
    serviceAccount?: string
    audience?: string | null
    serviceAccountUrl?: string | null
  }
}

export interface ConfigurationStatus {
  configured: boolean
  authenticationMethod: "vercel-oidc" | "not-configured"
  isVercelDeployment: boolean
  isProduction: boolean
  missingVariables: string[]
  recommendations: string[]
  oidcSetup: {
    poolId?: string
    providerId?: string
    serviceAccountEmail?: string
    projectNumber?: string
  }
}

// Migration and database types
export interface MigrationStatus {
  success: boolean
  message: string
  tablesCreated?: string[]
  error?: string
}

export interface DatabaseTableInfo {
  tableName: string
  exists: boolean
  rowCount: number
}

// CSV upload types
export interface CSVUploadResponse {
  success: boolean
  message: string
  rowsProcessed?: number
  error?: string
}

// Data source info
export interface DataSourceInfo {
  vercelAnalytics: {
    available: boolean
    recordCount?: number
    dateRange?: { start: string; end: string }
  }
  googleAnalytics: {
    available: boolean
    configured: boolean
    ga4StartDate: string
  }
  compatibility: {
    normalizationEnabled: boolean
    dataQualityChecks: boolean
    supportedFormats: string[]
  }
}

// Data source strategy types
export interface DataSourceStrategy {
  useHistorical: boolean
  useGA4: boolean
  historicalStart?: string
  historicalEnd?: string
  ga4Start?: string
  ga4End?: string
  strategy: "historical-only" | "ga4-only" | "hybrid" | "no-data"
}
