import { type NextRequest, NextResponse } from "next/server"
import { analyticsConfig, getConfigurationStatus, getAuthenticationMethod } from "../../lib/analytics-config"
import {
  getHybridDailyMetrics,
  getHybridTopPages,
  getHybridTopTrafficSources,
  getHybridDeviceData,
  getHybridGeographicData,
  getHybridAnalyticsSummary,
  getDataSourceInfo,
  getHybridTopReferrers,
} from "../../lib/hybrid-analytics"
import { getRealtimeData, testAnalyticsConnection } from "../../lib/google-analytics"

// Enhanced logging for analytics
function logAccess(message: string, success: boolean, metadata?: any) {
  const timestamp = new Date().toISOString()
  const context = {
    authMethod: getAuthenticationMethod(),
    isVercel: !!process.env.VERCEL,
    environment: process.env.NODE_ENV,
    ...metadata,
  }
  console.log(`[Analytics] ${timestamp} - ${message} - ${success ? "✓" : "✗"}`, context)
}

export async function GET(request: NextRequest) {
  try {
    const configStatus = getConfigurationStatus()
    const authMethod = getAuthenticationMethod()

    // Admin authentication
    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || adminKey !== analyticsConfig.adminPassword) {
      logAccess("Unauthorized access attempt", false, { configStatus, authMethod })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const startDate = searchParams.get("startDate") || "30daysAgo"
    const endDate = searchParams.get("endDate") || "today"

    // Configuration endpoint
    if (endpoint === "config") {
      const connectionTest = await testAnalyticsConnection()
      const dataSourceInfo = await getDataSourceInfo()

      return NextResponse.json({
        ...configStatus,
        connectionTest,
        authMethod,
        dataSourceInfo,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        isVercel: !!process.env.VERCEL,
        ga4PropertyId: analyticsConfig.ga4PropertyId,
      })
    }

    // Data sources endpoint
    if (endpoint === "data-sources") {
      const dataSourceInfo = await getDataSourceInfo()
      return NextResponse.json(dataSourceInfo)
    }

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint parameter required" }, { status: 400 })
    }

    // Check if analytics is properly configured
    if (!configStatus.configured) {
      return NextResponse.json(
        {
          error: "Analytics not configured",
          details: "Google Analytics OIDC configuration is incomplete",
          missingVariables: configStatus.missingVariables,
          recommendations: configStatus.recommendations,
        },
        { status: 503 },
      )
    }

    let data: any

    try {
      switch (endpoint) {
        case "pageviews":
          data = await getHybridDailyMetrics(startDate, endDate)
          break
        case "toppages":
          data = await getHybridTopPages(startDate, endDate)
          break
        case "trafficsources":
          data = await getHybridTopTrafficSources(startDate, endDate)
          break
        case "devices":
          data = await getHybridDeviceData(startDate, endDate)
          break
        case "geographic":
          data = await getHybridGeographicData(startDate, endDate)
          break
        case "realtime":
          // Realtime data only comes from GA4
          data = await getRealtimeData()
          data._source = "google-analytics"
          break
        case "summary":
          data = await getHybridAnalyticsSummary(startDate, endDate)
          break
        case "referrers":
          data = await getHybridTopReferrers(startDate, endDate, 10)
          break
        default:
          return NextResponse.json({ error: `Unknown endpoint: ${endpoint}` }, { status: 400 })
      }

      data._timestamp = new Date().toISOString()
      data._authMethod = authMethod

      logAccess(`Data served for ${endpoint}`, true, {
        authMethod,
        hybrid: data._hybrid,
        strategy: data._strategy,
        historicalDays: data._historicalDays,
        ga4Days: data._ga4Days,
      })
    } catch (apiError) {
      console.error("Analytics API Error:", apiError)

      const errorDetails = {
        message: apiError instanceof Error ? apiError.message : "Unknown error",
        endpoint,
        dateRange: { startDate, endDate },
        authMethod,
        configStatus: configStatus.configured,
        timestamp: new Date().toISOString(),
      }

      logAccess(`API error for ${endpoint}`, false, errorDetails)

      return NextResponse.json(
        {
          error: "Failed to fetch analytics data",
          details: errorDetails.message,
          endpoint,
          dateRange: { startDate, endDate },
          timestamp: errorDetails.timestamp,
        },
        { status: 500 },
      )
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=300", // 5 minute cache
        "X-Data-Source": data._hybrid ? "hybrid-analytics" : "google-analytics",
        "X-Auth-Method": authMethod,
        "X-Timestamp": new Date().toISOString(),
        "X-Strategy": data._strategy || "unknown",
      },
    })
  } catch (error) {
    console.error("Analytics API error:", error)
    logAccess(`Unexpected API error: ${error instanceof Error ? error.message : "Unknown error"}`, false)

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
