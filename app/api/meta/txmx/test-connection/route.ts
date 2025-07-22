import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"

export async function GET(request: NextRequest) {
  try {
    // Check if required environment variables are present
    const requiredEnvVars = {
      META_PIXEL_ID: process.env.META_PIXEL_ID,
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    }

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required environment variables",
          missingVars,
        },
        { status: 500 },
      )
    }

    // Initialize Meta API client
    const metaAPI = new MetaConversionsAPI(
      process.env.META_PIXEL_ID!,
      process.env.META_ACCESS_TOKEN!,
      process.env.META_TEST_EVENT_CODE,
    )

    // Send a test event
    const testUserData = {
      clientIpAddress: request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1",
      clientUserAgent: request.headers.get("user-agent") || "test-agent",
    }

    const testEventId = `test-${Date.now()}`
    const eventSourceUrl = request.url

    const success = await metaAPI.trackPageView(testUserData, testEventId, eventSourceUrl)

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Meta Conversions API connection successful",
        testEventId,
        pixelId: process.env.META_PIXEL_ID,
        hasTestCode: !!process.env.META_TEST_EVENT_CODE,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send test event to Meta Conversions API",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Meta Conversions API test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during connection test",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: "Use GET method to test connection" }, { status: 405 })
}
