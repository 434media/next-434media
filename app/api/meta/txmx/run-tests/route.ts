import { type NextRequest, NextResponse } from "next/server"
import { MetaConversionsAPI } from "../../../../lib/meta-conversions-api"
import { extractUserDataFromRequest } from "../../../../lib/meta-user-data"
import type { TXMXProductData } from "../../../../types/meta-pixel"

interface TestResult {
  testName: string
  success: boolean
  eventId: string
  timestamp: string
  error?: string
  responseData?: any
  duration?: number
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const results: TestResult[] = []

  try {
    // Environment check
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
          results: [],
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

    // Extract user data
    const userData = await extractUserDataFromRequest()
    const eventSourceUrl = request.url

    // Test 1: Page View
    const pageViewStart = Date.now()
    try {
      const pageViewEventId = `test-pageview-${Date.now()}`
      const pageViewResult = await metaAPI.trackPageView(userData, pageViewEventId, eventSourceUrl)

      results.push({
        testName: "Page View",
        success: pageViewResult.success,
        eventId: pageViewEventId,
        timestamp: new Date().toISOString(),
        error: pageViewResult.error,
        responseData: pageViewResult.response,
        duration: Date.now() - pageViewStart,
      })
    } catch (error) {
      results.push({
        testName: "Page View",
        success: false,
        eventId: `test-pageview-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - pageViewStart,
      })
    }

    // Test 2: View Content
    const viewContentStart = Date.now()
    try {
      const product: TXMXProductData = {
        productId: "test-product-123",
        productTitle: "Test TXMX Boxing Gloves",
        productHandle: "test-boxing-gloves",
        value: 129.99,
        currency: "USD",
      }

      const viewContentEventId = `test-viewcontent-${Date.now()}`
      const customData = {
        content_ids: [product.productId],
        content_type: "product",
        content_name: product.productTitle,
        content_category: "txmx-boxing",
        value: product.value,
        currency: product.currency,
      }

      const viewContentResult = await metaAPI.trackViewContent(userData, customData, viewContentEventId, eventSourceUrl)

      results.push({
        testName: "View Content",
        success: viewContentResult.success,
        eventId: viewContentEventId,
        timestamp: new Date().toISOString(),
        error: viewContentResult.error,
        responseData: viewContentResult.response,
        duration: Date.now() - viewContentStart,
      })
    } catch (error) {
      results.push({
        testName: "View Content",
        success: false,
        eventId: `test-viewcontent-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - viewContentStart,
      })
    }

    // Test 3: Add to Cart
    const addToCartStart = Date.now()
    try {
      const addToCartEventId = `test-addtocart-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123"],
        content_type: "product",
        content_name: "Test TXMX Boxing Gloves",
        content_category: "txmx-boxing",
        value: 259.98,
        currency: "USD",
        num_items: 2,
      }

      const addToCartResult = await metaAPI.trackAddToCart(userData, customData, addToCartEventId, eventSourceUrl)

      results.push({
        testName: "Add to Cart",
        success: addToCartResult.success,
        eventId: addToCartEventId,
        timestamp: new Date().toISOString(),
        error: addToCartResult.error,
        responseData: addToCartResult.response,
        duration: Date.now() - addToCartStart,
      })
    } catch (error) {
      results.push({
        testName: "Add to Cart",
        success: false,
        eventId: `test-addtocart-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - addToCartStart,
      })
    }

    // Test 4: Initiate Checkout
    const checkoutStart = Date.now()
    try {
      const checkoutEventId = `test-checkout-${Date.now()}`
      const customData = {
        content_ids: ["test-product-123", "test-product-456"],
        content_type: "product",
        content_category: "txmx-boxing",
        value: 389.97,
        currency: "USD",
        num_items: 3,
      }

      const checkoutResult = await metaAPI.trackInitiateCheckout(userData, customData, checkoutEventId, eventSourceUrl)

      results.push({
        testName: "Initiate Checkout",
        success: checkoutResult.success,
        eventId: checkoutEventId,
        timestamp: new Date().toISOString(),
        error: checkoutResult.error,
        responseData: checkoutResult.response,
        duration: Date.now() - checkoutStart,
      })
    } catch (error) {
      results.push({
        testName: "Initiate Checkout",
        success: false,
        eventId: `test-checkout-${Date.now()}`,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - checkoutStart,
      })
    }

    // Calculate summary
    const passed = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const total = results.length
    const passRate = total > 0 ? `${Math.round((passed / total) * 100)}%` : "0%"
    const totalDuration = Date.now() - startTime

    const summary = {
      total,
      passed,
      failed,
      passRate,
      totalDuration,
      environment: {
        hasPixelId: !!process.env.META_PIXEL_ID,
        hasAccessToken: !!process.env.META_ACCESS_TOKEN,
        hasTestCode: !!process.env.META_TEST_EVENT_CODE,
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
      },
      userData: {
        hasIp: !!userData.clientIpAddress,
        hasUserAgent: !!userData.clientUserAgent,
        hasFbc: !!userData.fbc,
        hasFbp: !!userData.fbp,
      },
    }

    return NextResponse.json({
      success: passed > 0,
      results,
      summary,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error running Meta tests:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run tests",
        details: error instanceof Error ? error.message : "Unknown error",
        results,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
