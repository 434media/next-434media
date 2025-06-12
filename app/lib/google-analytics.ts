import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAuth } from "google-auth-library"
import {
  analyticsConfig,
  getWorkloadIdentityAudience,
  getServiceAccountImpersonationUrl,
  validateAnalyticsConfig,
} from "./analytics-config"

// Initialize Google Analytics client
let analyticsDataClient: BetaAnalyticsDataClient | null = null

async function getAnalyticsClient(): Promise<BetaAnalyticsDataClient> {
  if (!validateAnalyticsConfig()) {
    throw new Error("Google Analytics configuration is incomplete. Check environment variables.")
  }

  if (!analyticsDataClient) {
    try {
      console.log("[Analytics] Initializing Google Analytics client")

      const audience = getWorkloadIdentityAudience()
      const serviceAccountImpersonationUrl = getServiceAccountImpersonationUrl()

      console.log("[Analytics] Auth configuration:", {
        audience: audience.substring(0, 50) + "...",
        serviceAccountEmail: analyticsConfig.gcpServiceAccountEmail,
        projectId: analyticsConfig.gcpProjectId,
        hasAudience: !!audience,
        hasServiceAccountUrl: !!serviceAccountImpersonationUrl,
      })

      // Create the external account credentials specifically for Vercel OIDC
      const credentials = {
        type: "external_account",
        audience,
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: "https://oauth2.googleapis.com/token",
        service_account_impersonation_url: serviceAccountImpersonationUrl,
        credential_source: {
          environment_id: "vercel",
          regional_cred_verification_url: "https://vercel.com/oidc",
          url: "https://vercel.com/oidc",
          format: {
            type: "json",
            subject_token_field_name: "token",
          },
          headers: {
            Authorization: "Bearer " + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
          },
        },
      }

      console.log("[Analytics] Creating GoogleAuth with Vercel OIDC credentials...")

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        projectId: analyticsConfig.gcpProjectId,
        credentials,
      })

      console.log("[Analytics] Creating BetaAnalyticsDataClient...")

      analyticsDataClient = new BetaAnalyticsDataClient({
        auth,
        projectId: analyticsConfig.gcpProjectId,
      })

      console.log("[Analytics] Successfully initialized Google Analytics client")
    } catch (error) {
      console.error("[Analytics] Failed to initialize client:", error)
      analyticsDataClient = null
      throw new Error(
        `Failed to initialize Google Analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  return analyticsDataClient
}

// Alternative initialization method using service account key (if OIDC fails)
async function getAnalyticsClientWithServiceAccount(): Promise<BetaAnalyticsDataClient> {
  if (!validateAnalyticsConfig()) {
    throw new Error("Google Analytics configuration is incomplete. Check environment variables.")
  }

  try {
    console.log("[Analytics] Attempting service account authentication...")

    // Check if we have a service account key
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!serviceAccountKey) {
      throw new Error("No service account key provided")
    }

    const credentials = JSON.parse(serviceAccountKey)

    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
      projectId: analyticsConfig.gcpProjectId,
      credentials,
    })

    const client = new BetaAnalyticsDataClient({
      auth,
      projectId: analyticsConfig.gcpProjectId,
    })

    console.log("[Analytics] Successfully initialized with service account key")
    return client
  } catch (error) {
    console.error("[Analytics] Service account authentication failed:", error)
    throw error
  }
}

// Test the Google Analytics connection with fallback
export async function testAnalyticsConnection() {
  try {
    console.log("[Analytics] Testing connection...")

    let client: BetaAnalyticsDataClient

    try {
      // Try Vercel OIDC first
      client = await getAnalyticsClient()
    } catch (oidcError) {
      console.log("[Analytics] OIDC failed, trying service account key...")
      // Fallback to service account key
      client = await getAnalyticsClientWithServiceAccount()
    }

    console.log("[Analytics] Client initialized, testing metadata request...")

    // Test with a simple metadata request
    const [response] = await client.getMetadata({
      name: `properties/${analyticsConfig.ga4PropertyId}/metadata`,
    })

    console.log("[Analytics] Metadata request successful")

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
      details: {
        propertyId: analyticsConfig.ga4PropertyId,
        projectId: analyticsConfig.gcpProjectId,
        serviceAccount: analyticsConfig.gcpServiceAccountEmail,
        hasOIDCToken: !!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        hasServiceAccountKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      },
    }
  }
}

// Enhanced error handling for Google Analytics API calls
function handleAnalyticsError(error: any, operation: string) {
  console.error(`[Analytics] ${operation} failed:`, error)

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes("credential_source") || error.message.includes("AWS")) {
      throw new Error(
        `Authentication configuration error: ${error.message}. Try setting GOOGLE_SERVICE_ACCOUNT_KEY environment variable as fallback.`,
      )
    }
    if (error.message.includes("permission") || error.message.includes("PERMISSION_DENIED")) {
      throw new Error(
        `Permission denied: Service account ${analyticsConfig.gcpServiceAccountEmail} needs Analytics Data API access.`,
      )
    }
    if (error.message.includes("quota") || error.message.includes("QUOTA_EXCEEDED")) {
      throw new Error(
        `API quota exceeded. Check Google Analytics API quotas for project: ${analyticsConfig.gcpProjectId}`,
      )
    }
    if (error.message.includes("INVALID_ARGUMENT")) {
      throw new Error(`Invalid request parameters. Check GA4 Property ID: ${analyticsConfig.ga4PropertyId}`)
    }
    if (error.message.includes("NOT_FOUND")) {
      throw new Error(`GA4 Property not found: ${analyticsConfig.ga4PropertyId}. Verify the property ID is correct.`)
    }
  }

  throw error
}

// Helper function to get client with fallback
async function getClientWithFallback(): Promise<BetaAnalyticsDataClient> {
  try {
    return await getAnalyticsClient()
  } catch (oidcError) {
    console.log("[Analytics] OIDC failed, trying service account key fallback...")
    return await getAnalyticsClientWithServiceAccount()
  }
}

// Get analytics summary data
export async function getAnalyticsSummary(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching summary for ${startDate} to ${endDate}`)

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
    const result = {
      totalPageViews: Number.parseInt(row?.metricValues?.[0]?.value || "0"),
      totalSessions: Number.parseInt(row?.metricValues?.[1]?.value || "0"),
      totalUsers: Number.parseInt(row?.metricValues?.[2]?.value || "0"),
      bounceRate: Number.parseFloat(row?.metricValues?.[3]?.value || "0"),
      averageSessionDuration: Number.parseFloat(row?.metricValues?.[4]?.value || "0"),
    }

    console.log("[Analytics] Summary fetched:", result)
    return result
  } catch (error) {
    handleAnalyticsError(error, "fetch analytics summary")
    throw error
  }
}

