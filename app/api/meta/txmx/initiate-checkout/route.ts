import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest, extractCartData } from "../../../../lib/meta-user-data"

const metaAPI = new MetaConversionsAPI()

export async function POST(request: NextRequest) {
  try {
    const { eventId, cart } = await request.json()

    if (!cart) {
      return NextResponse.json({ error: "Cart data required" }, { status: 400 })
    }

    const userData = extractUserDataFromRequest(request)
    const customData = extractCartData(cart)

    const event = metaAPI.createEvent("InitiateCheckout", userData, customData, eventId)

    const success = await metaAPI.sendEvent(event)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to send event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX InitiateCheckout API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
