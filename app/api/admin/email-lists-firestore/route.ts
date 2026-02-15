import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import { 
  getEmailSignups, 
  getEmailSources, 
  getEmailCountsBySource,
  emailSignupsToCSV,
  deleteEmailSignup,
} from "@/app/lib/firestore-email-signups"

// Ensure this route is never cached — always fetch fresh data from Firestore
export const dynamic = "force-dynamic"

// Check admin access
async function requireAdmin() {
  const session = await getSession()
  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }
  if (!isAuthorizedAdmin(session.email)) {
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

    const noCacheHeaders = { "Cache-Control": "no-store, no-cache, must-revalidate" }

    // Get counts by source
    if (action === "counts") {
      const counts = await getEmailCountsBySource()
      return NextResponse.json({ success: true, counts }, { headers: noCacheHeaders })
    }

    // Get available sources
    if (action === "sources") {
      const sources = await getEmailSources()
      return NextResponse.json({ success: true, sources }, { headers: noCacheHeaders })
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
    }, { headers: noCacheHeaders })
  } catch (error) {
    console.error("Error in email-lists API:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch email signups" },
      { status: 500 }
    )
  }
}

// POST - No longer needed (migrations complete, data lives in Firestore)
export async function POST(request: Request) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    return NextResponse.json(
      { 
        success: false, 
        error: "Airtable migrations have been completed. All email data is now in Firestore." 
      },
      { status: 410 }
    )
  } catch (error) {
    console.error("Error in email-lists POST:", error)
    return NextResponse.json(
      { success: false, error: "Request failed" },
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