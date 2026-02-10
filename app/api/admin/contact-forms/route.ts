import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/app/lib/auth"
import {
  getContactForms,
  getContactFormSources,
  getContactFormCountsBySource,
  contactFormsToCSV,
  deleteContactForm,
  migrateContactFormsFromAirtable,
} from "@/app/lib/firestore-contact-forms"

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

    // Get counts by source
    if (action === "counts") {
      const counts = await getContactFormCountsBySource()
      return NextResponse.json({ success: true, counts })
    }

    // Get available sources
    if (action === "sources") {
      const sources = await getContactFormSources()
      return NextResponse.json({ success: true, sources })
    }

    // Get contact form submissions
    const filters = source ? { source } : undefined
    const submissions = await getContactForms(filters)

    // Return as CSV download
    if (format === "csv") {
      const csv = contactFormsToCSV(submissions)
      const filename = source
        ? `contact-forms-${source.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`
        : `contact-forms-all-${new Date().toISOString().split("T")[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({
      success: true,
      submissions,
      total: submissions.length,
    })
  } catch (error) {
    console.error("Error in contact-forms API:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch contact form submissions" },
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
      console.log("[Contact Form Migration] Starting Airtable → Firestore migration...")

      const results = await migrateContactFormsFromAirtable()

      return NextResponse.json({
        success: true,
        message: `Migration complete: ${results.migrated} forms migrated, ${results.skipped} skipped`,
        results,
      })
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'migrate'." },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error in contact-forms migration:", error)
    return NextResponse.json(
      { success: false, error: "Migration failed" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a contact form submission
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
        { error: "Contact form submission ID is required" },
        { status: 400 }
      )
    }

    const result = await deleteContactForm(id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to delete submission" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Contact form submission deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting contact form:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete contact form submission" },
      { status: 500 }
    )
  }
}
