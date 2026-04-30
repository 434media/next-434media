import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import {
  getAvailableMailchimpProperties,
  getMailchimpAnalyticsSummary,
  getMailchimpCampaignPerformance,
  getMailchimpSubscriberGrowth,
  getMailchimpEngagementData,
} from "@/lib/mailchimp-analytics"

export const runtime = "nodejs"
export const maxDuration = 300

const SNAPSHOT_COLLECTION = "analytics_snapshots_mailchimp"
const SUBSCRIBERS_COLLECTION = "mailchimp_subscribers"
const PAGE_SIZE = 1000

interface MailchimpMember {
  id: string
  email_address: string
  status: string
  merge_fields?: Record<string, unknown>
  tags?: Array<{ id: number; name: string }>
  stats?: Record<string, unknown>
  last_changed?: string
  timestamp_signup?: string
  timestamp_opt?: string
  source?: string
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split("T")[0]
}

async function fetchAllMembers(audienceId: string): Promise<MailchimpMember[]> {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY not set")
  const serverPrefix = apiKey.split("-")[1]
  if (!serverPrefix) throw new Error("Invalid MAILCHIMP_API_KEY format")

  const baseUrl = `https://${serverPrefix}.api.mailchimp.com/3.0`
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }

  const all: MailchimpMember[] = []
  let offset = 0

  while (true) {
    const url = `${baseUrl}/lists/${audienceId}/members?count=${PAGE_SIZE}&offset=${offset}&fields=members.id,members.email_address,members.status,members.merge_fields,members.tags,members.stats,members.last_changed,members.timestamp_signup,members.timestamp_opt,members.source,total_items`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw new Error(`Mailchimp /members ${res.status} for ${audienceId}`)
    }
    const json = (await res.json()) as { members: MailchimpMember[]; total_items: number }
    const batch = json.members ?? []
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    if (offset > json.total_items) break
  }

  return all
}

async function writeSubscribersBatch(
  audienceId: string,
  audienceName: string,
  members: MailchimpMember[],
): Promise<number> {
  const db = getDb()
  const collection = db.collection(SUBSCRIBERS_COLLECTION)
  const now = new Date().toISOString()
  let written = 0

  for (let i = 0; i < members.length; i += 400) {
    const slice = members.slice(i, i + 400)
    const batch = db.batch()
    for (const m of slice) {
      const docId = `${audienceId}_${m.id}`
      batch.set(
        collection.doc(docId),
        {
          audienceId,
          audienceName,
          mailchimpId: m.id,
          email: m.email_address?.toLowerCase() ?? null,
          status: m.status,
          mergeFields: m.merge_fields ?? null,
          tags: m.tags ?? [],
          stats: m.stats ?? null,
          lastChanged: m.last_changed ?? null,
          timestampSignup: m.timestamp_signup ?? null,
          timestampOpt: m.timestamp_opt ?? null,
          source: m.source ?? null,
          syncedAt: now,
        },
        { merge: true },
      )
    }
    await batch.commit()
    written += slice.length
  }

  return written
}

export async function GET(request: NextRequest) {
  return runCronJob("mailchimp-sync", request, async () => {
    const properties = (await getAvailableMailchimpProperties()).filter((p) => p.isConfigured)
    if (properties.length === 0) {
      return { message: "No Mailchimp audiences configured", detail: { audiences: 0 } }
    }

    const endDate = isoDaysAgo(0)
    const startDate30 = isoDaysAgo(30)
    const startDate90 = isoDaysAgo(90)
    const snapshotDate = endDate
    const db = getDb()

    const results: Array<{
      audienceId: string
      name: string
      ok: boolean
      subscribersSynced?: number
      error?: string
    }> = []

    for (const property of properties) {
      const audienceId = process.env[property.key]
      if (!audienceId) {
        results.push({
          audienceId: property.id,
          name: property.name,
          ok: false,
          error: `${property.key} not set`,
        })
        continue
      }

      try {
        const [summary, campaigns, growth, engagement] = await Promise.all([
          getMailchimpAnalyticsSummary(startDate30, endDate, audienceId),
          getMailchimpCampaignPerformance(startDate30, endDate, audienceId),
          getMailchimpSubscriberGrowth(startDate90, endDate, audienceId),
          getMailchimpEngagementData(startDate30, endDate, audienceId),
        ])

        const docId = `${property.id}_${snapshotDate}`
        await db
          .collection(SNAPSHOT_COLLECTION)
          .doc(docId)
          .set({
            audienceId,
            audienceKey: property.id,
            audienceName: property.name,
            snapshotDate,
            generatedAt: new Date().toISOString(),
            range30d: { startDate: startDate30, endDate, summary, campaigns, engagement },
            range90d: { startDate: startDate90, endDate, growth },
          })

        const members = await fetchAllMembers(audienceId)
        const written = await writeSubscribersBatch(audienceId, property.name, members)

        results.push({
          audienceId: property.id,
          name: property.name,
          ok: true,
          subscribersSynced: written,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[cron:mailchimp-sync] ${property.id} failed:`, error)
        results.push({
          audienceId: property.id,
          name: property.name,
          ok: false,
          error: message,
        })
      }
    }

    const succeeded = results.filter((r) => r.ok).length
    const totalSubs = results.reduce((sum, r) => sum + (r.subscribersSynced ?? 0), 0)
    const failed = results.length - succeeded

    return {
      message: `${succeeded}/${results.length} audiences synced, ${totalSubs} subscribers${failed ? `, ${failed} failed` : ""}`,
      detail: { snapshotDate, results },
    }
  })
}
