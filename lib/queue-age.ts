/**
 * Queue-age alerts (434 build sequence V1 item 2, Foundation A: "Heartbeat and queue-age alerts on the founder channel,
 * extending the never-fires alert"). The never-fires alert (lib/cron-watchdog.ts) catches a job that does not start;
 * this catches work that started and then sits: the oldest item waiting in a queue, past that queue's limit.
 *
 * Pure: the queue list and the decision. The watchdog route reads Firestore and alerts on the founder channel.
 *
 * Each queue is read as `where(field == value).limit(LIMIT)` and aged in code, so no composite index is needed. A queue
 * holding more than LIMIT waiting items is reported as such, which is its own alarm.
 */

export interface QueueSpec {
  name: string
  /** What waiting in it means, for the alert. */
  what: string
  collection: string
  where: { field: string; equals: string | boolean }
  /** The field holding the time the item started waiting: an ISO string or a Firestore Timestamp. */
  ageField: string
  limitMs: number
}

const HOUR = 60 * 60_000

export const QUEUES: QueueSpec[] = [
  {
    // Build plan v3 R11: "The 24-hour review target becomes a console metric." Until the console (V1 item 4), the
    // alert carries it.
    name: "founder-review",
    what: "content posts waiting for approval in the founder-review queue",
    collection: "crm_content_posts",
    where: { field: "status", equals: "needs_approval" },
    ageField: "updated_at",
    limitMs: 24 * HOUR,
  },
  {
    // A job the content pipeline has not finished researching. The pipeline runs every minute; a job due for six
    // hours is stuck, whatever its lease says.
    name: "content-pipeline-jobs",
    what: "content-pipeline requests not yet researched",
    collection: "content_pipeline_jobs",
    where: { field: "due", equals: true },
    ageField: "createdAt",
    limitMs: 6 * HOUR,
  },
  {
    name: "content-pipeline-drafts",
    what: "content-pipeline drafts not yet through writing, media and design",
    collection: "content_pipeline_drafts",
    where: { field: "due", equals: true },
    ageField: "createdAt",
    limitMs: 6 * HOUR,
  },
]

export const QUEUE_READ_LIMIT = 200

export interface QueueReading { queue: QueueSpec; waiting: number; oldestAt: string | null; truncated: boolean }
export interface QueueAlert { queue: string; what: string; waiting: number; oldestAt: string; ageHours: number; limitHours: number; truncated: boolean }

/** An ISO string, a Firestore Timestamp, or a Date, as milliseconds; null when it is none of them. */
export function timeOf(v: unknown): number | null {
  if (typeof v === "string") { const t = Date.parse(v); return Number.isFinite(t) ? t : null }
  if (v instanceof Date) return v.getTime()
  const ts = v as { toMillis?: () => number; seconds?: number; _seconds?: number } | null
  if (ts && typeof ts.toMillis === "function") return ts.toMillis()
  const s = ts?.seconds ?? ts?._seconds
  return typeof s === "number" ? s * 1000 : null
}

/** The oldest waiting time among a queue's items; items with no readable time are counted but not aged. */
export function readQueue(queue: QueueSpec, items: Record<string, unknown>[]): QueueReading {
  let oldest: number | null = null
  for (const it of items) {
    const t = timeOf(it[queue.ageField])
    if (t !== null && (oldest === null || t < oldest)) oldest = t
  }
  return { queue, waiting: items.length, oldestAt: oldest === null ? null : new Date(oldest).toISOString(), truncated: items.length >= QUEUE_READ_LIMIT }
}

/** Queues whose oldest item has waited past the queue's limit. */
export function overdueQueues(readings: QueueReading[], now: Date): QueueAlert[] {
  const out: QueueAlert[] = []
  for (const r of readings) {
    if (!r.oldestAt) continue
    const age = now.getTime() - Date.parse(r.oldestAt)
    if (age <= r.queue.limitMs) continue
    out.push({ queue: r.queue.name, what: r.queue.what, waiting: r.waiting, oldestAt: r.oldestAt, ageHours: Math.round(age / HOUR * 10) / 10, limitHours: r.queue.limitMs / HOUR, truncated: r.truncated })
  }
  return out
}

/**
 * The daily heartbeat: once a day the watchdog writes to the founder channel even when nothing is wrong, so a broken
 * alert path (the sender, the address, the watchdog itself) shows as a missing message rather than as silence that
 * looks like health. It goes on the first watchdog run at or after HEARTBEAT_HOUR_UTC.
 */
export const HEARTBEAT_HOUR_UTC = 13

/** Whether this watchdog run sends the day's heartbeat: the first run at or after the hour, not yet sent today. */
export function heartbeatDue(now: Date, lastSentAt: string | null): boolean {
  if (now.getUTCHours() < HEARTBEAT_HOUR_UTC) return false
  return !lastSentAt || lastSentAt.slice(0, 10) !== now.toISOString().slice(0, 10)
}
