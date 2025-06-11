import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAuth } from "google-auth-library"
import {
  analyticsConfig,
  isVercelOIDCConfigured,
  isLocalDevelopmentConfigured,
  getWorkloadIdentityAudience,
  getServiceAccountImpersonationUrl,
  getAuthenticationMethod,
} from "./analytics-config"

// Initialize Google Analytics client with Vercel OIDC Workload Identity Federation
let analyticsDataClient: BetaAnalyticsDataClient | null = null

function getAnalyticsClient() {
  if (!analyticsDataClient) {
    try {
      const authMethod = getAuthenticationMethod()

      if (authMethod === "vercel-oidc") {
        // Vercel OIDC Workload Identity Federation setup
        console.log("[Analytics] Initializing with Vercel OIDC Workload Identity Federation")

        const audience = getWorkloadIdentityAudience()
        const serviceAccountImpersonationUrl = getServiceAccountImpersonationUrl()

        if (!audience || !serviceAccountImpersonationUrl) {
          throw new Error("Invalid Workload Identity Federation configuration")
        }

        const auth = new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
          projectId: analyticsConfig.gcpProjectId,
          credentials: {
            type: "external_account",
            audience,
            subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
            token_url: "https://oauth2.googleapis.com/token",
            service_account_impersonation_url: serviceAccountImpersonationUrl,
            credential_source: {
              environment_id: "vercel",
              regional_cred_verification_url: "https://vercel.com/oidc",
            },
          },
        })

        analyticsDataClient = new BetaAnalyticsDataClient({
          auth,
          projectId: analyticsConfig.gcpProjectId,
        })

        console.log("[Analytics] Successfully initialized with Vercel OIDC")
      } else if (authMethod === "service-account-file") {
        // Local development with service account file
        console.log("[Analytics] Initializing with service account file for local development")

        const auth = new GoogleAuth({
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
          projectId: analyticsConfig.gcpProjectId,
          keyFilename: analyticsConfig.googleApplicationCredentials,
        })

        analyticsDataClient = new BetaAnalyticsDataClient({
          auth,
          projectId: analyticsConfig.gcpProjectId,
        })

        console.log("[Analytics] Successfully initialized with service account file")
      } else {
        throw new Error("No valid authentication method configured")
      }
    } catch (error) {
      console.error("Failed to initialize Google Analytics client:", error)

      // Provide helpful error messages for common Vercel OIDC issues
      if (error instanceof Error) {
        if (error.message.includes("Could not load the default credentials")) {
          console.error(`
[Analytics] Vercel OIDC Workload Identity Federation Setup Issue:
- Ensure all GCP_* environment variables are set in Vercel
- Verify Workload Identity Pool and Provider are configured in GCP
- Check that the service account has Analytics Data API permissions
- For local development: Set GOOGLE_APPLICATION_CREDENTIALS to service account key file path
          `)
        }

        if (error.message.includes("Invalid Workload Identity Federation configuration")) {
          console.error(`
[Analytics] Missing Vercel OIDC Configuration:
Required environment variables:
- GCP_WORKLOAD_IDENTITY_POOL_ID=${analyticsConfig.gcpWorkloadIdentityPoolId || "MISSING"}
- GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=${analyticsConfig.gcpWorkloadIdentityPoolProviderId || "MISSING"}
- GCP_SERVICE_ACCOUNT_EMAIL=${analyticsConfig.gcpServiceAccountEmail || "MISSING"}
- GCP_PROJECT_NUMBER=${analyticsConfig.gcpProjectNumber || "MISSING"}
          `)
        }
      }
    }
  }
  return analyticsDataClient
}

