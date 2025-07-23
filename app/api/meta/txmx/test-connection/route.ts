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
      console.error("Missing environment variables:", missingVars)
      return NextResponse.json(
        {
          success: false,
          error: "Missing required environment variables",
          missingVars,
          availableVars: Object.keys(process.env).filter((key) => key.startsWith("META_")),
        },
        { status: 500 },
      )
    }

    // Log environment check (without exposing sensitive data)
    console.log("Environment check:", {
      hasPixelId: !!process.env.META_PIXEL_ID,
      hasAccessToken: !!process.env.META_ACCESS_TOKEN,
      hasTestCode: !!process.env.META_TEST_EVENT_CODE,
      pixelIdLength: process.env.META_PIXEL_ID?.length,
      accessTokenLength: process.env.META_ACCESS_TOKEN?.length,
    })

    // Initialize Meta API client
    const metaAPI = new MetaConversionsAPI(
      process.env.META_PIXEL_ID!,
      process.env.META_ACCESS_TOKEN!,
      process.env.META_TEST_EVENT_CODE,
    )

    // Enhanced IP extraction for production
    const clientIpAddress =
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "127.0.0.1"

    const clientUserAgent = request.headers.get("user-agent") || "test-agent"

    // Send a test event
    const testUserData = {
      clientIpAddress,
      clientUserAgent,
    }

    const testEventId = `test-connection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const eventSourceUrl = request.url

    console.log("Sending test event with data:", {
      testEventId,
      clientIpAddress,
      userAgentLength: clientUserAgent.length,
      eventSourceUrl,
    })

    const result = await metaAPI.trackPageView(testUserData, testEventId, eventSourceUrl)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Meta Conversions API connection successful",
        testEventId,
        pixelId: process.env.META_PIXEL_ID,
        hasTestCode: !!process.env.META_TEST_EVENT_CODE,
        timestamp: new Date().toISOString(),
        userDataSent: {
          hasIp: !!testUserData.clientIpAddress,
          hasUserAgent: !!testUserData.clientUserAgent,
          ipAddress: testUserData.clientIpAddress, // Remove in production
        },
        response: result.response,
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send test event to Meta Conversions API",
          details: result.error,
          testEventId,
          timestamp: new Date().toISOString(),
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
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: "Use GET method to test connection" }, { status: 405 })
}
