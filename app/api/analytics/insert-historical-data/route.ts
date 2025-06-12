import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Sample data for May 13 - June 12, 2024
const sampleData = {
  trafficSources: [
    { source: "google.com", medium: "referral", sessions: 20, users: 23, newUsers: 10 },
    { source: "linkedin.com", medium: "referral", sessions: 19, users: 21, newUsers: 8 },
    { source: "l.instagram.com", medium: "referral", sessions: 18, users: 19, newUsers: 7 },
    { source: "facebook.com", medium: "referral", sessions: 11, users: 11, newUsers: 5 },
    { source: "com.linkedin.android", medium: "referral", sessions: 6, users: 7, newUsers: 3 },
    { source: "mailchi.mp", medium: "referral", sessions: 3, users: 4, newUsers: 2 },
    { source: "bing.com", medium: "referral", sessions: 2, users: 2, newUsers: 1 },
    { source: "simplifi.lightning.force.com", medium: "referral", sessions: 2, users: 2, newUsers: 1 },
    { source: "com.google.android.gm", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "com.google.android.googlequicksearchbox", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "cvent.lightning.force.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "docs.google.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "gemini.google.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "instagram.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "mail.google.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "myrr.alguiblog.online", medium: "referral", sessions: 1, users: 2, newUsers: 1 },
    { source: "notion.so", medium: "referral", sessions: 1, users: 4, newUsers: 1 },
    { source: "soku.com", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "t.co", medium: "referral", sessions: 1, users: 1, newUsers: 1 },
    { source: "us22.campaign-archive.com", medium: "referral", sessions: 1, users: 2, newUsers: 1 },
    { source: "vercel.com", medium: "referral", sessions: 1, users: 2, newUsers: 1 },
  ],
  pageViews: [
    { path: "/", title: "Home", views: 536, visitors: 356, bounceRate: 0.45 },
    { path: "/en/sdoh", title: "SDOH", views: 122, visitors: 100, bounceRate: 0.38 },
    { path: "/events", title: "Events", views: 179, visitors: 73, bounceRate: 0.42 },
    { path: "/shop", title: "Shop", views: 87, visitors: 57, bounceRate: 0.51 },
    { path: "/admin/blog", title: "Admin Blog", views: 44, visitors: 18, bounceRate: 0.22 },
    { path: "/blog", title: "Blog", views: 53, visitors: 16, bounceRate: 0.35 },
    { path: "/es/sdoh", title: "SDOH (Spanish)", views: 15, visitors: 14, bounceRate: 0.57 },
    { path: "/analytics", title: "Analytics", views: 32, visitors: 13, bounceRate: 0.15 },
    {
      path: "/blog/bam-new-texas-am-facility-supercharges-hypersonic-and-laser-weapon-testing-",
      title: "Blog Post",
      views: 21,
      visitors: 12,
      bounceRate: 0.67,
    },
    {
      path: "/blog/110-laptops-given-to-families-in-need",
      title: "Blog Post",
      views: 12,
      visitors: 4,
      bounceRate: 0.75,
    },
    { path: "/privacy-policy", title: "Privacy Policy", views: 4, visitors: 4, bounceRate: 0.8 },
    { path: "/terms-of-service", title: "Terms of Service", views: 4, visitors: 4, bounceRate: 0.8 },
    { path: "/product/txmx-boxing-founders-tee", title: "Product", views: 3, visitors: 3, bounceRate: 0.67 },
    { path: "/search", title: "Search", views: 5, visitors: 3, bounceRate: 0.33 },
    { path: "/search/txmx-boxing", title: "Search Results", views: 4, visitors: 3, bounceRate: 0.33 },
    {
      path: "/&c=E,1,kV3jYBotaL4KqeRUGoE46XdsJ6NG_jPJUeiJ8AGAx2Rzs1HC-WaBXwnhuSuAjUN8KA6I_7hVfRMVCp_ZzQ7SF3VXEohzPvshB-Cl1W4Sq9RhGD8,&typo=1",
      title: "Unknown",
      views: 2,
      visitors: 2,
      bounceRate: 1.0,
    },
    { path: "/admin/blog/media", title: "Admin Blog Media", views: 7, visitors: 2, bounceRate: 0.0 },
    {
      path: "/product/que-es-sdoh-graphic-t-shirt-for-social-awareness",
      title: "Product",
      views: 3,
      visitors: 2,
      bounceRate: 0.5,
    },
    { path: "/search/vemosvamos", title: "Search Results", views: 3, visitors: 2, bounceRate: 0.5 },
    { path: "/adminblog", title: "Admin Blog", views: 1, visitors: 1, bounceRate: 1.0 },
    {
      path: "/product/vemosvamos-moisture-balance-gel-1-7oz",
      title: "Product",
      views: 2,
      visitors: 1,
      bounceRate: 0.0,
    },
    { path: "/search/devsa", title: "Search Results", views: 1, visitors: 1, bounceRate: 1.0 },
    { path: "/shopify", title: "Shopify", views: 1, visitors: 1, bounceRate: 1.0 },
  ],
  geographic: [
    { country: "US", city: "", sessions: 1034, users: 429, newUsers: 300 },
    { country: "IN", city: "", sessions: 51, users: 20, newUsers: 15 },
    { country: "PH", city: "", sessions: 19, users: 16, newUsers: 10 },
    { country: "CA", city: "", sessions: 14, users: 9, newUsers: 7 },
    { country: "CN", city: "", sessions: 7, users: 5, newUsers: 3 },
    { country: "IE", city: "", sessions: 3, users: 3, newUsers: 2 },
    { country: "GB", city: "", sessions: 3, users: 2, newUsers: 1 },
    { country: "NL", city: "", sessions: 3, users: 2, newUsers: 1 },
    { country: "CH", city: "", sessions: 2, users: 1, newUsers: 1 },
    { country: "IS", city: "", sessions: 1, users: 1, newUsers: 1 },
    { country: "MX", city: "", sessions: 4, users: 1, newUsers: 1 },
  ],
  devices: [
    { deviceCategory: "desktop", sessions: 819, users: 313 },
    { deviceCategory: "mobile", sessions: 322, users: 176 },
  ],
  summary: {
    totalPageViews: 1141,
    totalSessions: 1141,
    totalUsers: 489,
    bounceRate: 0.5,
    avgSessionDuration: 120.0,
  },
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Historical Data API] Starting data insertion...")

    // Verify admin access
    const adminKey = request.headers.get("x-admin-key")
    const expectedAdminKey = process.env.ADMIN_PASSWORD

    if (!adminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const dateRange = body.dateRange || "30days"

    // Calculate date for insertion (use current date or specific date based on range)
    const insertDate = "2024-06-12" // Fixed date for historical data

    const results = {
      trafficSources: 0,
      pageViews: 0,
      geographic: 0,
      devices: 0,
      summary: 0,
      errors: [] as string[],
    }

    // Insert traffic sources data
    try {
      console.log("[Historical Data API] Inserting traffic sources...")
      for (const source of sampleData.trafficSources) {
        await sql`
          INSERT INTO vercel_traffic_sources (date, source, medium, sessions, users, new_users)
          VALUES (${insertDate}, ${source.source}, ${source.medium}, ${source.sessions}, ${source.users}, ${source.newUsers})
          ON CONFLICT (date, source, medium) DO UPDATE SET
            sessions = EXCLUDED.sessions,
            users = EXCLUDED.users,
            new_users = EXCLUDED.new_users
        `
        results.trafficSources++
      }
      console.log(`[Historical Data API] Inserted ${results.trafficSources} traffic sources`)
    } catch (error) {
      const errorMsg = `Traffic sources error: ${error instanceof Error ? error.message : String(error)}`
      console.error("[Historical Data API]", errorMsg)
      results.errors.push(errorMsg)
    }

    // Insert page views data
    try {
      console.log("[Historical Data API] Inserting page views...")
      for (const page of sampleData.pageViews) {
        await sql`
          INSERT INTO vercel_page_views (date, page_path, page_title, views, unique_visitors, bounce_rate)
          VALUES (${insertDate}, ${page.path}, ${page.title}, ${page.views}, ${page.visitors}, ${page.bounceRate})
          ON CONFLICT (date, page_path) DO UPDATE SET
            page_title = EXCLUDED.page_title,
            views = EXCLUDED.views,
            unique_visitors = EXCLUDED.unique_visitors,
            bounce_rate = EXCLUDED.bounce_rate
        `
        results.pageViews++
      }
      console.log(`[Historical Data API] Inserted ${results.pageViews} page views`)
    } catch (error) {
      const errorMsg = `Page views error: ${error instanceof Error ? error.message : String(error)}`
      console.error("[Historical Data API]", errorMsg)
      results.errors.push(errorMsg)
    }

    // Insert geographic data
    try {
      console.log("[Historical Data API] Inserting geographic data...")
      for (const geo of sampleData.geographic) {
        await sql`
          INSERT INTO vercel_geographic_data (date, country, city, sessions, users, new_users)
          VALUES (${insertDate}, ${geo.country}, ${geo.city}, ${geo.sessions}, ${geo.users}, ${geo.newUsers})
          ON CONFLICT (date, country, city) DO UPDATE SET
            sessions = EXCLUDED.sessions,
            users = EXCLUDED.users,
            new_users = EXCLUDED.new_users
        `
        results.geographic++
      }
      console.log(`[Historical Data API] Inserted ${results.geographic} geographic entries`)
    } catch (error) {
      const errorMsg = `Geographic data error: ${error instanceof Error ? error.message : String(error)}`
      console.error("[Historical Data API]", errorMsg)
      results.errors.push(errorMsg)
    }

    // Insert device data
    try {
      console.log("[Historical Data API] Inserting device data...")
      for (const device of sampleData.devices) {
        await sql`
          INSERT INTO vercel_device_data (date, device_category, sessions, users)
          VALUES (${insertDate}, ${device.deviceCategory}, ${device.sessions}, ${device.users})
          ON CONFLICT (date, device_category) DO UPDATE SET
            sessions = EXCLUDED.sessions,
            users = EXCLUDED.users
        `
        results.devices++
      }
      console.log(`[Historical Data API] Inserted ${results.devices} device entries`)
    } catch (error) {
      const errorMsg = `Device data error: ${error instanceof Error ? error.message : String(error)}`
      console.error("[Historical Data API]", errorMsg)
      results.errors.push(errorMsg)
    }

    // Insert summary data
    try {
      console.log("[Historical Data API] Inserting summary data...")
      await sql`
        INSERT INTO vercel_daily_summary (date, total_page_views, total_sessions, total_users, bounce_rate, avg_session_duration)
        VALUES (
          ${insertDate},
          ${sampleData.summary.totalPageViews},
          ${sampleData.summary.totalSessions},
          ${sampleData.summary.totalUsers},
          ${sampleData.summary.bounceRate},
          ${sampleData.summary.avgSessionDuration}
        )
        ON CONFLICT (date) DO UPDATE SET
          total_page_views = EXCLUDED.total_page_views,
          total_sessions = EXCLUDED.total_sessions,
          total_users = EXCLUDED.total_users,
          bounce_rate = EXCLUDED.bounce_rate,
          avg_session_duration = EXCLUDED.avg_session_duration
      `
      results.summary = 1
      console.log("[Historical Data API] Inserted summary data")
    } catch (error) {
      const errorMsg = `Summary data error: ${error instanceof Error ? error.message : String(error)}`
      console.error("[Historical Data API]", errorMsg)
      results.errors.push(errorMsg)
    }

    console.log("[Historical Data API] Data insertion completed")
    console.log("[Historical Data API] Results:", results)

    return NextResponse.json({
      success: results.errors.length === 0,
      message: `Successfully inserted historical data for ${dateRange}`,
      results,
      dateRange,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Historical Data API] Critical error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

// GET endpoint to check if historical data exists
export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-admin-key")
    const expectedAdminKey = process.env.ADMIN_PASSWORD

    if (!adminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Historical Data API] Checking existing data...")

    // Check if data already exists
    const [trafficCount] = await sql`
      SELECT COUNT(*) as count FROM vercel_traffic_sources WHERE date = '2024-06-12'
    `

    const [pageViewsCount] = await sql`
      SELECT COUNT(*) as count FROM vercel_page_views WHERE date = '2024-06-12'
    `

    const [geoCount] = await sql`
      SELECT COUNT(*) as count FROM vercel_geographic_data WHERE date = '2024-06-12'
    `

    const [deviceCount] = await sql`
      SELECT COUNT(*) as count FROM vercel_device_data WHERE date = '2024-06-12'
    `

    const [summaryCount] = await sql`
      SELECT COUNT(*) as count FROM vercel_daily_summary WHERE date = '2024-06-12'
    `

    const existingData = {
      trafficSources: Number(trafficCount.count),
      pageViews: Number(pageViewsCount.count),
      geographic: Number(geoCount.count),
      devices: Number(deviceCount.count),
      summary: Number(summaryCount.count),
    }

    const hasData = Object.values(existingData).some((count) => count > 0)

    return NextResponse.json({
      hasHistoricalData: hasData,
      existingData,
      expectedData: {
        trafficSources: sampleData.trafficSources.length,
        pageViews: sampleData.pageViews.length,
        geographic: sampleData.geographic.length,
        devices: sampleData.devices.length,
        summary: 1,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Historical Data API] Error checking data:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
