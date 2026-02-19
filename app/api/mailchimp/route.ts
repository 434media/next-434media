import { type NextRequest, NextResponse } from "next/server"
import {
  getMailchimpAnalyticsSummary,
  getMailchimpCampaignPerformance,
  getMailchimpSubscriberGrowth,
  getMailchimpEngagementData,
  getMailchimpGeographicData,
  getMailchimpListsData,
  getMailchimpCampaignsData,
  getMailchimpRealtimeData,
  getMailchimpTags,
} from "@/lib/mailchimp-analytics"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get("endpoint")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const audienceId = searchParams.get("audienceId")

    console.log("[Mailchimp API] Request received:", { endpoint, startDate, endDate, audienceId })

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint parameter is required" }, { status: 400 })
    }

    const availableEndpoints = [
      "test-connection",
      "lists",
      "summary",
      "campaigns",
      "subscribers",
      "engagement",
      "geographic",
      "realtime",
      "all-campaigns",
      "tags",
    ]

    if (!availableEndpoints.includes(endpoint)) {
      return NextResponse.json(
        {
          error: `Endpoint '${endpoint}' not found. Available endpoints: ${availableEndpoints.join(", ")}`,
        },
        { status: 400 },
      )
    }

    // For endpoints that require date range
    const requiresDateRange = ["summary", "campaigns", "subscribers", "engagement", "all-campaigns"]
    if (requiresDateRange.includes(endpoint) && (!startDate || !endDate)) {
      return NextResponse.json(
        { error: `Endpoint '${endpoint}' requires startDate and endDate parameters` },
        { status: 400 },
      )
    }

    let data

    switch (endpoint) {
      case "test-connection":
        const { testMailchimpConnection } = await import("@/lib/mailchimp-analytics")
        data = await testMailchimpConnection(audienceId || undefined)
        break

      case "lists":
        data = await getMailchimpListsData()
        break

      case "summary":
        data = await getMailchimpAnalyticsSummary(startDate!, endDate!, audienceId || undefined)
        break

      case "campaigns":
        data = await getMailchimpCampaignPerformance(startDate!, endDate!, audienceId || undefined)
        break

      case "subscribers":
        data = await getMailchimpSubscriberGrowth(startDate!, endDate!, audienceId || undefined)
        break

      case "engagement":
        data = await getMailchimpEngagementData(startDate!, endDate!, audienceId || undefined)
        break

      case "geographic":
        data = await getMailchimpGeographicData(audienceId || undefined)
        break

      case "realtime":
        data = await getMailchimpRealtimeData(audienceId || undefined)
        break

      case "all-campaigns":
        console.log("[Mailchimp API] Fetching all-campaigns data...")
        data = await getMailchimpCampaignsData(startDate!, endDate!, audienceId || undefined)
        console.log("[Mailchimp API] all-campaigns data fetched:", {
          totalCampaigns: data.totalCampaigns,
          campaignsWithData: data.data.length,
          sampleBounces: data.data[0]?.report_summary?.bounces,
          sampleUnsubscribed: data.data[0]?.report_summary?.unsubscribed,
        })
        break

      case "tags":
        console.log("[Mailchimp API] Fetching tags data...")
        data = await getMailchimpTags(audienceId || undefined)
        console.log("[Mailchimp API] tags data fetched:", {
          totalTags: data.total_items,
          tags: data.tags.map((t: { name: string; member_count?: number }) => `${t.name} (${t.member_count || 0})`).join(", "),
        })
        break

      default:
        return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
    }

    console.log(`[Mailchimp API] ${endpoint} request completed successfully`)

    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Mailchimp API] Error:", error)

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
