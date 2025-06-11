import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAuth } from "google-auth-library"
import {
  analyticsConfig,
  isVercelOIDCConfigured,
  getWorkloadIdentityAudience,
  getServiceAccountImpersonationUrl,
  getAuthenticationMethod,
} from "./analytics-config"
import type {
  SummaryData,
  PageViewsResponse,
  TrafficSourcesResponse,
  DeviceDataResponse,
  GeographicDataResponse,
  DailyMetricsResponse,
  RealtimeData,
  AnalyticsConnectionStatus,
} from "../types/analytics"

// Initialize Google Analytics client with Vercel OIDC Workload Identity Federation
let analyticsDataClient: BetaAnalyticsDataClient | null = null

function getAnalyticsClient() {
  if (!analyticsDataClient) {
    const authMethod = getAuthenticationMethod()

    if (authMethod !== "vercel-oidc") {
      throw new Error("Google Analytics requires Vercel OIDC Workload Identity Federation configuration")
    }

    try {
      console.log("[Analytics] Initializing with Vercel OIDC Workload Identity Federation")

      const audience = getWorkloadIdentityAudience()
      const serviceAccountImpersonationUrl = getServiceAccountImpersonationUrl()

      if (!audience || !serviceAccountImpersonationUrl) {
        throw new Error("Invalid Workload Identity Federation configuration")
      }

      // Log configuration for debugging (without sensitive data)
      console.log("[Analytics] OIDC Configuration:", {
        projectId: analyticsConfig.gcpProjectId,
        propertyId: analyticsConfig.ga4PropertyId,
        serviceAccount: analyticsConfig.gcpServiceAccountEmail,
        poolId: analyticsConfig.gcpWorkloadIdentityPoolId,
        providerId: analyticsConfig.gcpWorkloadIdentityPoolProviderId,
      })

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
    } catch (error) {
      console.error("Failed to initialize Google Analytics client:", error)
      throw error
    }
  }
  return analyticsDataClient
}

// Test the Google Analytics connection
export async function testAnalyticsConnection(): Promise<AnalyticsConnectionStatus> {
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
        audience: getWorkloadIdentityAudience(),
        serviceAccountUrl: getServiceAccountImpersonationUrl(),
      },
    }
  }
}

// Enhanced error handling
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

  throw error
}

// Get daily metrics data
export async function getDailyMetrics(startDate: string, endDate: string): Promise<DailyMetricsResponse> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    })

    const data =
      response.rows?.map((row) => ({
        date: row.dimensionValues?.[0]?.value || "",
        pageViews: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[2]?.value || "0"),
        bounceRate: Number.parseFloat(row.metricValues?.[3]?.value || "0"),
      })) || []

    const totalPageViews = data.reduce((sum, day) => sum + day.pageViews, 0)
    const totalSessions = data.reduce((sum, day) => sum + day.sessions, 0)
    const totalUsers = data.reduce((sum, day) => sum + day.users, 0)

    return {
      data,
      totalPageViews,
      totalSessions,
      totalUsers,
    }
  } catch (error) {
    handleAnalyticsError(error, "fetch daily metrics")
    throw error
  }
}

// Get page views data
export async function getPageViewsData(startDate: string, endDate: string): Promise<PageViewsResponse> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "bounceRate" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 100,
    })

    const data =
      response.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value || "",
        title: row.dimensionValues?.[1]?.value || "",
        pageViews: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        sessions: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        bounceRate: Number.parseFloat(row.metricValues?.[2]?.value || "0"),
      })) || []

    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch page views data")
    throw error
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(startDate: string, endDate: string): Promise<TrafficSourcesResponse> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 15,
    })

    const data =
      response.rows?.map((row) => ({
        source: row.dimensionValues?.[0]?.value || "",
        medium: row.dimensionValues?.[1]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        newUsers: Number.parseInt(row.metricValues?.[2]?.value || "0"),
      })) || []

    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch traffic sources data")
    throw error
  }
}

// Get device data
export async function getDeviceData(startDate: string, endDate: string): Promise<DeviceDataResponse> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    })

    const data =
      response.rows?.map((row) => ({
        deviceCategory: row.dimensionValues?.[0]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
      })) || []

    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch device data")
    throw error
  }
}

// Get geographic data
export async function getGeographicData(startDate: string, endDate: string): Promise<GeographicDataResponse> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 20,
    })

    const data =
      response.rows?.map((row) => ({
        country: row.dimensionValues?.[0]?.value || "",
        city: row.dimensionValues?.[1]?.value || "",
        sessions: Number.parseInt(row.metricValues?.[0]?.value || "0"),
        users: Number.parseInt(row.metricValues?.[1]?.value || "0"),
        newUsers: Number.parseInt(row.metricValues?.[2]?.value || "0"),
      })) || []

    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch geographic data")
    throw error
  }
}

// Get real-time data
export async function getRealtimeData(): Promise<RealtimeData> {
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
    throw error
  }
}

// Get analytics summary
export async function getAnalyticsSummary(startDate: string, endDate: string): Promise<SummaryData> {
  const client = getAnalyticsClient()
  if (!client || !analyticsConfig.ga4PropertyId) {
    throw new Error("Google Analytics not configured")
  }

  try {
    const [response] = await client.runReport({
      property: `properties/${analyticsConfig.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
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
    handleAnalyticsError(error, "fetch analytics summary")
    throw error
  }
}

// Alias for backward compatibility
export const getSummaryData = getAnalyticsSummary
