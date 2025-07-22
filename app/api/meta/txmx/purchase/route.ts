import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest } from "../../../../lib/meta-user-data"

const metaAPI = new MetaConversionsAPI()

export async function POST(request: NextRequest) {
  try {
    const { eventId, order, email } = await request.json()

    if (!order) {
      return NextResponse.json({ error: "Order data required" }, { status: 400 })
    }

    const userData = extractUserDataFromRequest(request)

    // Add email if provided
    if (email) {
      userData.em = [email]
    }

    const customData = {
      currency: order.currency || "USD",
      value: Number.parseFloat(order.totalPrice || "0"),
      content_ids: order.lineItems?.map((item: any) => item.variant.product.id) || [],
      content_type: "product",
      content_category: "txmx-boxing",
      num_items: order.lineItems?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0,
    }

    const event = metaAPI.createEvent("Purchase", userData, customData, eventId)

    const success = await metaAPI.sendEvent(event)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: "Failed to send event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX Purchase API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
