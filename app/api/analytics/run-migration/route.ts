import { type NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

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

    // Get migration type from query params (default to 'vercel-analytics')
    const searchParams = request.nextUrl.searchParams
    const migrationType = searchParams.get("type") || "vercel-analytics"

    // Get SQL content based on migration type
    let sqlContent = ""

    switch (migrationType) {
      case "vercel-analytics":
        sqlContent = `
-- Create tables for storing Vercel analytics CSV data
-- This will serve as historical data until GA4 builds up 90 days

-- Page views table (from Vercel analytics CSV)
CREATE TABLE IF NOT EXISTS vercel_page_views (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(500),
  views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0, -- in seconds
  source VARCHAR(100) DEFAULT 'vercel_csv',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Traffic sources table
CREATE TABLE IF NOT EXISTS vercel_traffic_sources (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  source VARCHAR(200) NOT NULL,
  medium VARCHAR(100) DEFAULT 'referral',
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geographic data table
CREATE TABLE IF NOT EXISTS vercel_geographic_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(100) NOT NULL,
  city VARCHAR(100),
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Device data table
CREATE TABLE IF NOT EXISTS vercel_device_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  device_category VARCHAR(50) NOT NULL, -- desktop, mobile, tablet
  browser VARCHAR(100),
  os VARCHAR(100),
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily summary table (aggregated data)
CREATE TABLE IF NOT EXISTS vercel_daily_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_page_views INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  bounce_rate DECIMAL(5,4) DEFAULT 0,
  avg_session_duration INTEGER DEFAULT 0, -- in seconds
  top_page VARCHAR(500),
  top_referrer VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vercel_page_views_date ON vercel_page_views(date);
CREATE INDEX IF NOT EXISTS idx_vercel_page_views_path ON vercel_page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_vercel_traffic_sources_date ON vercel_traffic_sources(date);
CREATE INDEX IF NOT EXISTS idx_vercel_geographic_data_date ON vercel_geographic_data(date);
CREATE INDEX IF NOT EXISTS idx_vercel_device_data_date ON vercel_device_data(date);
CREATE INDEX IF NOT EXISTS idx_vercel_daily_summary_date ON vercel_daily_summary(date);

-- Create a view for easy querying of combined data
CREATE OR REPLACE VIEW analytics_overview AS
SELECT 
  ds.date,
  ds.total_page_views,
  ds.total_sessions,
  ds.total_users,
  ds.bounce_rate,
  ds.avg_session_duration,
  ds.top_page,
  ds.top_referrer,
  COUNT(DISTINCT pv.page_path) as unique_pages,
  COUNT(DISTINCT ts.source) as traffic_sources_count,
  COUNT(DISTINCT gd.country) as countries_count
FROM vercel_daily_summary ds
LEFT JOIN vercel_page_views pv ON ds.date = pv.date
LEFT JOIN vercel_traffic_sources ts ON ds.date = ts.date
LEFT JOIN vercel_geographic_data gd ON ds.date = gd.date
GROUP BY ds.date, ds.total_page_views, ds.total_sessions, ds.total_users, 
         ds.bounce_rate, ds.avg_session_duration, ds.top_page, ds.top_referrer
ORDER BY ds.date DESC;
        `
        break
      case "blog-images":
        sqlContent = `
-- Create tables for blog images
CREATE TABLE IF NOT EXISTS blog_images (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt_text VARCHAR(255),
  width INTEGER,
  height INTEGER,
  size_in_bytes INTEGER,
  mime_type VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_images_filename ON blog_images(filename);
        `
        break
      default:
        return NextResponse.json({ success: false, message: "Invalid migration type" }, { status: 400 })
    }

    // Execute the SQL migration
    const client = await pool.connect()
    try {
      // Start transaction
      await client.query("BEGIN")

      // Execute the SQL script
      await client.query(sqlContent)

      // Commit transaction
      await client.query("COMMIT")

      return NextResponse.json({
        success: true,
        message: `Successfully ran ${migrationType} migration`,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      // Rollback on error
      await client.query("ROLLBACK")
      console.error("Migration error:", error)

      return NextResponse.json(
        {
          success: false,
          message: "Migration failed",
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

// Add a GET endpoint to check migration status
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get("x-admin-key")
    if (authHeader !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const client = await pool.connect()
    try {
      // Check if tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
          'vercel_page_views', 
          'vercel_traffic_sources', 
          'vercel_geographic_data', 
          'vercel_device_data', 
          'vercel_daily_summary',
          'blog_images'
        )
      `
      const tablesResult = await client.query(tablesQuery)

      // Get table counts
      const countQueries = tablesResult.rows.map((row) => {
        return client.query(`SELECT COUNT(*) FROM ${row.table_name}`)
      })

      const countResults = await Promise.all(countQueries)

      // Build status object
      const status = {
        tables: tablesResult.rows.map((row, index) => ({
          name: row.table_name,
          exists: true,
          rowCount: Number.parseInt(countResults[index]?.rows[0]?.count || "0"),
        })),
        missingTables: [
          "vercel_page_views",
          "vercel_traffic_sources",
          "vercel_geographic_data",
          "vercel_device_data",
          "vercel_daily_summary",
          "blog_images",
        ].filter((tableName) => !tablesResult.rows.some((row) => row.table_name === tableName)),
      }

      return NextResponse.json({
        success: true,
        status,
        timestamp: new Date().toISOString(),
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Status check failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
