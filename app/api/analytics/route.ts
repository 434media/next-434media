import { type NextRequest, NextResponse } from "next/server"
import { analyticsConfig, getConfigurationStatus, getAuthenticationMethod } from "../../lib/analytics-config"
import {
  getPageViewsData,
  getTopPagesData,
  getTrafficSourcesData,
  getDeviceData,
  getGeographicData,
  getRealtimeData,
  getSummaryData,
  testAnalyticsConnection,
} from "../../lib/google-analytics"

// Enhanced logging for Vercel OIDC Workload Identity Federation
function logAccess(message: string, success: boolean, metadata?: any) {
  const timestamp = new Date().toISOString()
  const context = {
    authMethod: getAuthenticationMethod(),
    isVercel: !!process.env.VERCEL,
    environment: process.env.NODE_ENV,
    hasOIDCConfig: !!(
      analyticsConfig.gcpWorkloadIdentityPoolId &&
      analyticsConfig.gcpWorkloadIdentityPoolProviderId &&
      analyticsConfig.gcpServiceAccountEmail
    ),
    ...metadata,
  }
  console.log(`[Analytics Vercel OIDC] ${timestamp} - ${message} - ${success ? "✓" : "✗"}`, context)
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

    // Special endpoint for configuration status
    if (endpoint === "config") {
      const connectionTest = await testAnalyticsConnection()
      return NextResponse.json({
        ...configStatus,
        connectionTest,
        authMethod,
        vercelOIDCVariables: {
          GCP_WORKLOAD_IDENTITY_POOL_ID: analyticsConfig.gcpWorkloadIdentityPoolId,
          GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: analyticsConfig.gcpWorkloadIdentityPoolProviderId,
          GCP_SERVICE_ACCOUNT_EMAIL: analyticsConfig.gcpServiceAccountEmail,
          GCP_PROJECT_NUMBER: analyticsConfig.gcpProjectNumber,
          GCP_PROJECT_ID: analyticsConfig.gcpProjectId,
        },
        timestamp: new Date().toISOString(),
      })
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
        const dateRange = { startDate, endDate }

        switch (endpoint) {
          case "pageviews":
            data = await getPageViewsData(dateRange)
            break
          case "toppages":
            data = await getTopPagesData(dateRange)
            break
          case "trafficsources":
            data = await getTrafficSourcesData(dateRange)
            break
          case "devices":
            data = await getDeviceData(dateRange)
            break
          case "geographic":
            data = await getGeographicData(dateRange)
            break
          case "realtime":
            data = await getRealtimeData()
            break
          case "summary":
            data = await getSummaryData(dateRange)
            break
          default:
            throw new Error(`Unknown endpoint: ${endpoint}`)
        }

        data._timestamp = new Date().toISOString()
        data._authMethod = authMethod
        data._vercelOIDC = authMethod === "vercel-oidc"
        logAccess(`Real data served for ${endpoint}`, true, { authMethod })
      } catch (apiError) {
        console.error("Google Analytics API Error:", apiError)

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
        "X-Data-Source": data._mock ? "mock" : "google-analytics-vercel-oidc",
        "X-Auth-Method": authMethod,
        "X-Timestamp": new Date().toISOString(),
        "X-Vercel-OIDC": data._vercelOIDC ? "true" : "false",
      },
    })
  } catch (error) {
    console.error("Analytics API error:", error)
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
