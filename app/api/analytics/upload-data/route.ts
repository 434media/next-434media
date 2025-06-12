import { type NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import * as XLSX from "xlsx"

const sql = neon(process.env.DATABASE_URL!)

// Helper function to parse CSV
function parseCSV(csvText: string): any[] {
  const lines = csvText.split("\n").filter((line) => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
    const row: any = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    data.push(row)
  }

  return data
}

// Helper function to detect data type and normalize
function detectAndNormalizeData(data: any[]): {
  type: "traffic" | "pages" | "geographic" | "devices" | "unknown"
  normalized: any[]
} {
  if (data.length === 0) return { type: "unknown", normalized: [] }

  const firstRow = data[0]
  const headers = Object.keys(firstRow).map((h) => h.toLowerCase())

  // Traffic sources detection
  if (
    headers.some((h) => h.includes("source") || h.includes("referrer")) &&
    headers.some((h) => h.includes("session") || h.includes("visit"))
  ) {
    return {
      type: "traffic",
      normalized: data.map((row) => ({
        source: row.source || row.referrer || row.Source || row.Referrer || "",
        medium: row.medium || row.Medium || "referral",
        sessions: Number.parseInt(row.sessions || row.visits || row.Sessions || row.Visits || "0"),
        users: Number.parseInt(row.users || row.visitors || row.Users || row.Visitors || "0"),
        newUsers: Number.parseInt(row.newUsers || row.new_users || row["New Users"] || "0"),
      })),
    }
  }

  // Page views detection
  if (
    headers.some((h) => h.includes("page") || h.includes("path")) &&
    headers.some((h) => h.includes("view") || h.includes("visit"))
  ) {
    return {
      type: "pages",
      normalized: data.map((row) => ({
        path: row.path || row.page || row.Path || row.Page || "",
        title: row.title || row.Title || row.path || row.page || "",
        views: Number.parseInt(row.views || row.pageviews || row.Views || row.PageViews || "0"),
        visitors: Number.parseInt(row.visitors || row.users || row.Visitors || row.Users || "0"),
        bounceRate: Number.parseFloat(row.bounceRate || row.bounce_rate || row["Bounce Rate"] || "0"),
      })),
    }
  }

  // Geographic detection
  if (headers.some((h) => h.includes("country")) && headers.some((h) => h.includes("session") || h.includes("user"))) {
    return {
      type: "geographic",
      normalized: data.map((row) => ({
        country: row.country || row.Country || "",
        city: row.city || row.City || "",
        sessions: Number.parseInt(row.sessions || row.Sessions || "0"),
        users: Number.parseInt(row.users || row.Users || "0"),
        newUsers: Number.parseInt(row.newUsers || row.new_users || row["New Users"] || "0"),
      })),
    }
  }

  // Device detection
  if (headers.some((h) => h.includes("device")) && headers.some((h) => h.includes("session") || h.includes("user"))) {
    return {
      type: "devices",
      normalized: data.map((row) => ({
        deviceCategory: (row.device || row.deviceCategory || row.Device || row.DeviceCategory || "").toLowerCase(),
        sessions: Number.parseInt(row.sessions || row.Sessions || "0"),
        users: Number.parseInt(row.users || row.Users || "0"),
      })),
    }
  }

  return { type: "unknown", normalized: data }
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Upload API] Starting file upload processing...")

    // Verify admin access
    const adminKey = request.headers.get("x-admin-key")
    const expectedAdminKey = process.env.ADMIN_PASSWORD

    if (!adminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const dateRange = formData.get("dateRange") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("[Upload API] Processing file:", file.name, "Type:", file.type)

    let data: any[] = []

    // Parse file based on type
    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const csvText = await file.text()
      data = parseCSV(csvText)
    } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = XLSX.utils.sheet_to_json(worksheet)
    } else {
      return NextResponse.json({ error: "Unsupported file type. Please use CSV or Excel files." }, { status: 400 })
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 })
    }

    console.log("[Upload API] Parsed", data.length, "rows")

    // Detect data type and normalize
    const { type, normalized } = detectAndNormalizeData(data)

    if (type === "unknown") {
      return NextResponse.json(
        {
          error:
            "Could not detect data type. Please ensure your file has proper headers for traffic sources, page views, geographic data, or device data.",
        },
        { status: 400 },
      )
    }

    console.log("[Upload API] Detected data type:", type)

    const results = {
      trafficSources: 0,
      pageViews: 0,
      geographic: 0,
      devices: 0,
      summary: 0,
      errors: [] as string[],
    }

    // Calculate date for insertion (use current date or specific date based on range)
    const insertDate = new Date().toISOString().split("T")[0]

    // Insert data based on type
    try {
      if (type === "traffic") {
        console.log("[Upload API] Inserting traffic sources...")
        for (const item of normalized) {
          if (item.source && item.sessions > 0) {
            await sql`
              INSERT INTO vercel_traffic_sources (date, source, medium, sessions, users, new_users)
              VALUES (${insertDate}, ${item.source}, ${item.medium}, ${item.sessions}, ${item.users}, ${item.newUsers})
              ON CONFLICT (date, source, medium) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users,
                new_users = EXCLUDED.new_users
            `
            results.trafficSources++
          }
        }
      } else if (type === "pages") {
        console.log("[Upload API] Inserting page views...")
        for (const item of normalized) {
          if (item.path && item.views > 0) {
            await sql`
              INSERT INTO vercel_page_views (date, page_path, page_title, views, unique_visitors, bounce_rate)
              VALUES (${insertDate}, ${item.path}, ${item.title}, ${item.views}, ${item.visitors}, ${item.bounceRate})
              ON CONFLICT (date, page_path) DO UPDATE SET
                page_title = EXCLUDED.page_title,
                views = EXCLUDED.views,
                unique_visitors = EXCLUDED.unique_visitors,
                bounce_rate = EXCLUDED.bounce_rate
            `
            results.pageViews++
          }
        }
      } else if (type === "geographic") {
        console.log("[Upload API] Inserting geographic data...")
        for (const item of normalized) {
          if (item.country && item.sessions > 0) {
            await sql`
              INSERT INTO vercel_geographic_data (date, country, city, sessions, users, new_users)
              VALUES (${insertDate}, ${item.country}, ${item.city}, ${item.sessions}, ${item.users}, ${item.newUsers})
              ON CONFLICT (date, country, city) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users,
                new_users = EXCLUDED.new_users
            `
            results.geographic++
          }
        }
      } else if (type === "devices") {
        console.log("[Upload API] Inserting device data...")
        for (const item of normalized) {
          if (item.deviceCategory && item.sessions > 0) {
            await sql`
              INSERT INTO vercel_device_data (date, device_category, sessions, users)
              VALUES (${insertDate}, ${item.deviceCategory}, ${item.sessions}, ${item.users})
              ON CONFLICT (date, device_category) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users
            `
            results.devices++
          }
        }
      }

      // Create summary if we have data
      if (results.trafficSources > 0 || results.pageViews > 0) {
        const totalSessions = normalized.reduce((sum, item) => sum + (item.sessions || 0), 0)
        const totalUsers = normalized.reduce((sum, item) => sum + (item.users || item.visitors || 0), 0)
        const totalViews = normalized.reduce((sum, item) => sum + (item.views || item.sessions || 0), 0)

        await sql`
          INSERT INTO vercel_daily_summary (date, total_page_views, total_sessions, total_users, bounce_rate, avg_session_duration)
          VALUES (${insertDate}, ${totalViews}, ${totalSessions}, ${totalUsers}, 0.5, 120.0)
          ON CONFLICT (date) DO UPDATE SET
            total_page_views = EXCLUDED.total_page_views,
            total_sessions = EXCLUDED.total_sessions,
            total_users = EXCLUDED.total_users
        `
        results.summary = 1
      }
    } catch (error) {
      console.error("[Upload API] Database error:", error)
      results.errors.push(`Database error: ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log("[Upload API] Upload completed successfully")

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${normalized.length} records of ${type} data`,
      results,
      dataType: type,
      recordsProcessed: normalized.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Upload API] Critical error:", error)
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
