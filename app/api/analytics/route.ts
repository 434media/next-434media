import { type NextRequest, NextResponse } from "next/server"
import {
  testAnalyticsConnection,
  getAnalyticsSummary,
  getDailyMetrics,
  getPageViewsData,
  getTrafficSourcesData,
  getDeviceData,
  getGeographicData,
  getRealtimeData,
} from "../../lib/google-analytics"
import { validateAnalyticsConfig, getConfigurationStatus } from "../../lib/analytics-config"

// Helper function to convert relative dates to YYYY-MM-DD format
function formatDateForGA(dateString: string): string {
  const today = new Date()

  switch (dateString) {
    case "today":
      return today.toISOString().split("T")[0]
    case "yesterday":
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return yesterday.toISOString().split("T")[0]
    case "7daysAgo":
      const sevenDaysAgo = new Date(today)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      return sevenDaysAgo.toISOString().split("T")[0]
    case "30daysAgo":
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return thirtyDaysAgo.toISOString().split("T")[0]
    case "90daysAgo":
      const ninetyDaysAgo = new Date(today)
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      return ninetyDaysAgo.toISOString().split("T")[0]
    default:
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }
      // Default to today if format is unrecognized
      return today.toISOString().split("T")[0]
  }
}

export async function GET(request: NextRequest) {
  console.log("[Analytics API] Request received:", request.url)

  // Get detailed configuration status
  const configStatus = getConfigurationStatus()
  console.log("[Analytics API] Detailed configuration:", configStatus)

  // Check which specific variables are missing
  const missingVars = []
  if (!process.env.GA4_PROPERTY_ID) missingVars.push("GA4_PROPERTY_ID")
  if (!process.env.GCP_PROJECT_ID) missingVars.push("GCP_PROJECT_ID")
  if (!process.env.GCP_PROJECT_NUMBER) missingVars.push("GCP_PROJECT_NUMBER")
  if (!process.env.GCP_WORKLOAD_IDENTITY_POOL_ID) missingVars.push("GCP_WORKLOAD_IDENTITY_POOL_ID")
  if (!process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID) missingVars.push("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")
  if (!process.env.GCP_SERVICE_ACCOUNT_EMAIL) missingVars.push("GCP_SERVICE_ACCOUNT_EMAIL")
  if (!process.env.ADMIN_PASSWORD) missingVars.push("ADMIN_PASSWORD")

  console.log("[Analytics API] Missing environment variables:", missingVars)

  if (!validateAnalyticsConfig()) {
    console.error("[Analytics API] Configuration validation failed")
    return NextResponse.json(
      {
        error: "Google Analytics not configured. Missing required environment variables.",
        missingVariables: missingVars,
        config: configStatus,
        help: {
          message: "Set these environment variables in your deployment platform:",
          required: [
            "GA4_PROPERTY_ID - Your Google Analytics 4 property ID",
            "GCP_PROJECT_ID - Your Google Cloud project ID",
            "GCP_PROJECT_NUMBER - Your Google Cloud project number",
            "GCP_WORKLOAD_IDENTITY_POOL_ID - Workload Identity pool ID",
            "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID - Workload Identity provider ID",
            "GCP_SERVICE_ACCOUNT_EMAIL - Service account email with Analytics access",
            "ADMIN_PASSWORD - Password for analytics dashboard access",
          ],
        },
      },
      { status: 400 },
    )
  }

  const searchParams = request.nextUrl.searchParams
  const endpoint = searchParams.get("endpoint")
  const startDateParam = searchParams.get("startDate") || "7daysAgo"
  const endDateParam = searchParams.get("endDate") || "today"
  const adminKey = request.headers.get("x-admin-key")

  console.log("[Analytics API] Parameters:", {
    endpoint,
    startDateParam,
    endDateParam,
    hasAdminKey: !!adminKey,
  })

  // Validate admin key
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    console.error("[Analytics API] Invalid admin key")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Convert relative dates to proper format
  const startDate = formatDateForGA(startDateParam)
  const endDate = formatDateForGA(endDateParam)

  console.log("[Analytics API] Formatted dates:", { startDate, endDate })

  try {
    switch (endpoint) {
      case "test-connection":
        console.log("[Analytics API] Testing connection...")
        const connectionStatus = await testAnalyticsConnection()
        console.log("[Analytics API] Connection result:", connectionStatus)
        return NextResponse.json(connectionStatus)

      case "summary":
        console.log("[Analytics API] Fetching summary data...")
        const summary = await getAnalyticsSummary(startDate, endDate)
        console.log("[Analytics API] Summary data fetched:", {
          totalPageViews: summary.totalPageViews,
          totalSessions: summary.totalSessions,
          totalUsers: summary.totalUsers,
        })

        const enhancedSummary = {
          ...summary,
          pageViewsChange: 0,
          sessionsChange: 0,
          usersChange: 0,
          bounceRateChange: 0,
          activeUsers: summary.totalUsers,
        }
        return NextResponse.json(enhancedSummary)

      case "daily-metrics":
        console.log("[Analytics API] Fetching daily metrics...")
        const dailyMetrics = await getDailyMetrics(startDate, endDate)
        console.log("[Analytics API] Daily metrics fetched:", dailyMetrics.data.length, "days")
        return NextResponse.json(dailyMetrics)

      case "pages":
      case "toppages": // Handle both endpoint names
        console.log("[Analytics API] Fetching page views...")
        const pageViews = await getPageViewsData(startDate, endDate)
        console.log("[Analytics API] Page views fetched:", pageViews.data.length, "pages")
        return NextResponse.json(pageViews)

      case "referrers":
      case "traffic-sources":
        console.log("[Analytics API] Fetching traffic sources...")
        const trafficSources = await getTrafficSourcesData(startDate, endDate)
        console.log("[Analytics API] Traffic sources fetched:", trafficSources.data.length, "sources")
        return NextResponse.json(trafficSources)

      case "devices":
        console.log("[Analytics API] Fetching device data...")
        const deviceData = await getDeviceData(startDate, endDate)
        console.log("[Analytics API] Device data fetched:", deviceData.data.length, "device types")
        return NextResponse.json(deviceData)

      case "geographic":
        console.log("[Analytics API] Fetching geographic data...")
        const geoData = await getGeographicData(startDate, endDate)
        console.log("[Analytics API] Geographic data fetched:", geoData.data.length, "locations")
        return NextResponse.json(geoData)

      case "realtime":
        console.log("[Analytics API] Fetching realtime data...")
        const realtimeData = await getRealtimeData()
        console.log("[Analytics API] Realtime data fetched:", realtimeData.totalActiveUsers, "active users")
        return NextResponse.json(realtimeData)

      default:
        console.error("[Analytics API] Invalid endpoint:", endpoint)
        return NextResponse.json({ error: "Invalid endpoint parameter" }, { status: 400 })
    }
  } catch (error) {
    console.error("[Analytics API] Error:", error)

    let errorMessage = "Unknown error occurred"
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      if (error.message.includes("permission") || error.message.includes("PERMISSION_DENIED")) {
        statusCode = 403
        errorMessage = "Permission denied. Check Google Analytics permissions for the service account."
      } else if (error.message.includes("quota") || error.message.includes("QUOTA_EXCEEDED")) {
        statusCode = 429
        errorMessage = "Google Analytics API quota exceeded. Try again later."
      } else if (error.message.includes("authentication") || error.message.includes("credentials")) {
        statusCode = 401
        errorMessage = "Authentication failed. Check Google Analytics authentication setup."
      } else if (error.message.includes("INVALID_ARGUMENT")) {
        statusCode = 400
        errorMessage = "Invalid request parameters. Check GA4 Property ID and date formats."
      } else if (error.message.includes("NOT_FOUND")) {
        statusCode = 404
        errorMessage = "GA4 Property not found. Verify the property ID is correct."
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        endpoint,
        startDate,
        endDate,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    )
  }
}
