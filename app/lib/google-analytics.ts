import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAuth } from "google-auth-library"
import {
  analyticsConfig,
  getWorkloadIdentityAudience,
  getServiceAccountImpersonationUrl,
  validateAnalyticsConfig,
} from "./analytics-config"

// Initialize Google Analytics client with Vercel OIDC
let analyticsDataClient: BetaAnalyticsDataClient | null = null

async function getAnalyticsClient(): Promise<BetaAnalyticsDataClient> {
  if (!validateAnalyticsConfig()) {
    throw new Error("Google Analytics configuration is incomplete. Check environment variables.")
  }

  if (!analyticsDataClient) {
    try {
      console.log("[Analytics] Initializing Google Analytics client with Vercel OIDC")

      const audience = getWorkloadIdentityAudience()
      const serviceAccountImpersonationUrl = getServiceAccountImpersonationUrl()

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

      console.log("[Analytics] Successfully initialized Google Analytics client")
    } catch (error) {
      console.error("[Analytics] Failed to initialize client:", error)
      throw new Error(
        `Failed to initialize Google Analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  return analyticsDataClient
}

// Test the Google Analytics connection
export async function testAnalyticsConnection() {
  try {
    const client = await getAnalyticsClient()

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${analyticsConfig.ga4PropertyId}/metadata`,
    })

    return {
      success: true,
      propertyId: analyticsConfig.ga4PropertyId,
      dimensionCount: response.dimensions?.length || 0,
      metricCount: response.metrics?.length || 0,
      projectId: analyticsConfig.gcpProjectId,
      serviceAccount: analyticsConfig.gcpServiceAccountEmail,
    }
  } catch (error) {
    console.error("[Analytics] Connection test failed:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// Get analytics summary data
export async function getAnalyticsSummary(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch summary:", error)
    throw new Error(`Failed to fetch analytics summary: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get daily metrics data
export async function getDailyMetrics(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch daily metrics:", error)
    throw new Error(`Failed to fetch daily metrics: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get page views data
export async function getPageViewsData(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch page views:", error)
    throw new Error(`Failed to fetch page views: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch traffic sources:", error)
    throw new Error(`Failed to fetch traffic sources: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get device data
export async function getDeviceData(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch device data:", error)
    throw new Error(`Failed to fetch device data: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get geographic data
export async function getGeographicData(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch geographic data:", error)
    throw new Error(`Failed to fetch geographic data: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Get real-time data
export async function getRealtimeData() {
  const client = await getAnalyticsClient()

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
    console.error("[Analytics] Failed to fetch realtime data:", error)
    throw new Error(`Failed to fetch realtime data: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
