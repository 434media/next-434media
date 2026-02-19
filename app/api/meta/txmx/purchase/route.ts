import { type NextRequest, NextResponse } from "next/server"
import { trackTXMXPurchase } from "@/lib/meta-server-tracking"
import type { TXMXOrderData } from "@/types/meta-pixel"

export async function POST(request: NextRequest) {
  try {
    const {
      eventId,
      order,
    }: {
      eventId?: string
      order: TXMXOrderData
    } = await request.json()

    if (!order || !order.orderId || order.value <= 0 || order.numItems <= 0) {
      return NextResponse.json(
        {
          error: "Order data with orderId, positive value, and positive numItems is required",
        },
        { status: 400 },
      )
    }

    if (!order.products || order.products.length === 0) {
      return NextResponse.json({ error: "Order must contain at least one product" }, { status: 400 })
    }

    // Get the current URL for event source
    const eventSourceUrl = request.headers.get("referer") || request.url

    const success = await trackTXMXPurchase(order, eventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "TXMX Purchase event tracked successfully",
        order: {
          id: order.orderId,
          value: order.value,
          numItems: order.numItems,
          productCount: order.products.length,
          email: order.email ? "provided" : "not provided",
        },
        eventId,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json({ error: "Failed to track TXMX Purchase event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX Purchase API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "TXMX Purchase Tracking",
    timestamp: new Date().toISOString(),
  })
}
