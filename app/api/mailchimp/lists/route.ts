import { NextResponse } from "next/server"
import { getMailchimpListsData } from "../../../lib/mailchimp-analytics"

export async function GET() {
  try {
    console.log("[Mailchimp Lists] Fetching lists data...")

    const data = await getMailchimpListsData()

    console.log("[Mailchimp Lists] Successfully fetched", data.totalLists, "lists")

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Mailchimp Lists] Error:", error)

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
