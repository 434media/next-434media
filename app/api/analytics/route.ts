import { type NextRequest, NextResponse } from "next/server"
import { rateLimit } from "../../lib/rate-limiter"
import { getClientIP, validateAdminPassword, logSecurityEvent } from "../../lib/security"

// Correct Vercel Analytics API endpoints
const VERCEL_API_BASE = "https://vercel.com/api/web/insights"

// Map our internal endpoint names to Vercel's actual API endpoints
const ENDPOINT_MAPPING = {
  views: "pageviews",
  visitors: "visitors",
  pages: "pages",
  countries: "countries",
  devices: "devices",
  browsers: "browsers",
  "operating-systems": "operating-systems",
  os: "operating-systems",
  referrers: "referrers",
  "bounce-rate": "bounce-rate",
  duration: "session-duration",
  performance: "web-vitals",
  realtime: "visitors",
}

async function fetchVercelAnalytics(
  endpoint: string,
  projectId: string,
  token: string,
  since: string,
  until: string,
  limit: string,
) {
  const vercelEndpoint = ENDPOINT_MAPPING[endpoint as keyof typeof ENDPOINT_MAPPING] || endpoint

  const url = new URL(`${VERCEL_API_BASE}/${vercelEndpoint}`)
  url.searchParams.set("projectId", projectId)
  url.searchParams.set("since", since)
  url.searchParams.set("until", until)

  if (limit && vercelEndpoint !== "pageviews" && vercelEndpoint !== "visitors") {
    url.searchParams.set("limit", limit)
  }

  console.log(`Fetching from Vercel API: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "434media-analytics-dashboard",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Vercel API Error (${response.status}):`, errorText)
    throw new Error(`Vercel API returned ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log(`Vercel API Response for ${endpoint}:`, data)

  return data
}

// Enhanced development mode mock data generator that matches Vercel Analytics API structure
function generateMockData(endpoint: string, timeRange: string) {
  const now = new Date()
  const days = Number.parseInt(timeRange.replace("d", "")) || 7

  switch (endpoint) {
    case "views":
    case "pageviews":
      // Vercel Analytics pageviews format
      return {
        value: Math.floor(Math.random() * 10000) + 1000,
        change: (Math.random() - 0.5) * 40,
        timeseries: Array.from({ length: days }, (_, i) => ({
          date: new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          value: Math.floor(Math.random() * 500) + 100,
        })),
      }

    case "visitors":
      // Vercel Analytics visitors format
      return {
        value: Math.floor(Math.random() * 5000) + 500,
        change: (Math.random() - 0.5) * 30,
        timeseries: Array.from({ length: days }, (_, i) => ({
          date: new Date(now.getTime() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          value: Math.floor(Math.random() * 200) + 50,
        })),
      }

    case "pages":
      // Vercel Analytics pages format - directly return array format
      return Array.from({ length: 10 }, (_, i) => ({
        page: ["/", "/about", "/contact", "/blog", "/services", "/products", "/pricing", "/support", "/docs", "/api"][
          i
        ],
        visits: Math.floor(Math.random() * 1000) + 50,
      }))

    case "countries":
      // Vercel Analytics countries format
      return Array.from({ length: 10 }, (_, i) => ({
        country: ["US", "CA", "GB", "DE", "FR", "AU", "JP", "BR", "IN", "NL"][i],
        visits: Math.floor(Math.random() * 500) + 50,
      }))

    case "devices":
      // Vercel Analytics devices format
      return [
        { device: "desktop", visits: Math.floor(Math.random() * 1000) + 300 },
        { device: "mobile", visits: Math.floor(Math.random() * 800) + 400 },
        { device: "tablet", visits: Math.floor(Math.random() * 200) + 50 },
      ]

    case "browsers":
      // Vercel Analytics browsers format - this is the key fix!
      return Array.from({ length: 8 }, (_, i) => ({
        browser: ["Chrome", "Safari", "Firefox", "Edge", "Opera", "Samsung Internet", "UC Browser", "Other"][i],
        visits: Math.floor(Math.random() * 500) + 50,
      }))

    case "operating-systems":
      // Vercel Analytics OS format
      return Array.from({ length: 6 }, (_, i) => ({
        os: ["Windows", "macOS", "iOS", "Android", "Linux", "Other"][i],
        visits: Math.floor(Math.random() * 400) + 100,
      }))

    case "referrers":
      // Vercel Analytics referrers format
      return Array.from({ length: 8 }, (_, i) => ({
        referrer: [
          "google.com",
          "direct",
          "twitter.com",
          "linkedin.com",
          "facebook.com",
          "github.com",
          "reddit.com",
          "other",
        ][i],
        visits: Math.floor(Math.random() * 300) + 25,
      }))

    case "bounce-rate":
      // Vercel Analytics bounce rate format
      return {
        value: Math.random() * 30 + 20, // 20-50%
        change: (Math.random() - 0.5) * 10,
      }

    case "session-duration":
      // Vercel Analytics session duration format
      return {
        value: Math.floor(Math.random() * 180) + 60, // 60-240 seconds
        change: (Math.random() - 0.5) * 20,
      }

    case "realtime":
      // Vercel Analytics realtime format
      return {
        value: Math.floor(Math.random() * 50) + 5,
        change: (Math.random() - 0.5) * 100,
      }

    case "performance":
    case "web-vitals":
      // Vercel Analytics web vitals format
      return {
        avg: Math.random() * 2 + 0.5, // 0.5 - 2.5 seconds
        p75: Math.random() * 3 + 0.8, // 0.8 - 3.8 seconds
        p90: Math.random() * 4 + 1.2, // 1.2 - 5.2 seconds
        p99: Math.random() * 6 + 2, // 2 - 8 seconds
        change: (Math.random() - 0.5) * 20, // -10% to +10%
        // Also include the nested format that Vercel might return
        webVitals: {
          lcp: {
            avg: (Math.random() * 2 + 0.5) * 1000, // Convert to ms
            p75: (Math.random() * 3 + 0.8) * 1000,
            p90: (Math.random() * 4 + 1.2) * 1000,
            p99: (Math.random() * 6 + 2) * 1000,
          },
          fid: {
            avg: Math.random() * 100 + 10,
            p75: Math.random() * 150 + 20,
            p90: Math.random() * 200 + 30,
            p99: Math.random() * 300 + 50,
          },
          cls: {
            avg: Math.random() * 0.1,
            p75: Math.random() * 0.15,
            p90: Math.random() * 0.2,
            p99: Math.random() * 0.25,
          },
        },
      }

    default:
      return {
        value: Math.floor(Math.random() * 1000),
        change: (Math.random() - 0.5) * 20,
      }
  }
}

export async function GET(request: NextRequest) {
  try {
    const vercelToken = process.env.VERCEL_ANALYTICS_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID
    const isDevelopment = process.env.NODE_ENV === "development"

    console.log("Environment check:", {
      hasToken: !!vercelToken,
      hasProjectId: !!projectId,
      isDevelopment,
      tokenLength: vercelToken?.length,
      projectId: projectId?.substring(0, 8) + "...",
    })

    // In development, we can use mock data if Vercel Analytics is not configured
    if (isDevelopment && (!vercelToken || !projectId)) {
      console.log("Development mode: Using mock data")

      const { searchParams } = new URL(request.url)
      const endpoint = searchParams.get("endpoint")
      const since = searchParams.get("since") || "7d"

      if (!endpoint) {
        return NextResponse.json({ error: "Endpoint parameter required" }, { status: 400 })
      }

      const mockData = generateMockData(endpoint, since)

      return NextResponse.json(
        {
          ...mockData,
          _mock: true,
          _timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Cache-Control": "private, max-age=60",
            "X-Data-Source": "mock-development",
            "X-Timestamp": new Date().toISOString(),
          },
        },
      )
    }

    if (!vercelToken || !projectId) {
      return NextResponse.json(
        {
          error:
            "Vercel Analytics not configured. Please set VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID environment variables.",
          missingConfig: {
            token: !vercelToken,
            projectId: !projectId,
          },
        },
        { status: 503 },
      )
    }

    const ip = await getClientIP()
    const rateLimitResult = rateLimit(ip, 100, 60000)

    if (!rateLimitResult.success) {
      logSecurityEvent("Rate limit exceeded for analytics", ip, false)
      return NextResponse.json({ error: "Rate limit exceeded. Please try again shortly." }, { status: 429 })
    }

    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || !validateAdminPassword(adminKey)) {
      logSecurityEvent("Unauthorized analytics access attempt", ip, false)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const since = searchParams.get("since") || "7d"
    const until = searchParams.get("until") || "0d"
    const limit = searchParams.get("limit") || "10"

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint parameter required" }, { status: 400 })
    }

    console.log(`Fetching analytics for endpoint: ${endpoint}, since: ${since}, until: ${until}`)

    try {
      const data = await fetchVercelAnalytics(endpoint, projectId, vercelToken, since, until, limit)

      logSecurityEvent("Successful analytics access", ip, true)

      return NextResponse.json(data, {
        headers: {
          "Cache-Control": "private, max-age=300",
          "X-Data-Source": "vercel-analytics-live",
          "X-Timestamp": new Date().toISOString(),
        },
      })
    } catch (apiError) {
      console.error("Vercel Analytics API Error:", apiError)

      // In development, fall back to mock data if API fails
      if (isDevelopment) {
        console.log("API failed in development, falling back to mock data")
        const mockData = generateMockData(endpoint, since)

        return NextResponse.json(
          {
            ...mockData,
            _mock: true,
            _fallback: true,
            _error: apiError instanceof Error ? apiError.message : "Unknown error",
            _timestamp: new Date().toISOString(),
          },
          {
            headers: {
              "Cache-Control": "private, max-age=60",
              "X-Data-Source": "mock-fallback",
              "X-Timestamp": new Date().toISOString(),
            },
          },
        )
      }

      return NextResponse.json(
        {
          error: `Failed to fetch analytics data: ${apiError instanceof Error ? apiError.message : "Unknown error"}`,
          endpoint,
          timestamp: new Date().toISOString(),
        },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error("Analytics API error:", error)
    const errorIp = await getClientIP()
    logSecurityEvent("Analytics API error", errorIp, false)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
