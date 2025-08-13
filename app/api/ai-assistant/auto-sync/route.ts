import { NextResponse } from "next/server"
import { autoSyncOnStartup } from "../../../lib/knowledge-base"

// Endpoint for triggering auto-sync (useful for deployment hooks)
export async function POST() {
  try {
    console.log("🚀 Manual auto-sync triggered")
    await autoSyncOnStartup()

    return NextResponse.json({
      message: "Auto-sync completed successfully",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Auto-sync failed:", error)

    return NextResponse.json(
      {
        error: "Auto-sync failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
