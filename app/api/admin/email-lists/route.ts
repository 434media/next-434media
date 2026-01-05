import { NextResponse } from "next/server"
import { getEmailSignups, getEmailSources, getEmailCountsBySource, emailSignupsToCSV } from "@/app/lib/airtable-contacts"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const source = searchParams.get("source")
    const format = searchParams.get("format")
    
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
    })
  } catch (error) {
    console.error("Error in email-lists API:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch email signups" },
      { status: 500 }
    )
  }
}
