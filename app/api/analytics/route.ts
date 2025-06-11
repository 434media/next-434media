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
  getHybridTopReferrers, // Import the new function
} from "../../lib/hybrid-analytics"
import { getRealtimeData, testAnalyticsConnection } from "../../lib/google-analytics"

// Enhanced logging for hybrid analytics
function logAccess(message: string, success: boolean, metadata?: any) {
  const timestamp = new Date().toISOString()
  const context = {
    authMethod: getAuthenticationMethod(),
    isVercel: !!process.env.VERCEL,
    environment: process.env.NODE_ENV,
    hybrid: true,
    ...metadata,
  }
  console.log(`[Hybrid Analytics] ${timestamp} - ${message} - ${success ? "✓" : "✗"}`, context)
}

// Enhanced mock data generator for development
function generateMockData(endpoint: string, timeRange: string) {
  const now = new Date()
  const days = Number.parseInt(timeRange.replace("d", "")) || 7

  switch (endpoint) {
    case "pageviews":
      return {
        data: Array.from({ length: days }, (_, i) => ({
          date: new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          pageViews: Math.floor(Math.random() * 500) + 100,
          sessions: Math.floor(Math.random() * 300) + 80,
          users: Math.floor(Math.random() * 200) + 50,
        })),
        totalPageViews: Math.floor(Math.random() * 10000) + 5000,
        totalSessions: Math.floor(Math.random() * 8000) + 4000,
        totalUsers: Math.floor(Math.random() * 6000) + 3000,
      }

    case "toppages":
      return {
        data: Array.from({ length: 10 }, (_, i) => ({
          path: ["/", "/about", "/contact", "/blog", "/services", "/products", "/pricing", "/support", "/docs", "/api"][
            i
          ],
          title: ["Home", "About", "Contact", "Blog", "Services", "Products", "Pricing", "Support", "Docs", "API"][i],
          pageViews: Math.floor(Math.random() * 1000) + 50,
          sessions: Math.floor(Math.random() * 800) + 40,
          bounceRate: Math.random() * 0.8 + 0.1,
        })),
      }

    case "trafficsources":
      return {
        data: Array.from({ length: 8 }, (_, i) => ({
          source: [
            "google",
            "direct",
            "twitter.com",
            "linkedin.com",
            "facebook.com",
            "github.com",
            "reddit.com",
            "other",
          ][i],
          medium: ["organic", "none", "social", "social", "social", "referral", "referral", "referral"][i],
          sessions: Math.floor(Math.random() * 500) + 50,
          users: Math.floor(Math.random() * 400) + 40,
          newUsers: Math.floor(Math.random() * 300) + 30,
        })),
      }

    case "devices":
      return {
        data: [
          {
            deviceCategory: "desktop",
            sessions: Math.floor(Math.random() * 1000) + 300,
            users: Math.floor(Math.random() * 800) + 250,
          },
          {
            deviceCategory: "mobile",
            sessions: Math.floor(Math.random() * 800) + 400,
            users: Math.floor(Math.random() * 600) + 350,
          },
          {
            deviceCategory: "tablet",
            sessions: Math.floor(Math.random() * 200) + 50,
            users: Math.floor(Math.random() * 150) + 40,
          },
        ],
      }

    case "geographic":
      return {
        data: Array.from({ length: 15 }, (_, i) => ({
          country: [
            "United States",
            "Canada",
            "United Kingdom",
            "Germany",
            "France",
            "Australia",
            "Japan",
            "Brazil",
            "India",
            "Netherlands",
            "Spain",
            "Italy",
            "Mexico",
            "Sweden",
            "Norway",
          ][i],
          city: [
            "New York",
            "Toronto",
            "London",
            "Berlin",
            "Paris",
            "Sydney",
            "Tokyo",
            "São Paulo",
            "Mumbai",
            "Amsterdam",
            "Madrid",
            "Rome",
            "Mexico City",
            "Stockholm",
            "Oslo",
          ][i],
          sessions: Math.floor(Math.random() * 500) + 50,
          users: Math.floor(Math.random() * 400) + 40,
          newUsers: Math.floor(Math.random() * 300) + 30,
        })),
      }

    case "realtime":
      return {
        totalActiveUsers: Math.floor(Math.random() * 50) + 5,
        topCountries: Array.from({ length: 5 }, (_, i) => ({
          country: ["United States", "Canada", "United Kingdom", "Germany", "France"][i],
          activeUsers: Math.floor(Math.random() * 10) + 1,
        })),
      }

    case "summary":
      return {
        totalPageViews: Math.floor(Math.random() * 10000) + 5000,
        totalSessions: Math.floor(Math.random() * 8000) + 4000,
        totalUsers: Math.floor(Math.random() * 6000) + 3000,
        bounceRate: Math.random() * 0.4 + 0.3,
        averageSessionDuration: Math.floor(Math.random() * 180) + 60,
      }

    case "referrers":
      return {
        data: Array.from({ length: 10 }, (_, i) => ({
          referrer: ["https://example.com", "https://anotherexample.com", "https://yetanotherexample.com"][i % 3],
          sessions: Math.floor(Math.random() * 200) + 50,
          users: Math.floor(Math.random() * 150) + 40,
        })),
      }

    default:
      return { data: [], error: "Unknown endpoint" }
  }
}

