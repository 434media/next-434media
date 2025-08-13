import { NextResponse } from "next/server"
import { ingestNotionData } from "../../../lib/notion-client"
import { saveKnowledgeBaseToDisk, getKnowledgeBaseStats } from "../../../lib/knowledge-base"
import { saveSyncStatus, loadSyncStatus } from "../../../lib/ai-database"

export async function POST() {
  const startTime = Date.now()

  try {
    console.log("🔄 Starting Notion data ingestion...")

    await saveSyncStatus({
      lastSync: new Date().toISOString(),
      totalPages: 0,
      status: "in-progress",
    })

    const result = await ingestNotionData()

    // Save to persistent storage
    await saveKnowledgeBaseToDisk()

    const duration = Date.now() - startTime

    await saveSyncStatus({
      lastSync: new Date().toISOString(),
      totalPages: result.count,
      status: "success",
    })

    console.log(`✅ Ingestion completed in ${duration}ms`)

    return NextResponse.json({
      message: `Successfully ingested ${result.count} pages from Notion`,
      count: result.count,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Ingestion error:", error)

    await saveSyncStatus({
      lastSync: new Date().toISOString(),
      totalPages: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    })

    return NextResponse.json(
      {
        error: "Failed to ingest Notion data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    console.log("📊 Getting sync status...")

    const syncStatus = await loadSyncStatus()
    const stats = await getKnowledgeBaseStats()

    console.log("Sync status:", syncStatus)
    console.log("Stats:", stats)

    return NextResponse.json({
      syncStatus,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Failed to get sync status:", error)

    return NextResponse.json(
      {
        error: "Failed to get sync status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
