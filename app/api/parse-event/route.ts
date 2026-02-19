import { type NextRequest, NextResponse } from "next/server"
import { parseEventUrl } from "@/lib/event-parser"

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 })
    }

    console.log(`🚀 Starting to parse event URL: ${url}`)

    const result = await parseEventUrl(url)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    console.log(`✅ Successfully parsed event: ${result.data?.title}`)

    return NextResponse.json(result.data)
  } catch (error) {
    console.error("❌ API Error parsing event:", error)

    return NextResponse.json(
      {
        error: "An unexpected error occurred while parsing the event. Please try again.",
      },
      { status: 500 },
    )
  }
}

// Add CORS headers for better compatibility
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
