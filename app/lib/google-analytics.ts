import { BetaAnalyticsDataClient } from "@google-analytics/data"
import { GoogleAuth } from "google-auth-library"
import { analyticsConfig, validateAnalyticsConfig } from "./analytics-config"

// Initialize Google Analytics client
let analyticsDataClient: BetaAnalyticsDataClient | null = null

// Create service account credentials from environment variable
function createServiceAccountCredentials() {
  console.log("[Analytics] Creating service account credentials...")

  if (!analyticsConfig.googleServiceAccountKey) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is required")
  }

  try {
    console.log("[Analytics] Parsing service account key...")
    const credentials = JSON.parse(analyticsConfig.googleServiceAccountKey)

    // Validate required fields
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Service account key missing required fields (client_email, private_key)")
    }

    console.log("[Analytics] Service account credentials parsed successfully")
    console.log("[Analytics] Using service account:", credentials.client_email)
    console.log("[Analytics] Project ID from credentials:", credentials.project_id)

    return credentials
  } catch (error) {
    console.error("[Analytics] Failed to parse service account key:", error)
    console.error("[Analytics] Service account key length:", analyticsConfig.googleServiceAccountKey?.length)
    console.error(
      "[Analytics] Service account key preview:",
      analyticsConfig.googleServiceAccountKey?.substring(0, 100) + "...",
    )
    throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY format - must be valid JSON")
  }
}

async function getAnalyticsClient(): Promise<BetaAnalyticsDataClient> {
  console.log("[Analytics] Getting analytics client...")

  if (!validateAnalyticsConfig()) {
    throw new Error("Google Analytics configuration is incomplete. Check environment variables.")
  }

  if (!analyticsDataClient) {
    try {
      console.log("[Analytics] Initializing Google Analytics client with service account key")

      const credentials = createServiceAccountCredentials()
      console.log("[Analytics] Credentials created, initializing GoogleAuth...")

      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        projectId: analyticsConfig.gcpProjectId,
        credentials,
      })

      console.log("[Analytics] GoogleAuth initialized, creating BetaAnalyticsDataClient...")

      // Use the correct Analytics Data API service endpoint
      analyticsDataClient = new BetaAnalyticsDataClient({
        auth,
        projectId: analyticsConfig.gcpProjectId,
        apiEndpoint: "https://analyticsdata.googleapis.com",
        timeout: 30000, // 30 seconds
      })

      console.log("[Analytics] Successfully initialized Google Analytics client")
    } catch (error) {
      console.error("[Analytics] Failed to initialize client:", error)
      console.error("[Analytics] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack trace",
      })
      analyticsDataClient = null
      throw new Error(
        `Failed to initialize Google Analytics: ${error instanceof Error ? error.message : "Unknown error"}`,
      )
    }
  }

  return analyticsDataClient
}

// Helper function to retry API calls
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Analytics] Attempt ${attempt}/${maxRetries}`)
      return await operation()
    } catch (error) {
      lastError = error
      console.error(`[Analytics] Attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error))

      // Check if it's a network error that might be transient
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("ETIMEDOUT") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("UNAVAILABLE") ||
          error.message.includes("network") ||
          error.message.includes("connection"))

      if (!isNetworkError || attempt === maxRetries) {
        throw error
      }

      console.log(`[Analytics] Network error, retrying (${attempt}/${maxRetries}): ${error.message}`)
      await new Promise((resolve) => setTimeout(resolve, delay * attempt))
    }
  }

  throw lastError
}

// Test the Google Analytics connection
export async function testAnalyticsConnection() {
  try {
    console.log("[Analytics] Testing connection...")
    console.log("[Analytics] Configuration check:", {
      propertyId: analyticsConfig.ga4PropertyId,
      projectId: analyticsConfig.gcpProjectId,
      hasServiceAccountKey: !!analyticsConfig.googleServiceAccountKey,
    })

    const client = await getAnalyticsClient()
    console.log("[Analytics] Client initialized, testing metadata request...")

    // Test with a simple metadata request with retry
    const response = await retryOperation(async () => {
      console.log("[Analytics] Making metadata request...")
      const [resp] = await client.getMetadata({
        name: `properties/${analyticsConfig.ga4PropertyId}/metadata`,
      })
      console.log("[Analytics] Metadata request completed successfully")
      return resp
    })

    console.log("[Analytics] Metadata request successful")

    return {
      success: true,
      propertyId: analyticsConfig.ga4PropertyId,
      dimensionCount: response.dimensions?.length || 0,
      metricCount: response.metrics?.length || 0,
      projectId: analyticsConfig.gcpProjectId,
    }
  } catch (error) {
    console.error("[Analytics] Connection test failed:", error)

    let errorMessage = "Unknown error"
    if (error instanceof Error) {
      errorMessage = error.message

      // Network connectivity errors
      if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("UNAVAILABLE")
      ) {
        errorMessage = `Network connectivity issue: ${error.message}. The server cannot reach Google Analytics API. This may be due to network restrictions, firewall settings, or DNS issues.`
      }
      // Permission errors
      else if (error.message.includes("permission") || error.message.includes("PERMISSION_DENIED")) {
        errorMessage = `Permission denied. Please ensure:
1. Analytics Data API is enabled in Google Cloud Console
2. Service account has 'Viewer' role on GA4 property ${analyticsConfig.ga4PropertyId}
3. Service account email is added as a user in Google Analytics`
      }
    }

    return {
      success: false,
      error: errorMessage,
      propertyId: analyticsConfig.ga4PropertyId,
      projectId: analyticsConfig.gcpProjectId,
    }
  }
}

