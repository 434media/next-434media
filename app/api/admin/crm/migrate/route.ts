import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getRecordsFromTable,
  mapAirtableRecordToTyped,
  getMigrationStatus,
  AIRTABLE_CRM_TABLES,
} from "@/app/lib/airtable-crm"
import { batchWrite } from "@/app/lib/firestore-crm"
import { AIRTABLE_TO_FIRESTORE_MAP } from "@/app/types/crm-types"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 }
  }

  return { session }
}

// GET - Get migration status
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const status = await getMigrationStatus()

    return NextResponse.json({
      success: true,
      tables: status,
      totalTables: AIRTABLE_CRM_TABLES.length,
    })
  } catch (error) {
    console.error("Error getting migration status:", error)
    return NextResponse.json(
      { error: "Failed to get migration status" },
      { status: 500 }
    )
  }
}

// POST - Run migration for specific tables or all tables
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    const { tables, dryRun = false } = body

    // Determine which tables to migrate
    const tablesToMigrate: string[] = tables && tables.length > 0
      ? tables
      : [...AIRTABLE_CRM_TABLES]

    const results: {
      table: string
      collection: string
      recordCount: number
      status: "success" | "error" | "skipped"
      error?: string
    }[] = []

    for (const tableName of tablesToMigrate) {
      try {
        // Get Firestore collection name
        const collectionName = AIRTABLE_TO_FIRESTORE_MAP[tableName]
        if (!collectionName) {
          results.push({
            table: tableName,
            collection: "unknown",
            recordCount: 0,
            status: "skipped",
            error: "No collection mapping found",
          })
          continue
        }

        // Fetch records from Airtable
        console.log("[Migration] Fetching records from table:", tableName)
        const records = await getRecordsFromTable(tableName)

        if (records.length === 0) {
          results.push({
            table: tableName,
            collection: collectionName,
            recordCount: 0,
            status: "success",
          })
          continue
        }

        // Map records to typed format
        const mappedRecords = records.map((record) =>
          mapAirtableRecordToTyped(tableName, record)
        )

        if (dryRun) {
          // Just report what would be migrated
          results.push({
            table: tableName,
            collection: collectionName,
            recordCount: mappedRecords.length,
            status: "success",
          })
          continue
        }

        // Write to Firestore
        console.log("[Migration] Writing", mappedRecords.length, "records to collection:", collectionName)
        const writtenCount = await batchWrite(collectionName, mappedRecords)

        results.push({
          table: tableName,
          collection: collectionName,
          recordCount: writtenCount,
          status: "success",
        })
      } catch (error) {
        console.error("[Migration] Error migrating table:", tableName, error)
        results.push({
          table: tableName,
          collection: AIRTABLE_TO_FIRESTORE_MAP[tableName] || "unknown",
          recordCount: 0,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    const successCount = results.filter((r) => r.status === "success").length
    const errorCount = results.filter((r) => r.status === "error").length
    const totalRecords = results.reduce((sum, r) => sum + r.recordCount, 0)

    return NextResponse.json({
      success: errorCount === 0,
      dryRun,
      summary: {
        tablesProcessed: results.length,
        successCount,
        errorCount,
        totalRecordsMigrated: totalRecords,
      },
      results,
    })
  } catch (error) {
    console.error("Migration error:", error)
    return NextResponse.json(
      { error: "Migration failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
