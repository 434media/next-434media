import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
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
        success: true,
        message: "No tables to clear",
        deletedCount: 0,
        tablesCleared: [],
      })
    }

    let totalDeletedCount = 0
    const tablesCleared: string[] = []

    // Clear each table that exists
    if (tables.includes("vercel_traffic_sources")) {
      const result = await sql`DELETE FROM vercel_traffic_sources`
      const deletedRows = Array.isArray(result) ? result.length : 0
      totalDeletedCount += deletedRows
      tablesCleared.push(`vercel_traffic_sources (${deletedRows} rows)`)
    }

    if (tables.includes("vercel_page_views")) {
      const result = await sql`DELETE FROM vercel_page_views`
      const deletedRows = Array.isArray(result) ? result.length : 0
      totalDeletedCount += deletedRows
      tablesCleared.push(`vercel_page_views (${deletedRows} rows)`)
    }

    if (tables.includes("vercel_geographic_data")) {
      const result = await sql`DELETE FROM vercel_geographic_data`
      const deletedRows = Array.isArray(result) ? result.length : 0
      totalDeletedCount += deletedRows
      tablesCleared.push(`vercel_geographic_data (${deletedRows} rows)`)
    }

    if (tables.includes("vercel_device_data")) {
      const result = await sql`DELETE FROM vercel_device_data`
      const deletedRows = Array.isArray(result) ? result.length : 0
      totalDeletedCount += deletedRows
      tablesCleared.push(`vercel_device_data (${deletedRows} rows)`)
    }

    if (tables.includes("vercel_daily_summary")) {
      const result = await sql`DELETE FROM vercel_daily_summary`
      const deletedRows = Array.isArray(result) ? result.length : 0
      totalDeletedCount += deletedRows
      tablesCleared.push(`vercel_daily_summary (${deletedRows} rows)`)
    }

    return NextResponse.json({
      success: true,
      message: "Successfully cleared all analytics data",
      deletedCount: totalDeletedCount,
      tablesCleared,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Clear Data] Error:", error)
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
