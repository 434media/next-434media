import { type NextRequest, NextResponse } from "next/server"

const VERCEL_API_BASE = "https://vercel.com/api/web/insights"

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-admin-key")

    if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
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

    // Check for required environment variables
    const token = process.env.VERCEL_ANALYTICS_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID

    if (!token || !projectId) {
      return NextResponse.json(
        {
          error: "Vercel Analytics not configured. Missing VERCEL_ANALYTICS_TOKEN or VERCEL_PROJECT_ID",
          missingConfig: {
            token: !token,
            projectId: !projectId,
          },
        },
        { status: 500 },
      )
    }

    // Build the Vercel Analytics API URL
    const params = new URLSearchParams({
      projectId,
      since,
      until,
      limit,
    })

    const apiUrl = `${VERCEL_API_BASE}/${endpoint}?${params}`

    console.log(`Fetching from Vercel Analytics: ${endpoint}`)

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Vercel API error for ${endpoint}:`, response.status, errorText)

      return NextResponse.json(
        {
          error: `Vercel Analytics API error: ${response.status}`,
          details: errorText,
          endpoint,
        },
        { status: response.status },
      )
    }

    const data = await response.json()

    // Return the raw data from Vercel Analytics
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
