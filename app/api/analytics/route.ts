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

  // Check configuration first
  const configStatus = getConfigurationStatus()
  console.log("[Analytics API] Configuration status:", configStatus)

  if (!validateAnalyticsConfig()) {
    console.error("[Analytics API] Configuration validation failed")
    return NextResponse.json(
      {
        error: "Google Analytics not configured. Check environment variables.",
        config: configStatus,
        missingVars: Object.entries(configStatus)
          .filter(([key, value]) => !value)
          .map(([key]) => key),
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

        // Add percentage changes (mock for now, you can implement comparison logic)
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

    // Provide more specific error information
    let errorMessage = "Unknown error occurred"
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      // Check for specific Google Analytics errors
      if (error.message.includes("permission")) {
        statusCode = 403
        errorMessage = "Permission denied. Check Google Analytics permissions for the service account."
      } else if (error.message.includes("quota")) {
        statusCode = 429
        errorMessage = "Google Analytics API quota exceeded. Try again later."
      } else if (error.message.includes("authentication") || error.message.includes("credentials")) {
        statusCode = 401
        errorMessage = "Authentication failed. Check Vercel OIDC Workload Identity Federation setup."
      } else if (error.message.includes("INVALID_ARGUMENT")) {
        statusCode = 400
        errorMessage = "Invalid request parameters. Check GA4 Property ID and date formats."
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        endpoint,
        startDate,
        endDate,
        timestamp: new Date().toISOString(),
        config: configStatus,
      },
      { status: statusCode },
    )
  }
}