// Get daily metrics data
export async function getDailyMetrics(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching daily metrics for ${startDate} to ${endDate}`)

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

    const result = {
      data,
      totalPageViews,
      totalSessions,
      totalUsers,
    }

    console.log(`[Analytics] Daily metrics fetched: ${data.length} days`)
    return result
  } catch (error) {
    handleAnalyticsError(error, "fetch daily metrics")
    throw error
  }
}

// Get page views data
export async function getPageViewsData(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching page views for ${startDate} to ${endDate}`)

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

    console.log(`[Analytics] Page views fetched: ${data.length} pages`)
    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch page views")
    throw error
  }
}

// Get traffic sources data
export async function getTrafficSourcesData(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching traffic sources for ${startDate} to ${endDate}`)

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

    console.log(`[Analytics] Traffic sources fetched: ${data.length} sources`)
    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch traffic sources")
    throw error
  }
}

// Get device data
export async function getDeviceData(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching device data for ${startDate} to ${endDate}`)

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

    console.log(`[Analytics] Device data fetched: ${data.length} device types`)
    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch device data")
    throw error
  }
}

// Get geographic data
export async function getGeographicData(startDate: string, endDate: string) {
  const client = await getClientWithFallback()

  try {
    console.log(`[Analytics] Fetching geographic data for ${startDate} to ${endDate}`)

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

    console.log(`[Analytics] Geographic data fetched: ${data.length} locations`)
    return { data }
  } catch (error) {
    handleAnalyticsError(error, "fetch geographic data")
    throw error
  }
}

// Get real-time data
export async function getRealtimeData() {
  const client = await getClientWithFallback()

  try {
    console.log("[Analytics] Fetching realtime data")

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

    console.log(`[Analytics] Realtime data fetched: ${totalActiveUsers} active users`)
    return {
      totalActiveUsers,
      topCountries,
    }
  } catch (error) {
    handleAnalyticsError(error, "fetch realtime data")
    throw error
  }
}
