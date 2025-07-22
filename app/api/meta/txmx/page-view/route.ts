import { type NextRequest, NextResponse } from "next/server"
import { trackTXMXPageView } from "../../../../lib/meta-server-tracking"

export async function POST(request: NextRequest) {
  try {
    const { eventId, page } = await request.json()

    // Get the current URL for event source
    const eventSourceUrl = request.headers.get("referer") || request.url

    const success = await trackTXMXPageView(eventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "TXMX PageView event tracked successfully",
      })
    } else {
      return NextResponse.json({ error: "Failed to track TXMX PageView event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX PageView API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "TXMX PageView Tracking",
    timestamp: new Date().toISOString(),
  })
}
