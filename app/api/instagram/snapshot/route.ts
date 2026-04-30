import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getLatestInstagramSnapshot, type InstagramSnapshot } from "@/lib/analytics-snapshots"

export const runtime = "nodejs"

const VALID_ACCOUNTS = new Set(["txmx", "vemos", "milcity", "ampd"])

function snapshotMeta(snap: InstagramSnapshot) {
  return {
    snapshotDate: snap.snapshotDate,
    generatedAt: snap.generatedAt,
    source: "snapshot" as const,
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const endpoint = params.get("endpoint")
    const accountParam = params.get("account") || "txmx"

    if (!VALID_ACCOUNTS.has(accountParam)) {
      return NextResponse.json(
        { success: false, error: `Invalid account '${accountParam}'. Valid: ${[...VALID_ACCOUNTS].join(", ")}` },
        { status: 400 },
      )
    }

    const snap = await getLatestInstagramSnapshot(accountParam)
    if (!snap) {
      return NextResponse.json(
        {
          success: false,
          error: `No Instagram snapshot for '${accountParam}' yet — wait for daily cron or call /api/instagram/${accountParam} for live data`,
        },
        { status: 404 },
      )
    }

    const meta = snapshotMeta(snap)

    switch (endpoint) {
      case "test-connection":
        return NextResponse.json({
          success: true,
          message: `Snapshot from ${snap.snapshotDate}`,
          account: snap.profile,
          _snapshot: meta,
        })

      case "account-info":
        return NextResponse.json({
          success: true,
          data: {
            id: snap.instagramBusinessAccountId,
            ...snap.profile,
          },
          _snapshot: meta,
        })

      case "media":
      case "posts":
        return NextResponse.json({
          success: true,
          data: snap.recentMedia,
          _snapshot: meta,
        })

      case "insights":
      case "reach-breakdown":
      case "demographics":
      case "online-followers":
        return NextResponse.json(
          {
            success: false,
            error: `'${endpoint}' is not snapshotted — call /api/instagram/${accountParam}?endpoint=${endpoint} for live data`,
          },
          { status: 400 },
        )

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Endpoint '${endpoint}' not supported by snapshot. Available: test-connection, account-info, media`,
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[Instagram Snapshot] Error:", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
