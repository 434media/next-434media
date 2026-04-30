import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import {
  getAnalyticsSummary,
  getDailyMetrics,
  getPageViewsData,
  getTrafficSourcesData,
  getDeviceData,
  getGeographicData,
  getAvailableProperties,
} from "@/lib/google-analytics"

export const runtime = "nodejs"
export const maxDuration = 300

const SNAPSHOT_COLLECTION = "analytics_snapshots_ga4"

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split("T")[0]
}

export async function GET(request: NextRequest) {
  return runCronJob("ga4-snapshot", request, async () => {
    const properties = getAvailableProperties().filter((p) => p.isConfigured)
    if (properties.length === 0) {
      return { message: "No GA4 properties configured", detail: { properties: 0 } }
    }

    const endDate = isoDaysAgo(1)
    const startDate7 = isoDaysAgo(7)
    const startDate30 = isoDaysAgo(30)
    const snapshotDate = endDate
    const db = getDb()

    const results: Array<{
      propertyId: string
      name: string
      ok: boolean
      error?: string
    }> = []

    for (const property of properties) {
      try {
        const [
          summary7d,
          summary30d,
          daily30d,
          topPages,
          trafficSources,
          devices,
          geographic,
        ] = await Promise.all([
          getAnalyticsSummary(startDate7, endDate, property.id),
          getAnalyticsSummary(startDate30, endDate, property.id),
          getDailyMetrics(startDate30, endDate, property.id),
          getPageViewsData(startDate30, endDate, property.id),
          getTrafficSourcesData(startDate30, endDate, property.id),
          getDeviceData(startDate30, endDate, property.id),
          getGeographicData(startDate30, endDate, property.id),
        ])

        const docId = `${property.id}_${snapshotDate}`
        await db
          .collection(SNAPSHOT_COLLECTION)
          .doc(docId)
          .set({
            propertyId: property.id,
            propertyName: property.name,
            snapshotDate,
            generatedAt: new Date().toISOString(),
            range7d: { startDate: startDate7, endDate, summary: summary7d },
            range30d: {
              startDate: startDate30,
              endDate,
              summary: summary30d,
              daily: daily30d,
              topPages,
              trafficSources,
              devices,
              geographic,
            },
          })

        results.push({ propertyId: property.id, name: property.name, ok: true })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[cron:ga4-snapshot] property ${property.id} failed:`, error)
        results.push({ propertyId: property.id, name: property.name, ok: false, error: message })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    const failed = results.length - succeeded

    return {
      message: `${succeeded}/${results.length} properties snapshotted${failed ? `, ${failed} failed` : ""}`,
      detail: { snapshotDate, results },
    }
  })
}
