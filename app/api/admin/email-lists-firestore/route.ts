import { NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { getEmailSignups as getAirtableSignups } from "@/app/lib/airtable-contacts"
import { getMxrRsvpEmails } from "@/app/lib/airtable-mxr"
import { getTxmxRsvpEmails } from "@/app/lib/airtable-txmx-iconic"
import { 
  migrateFromAirtable,
  migrateFromMxrRsvp,
  migrateFromTxmxRsvp,
  getEmailSignups, 
  getEmailSources, 
  getEmailCountsBySource,
  emailSignupsToCSV,
  deleteEmailSignup,
} from "@/app/lib/firestore-email-signups"

// Check admin access
async function requireAdmin() {
  const session = await getSession()
  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }
  if (!isWorkspaceEmail(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }
  return { session }
}

export async function GET(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const source = searchParams.get("source")
    const format = searchParams.get("format")
    const dataSource = searchParams.get("dataSource") || "firestore" // "firestore" or "airtable"

    // Get counts by source
    if (action === "counts") {
      const counts = await getEmailCountsBySource()
      return NextResponse.json({ success: true, counts })
    }

    // Get available sources
    if (action === "sources") {
      const sources = await getEmailSources()
      return NextResponse.json({ success: true, sources })
    }

    // Get emails (with optional source filter)
    const filters = source ? { source } : undefined
    const signups = await getEmailSignups(filters)

    // Return as CSV download
    if (format === "csv") {
      const csv = emailSignupsToCSV(signups)
      const filename = source
        ? `email-signups-${source.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
        : `email-signups-all-${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      signups,
      total: signups.length,
      dataSource: "firestore",
    })
  } catch (error) {
    console.error("Error in email-lists API:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch email signups" },
      { status: 500 }
    )
  }
}

// POST - Trigger migration from Airtable to Firestore
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    
    // Standard Airtable migration (Email Sign Up table)
    if (body.action === "migrate") {
      // Fetch all emails from Airtable
      console.log("[Migration] Fetching emails from Airtable...")
      const airtableSignups = await getAirtableSignups()
      
      // Migrate to Firestore
      const results = await migrateFromAirtable(airtableSignups)
      
      return NextResponse.json({
        success: true,
        message: "Migration complete",
        results,
      })
    }

    // MXR RSVP migration (DigitalCanvas emails from "Join The Feed")
    if (body.action === "migrate-mxr") {
      console.log("[MXR Migration] Fetching emails from MXR RSVP table...")
      
      try {
        // Fetch emails from MXR RSVP table where "Join The Feed" = Yes
        const mxrEmails = await getMxrRsvpEmails()
        
        console.log(`[MXR Migration] Found ${mxrEmails.length} emails with "Join The Feed" = Yes`)
        
        if (mxrEmails.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No emails to migrate - no RSVP records with 'Join The Feed' = Yes found",
            results: { total: 0, migrated: 0, skipped: 0, errors: 0 },
          })
        }
        
        // Migrate to Firestore with source "DigitalCanvas"
        const results = await migrateFromMxrRsvp(
          mxrEmails.map(e => ({ email: e.email, createdAt: e.createdAt }))
        )
        
        return NextResponse.json({
          success: true,
          message: `MXR RSVP migration complete - ${results.migrated} emails added to DigitalCanvas`,
          results,
        })
      } catch (mxrError) {
        console.error("[MXR Migration] Error:", mxrError)
        return NextResponse.json(
          { 
            success: false, 
            error: `MXR migration failed: ${mxrError instanceof Error ? mxrError.message : "Unknown error"}` 
          },
          { status: 500 }
        )
      }
    }

    // Migrate both sources
    if (body.action === "migrate-all") {
      const allResults = {
        airtable: { total: 0, migrated: 0, skipped: 0, errors: 0 },
        mxr: { total: 0, migrated: 0, skipped: 0, errors: 0 },
      }

      // 1. Standard Airtable migration
      try {
        console.log("[Migration All] Starting Airtable migration...")
        const airtableSignups = await getAirtableSignups()
        allResults.airtable = await migrateFromAirtable(airtableSignups)
      } catch (airtableError) {
        console.error("[Migration All] Airtable migration error:", airtableError)
        allResults.airtable.errors = -1 // Indicate failure
      }

      // 2. MXR RSVP migration
      try {
        console.log("[Migration All] Starting MXR RSVP migration...")
        const mxrEmails = await getMxrRsvpEmails()
        if (mxrEmails.length > 0) {
          allResults.mxr = await migrateFromMxrRsvp(
            mxrEmails.map(e => ({ email: e.email, createdAt: e.createdAt }))
          )
        }
      } catch (mxrError) {
        console.error("[Migration All] MXR migration error:", mxrError)
        allResults.mxr.errors = -1 // Indicate failure
      }

      const totalMigrated = allResults.airtable.migrated + allResults.mxr.migrated
      const totalSkipped = allResults.airtable.skipped + allResults.mxr.skipped

      return NextResponse.json({
        success: true,
        message: `Migration complete - ${totalMigrated} emails migrated, ${totalSkipped} skipped`,
        results: allResults,
      })
    }

    // TXMX Iconic Series RSVP migration (TXMX emails from "Subscribe to 8 Count")
    if (body.action === "migrate-txmx") {
      console.log("[TXMX Migration] Fetching emails from TXMX Iconic Series RSVP table...")
      
      try {
        // Fetch emails from TXMX RSVP table where "Subscribe to 8 Count" = Yes
        const txmxEmails = await getTxmxRsvpEmails()
        
        console.log(`[TXMX Migration] Found ${txmxEmails.length} emails with "Subscribe to 8 Count" = Yes`)
        
        if (txmxEmails.length === 0) {
          return NextResponse.json({
            success: true,
            message: "No emails to migrate - no RSVP records with 'Subscribe to 8 Count' = Yes found",
            results: { total: 0, migrated: 0, skipped: 0, errors: 0 },
          })
        }
        
        // Migrate to Firestore with source "TXMX"
        const results = await migrateFromTxmxRsvp(
          txmxEmails.map(e => ({ email: e.email, createdAt: e.createdAt }))
        )
        
        return NextResponse.json({
          success: true,
          message: `TXMX RSVP migration complete - ${results.migrated} emails added to TXMX`,
          results,
        })
      } catch (txmxError) {
        console.error("[TXMX Migration] Error:", txmxError)
        return NextResponse.json(
          { 
            success: false, 
            error: `TXMX migration failed: ${txmxError instanceof Error ? txmxError.message : "Unknown error"}` 
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'migrate', 'migrate-mxr', 'migrate-txmx', or 'migrate-all'." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error in email-lists migration:", error)
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 }
    )
  }
}

// DELETE - Delete an email signup
export async function DELETE(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Email signup ID is required" },
        { status: 400 }
      )
    }

    const result = await deleteEmailSignup(id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to delete email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Email signup deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting email signup:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete email signup" },
      { status: 500 }
    )
  }
}