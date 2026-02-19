import { type NextRequest, NextResponse } from "next/server"
import { testMailchimpConnection } from "@/lib/mailchimp-analytics"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const audienceId = searchParams.get("audienceId")

    console.log("[Mailchimp Test Connection] Testing connection with audienceId:", audienceId)

    const result = await testMailchimpConnection(audienceId || undefined)

    console.log("[Mailchimp Test Connection] Test completed:", result.success ? "SUCCESS" : "FAILED")

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Mailchimp Test Connection] Error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
