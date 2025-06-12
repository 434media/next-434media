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

    // Parse request body
    const body = await request.json()
    const { dataTypes } = body

    if (!dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No data types specified for deletion",
        },
        { status: 400 },
      )
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

    // Map data types to table names
    const dataTypeToTable: Record<string, string> = {
      trafficSources: "vercel_traffic_sources",
      pageViews: "vercel_page_views",
      geographic: "vercel_geographic_data",
      devices: "vercel_device_data",
      dailySummary: "vercel_daily_summary",
    }

    // Delete data from each selected table
    for (const dataType of dataTypes) {
      const tableName = dataTypeToTable[dataType]

      if (tableName && tables.includes(tableName)) {
        // Since we're dealing with a fixed set of known table names from our mapping,
        // we can safely use a switch statement to handle each case specifically
        let result

        switch (tableName) {
          case "vercel_traffic_sources":
            result = await sql`DELETE FROM vercel_traffic_sources`
            break
          case "vercel_page_views":
            result = await sql`DELETE FROM vercel_page_views`
            break
          case "vercel_geographic_data":
            result = await sql`DELETE FROM vercel_geographic_data`
            break
          case "vercel_device_data":
            result = await sql`DELETE FROM vercel_device_data`
            break
          case "vercel_daily_summary":
            result = await sql`DELETE FROM vercel_daily_summary`
            break
          default:
            // Skip unknown tables
            continue
        }

        const deletedRows = Array.isArray(result) ? result.length : 0
        totalDeletedCount += deletedRows
        tablesCleared.push(`${tableName} (${deletedRows} rows)`)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully deleted selected data types",
      deletedCount: totalDeletedCount,
      tablesCleared,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Delete Data Types] Error:", error)
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
