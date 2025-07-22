import { type NextRequest, NextResponse } from "next/server"
import { trackTXMXInitiateCheckout } from "../../../../lib/meta-server-tracking"
import type { TXMXCartData } from "../../../../types/meta-pixel"

export async function POST(request: NextRequest) {
  try {
    const { eventId, cart }: { eventId?: string; cart: TXMXCartData } = await request.json()

    if (!cart || !cart.cartId) {
      return NextResponse.json({ error: "Cart data with cartId is required" }, { status: 400 })
    }

    if (!cart.products || cart.products.length === 0) {
      return NextResponse.json({ error: "Cart must contain at least one product" }, { status: 400 })
    }

    if (!cart.value || cart.value <= 0) {
      return NextResponse.json({ error: "Cart value must be greater than 0" }, { status: 400 })
    }

    // Get the current URL for event source
    const eventSourceUrl = request.headers.get("referer") || request.url

    const success = await trackTXMXInitiateCheckout(cart, eventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "TXMX InitiateCheckout event tracked successfully",
        cart: {
          id: cart.cartId,
          value: cart.value,
          currency: cart.currency,
          numItems: cart.numItems,
          productCount: cart.products.length,
        },
      })
    } else {
      return NextResponse.json({ error: "Failed to track TXMX InitiateCheckout event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX InitiateCheckout API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "TXMX InitiateCheckout Tracking",
    timestamp: new Date().toISOString(),
  })
}
