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
