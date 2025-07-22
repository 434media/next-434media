import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest, extractProductData } from "../../../../lib/meta-user-data"

const metaAPI = new MetaConversionsAPI()

export async function POST(request: NextRequest) {
  try {
    const { eventId, product } = await request.json()

    if (!product) {
      return NextResponse.json({ error: "Product data required" }, { status: 400 })
    }

    const userData = extractUserDataFromRequest(request)
    const customData = extractProductData(product)

    const event = metaAPI.createEvent("ViewContent", userData, customData, eventId)

    const success = await metaAPI.sendEvent(event)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to send event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX ViewContent API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
