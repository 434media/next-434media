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
  data: TopPageData[] // Changed from PageViewData to TopPageData since we're dealing with pages, not daily data
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

// Vercel OIDC Workload Identity Federation specific types
export interface VercelOIDCConfig {
  gcpProjectId: string
  gcpProjectNumber: string
  gcpWorkloadIdentityPoolId: string
  gcpWorkloadIdentityPoolProviderId: string
  gcpServiceAccountEmail: string
  ga4PropertyId: string
}

export interface AnalyticsConnectionStatus {
  success: boolean
  error?: string
  details?: {
    hasClient?: boolean
    hasPropertyId?: boolean
    authMethod?: "vercel-oidc" | "service-account-file" | "not-configured"
    isVercelOIDC?: boolean
    isLocalDev?: boolean
    propertyId?: string
    dimensionCount?: number
    metricCount?: number
    hasCredentials?: boolean
    projectId?: string
    serviceAccount?: string
    audience?: string | null
    serviceAccountUrl?: string | null
  }
}

export interface ConfigurationStatus {
  configured: boolean
  authenticationMethod: "vercel-oidc" | "service-account-file" | "not-configured"
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

// External account credentials structure for Vercel OIDC
export interface ExternalAccountCredentials {
  type: "external_account"
  audience: string
  subject_token_type: string
  token_url: string
  service_account_impersonation_url: string
  credential_source: {
    environment_id: string
    regional_cred_verification_url: string
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

// Hybrid analytics types
export interface HybridAnalyticsResponse<T> {
  data: T
  _hybrid?: boolean
  _historicalDays?: number
  _ga4Days?: number
  _historicalPages?: number
  _ga4Pages?: number
  _historicalData?: any
  _ga4Data?: any
}
