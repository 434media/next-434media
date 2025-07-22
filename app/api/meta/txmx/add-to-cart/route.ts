import { type NextRequest, NextResponse } from "next/server"
import { trackTXMXAddToCart } from "../../../../lib/meta-server-tracking"
import type { TXMXProductData } from "../../../../types/meta-pixel"

export async function POST(request: NextRequest) {
  try {
    const {
      eventId,
      product,
    }: {
      eventId?: string
      product: TXMXProductData & {
        variantId: string
        variantTitle: string
        quantity: number
      }
    } = await request.json()

    if (!product || !product.productId || !product.productTitle || !product.variantId) {
      return NextResponse.json(
        {
          error: "Product data with productId, productTitle, and variantId is required",
        },
        { status: 400 },
      )
    }

    if (!product.quantity || product.quantity < 1) {
      return NextResponse.json({ error: "Valid quantity (>= 1) is required" }, { status: 400 })
    }

    // Get the current URL for event source
    const eventSourceUrl = request.headers.get("referer") || request.url

    const success = await trackTXMXAddToCart(product, eventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "TXMX AddToCart event tracked successfully",
        product: {
          id: product.productId,
          title: product.productTitle,
          variant: product.variantId,
          quantity: product.quantity,
          value: product.value,
        },
      })
    } else {
      return NextResponse.json({ error: "Failed to track TXMX AddToCart event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX AddToCart API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "TXMX AddToCart Tracking",
    timestamp: new Date().toISOString(),
  })
}
