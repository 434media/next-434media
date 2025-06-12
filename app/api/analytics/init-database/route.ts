import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import fs from "fs"
import path from "path"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    // Check for admin authorization
    const url = new URL(request.url)
    const adminKey = url.searchParams.get("adminKey")

    if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[DB Init] Starting database initialization...")

    // Read the SQL schema file
    const schemaPath = path.join(process.cwd(), "scripts", "analytics-schema-setup.sql")
    const schemaSQL = fs.readFileSync(schemaPath, "utf8")

    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(";")
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