// Enhanced error handling for Google Analytics API calls
function handleAnalyticsError(error: any, operation: string) {
  console.error(`[Analytics] ${operation} failed:`, error)
  console.error(`[Analytics] Error type:`, typeof error)
  console.error(`[Analytics] Error constructor:`, error?.constructor?.name)
  console.error(`[Analytics] Error message:`, error instanceof Error ? error.message : String(error))

  if (error instanceof Error) {
    // Network connectivity errors
    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("UNAVAILABLE") ||
      error.message.includes("No connection established")
    ) {
      throw new Error(
        `Network connectivity issue: Cannot connect to Google Analytics API. This may be due to network restrictions on your hosting provider. Error: ${error.message}`,
      )
    }
    // Permission errors
    else if (error.message.includes("permission") || error.message.includes("PERMISSION_DENIED")) {
      throw new Error(
        `Permission denied: Service account needs Analytics Data API access for property ${analyticsConfig.ga4PropertyId}. Please ensure:
1. Analytics Data API is enabled in Google Cloud Console
2. Service account has 'Viewer' role on the GA4 property
3. Service account email is added as a user in Google Analytics`,
      )
    } else if (error.message.includes("quota") || error.message.includes("QUOTA_EXCEEDED")) {
      throw new Error(
        `API quota exceeded. Check Google Analytics API quotas for project: ${analyticsConfig.gcpProjectId}`,
      )
    } else if (error.message.includes("INVALID_ARGUMENT")) {
      throw new Error(`Invalid request parameters. Check GA4 Property ID: ${analyticsConfig.ga4PropertyId}`)
    } else if (error.message.includes("NOT_FOUND")) {
      throw new Error(`GA4 Property not found: ${analyticsConfig.ga4PropertyId}. Verify the property ID is correct.`)
    } else if (error.message.includes("authentication") || error.message.includes("credentials")) {
      throw new Error("Authentication failed. Check GOOGLE_SERVICE_ACCOUNT_KEY format and permissions.")
    }
  }

  throw error
}

// Get analytics summary data
export async function getAnalyticsSummary(startDate: string, endDate: string) {
  console.log(`[Analytics] getAnalyticsSummary called with dates: ${startDate} to ${endDate}`)

  const client = await getAnalyticsClient()
  console.log("[Analytics] Client obtained, making runReport request...")

  try {
    const response = await retryOperation(async () => {
      console.log("[Analytics] Making runReport request for summary...")
      const [resp] = await client.runReport({
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
      console.log("[Analytics] runReport request completed successfully")
      return resp
    })

    console.log("[Analytics] Processing response...")
    console.log("[Analytics] Response rows count:", response.rows?.length || 0)

    const row = response.rows?.[0]
    const result = {
      totalPageViews: Number.parseInt(row?.metricValues?.[0]?.value || "0"),
      totalSessions: Number.parseInt(row?.metricValues?.[1]?.value || "0"),
      totalUsers: Number.parseInt(row?.metricValues?.[2]?.value || "0"),
      bounceRate: Number.parseFloat(row?.metricValues?.[3]?.value || "0"),
      averageSessionDuration: Number.parseFloat(row?.metricValues?.[4]?.value || "0"),
    }

    console.log("[Analytics] Summary processed successfully:", result)
    return result
  } catch (error) {
    console.error("[Analytics] Error in getAnalyticsSummary:", error)
    handleAnalyticsError(error, "fetch analytics summary")
    throw error
  }
}

// Get daily metrics data
export async function getDailyMetrics(startDate: string, endDate: string) {
  const client = await getAnalyticsClient()

  try {
    console.log(`[Analytics] Fetching daily metrics for ${startDate} to ${endDate}`)

    const response = await retryOperation(async () => {
      const [resp] = await client.runReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      })
      return resp
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
  const client = await getAnalyticsClient()

  try {
    console.log(`[Analytics] Fetching page views for ${startDate} to ${endDate}`)

    const response = await retryOperation(async () => {
      const [resp] = await client.runReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "bounceRate" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 100,
      })
      return resp
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
  const client = await getAnalyticsClient()

  try {
    console.log(`[Analytics] Fetching traffic sources for ${startDate} to ${endDate}`)

    const response = await retryOperation(async () => {
      const [resp] = await client.runReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      })
      return resp
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
  const client = await getAnalyticsClient()

  try {
    console.log(`[Analytics] Fetching device data for ${startDate} to ${endDate}`)

    const response = await retryOperation(async () => {
      const [resp] = await client.runReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      })
      return resp
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
  const client = await getAnalyticsClient()

  try {
    console.log(`[Analytics] Fetching geographic data for ${startDate} to ${endDate}`)

    const response = await retryOperation(async () => {
      const [resp] = await client.runReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "country" }, { name: "city" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 20,
      })
      return resp
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
  const client = await getAnalyticsClient()

  try {
    console.log("[Analytics] Fetching realtime data")

    const response = await retryOperation(async () => {
      const [resp] = await client.runRealtimeReport({
        property: `properties/${analyticsConfig.ga4PropertyId}`,
        metrics: [{ name: "activeUsers" }],
        dimensions: [{ name: "country" }],
        limit: 10,
      })
      return resp
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
