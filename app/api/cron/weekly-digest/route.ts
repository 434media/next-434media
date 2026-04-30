import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"
import { getClients, getOpportunities } from "@/lib/firestore-crm"
import { getEmailSignups } from "@/lib/firestore-email-signups"

export const runtime = "nodejs"
export const maxDuration = 120

const DIGESTS_COLLECTION = "weekly_digests"
const GA4_SNAPSHOTS = "analytics_snapshots_ga4"
const MC_SNAPSHOTS = "analytics_snapshots_mailchimp"
const IG_SNAPSHOTS = "analytics_snapshots_instagram"

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split("T")[0]
}

async function latestSnapshotsThisWeek(collection: string, since: string) {
  const db = getDb()
  const snap = await db
    .collection(collection)
    .where("snapshotDate", ">=", since)
    .get()
  return snap.docs.map((d) => d.data())
}

export async function GET(request: NextRequest) {
  return runCronJob("weekly-digest", request, async () => {
    const since = isoDaysAgo(7)
    const generatedAt = new Date().toISOString()
    const weekId = isoDaysAgo(0)

    const [clients, opportunities, ga4, mailchimp, instagram, recentSignups] = await Promise.all([
      getClients(),
      getOpportunities(),
      latestSnapshotsThisWeek(GA4_SNAPSHOTS, since),
      latestSnapshotsThisWeek(MC_SNAPSHOTS, since),
      latestSnapshotsThisWeek(IG_SNAPSHOTS, since),
      getEmailSignups({ startDate: since }).catch(() => [] as unknown[]),
    ])

    const newClients = clients.filter((c) => c.created_at && c.created_at >= since)
    const movedDeals = opportunities.filter(
      (o) => o.updated_at && o.updated_at >= since,
    )
    const wonDeals = opportunities.filter(
      (o) => o.stage === "closed_won" && o.actual_close_date && o.actual_close_date >= since,
    )
    const wonValue = wonDeals.reduce((sum, o) => sum + (o.value ?? 0), 0)
    const openPipelineValue = opportunities
      .filter((o) => o.stage !== "closed_won" && o.stage !== "closed_lost")
      .reduce((sum, o) => sum + (o.value ?? 0), 0)

    const ga4Totals = ga4.reduce(
      (acc, snap) => {
        const summary = (snap as any)?.range7d?.summary
        if (summary) {
          acc.pageViews += summary.totalPageViews ?? 0
          acc.sessions += summary.totalSessions ?? 0
          acc.users += summary.totalUsers ?? 0
        }
        return acc
      },
      { pageViews: 0, sessions: 0, users: 0 },
    )

    const mcTotals = mailchimp.reduce(
      (acc, snap) => {
        const summary = (snap as any)?.range30d?.summary
        if (summary) {
          acc.subscribers += summary.totalSubscribers ?? 0
          acc.opens += summary.totalOpens ?? 0
          acc.clicks += summary.totalClicks ?? 0
        }
        return acc
      },
      { subscribers: 0, opens: 0, clicks: 0 },
    )

    const igTotals = instagram.reduce(
      (acc, snap) => {
        const profile = (snap as any)?.profile
        const recentMedia = (snap as any)?.recentMedia ?? []
        if (profile) {
          acc.followers += profile.followers_count ?? 0
        }
        acc.recentPosts += recentMedia.length
        return acc
      },
      { followers: 0, recentPosts: 0 },
    )

    const digest = {
      weekId,
      since,
      generatedAt,
      crm: {
        totalClients: clients.length,
        newClientsThisWeek: newClients.length,
        movedDealsThisWeek: movedDeals.length,
        wonDealsThisWeek: wonDeals.length,
        wonValueThisWeek: wonValue,
        openPipelineValue,
      },
      web: ga4Totals,
      email: {
        ...mcTotals,
        newSignupsThisWeek: Array.isArray(recentSignups) ? recentSignups.length : 0,
      },
      social: igTotals,
    }

    const db = getDb()
    await db.collection(DIGESTS_COLLECTION).doc(weekId).set(digest)

    return {
      message: `Weekly digest written: ${newClients.length} new clients, ${wonDeals.length} deals won ($${wonValue.toLocaleString()}), ${ga4Totals.users} web users`,
      detail: digest,
    }
  })
}