// Test the Google Analytics connection with Vercel OIDC
export async function testAnalyticsConnection(): Promise<{
  success: boolean
  error?: string
  details?: any
}> {
  try {
    const client = getAnalyticsClient()
    if (!client || !analyticsConfig.ga4PropertyId) {
      return {
        success: false,
        error: "Google Analytics client not configured",
        details: {
          hasClient: !!client,
          hasPropertyId: !!analyticsConfig.ga4PropertyId,
          authMethod: getAuthenticationMethod(),
          isVercelOIDC: isVercelOIDCConfigured(),
          isLocalDev: isLocalDevelopmentConfigured(),
        },
      }
    }

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${analyticsConfig.ga4PropertyId}/metadata`,
    })

    return {
      success: true,
      details: {
        propertyId: analyticsConfig.ga4PropertyId,
        dimensionCount: response.dimensions?.length || 0,
        metricCount: response.metrics?.length || 0,
        authMethod: getAuthenticationMethod(),
        isVercelOIDC: isVercelOIDCConfigured(),
        projectId: analyticsConfig.gcpProjectId,
        serviceAccount: analyticsConfig.gcpServiceAccountEmail,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: {
        authMethod: getAuthenticationMethod(),
        isVercelOIDC: isVercelOIDCConfigured(),
        isLocalDev: isLocalDevelopmentConfigured(),
        hasCredentials: !!analyticsConfig.googleApplicationCredentials,
        audience: getWorkloadIdentityAudience(),
        serviceAccountUrl: getServiceAccountImpersonationUrl(),
      },
    }
  }
}

export interface AnalyticsDateRange {
  startDate: string
  endDate: string
}

export interface AnalyticsMetric {
  name: string
  value: string
}

export interface AnalyticsDimension {
  name: string
  value: string
}

export interface AnalyticsRow {
  dimensionValues: AnalyticsDimension[]
  metricValues: AnalyticsMetric[]
}

// Enhanced error handling for Vercel OIDC Workload Identity Federation
function handleAnalyticsError(error: any, operation: string) {
  console.error(`Failed to ${operation}:`, error)

  if (error instanceof Error) {
    if (error.message.includes("permission")) {
      throw new Error(
        `Permission denied for ${operation}. Check Google Analytics permissions for service account: ${analyticsConfig.gcpServiceAccountEmail}`,
      )
    }
    if (error.message.includes("quota")) {
      throw new Error(
        `Quota exceeded for ${operation}. Check Google Analytics API quotas for project: ${analyticsConfig.gcpProjectId}`,
      )
    }
    if (error.message.includes("credentials") || error.message.includes("authentication")) {
      throw new Error(`Authentication error for ${operation}. Check Vercel OIDC Workload Identity Federation setup.`)
    }
    if (error.message.includes("INVALID_ARGUMENT")) {
      throw new Error(`Invalid request for ${operation}. Check GA4 Property ID: ${analyticsConfig.ga4PropertyId}`)
    }
  }

  throw new Error(`Failed to ${operation}`)
}

// Get page views and sessions data
export async function getPageViewsData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    })

    return (
      response.rows?.map((row) => ({
        date: row.dimensionValues?.[0]?.value || "",
        pageViews: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        activeUsers: Number.parseInt(row.metricValues?.[2]?.value || "0"),
        bounceRate: Number.parseFloat(row.metricValues?.[3]?.value || "0"),
      })) || []
    )
  } catch (error) {
    handleAnalyticsError(error, "fetch page views data")
  }
}

// Get top pages data
export async function getTopPagesData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    })

    return (
      response.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        pageViews: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        bounceRate: Number.parseFloat(row.metricValues?.[2]?.value || "0"),
      })) || []
    )
  } catch (error) {
    handleAnalyticsError(error, "fetch top pages data")
  }
}

// Get traffic sources data (referrers)
export async function getTrafficSourcesData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 15,
    })

    return (
      response.rows?.map((row) => ({
        source: row.dimensionValues?.[0]?.value || "",
        medium: row.dimensionValues?.[1]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        newUsers: Number.parseInt(row.metricValues?.[2]?.value || "0"),
      })) || []
    )
  } catch (error) {
    handleAnalyticsError(error, "fetch traffic sources data")
  }
}

// Get device data (desktop vs mobile)
export async function getDeviceData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    })

    return (
      response.rows?.map((row) => ({
        deviceCategory: row.dimensionValues?.[0]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
      })) || []
    )
  } catch (error) {
    handleAnalyticsError(error, "fetch device data")
  }
}

// Get geographic data (countries and cities)
export async function getGeographicData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    })

    return (
      response.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        city: row.dimensionValues?.[1]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        newUsers: Number.parseInt(row.metricValues?.[2]?.value || "0"),
      })) || []
    )
  } catch (error) {
    handleAnalyticsError(error, "fetch geographic data")
  }
}

// Get real-time data
export async function getRealtimeData() {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runRealtimeReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      metrics: [{ name: "activeUsers" }],
      dimensions: [{ name: "country" }],
      limit: 10,
    })

    const totalActiveUsers =
      response.rows?.reduce((sum, row) => {
        return sum + Number.parseInt(row.metricValues?.[0]?.value || "0")
      }, 0) || 0

    const topCountries =
      response.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        activeUsers: Number.parseInt(row.metricValues?.[0]?.value || "0"),
      })) || []

    return {
      totalActiveUsers,
      topCountries,
    }
  } catch (error) {
    handleAnalyticsError(error, "fetch realtime data")
  }
}

// Get summary metrics
export async function getSummaryData(dateRange: AnalyticsDateRange) {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [dateRange],
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
      ],
    })

    const row = response.rows?.[0]
    return {
      totalPageViews: Number.parseInt(row?.metricValues?.[0]?.value || "0"),
      totalSessions: Number.parseInt(row?.metricValues?.[1]?.value || "0"),
      totalUsers: Number.parseInt(row?.metricValues?.[2]?.value || "0"),
      bounceRate: Number.parseFloat(row?.metricValues?.[3]?.value || "0"),
      averageSessionDuration: Number.parseFloat(row?.metricValues?.[4]?.value || "0"),
    }
  } catch (error) {
    handleAnalyticsError(error, "fetch summary data")
  }
}
