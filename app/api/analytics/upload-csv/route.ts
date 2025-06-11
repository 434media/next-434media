import { type NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"
import { parse } from "csv-parse/sync"

// Create a connection pool for Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
})

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get("x-admin-key")
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get("file") as File
    const type = (formData.get("type") as string) || "pageviews"

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 })
    }

    // Read file content
    const fileBuffer = await file.arrayBuffer()
    const fileContent = new TextDecoder().decode(fileBuffer)

    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    if (records.length === 0) {
      return NextResponse.json({ success: false, message: "CSV file is empty" }, { status: 400 })
    }

    // Process based on type
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      let insertedCount = 0

      switch (type) {
        case "pageviews":
          // Process page views data
          for (const record of records) {
            const query = `
              INSERT INTO vercel_page_views 
                (date, page_path, page_title, views, unique_visitors, bounce_rate, avg_session_duration)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (date, page_path) DO UPDATE SET
                views = EXCLUDED.views,
                unique_visitors = EXCLUDED.unique_visitors,
                bounce_rate = EXCLUDED.bounce_rate,
                avg_session_duration = EXCLUDED.avg_session_duration,
                updated_at = NOW()
            `

            await client.query(query, [
              record.date,
              record.path || record.page_path,
              record.title || record.page_title || "",
              Number.parseInt(record.views || record.pageviews || 0),
              Number.parseInt(record.visitors || record.unique_visitors || 0),
              Number.parseFloat(record.bounce_rate || 0),
              Number.parseInt(record.avg_session_duration || record.session_duration || 0),
            ])

            insertedCount++
          }
          break

        case "traffic":
          // Process traffic sources data
          for (const record of records) {
            const query = `
              INSERT INTO vercel_traffic_sources 
                (date, source, medium, sessions, users, new_users, bounce_rate)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (date, source, medium) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users,
                new_users = EXCLUDED.new_users,
                bounce_rate = EXCLUDED.bounce_rate
            `

            await client.query(query, [
              record.date,
              record.source,
              record.medium || "referral",
              Number.parseInt(record.sessions || 0),
              Number.parseInt(record.users || 0),
              Number.parseInt(record.new_users || 0),
              Number.parseFloat(record.bounce_rate || 0),
            ])

            insertedCount++
          }
          break

        case "geographic":
          // Process geographic data
          for (const record of records) {
            const query = `
              INSERT INTO vercel_geographic_data 
                (date, country, city, sessions, users, new_users)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (date, country, city) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users,
                new_users = EXCLUDED.new_users
            `

            await client.query(query, [
              record.date,
              record.country,
              record.city || "",
              Number.parseInt(record.sessions || 0),
              Number.parseInt(record.users || 0),
              Number.parseInt(record.new_users || 0),
            ])

            insertedCount++
          }
          break

        case "devices":
          // Process device data
          for (const record of records) {
            const query = `
              INSERT INTO vercel_device_data 
                (date, device_category, browser, os, sessions, users)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (date, device_category, browser, os) DO UPDATE SET
                sessions = EXCLUDED.sessions,
                users = EXCLUDED.users
            `

            await client.query(query, [
              record.date,
              record.device_category || record.device || "unknown",
              record.browser || "",
              record.os || record.operating_system || "",
              Number.parseInt(record.sessions || 0),
              Number.parseInt(record.users || 0),
            ])

            insertedCount++
          }
          break

        default:
          await client.query("ROLLBACK")
          return NextResponse.json({ success: false, message: "Invalid data type" }, { status: 400 })
      }

      // Update daily summary table
      if (type === "pageviews") {
        // Get unique dates from the imported data
        const datesQuery = `
          SELECT DISTINCT date FROM vercel_page_views
          WHERE date NOT IN (SELECT date FROM vercel_daily_summary)
        `
        const datesResult = await client.query(datesQuery)

        // For each date, create a summary record
        for (const dateRow of datesResult.rows) {
          const date = dateRow.date

          // Get aggregated data for this date
          const summaryQuery = `
            SELECT 
              SUM(views) as total_views,
              SUM(unique_visitors) as total_visitors,
              AVG(bounce_rate) as avg_bounce_rate,
              AVG(avg_session_duration) as avg_duration,
              (SELECT page_path FROM vercel_page_views WHERE date = $1 ORDER BY views DESC LIMIT 1) as top_page
            FROM vercel_page_views
            WHERE date = $1
          `

          const summaryResult = await client.query(summaryQuery, [date])
          const summary = summaryResult.rows[0]

          // Insert into daily summary
          const insertSummaryQuery = `
            INSERT INTO vercel_daily_summary
              (date, total_page_views, total_sessions, total_users, unique_visitors, bounce_rate, avg_session_duration, top_page)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (date) DO UPDATE SET
              total_page_views = EXCLUDED.total_page_views,
              unique_visitors = EXCLUDED.unique_visitors,
              bounce_rate = EXCLUDED.bounce_rate,
              avg_session_duration = EXCLUDED.avg_session_duration,
              top_page = EXCLUDED.top_page,
              updated_at = NOW()
          `

          await client.query(insertSummaryQuery, [
            date,
            summary.total_views || 0,
            summary.total_views || 0, // Using page views as proxy for sessions
            summary.total_visitors || 0,
            summary.total_visitors || 0,
            summary.avg_bounce_rate || 0,
            summary.avg_duration || 0,
            summary.top_page || "",
          ])
        }
      }

      await client.query("COMMIT")

      return NextResponse.json({
        success: true,
        message: `Successfully imported ${insertedCount} records of type ${type}`,
        recordCount: insertedCount,
      })
    } catch (error) {
      await client.query("ROLLBACK")
      console.error("CSV import error:", error)

      return NextResponse.json(
        {
          success: false,
          message: "CSV import failed",
          error: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      )
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Server error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
