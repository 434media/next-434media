import { NextResponse } from "next/server"

export async function GET() {
  try {
    const hasToken = !!process.env.VERCEL_ANALYTICS_TOKEN
    const hasProjectId = !!process.env.VERCEL_PROJECT_ID
    const isConfigured = hasToken && hasProjectId

    return NextResponse.json({
      hasToken,
      hasProjectId,
      isConfigured,
      message: isConfigured ? "Vercel Analytics is properly configured" : "Vercel Analytics configuration incomplete",
    })
  } catch (error) {
    console.error("Config check error:", error)
    return NextResponse.json(
      {
        hasToken: false,
        hasProjectId: false,
        isConfigured: false,
        error: "Failed to check configuration",
      },
      { status: 500 },
    )
  }
}
