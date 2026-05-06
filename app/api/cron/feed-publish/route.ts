import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { getFeedItems, updateFeedItem } from "@/lib/firestore-feed"

export const runtime = "nodejs"
export const maxDuration = 60

const FEED_TABLE = "THEFEED"

/**
 * Promote scheduled feed items whose scheduled_at has arrived.
 *
 * Status flow: an editor sets status=scheduled and picks a scheduled_at in
 * the future. This cron runs frequently (every 5 minutes by Vercel cron) and
 * flips any scheduled items whose time has passed to status=published.
 *
 * Failure of one item never blocks the others — each promotion is wrapped in
 * its own try/catch so a single bad doc can't poison the run.
 */
export async function GET(request: NextRequest) {
  return runCronJob("feed-publish", request, async () => {
    const items = await getFeedItems({ tableName: FEED_TABLE })
    const now = Date.now()

    const due = items.filter((item) => {
      if (item.status !== "scheduled") return false
      if (!item.scheduled_at) return false
      const t = new Date(item.scheduled_at).getTime()
      if (!Number.isFinite(t)) return false
      return t <= now
    })

    let promoted = 0
    const failures: Array<{ id: string; error: string }> = []

    for (const item of due) {
      if (!item.id) continue
      try {
        await updateFeedItem(item.id, { status: "published" }, FEED_TABLE)
        promoted += 1
        console.log(`[cron:feed-publish] promoted ${item.id} (${item.title})`)
      } catch (err) {
        failures.push({
          id: item.id,
          error: err instanceof Error ? err.message : String(err),
        })
        console.error(`[cron:feed-publish] failed to promote ${item.id}:`, err)
      }
    }

    return {
      message: `Promoted ${promoted}/${due.length} scheduled feed item${due.length === 1 ? "" : "s"}`,
      detail: {
        scanned: items.length,
        scheduled: items.filter((i) => i.status === "scheduled").length,
        due: due.length,
        promoted,
        failures: failures.length,
        failureDetail: failures,
      },
    }
  })
}
