import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getLatestGA4Snapshot } from "@/lib/analytics-snapshots"
import {
  getAvailableProperties,
  getAnalyticsSummary,
  getDailyMetrics,
  getPageViewsData,
  getTrafficSourcesData,
  getDeviceData,
  getGeographicData,
} from "@/lib/google-analytics"

export const runtime = "nodejs"

type Range = "7d" | "30d"

function snapshotMeta(snap: { snapshotDate: string; generatedAt: string }, range: Range) {
  return {
    _snapshot: {
      snapshotDate: snap.snapshotDate,
      generatedAt: snap.generatedAt,
      range,
      source: "snapshot" as const,
    },
  }
}

function liveMeta(reason: string) {
  return {
    _snapshot: {
      source: "live_fallback" as const,
      reason,
    },
  }
}

function rangeToDates(range: Range): { startDate: string; endDate: string } {
  const days = range === "7d" ? 7 : 30
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - days)
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  }
}

/**
 * Live-data fallback. Used when no snapshot exists yet OR when the snapshot
 * doesn't contain the requested endpoint (e.g., 7d range only has summary).
 */
async function fetchLive(
  endpoint: string,
  propertyId: string,
  range: Range,
  reason: string,
): Promise<NextResponse> {
  const { startDate, endDate } = rangeToDates(range)
  const meta = liveMeta(reason)
  try {
    switch (endpoint) {
      case "summary":
      case "overview": {
        const summary = await getAnalyticsSummary(startDate, endDate, propertyId)
        return NextResponse.json({
          ...summary,
          pageViewsChange: 0,
          sessionsChange: 0,
          usersChange: 0,
          bounceRateChange: 0,
          activeUsers: summary.totalUsers,
          ...meta,
        })
      }
      case "daily-metrics":
      case "chart":
      case "pageviews":
        return NextResponse.json({ ...(await getDailyMetrics(startDate, endDate, propertyId)), ...meta })
      case "pages":
      case "toppages":
      case "top-pages":
        return NextResponse.json({ ...(await getPageViewsData(startDate, endDate, propertyId)), ...meta })
      case "referrers":
      case "traffic-sources":
      case "trafficsources":
      case "sources":
        return NextResponse.json({ ...(await getTrafficSourcesData(startDate, endDate, propertyId)), ...meta })
      case "devices":
      case "device-breakdown":
        return NextResponse.json({ ...(await getDeviceData(startDate, endDate, propertyId)), ...meta })
      case "geographic":
      case "geography":
      case "geo":
      case "countries":
        return NextResponse.json({ ...(await getGeographicData(startDate, endDate, propertyId)), ...meta })
      default:
        return NextResponse.json(
          {
            error: `Endpoint '${endpoint}' is not snapshotted and live fallback is not implemented for it. Call /api/analytics?endpoint=${endpoint} directly.`,
            ...meta,
          },
          { status: 400 },
        )
    }
  } catch (liveErr) {
    console.error(`[Analytics Snapshot] Live fallback failed for endpoint=${endpoint}:`, liveErr)
    return NextResponse.json(
      {
        error: liveErr instanceof Error ? liveErr.message : "Live data fallback failed",
        endpoint,
        propertyId,
        ...meta,
      },
      { status: 502 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const endpoint = params.get("endpoint") ?? ""
    const propertyIdParam = params.get("propertyId")
    const propertyId = propertyIdParam || process.env.GA4_PROPERTY_ID
    const rangeParam = (params.get("range") as Range) || "30d"
    const range: Range = rangeParam === "7d" ? "7d" : "30d"

    if (endpoint === "properties") {
      const availableProperties = getAvailableProperties()
      return NextResponse.json({
        success: true,
        properties: availableProperties,
        defaultPropertyId: availableProperties[0]?.id,
      })
    }

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId required" }, { status: 400 })
    }

    const snap = await getLatestGA4Snapshot(propertyId)
    if (!snap) {
      // No snapshot yet — fall back to live so the page works on day 1.
      return fetchLive(endpoint, propertyId, range, "no snapshot exists for this property yet")
    }

    const rangeData = range === "7d" ? snap.range7d : snap.range30d
    const meta = snapshotMeta(snap, range)

    switch (endpoint) {
      case "summary":
      case "overview": {
        const summary = rangeData.summary as Record<string, number>
        return NextResponse.json({
          ...summary,
          propertyId: snap.propertyId,
          pageViewsChange: 0,
          sessionsChange: 0,
          usersChange: 0,
          bounceRateChange: 0,
          activeUsers: summary.totalUsers,
          ...meta,
        })
      }

      case "daily-metrics":
      case "chart":
      case "pageviews": {
        const daily = "daily" in rangeData ? rangeData.daily : null
        if (!daily) return fetchLive(endpoint, propertyId, range, "daily-metrics not snapshotted for 7d range")
        return NextResponse.json({ ...daily, ...meta })
      }

      case "pages":
      case "toppages":
      case "top-pages": {
        const topPages = "topPages" in rangeData ? rangeData.topPages : null
        if (!topPages) return fetchLive(endpoint, propertyId, range, "top-pages not snapshotted for 7d range")
        return NextResponse.json({ ...topPages, ...meta })
      }

      case "referrers":
      case "traffic-sources":
      case "trafficsources":
      case "sources": {
        const trafficSources = "trafficSources" in rangeData ? rangeData.trafficSources : null
        if (!trafficSources)
          return fetchLive(endpoint, propertyId, range, "traffic-sources not snapshotted for 7d range")
        return NextResponse.json({ ...trafficSources, ...meta })
      }

      case "devices":
      case "device-breakdown": {
        const devices = "devices" in rangeData ? rangeData.devices : null
        if (!devices) return fetchLive(endpoint, propertyId, range, "devices not snapshotted for 7d range")
        return NextResponse.json({ ...devices, ...meta })
      }

      case "geographic":
      case "geography":
      case "geo":
      case "countries": {
        const geographic = "geographic" in rangeData ? rangeData.geographic : null
        if (!geographic) return fetchLive(endpoint, propertyId, range, "geographic not snapshotted for 7d range")
        return NextResponse.json({ ...geographic, ...meta })
      }

      case "realtime":
      case "real-time":
        return NextResponse.json(
          { error: "realtime data is not snapshotted — call /api/analytics?endpoint=realtime instead" },
          { status: 400 },
        )

      default:
        return NextResponse.json(
          {
            error: "Invalid endpoint parameter",
            endpoint,
            availableEndpoints: [
              "properties",
              "summary",
              "daily-metrics",
              "top-pages",
              "traffic-sources",
              "devices",
              "geographic",
            ],
          },
          { status: 400 },
        )
    }
  } catch (error) {
    console.error("[Analytics Snapshot] Unhandled error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 },
    )
  }
}
