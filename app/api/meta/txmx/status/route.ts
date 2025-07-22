import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Check environment variables
    const envStatus = {
      META_PIXEL_ID: !!process.env.META_PIXEL_ID,
      META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
      META_TEST_EVENT_CODE: !!process.env.META_TEST_EVENT_CODE,
    }

    const allEnvVarsPresent = envStatus.META_PIXEL_ID && envStatus.META_ACCESS_TOKEN

    return NextResponse.json({
      status: allEnvVarsPresent ? "ready" : "configuration_required",
      message: allEnvVarsPresent
        ? "TXMX Meta Conversions API is properly configured"
        : "Missing required environment variables",
      environment: envStatus,
      endpoints: {
        pageView: "/api/meta/txmx/page-view",
        viewContent: "/api/meta/txmx/view-content",
        addToCart: "/api/meta/txmx/add-to-cart",
        initiateCheckout: "/api/meta/txmx/initiate-checkout",
        purchase: "/api/meta/txmx/purchase",
        testConnection: "/api/meta/txmx/test-connection",
        status: "/api/meta/txmx/status",
      },
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    })
  } catch (error) {
    console.error("Status check error:", error)
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to check status",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
