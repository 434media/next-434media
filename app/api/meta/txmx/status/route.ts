import { NextResponse } from "next/server"

export async function GET() {
  const requiredEnvVars = {
    META_PIXEL_ID: process.env.META_PIXEL_ID,
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    META_TEST_EVENT_CODE: process.env.META_TEST_EVENT_CODE,
  }

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  const endpoints = [
    { name: "Page View", path: "/api/meta/txmx/page-view", method: "POST" },
    { name: "View Content", path: "/api/meta/txmx/view-content", method: "POST" },
    { name: "Add to Cart", path: "/api/meta/txmx/add-to-cart", method: "POST" },
    { name: "Initiate Checkout", path: "/api/meta/txmx/initiate-checkout", method: "POST" },
    { name: "Purchase", path: "/api/meta/txmx/purchase", method: "POST" },
    { name: "Test Connection", path: "/api/meta/txmx/test-connection", method: "GET" },
    { name: "Run Tests", path: "/api/meta/txmx/run-tests", method: "GET" },
  ]

  return NextResponse.json({
    status: "ok",
    service: "TXMX Meta Conversions API",
    timestamp: new Date().toISOString(),
    configuration: {
      pixelId: process.env.META_PIXEL_ID ? "configured" : "missing",
      accessToken: process.env.META_ACCESS_TOKEN ? "configured" : "missing",
      testEventCode: process.env.META_TEST_EVENT_CODE ? "configured" : "not set",
      isTestMode: !!process.env.META_TEST_EVENT_CODE,
    },
    missingEnvironmentVariables: missingVars,
    availableEndpoints: endpoints,
    ready: missingVars.length === 0,
  })
}
