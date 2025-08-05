import { NextResponse } from "next/server"
import { getInstagramConfigurationStatus, validateInstagramConfig } from "../../../../lib/instagram-config"

export async function GET() {
  try {
    const configStatus = getInstagramConfigurationStatus()
    const isValid = validateInstagramConfig()

    return NextResponse.json({
      success: true,
      configured: isValid,
      status: configStatus,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Instagram Config Check] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check Instagram configuration",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
