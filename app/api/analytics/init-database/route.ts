import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

// Embed the schema directly in the code instead of reading from a file
const ANALYTICS_SCHEMA_SQL = `
-- Create tables for analytics data storage

-- Traffic sources table
CREATE TABLE IF NOT EXISTS vercel_traffic_sources (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  source VARCHAR(255) NOT NULL,
  medium VARCHAR(100) NOT NULL DEFAULT 'referral',
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, source, medium)
);

-- Page views table
CREATE TABLE IF NOT EXISTS vercel_page_views (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(500),
  views INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, page_path)
);

-- Geographic data table
CREATE TABLE IF NOT EXISTS vercel_geographic_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  country VARCHAR(100) NOT NULL,
  city VARCHAR(100) DEFAULT '',
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  new_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, country, city)
);

-- Device data table
CREATE TABLE IF NOT EXISTS vercel_device_data (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  device_category VARCHAR(50) NOT NULL,
  sessions INTEGER NOT NULL DEFAULT 0,
  users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, device_category)
);

-- Daily summary table
CREATE TABLE IF NOT EXISTS vercel_daily_summary (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_page_views INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  avg_session_duration FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_traffic_sources_date ON vercel_traffic_sources(date);
CREATE INDEX IF NOT EXISTS idx_page_views_date ON vercel_page_views(date);
CREATE INDEX IF NOT EXISTS idx_geographic_data_date ON vercel_geographic_data(date);
CREATE INDEX IF NOT EXISTS idx_device_data_date ON vercel_device_data(date);
`

export async function GET(request: Request) {
  try {
    // Check for admin authorization
    const url = new URL(request.url)
    const adminKey = url.searchParams.get("adminKey")

    if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[DB Init] Starting database initialization...")

    // Split the SQL into individual statements
    const statements = ANALYTICS_SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    // Execute each statement
    const results = []
    for (const statement of statements) {
      try {
        console.log("[DB Init] Executing:", statement.substring(0, 50) + "...")
        await sql.query(statement)
        results.push({ success: true, statement: statement.substring(0, 50) + "..." })
      } catch (error) {
        console.error("[DB Init] Error executing statement:", error)
        results.push({
          success: false,
          statement: statement.substring(0, 50) + "...",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // Check if tables were created
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'vercel_%'
    `

    const tables = tablesResult.map((row) => row.table_name)

    return NextResponse.json({
      success: true,
      message: "Database initialization completed",
      tables,
      results,
    })
  } catch (error) {
    console.error("[DB Init] Critical error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
