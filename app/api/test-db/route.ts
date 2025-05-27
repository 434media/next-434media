import { NextResponse } from "next/server"
import { testConnection, initializeDatabase } from "../../lib/db"

export async function GET() {
  try {
    // Test connection
    const isConnected = await testConnection()

    if (!isConnected) {
      return NextResponse.json({ success: false, error: "Database connection failed" }, { status: 500 })
    }

    // Initialize database
    await initializeDatabase()

    return NextResponse.json({
      success: true,
      message: "Neon database connected and initialized successfully",
      database: "Neon PostgreSQL",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Database test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
