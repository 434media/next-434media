import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest } from "../../../../lib/meta-user-data"

interface TestResult {
  testName: string
  success: boolean
  eventId: string
  timestamp: string
  error?: string
  responseData?: any
}

export async function GET(request: NextRequest) {
  const results: TestResult[] = []
  const baseUrl = new URL(request.url).origin

  try {
    // Check environment variables first
    const requiredEnvVars = {
      META_PIXEL_ID: process.env.META_PIXEL_ID,
      META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    }

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingVars.length > 0) {
      return NextResponse.json({
        success: false,
        error: "Missing required environment variables",
        missingVars,
        results: [],
      })
    }

    // Initialize Meta API client
    const metaAPI = new MetaConversionsAPI(
      process.env.META_PIXEL_ID!,
      process.env.META_ACCESS_TOKEN!,
      process.env.META_TEST_EVENT_CODE,
    )

    // Extract user data for tests
    const userData = await extractUserDataFromRequest()

    // Test 1: Page View
    try {
      const eventId = `test-pageview-${Date.now()}`
      const success = await metaAPI.trackPageView(userData, eventId, `${baseUrl}/test`)

      results.push({
        testName: "Page View",
        success,
        eventId,
        timestamp: new Date().toISOString(),
        responseData: { userData: { ...userData, clientIpAddress: "hidden" } },
      })
    } catch (error) {
      results.push({
        testName: "Page View",
        success: false,
        eventId: `test-pageview-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 2: View Content
    try {
      const eventId = `test-viewcontent-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123"],
        content_type: "product",
        content_name: "Test TXMX Boxing Gloves",
        content_category: "txmx-boxing",
        value: 99.99,
        currency: "USD",
      }

      const success = await metaAPI.trackViewContent(userData, customData, eventId, `${baseUrl}/test-product`)

      results.push({
        testName: "View Content",
        success,
        eventId,
        timestamp: new Date().toISOString(),
        responseData: { customData },
      })
    } catch (error) {
      results.push({
        testName: "View Content",
        success: false,
        eventId: `test-viewcontent-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 3: Add to Cart
    try {
      const eventId = `test-addtocart-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123"],
        content_type: "product",
        content_name: "Test TXMX Boxing Gloves",
        content_category: "txmx-boxing",
        value: 99.99,
        currency: "USD",
        num_items: 2,
      }

      const success = await metaAPI.trackAddToCart(userData, customData, eventId, `${baseUrl}/test-cart`)

      results.push({
        testName: "Add to Cart",
        success,
        eventId,
        timestamp: new Date().toISOString(),
        responseData: { customData },
      })
    } catch (error) {
      results.push({
        testName: "Add to Cart",
        success: false,
        eventId: `test-addtocart-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 4: Initiate Checkout
    try {
      const eventId = `test-checkout-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123", "test-product-456"],
        content_type: "product",
        content_category: "txmx-boxing",
        value: 199.98,
        currency: "USD",
        num_items: 3,
      }

      const success = await metaAPI.trackInitiateCheckout(userData, customData, eventId, `${baseUrl}/test-checkout`)

      results.push({
        testName: "Initiate Checkout",
        success,
        eventId,
        timestamp: new Date().toISOString(),
        responseData: { customData },
      })
    } catch (error) {
      results.push({
        testName: "Initiate Checkout",
        success: false,
        eventId: `test-checkout-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Test 5: Purchase
    try {
      const eventId = `test-purchase-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123", "test-product-456"],
        content_type: "product",
        content_category: "txmx-boxing",
        value: 199.98,
        currency: "USD",
        num_items: 3,
      }

      const success = await metaAPI.trackPurchase(userData, customData, eventId, `${baseUrl}/test-purchase`)

      results.push({
        testName: "Purchase",
        success,
        eventId,
        timestamp: new Date().toISOString(),
        responseData: { customData },
      })
    } catch (error) {
      results.push({
        testName: "Purchase",
        success: false,
        eventId: `test-purchase-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }

    // Calculate summary
    const successCount = results.filter((r) => r.success).length
    const totalTests = results.length
    const allPassed = successCount === totalTests

    return NextResponse.json({
      success: allPassed,
      summary: {
        total: totalTests,
        passed: successCount,
        failed: totalTests - successCount,
        passRate: `${Math.round((successCount / totalTests) * 100)}%`,
      },
      configuration: {
        pixelId: process.env.META_PIXEL_ID,
        hasTestCode: !!process.env.META_TEST_EVENT_CODE,
        testMode: !!process.env.META_TEST_EVENT_CODE,
      },
      results,
      timestamp: new Date().toISOString(),
      note: process.env.META_TEST_EVENT_CODE
        ? "Running in TEST MODE - events will appear in Meta Events Manager Test Events tab"
        : "Running in LIVE MODE - events will appear in Meta Events Manager",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Test runner failed",
        details: error instanceof Error ? error.message : "Unknown error",
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
