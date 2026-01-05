import { NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { getEmailSignups as getAirtableSignups } from "@/app/lib/airtable-contacts"
import { 
  migrateFromAirtable, 
  getEmailSignups, 
  getEmailSources, 
  getEmailCountsBySource,
  emailSignupsToCSV 
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

    return NextResponse.json(
      { error: "Invalid action. Use 'migrate' to migrate from Airtable." },
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
