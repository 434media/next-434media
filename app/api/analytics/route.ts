import { type NextRequest, NextResponse } from "next/server"
import { rateLimit } from "../../lib/rate-limiter"
import { getClientIP, validateAdminPassword, logSecurityEvent } from "../../lib/security"

// Vercel Analytics API endpoints mapping
const VERCEL_ENDPOINTS = {
  views: "pageviews",
  visitors: "visitors",
  pages: "pages",
  countries: "countries",
  devices: "devices",
  browsers: "browsers",
  os: "operating-systems",
  referrers: "referrers",
}

// Mock data generator for development
function generateMockData(endpoint: string, since: string, until: string, limit: string) {
  const timeRange = Number.parseInt(since.replace("d", ""))
  const limitNum = Number.parseInt(limit)

  switch (endpoint) {
    case "views":
    case "pageviews":
      return {
        data: Array.from({ length: Math.min(timeRange, 30) }, (_, i) => ({
          date: new Date(Date.now() - (timeRange - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          views: Math.floor(Math.random() * 1000) + 500,
        })),
        total: Math.floor(Math.random() * 10000) + 5000,
      }

    case "visitors":
      return {
        total: Math.floor(Math.random() * 5000) + 2500,
        change: Math.floor(Math.random() * 40) - 20,
      }

    case "pages":
      return {
        data: [
          { page: "/", views: Math.floor(Math.random() * 2000) + 1000, change: Math.floor(Math.random() * 40) - 20 },
          { page: "/blog", views: Math.floor(Math.random() * 1500) + 500, change: Math.floor(Math.random() * 40) - 20 },
          {
            page: "/events",
            views: Math.floor(Math.random() * 1000) + 300,
            change: Math.floor(Math.random() * 40) - 20,
          },
          { page: "/sdoh", views: Math.floor(Math.random() * 800) + 200, change: Math.floor(Math.random() * 40) - 20 },
          { page: "/shop", views: Math.floor(Math.random() * 600) + 150, change: Math.floor(Math.random() * 40) - 20 },
        ].slice(0, limitNum),
      }

    case "countries":
      return {
        data: [
          {
            country: "United States",
            code: "🇺🇸",
            views: Math.floor(Math.random() * 3000) + 1500,
            change: Math.floor(Math.random() * 40) - 20,
          },
          {
            country: "Canada",
            code: "🇨🇦",
            views: Math.floor(Math.random() * 1000) + 500,
            change: Math.floor(Math.random() * 40) - 20,
          },
          {
            country: "United Kingdom",
            code: "🇬🇧",
            views: Math.floor(Math.random() * 800) + 400,
            change: Math.floor(Math.random() * 40) - 20,
          },
          {
            country: "Germany",
            code: "🇩🇪",
            views: Math.floor(Math.random() * 600) + 300,
            change: Math.floor(Math.random() * 40) - 20,
          },
          {
            country: "France",
            code: "🇫🇷",
            views: Math.floor(Math.random() * 500) + 250,
            change: Math.floor(Math.random() * 40) - 20,
          },
        ].slice(0, limitNum),
      }

    case "devices":
      return {
        data: {
          desktop: Math.floor(Math.random() * 2000) + 1000,
          mobile: Math.floor(Math.random() * 1800) + 900,
        },
      }

    case "browsers":
      return {
        data: [
          { name: "Chrome", views: Math.floor(Math.random() * 2000) + 1000, percentage: 54.7 },
          { name: "Safari", views: Math.floor(Math.random() * 1000) + 500, percentage: 21.9 },
          { name: "Firefox", views: Math.floor(Math.random() * 600) + 300, percentage: 11.7 },
          { name: "Edge", views: Math.floor(Math.random() * 400) + 200, percentage: 8.2 },
        ],
      }

    case "operating-systems":
    case "os":
      return {
        data: [
          { name: "Windows", views: Math.floor(Math.random() * 2000) + 1000, percentage: 42.3 },
          { name: "macOS", views: Math.floor(Math.random() * 1500) + 800, percentage: 30.5 },
          { name: "iOS", views: Math.floor(Math.random() * 800) + 400, percentage: 14.3 },
          { name: "Android", views: Math.floor(Math.random() * 600) + 300, percentage: 9.2 },
        ],
      }

    case "referrers":
      return {
        data: [
          { referrer: "Direct / None", views: Math.floor(Math.random() * 2000) + 1000, change: 7.2 },
          { referrer: "Google", views: Math.floor(Math.random() * 1500) + 800, change: 12.5 },
          { referrer: "Twitter", views: Math.floor(Math.random() * 800) + 400, change: -3.2 },
          { referrer: "LinkedIn", views: Math.floor(Math.random() * 600) + 300, change: 15.7 },
        ].slice(0, limitNum),
      }

    default:
      return { data: [], total: 0 }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get required environment variables for production
    const vercelToken = process.env.VERCEL_ANALYTICS_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID
    const isProduction = process.env.NODE_ENV === "production"

    // In production, validate environment variables
    if (isProduction && (!vercelToken || !projectId)) {
      console.error("Missing required Vercel Analytics environment variables")
      logSecurityEvent("Missing Vercel Analytics configuration", await getClientIP(), false)
      return NextResponse.json({ error: "Analytics service unavailable" }, { status: 503 })
    }

    const ip = await getClientIP()
    const rateLimitResult = rateLimit(ip, 60, 60000) // Increased to 60 requests per minute

    if (!rateLimitResult.success) {
      logSecurityEvent("Rate limit exceeded for analytics", ip, false)
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again shortly." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        },
      )
    }

    // Check admin authentication
    const adminKey = request.headers.get("x-admin-key")
    if (!adminKey || !validateAdminPassword(adminKey)) {
      logSecurityEvent("Unauthorized analytics access attempt", ip, false)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    logSecurityEvent("Successful analytics access", ip, true)

    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const since = searchParams.get("since") || "7d"
    const until = searchParams.get("until") || "0d"
    const limit = searchParams.get("limit") || "10"

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint parameter required" }, { status: 400 })
    }

    // Production: Use real Vercel Analytics API
    if (isProduction && vercelToken && projectId) {
      // Map our endpoint names to Vercel's endpoint names
      const vercelEndpoint = VERCEL_ENDPOINTS[endpoint as keyof typeof VERCEL_ENDPOINTS] || endpoint

      const baseUrl = `https://vercel.com/api/web/insights/${vercelEndpoint}`
      const params = new URLSearchParams({
        projectId,
        since,
        until,
        limit,
      })

      const response = await fetch(`${baseUrl}?${params}`, {
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 60 }, // Cache for 1 minute
      })

      if (!response.ok) {
        console.error(`Vercel API error: ${response.status} ${response.statusText}`)

        // Fallback to mock data if Vercel API fails
        const mockData = generateMockData(endpoint, since, until, limit)
        return NextResponse.json(mockData, {
          headers: {
            "X-RateLimit-Limit": "60",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            "Cache-Control": "private, max-age=60",
            "X-Data-Source": "fallback-mock-data",
          },
        })
      }

      const data = await response.json()

      return NextResponse.json(data, {
        headers: {
          "X-RateLimit-Limit": "60",
          "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
          "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
          "Cache-Control": "private, max-age=60",
          "X-Data-Source": "vercel-analytics",
        },
      })
    }

    // Development: Use mock data
    const mockData = generateMockData(endpoint, since, until, limit)

    // Add a small delay to simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300))

    return NextResponse.json(mockData, {
      headers: {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
        "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
        "Cache-Control": "private, max-age=60",
        "X-Data-Source": "mock-data",
      },
    })
  } catch (error) {
    console.error("Analytics API error:", error)
    logSecurityEvent("Analytics API error", await getClientIP(), false)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