export async function GET(request: NextRequest) {
  try {
    const isDevelopment = process.env.NODE_ENV === "development"
    const configStatus = getConfigurationStatus()
    const authMethod = getAuthenticationMethod()

    // Simple admin authentication
    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || adminKey !== analyticsConfig.adminPassword) {
      logAccess("Unauthorized access attempt", false, { configStatus, authMethod })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const startDate = searchParams.get("startDate") || "30daysAgo"
    const endDate = searchParams.get("endDate") || "today"

    // Special endpoints
    if (endpoint === "config") {
      const connectionTest = await testAnalyticsConnection()
      const dataSourceInfo = await getDataSourceInfo()
      return NextResponse.json({
        ...configStatus,
        connectionTest,
        authMethod,
        dataSourceInfo,
        timestamp: new Date().toISOString(),
      })
    }

    if (endpoint === "data-sources") {
      const dataSourceInfo = await getDataSourceInfo()
      return NextResponse.json(dataSourceInfo)
    }

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint parameter required" }, { status: 400 })
    }

    let data: any

    // Use mock data in development or if not configured
    if (isDevelopment && !configStatus.configured) {
      data = generateMockData(endpoint, "30d")
      data._mock = true
      data._timestamp = new Date().toISOString()
      data._configStatus = configStatus
      data._authMethod = authMethod
      logAccess(`Mock data served for ${endpoint}`, true, { reason: "development_not_configured" })
    } else {
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
            break
          case "summary":
            data = await getHybridAnalyticsSummary(startDate, endDate)
            break
          case "referrers":
            // Use the specialized referrers endpoint
            data = await getHybridTopReferrers(startDate, endDate, 10)
            break
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`)
        }

        data._timestamp = new Date().toISOString()
        data._authMethod = authMethod
        logAccess(`Hybrid data served for ${endpoint}`, true, {
          authMethod,
          hybrid: data._hybrid,
          historicalDays: data._historicalDays,
          ga4Days: data._ga4Days,
        })
      } catch (apiError) {
        console.error("Hybrid Analytics API Error:", apiError)

        // Fallback to mock data if API fails
        data = generateMockData(endpoint, "30d")
        data._mock = true
        data._fallback = true
        data._error = apiError instanceof Error ? apiError.message : "Unknown error"
        data._timestamp = new Date().toISOString()
        data._configStatus = configStatus
        data._authMethod = authMethod
        logAccess(`Fallback mock data served for ${endpoint}`, true, {
          reason: "api_error",
          error: apiError instanceof Error ? apiError.message : "Unknown error",
          authMethod,
        })
      }
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=300", // 5 minute cache
        "X-Data-Source": data._mock ? "mock" : "hybrid-analytics",
        "X-Auth-Method": authMethod,
        "X-Timestamp": new Date().toISOString(),
        "X-Hybrid": data._hybrid ? "true" : "false",
      },
    })
  } catch (error) {
    console.error("Hybrid Analytics API error:", error)
    logAccess(`API error: ${error instanceof Error ? error.message : "Unknown error"}`, false)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
