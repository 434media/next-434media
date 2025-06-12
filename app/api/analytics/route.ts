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
  console.log("[Analytics API] =================================")
  console.log("[Analytics API] Request received:", request.url)
  console.log("[Analytics API] Method:", request.method)
  console.log("[Analytics API] Headers:", Object.fromEntries(request.headers.entries()))

  try {
    // Check configuration first
    console.log("[Analytics API] Checking configuration...")

    const configStatus = getConfigurationStatus()
    console.log("[Analytics API] Configuration status:", {
      configured: configStatus.configured,
      missingVariables: configStatus.missingVariables,
      hasServiceAccountKey: configStatus.hasServiceAccountKey,
      hasAdminPassword: configStatus.hasAdminPassword,
    })

    if (!validateAnalyticsConfig()) {
      console.error("[Analytics API] Configuration validation failed:", configStatus.missingVariables)

      return NextResponse.json(
        {
          error: "Google Analytics not configured properly.",
          missingVariables: configStatus.missingVariables,
          help: {
            message: "Required environment variables:",
            required: [
              "GA4_PROPERTY_ID - Your Google Analytics 4 property ID (numeric)",
              "GCP_PROJECT_ID - Your Google Cloud project ID",
              "GOOGLE_SERVICE_ACCOUNT_KEY - Complete JSON service account key",
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

    console.log("[Analytics API] Request parameters:", {
      endpoint,
      startDateParam,
      endDateParam,
      hasAdminKey: !!adminKey,
      adminKeyLength: adminKey?.length || 0,
    })

    // Validate admin key
    const expectedAdminKey = process.env.ADMIN_PASSWORD
    console.log("[Analytics API] Admin key validation:", {
      hasExpectedKey: !!expectedAdminKey,
      expectedKeyLength: expectedAdminKey?.length || 0,
      keysMatch: adminKey === expectedAdminKey,
    })

    if (!adminKey || adminKey !== expectedAdminKey) {
      console.error("[Analytics API] Invalid admin key")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Convert relative dates to proper format
    console.log("[Analytics API] Converting dates...")
    const startDate = formatDateForGA(startDateParam)
    const endDate = formatDateForGA(endDateParam)

    console.log("[Analytics API] Formatted dates:", {
      original: { startDateParam, endDateParam },
      formatted: { startDate, endDate },
    })

    console.log("[Analytics API] Processing endpoint:", endpoint)

    switch (endpoint) {
      case "test-connection":
        console.log("[Analytics API] Testing connection...")
        const connectionStatus = await testAnalyticsConnection()
        console.log("[Analytics API] Connection result:", connectionStatus)
        return NextResponse.json(connectionStatus)

      case "summary":
      case "overview":
        console.log("[Analytics API] Fetching summary data...")
        console.log("[Analytics API] About to call getAnalyticsSummary with:", { startDate, endDate })

        const summary = await getAnalyticsSummary(startDate, endDate)
        console.log("[Analytics API] Raw summary result:", summary)

        const enhancedSummary = {
          ...summary,
          pageViewsChange: 0,
          sessionsChange: 0,
          usersChange: 0,
          bounceRateChange: 0,
          activeUsers: summary.totalUsers,
        }
        console.log("[Analytics API] Enhanced summary result:", enhancedSummary)
        return NextResponse.json(enhancedSummary)

      case "daily-metrics":
      case "chart":
      case "pageviews":
        console.log("[Analytics API] Fetching daily metrics...")
        const dailyMetrics = await getDailyMetrics(startDate, endDate)
        console.log("[Analytics API] Daily metrics result:", {
          dataLength: dailyMetrics.data.length,
          source: dailyMetrics._source || "unknown",
        })
        return NextResponse.json(dailyMetrics)

      case "pages":
      case "toppages":
      case "top-pages":
        console.log("[Analytics API] Fetching page views...")
        const pageViews = await getPageViewsData(startDate, endDate)
        console.log("[Analytics API] Page views result:", { dataLength: pageViews.data.length })
        return NextResponse.json(pageViews)

      case "referrers":
      case "traffic-sources":
      case "trafficsources":
      case "sources":
        console.log("[Analytics API] Fetching traffic sources...")
        const trafficSources = await getTrafficSourcesData(startDate, endDate)
        console.log("[Analytics API] Traffic sources result:", { dataLength: trafficSources.data.length })
        return NextResponse.json(trafficSources)

      case "devices":
      case "device-breakdown":
        console.log("[Analytics API] Fetching device data...")
        const deviceData = await getDeviceData(startDate, endDate)
        console.log("[Analytics API] Device data result:", { dataLength: deviceData.data.length })
        return NextResponse.json(deviceData)

      case "geographic":
      case "geography":
      case "geo":
      case "countries":
        console.log("[Analytics API] Fetching geographic data...")
        const geoData = await getGeographicData(startDate, endDate)
        console.log("[Analytics API] Geographic data result:", { dataLength: geoData.data.length })
        return NextResponse.json(geoData)

      case "realtime":
      case "real-time":
        console.log("[Analytics API] Fetching realtime data...")
        const realtimeData = await getRealtimeData()
        console.log("[Analytics API] Realtime data result:", realtimeData)
        return NextResponse.json(realtimeData)

      default:
        console.error("[Analytics API] Invalid endpoint:", endpoint)
        return NextResponse.json(
          {
            error: "Invalid endpoint parameter",
            endpoint: endpoint,
            availableEndpoints: [
              "test-connection",
              "summary",
              "daily-metrics",
              "pages",
              "toppages",
              "referrers",
              "trafficsources",
              "devices",
              "geographic",
              "realtime",
            ],
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[Analytics API] =================================")
    console.error("[Analytics API] CRITICAL ERROR:")
    console.error("[Analytics API] Error type:", typeof error)
    console.error("[Analytics API] Error constructor:", error?.constructor?.name)
    console.error("[Analytics API] Error message:", error instanceof Error ? error.message : String(error))
    console.error("[Analytics API] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[Analytics API] =================================")

    let errorMessage = "Unknown error occurred"
    let statusCode = 500
    let errorType = "unknown"

    if (error instanceof Error) {
      errorMessage = error.message

      // Network connectivity errors
      if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("UNAVAILABLE") ||
        error.message.includes("No connection established") ||
        error.message.includes("network")
      ) {
        statusCode = 503 // Service Unavailable
        errorType = "network"
        errorMessage = `Network connectivity issue: The server cannot reach Google Analytics API (${error.message}). This may be due to network restrictions on your hosting provider.`
      }
      // Permission errors
      else if (error.message.includes("permission") || error.message.includes("PERMISSION_DENIED")) {
        statusCode = 403
        errorType = "permission"
      }
      // Quota errors
      else if (error.message.includes("quota") || error.message.includes("QUOTA_EXCEEDED")) {
        statusCode = 429
        errorType = "quota"
      }
      // Authentication errors
      else if (error.message.includes("authentication") || error.message.includes("credentials")) {
        statusCode = 401
        errorType = "authentication"
      }
      // Invalid argument errors
      else if (error.message.includes("INVALID_ARGUMENT")) {
        statusCode = 400
        errorType = "invalid_argument"
      }
      // Not found errors
      else if (error.message.includes("NOT_FOUND")) {
        statusCode = 404
        errorType = "not_found"
      }
    }

    const errorResponse = {
      error: errorMessage,
      errorType,
      originalError: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      // Add helpful information for network errors
      help:
        errorType === "network"
          ? {
              message: "Network connectivity troubleshooting:",
              steps: [
                "Check if your hosting provider allows outbound connections to Google APIs",
                "Verify that your Google Cloud project has the Analytics Data API enabled",
                "Try accessing the Google Analytics dashboard to confirm your account is active",
                "The error may be temporary - try again in a few minutes",
              ],
            }
          : undefined,
    }

    console.log("[Analytics API] Sending error response:", errorResponse)
    return NextResponse.json(errorResponse, { status: statusCode })
  }
}
