import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    // Check for admin authorization
    const adminKey = request.headers.get("x-admin-key")

    if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if tables exist first
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'vercel_%'
    `

    const tables = tablesResult.map((row) => row.table_name)

    // If tables don't exist, return empty counts
    if (tables.length === 0) {
      return NextResponse.json({
        trafficSources: 0,
        pageViews: 0,
        geographic: 0,
        devices: 0,
        dailySummary: 0,
      })
    }

    // Get counts from each table
    const counts = {
      trafficSources: 0,
      pageViews: 0,
      geographic: 0,
      devices: 0,
      dailySummary: 0,
    }

    // Only query tables that exist
    if (tables.includes("vercel_traffic_sources")) {
      const trafficResult = await sql`SELECT COUNT(*) as count FROM vercel_traffic_sources`
      counts.trafficSources = Number(trafficResult[0]?.count || 0)
    }

    if (tables.includes("vercel_page_views")) {
      const pageViewsResult = await sql`SELECT COUNT(*) as count FROM vercel_page_views`
      counts.pageViews = Number(pageViewsResult[0]?.count || 0)
    }

    if (tables.includes("vercel_geographic_data")) {
      const geoResult = await sql`SELECT COUNT(*) as count FROM vercel_geographic_data`
      counts.geographic = Number(geoResult[0]?.count || 0)
    }

    if (tables.includes("vercel_device_data")) {
      const deviceResult = await sql`SELECT COUNT(*) as count FROM vercel_device_data`
      counts.devices = Number(deviceResult[0]?.count || 0)
    }

    if (tables.includes("vercel_daily_summary")) {
      const summaryResult = await sql`SELECT COUNT(*) as count FROM vercel_daily_summary`
      counts.dailySummary = Number(summaryResult[0]?.count || 0)
    }

    return NextResponse.json(counts)
  } catch (error) {
    console.error("[Data Status] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
