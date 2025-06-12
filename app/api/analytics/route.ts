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

export async function GET(request: NextRequest) {
  // Validate configuration
  if (!validateAnalyticsConfig()) {
    return NextResponse.json(
      {
        error: "Google Analytics not configured. Check environment variables.",
        config: getConfigurationStatus(),
      },
      { status: 400 },
    )
  }

  const searchParams = request.nextUrl.searchParams
  const endpoint = searchParams.get("endpoint")
  const startDate = searchParams.get("startDate") || "30daysAgo"
  const endDate = searchParams.get("endDate") || "today"
  const adminKey = request.headers.get("x-admin-key")

  // Validate admin key
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    switch (endpoint) {
      case "test-connection":
        const connectionStatus = await testAnalyticsConnection()
        return NextResponse.json(connectionStatus)

      case "summary":
        const summary = await getAnalyticsSummary(startDate, endDate)
        // Add percentage changes (mock for now, you can implement comparison logic)
        return NextResponse.json({
          ...summary,
          pageViewsChange: 0,
          sessionsChange: 0,
          usersChange: 0,
          bounceRateChange: 0,
          activeUsers: summary.totalUsers, // Use current users as active users approximation
        })

      case "daily-metrics":
        const dailyMetrics = await getDailyMetrics(startDate, endDate)
        return NextResponse.json(dailyMetrics)

      case "pages":
        const pageViews = await getPageViewsData(startDate, endDate)
        return NextResponse.json(pageViews)

      case "referrers":
      case "traffic-sources":
        const trafficSources = await getTrafficSourcesData(startDate, endDate)
        return NextResponse.json(trafficSources)

      case "devices":
        const deviceData = await getDeviceData(startDate, endDate)
        return NextResponse.json(deviceData)

      case "geographic":
        const geoData = await getGeographicData(startDate, endDate)
        return NextResponse.json(geoData)

      case "realtime":
        const realtimeData = await getRealtimeData()
        return NextResponse.json(realtimeData)

      default:
        return NextResponse.json({ error: "Invalid endpoint parameter" }, { status: 400 })
    }
  } catch (error) {
    console.error("[Analytics API] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error occurred",
        endpoint,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
