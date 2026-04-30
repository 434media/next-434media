import { type NextRequest, NextResponse } from "next/server"
import {
  getLatestMailchimpSnapshot,
  getLatestMailchimpSnapshotByAudienceId,
  type MailchimpSnapshot,
} from "@/lib/analytics-snapshots"

export const runtime = "nodejs"

const DEFAULT_AUDIENCE_KEY = "434media"

function snapshotMeta(snap: MailchimpSnapshot) {
  return {
    snapshotDate: snap.snapshotDate,
    generatedAt: snap.generatedAt,
    source: "snapshot" as const,
  }
}

async function loadSnapshot(audienceParam: string | null): Promise<MailchimpSnapshot | null> {
  if (!audienceParam) {
    return getLatestMailchimpSnapshot(DEFAULT_AUDIENCE_KEY)
  }
  const byKey = await getLatestMailchimpSnapshot(audienceParam)
  if (byKey) return byKey
  return getLatestMailchimpSnapshotByAudienceId(audienceParam)
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const endpoint = params.get("endpoint")
    const audienceParam = params.get("audienceId")

    if (!endpoint) {
      return NextResponse.json({ success: false, error: "Endpoint parameter is required" }, { status: 400 })
    }

    const snap = await loadSnapshot(audienceParam)
    if (!snap) {
      return NextResponse.json(
        {
          success: false,
          error: "No Mailchimp snapshot available yet — wait for daily cron or use ?source=live",
        },
        { status: 404 },
      )
    }

    const meta = snapshotMeta(snap)

    switch (endpoint) {
      case "summary":
        return NextResponse.json({
          success: true,
          data: { ...(snap.range30d.summary as Record<string, unknown>), _snapshot: meta },
        })

      case "campaigns":
        return NextResponse.json({
          success: true,
          data: { ...(snap.range30d.campaigns as Record<string, unknown>), _snapshot: meta },
        })

      case "engagement":
        return NextResponse.json({
          success: true,
          data: { ...(snap.range30d.engagement as Record<string, unknown>), _snapshot: meta },
        })

      case "subscribers":
        return NextResponse.json({
          success: true,
          data: { ...(snap.range90d.growth as Record<string, unknown>), _snapshot: meta },
        })

      case "lists":
      case "geographic":
      case "realtime":
      case "all-campaigns":
      case "tags":
      case "test-connection":
        return NextResponse.json(
          {
            success: false,
            error: `'${endpoint}' is not snapshotted — call /api/mailchimp?endpoint=${endpoint} for live data`,
          },
          { status: 400 },
        )

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Endpoint '${endpoint}' not supported by snapshot. Available: summary, campaigns, engagement, subscribers`,
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[Mailchimp Snapshot] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
