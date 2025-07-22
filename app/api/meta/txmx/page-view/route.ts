import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest } from "../../../../lib/meta-user-data"

const metaAPI = new MetaConversionsAPI()

export async function POST(request: NextRequest) {
  try {
    const { eventId, page } = await request.json()

    const userData = extractUserDataFromRequest(request)

    const event = metaAPI.createEvent(
      "PageView",
      userData,
      {
        content_category: "txmx-boxing",
        content_name: page || "TXMX Boxing Collection",
      },
      eventId,
    )

    const success = await metaAPI.sendEvent(event)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to send event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX PageView API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
