import { type NextRequest, NextResponse } from "next/server"
import { trackTXMXViewContent } from "../../../../lib/meta-server-tracking"
import type { TXMXProductData } from "../../../../types/meta-pixel"

export async function POST(request: NextRequest) {
  try {
    const { eventId, product }: { eventId?: string; product: TXMXProductData } = await request.json()

    if (!product || !product.productId || !product.productTitle) {
      return NextResponse.json({ error: "Product data with productId and productTitle is required" }, { status: 400 })
    }

    // Get the current URL for event source
    const eventSourceUrl = request.headers.get("referer") || request.url

    const success = await trackTXMXViewContent(product, eventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "TXMX ViewContent event tracked successfully",
        product: {
          id: product.productId,
          title: product.productTitle,
        },
      })
    } else {
      return NextResponse.json({ error: "Failed to track TXMX ViewContent event" }, { status: 500 })
    }
  } catch (error) {
    console.error("TXMX ViewContent API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "TXMX ViewContent Tracking",
    timestamp: new Date().toISOString(),
  })
}
