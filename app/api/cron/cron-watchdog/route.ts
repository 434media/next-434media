import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { CRON_HEARTBEATS_COLLECTION, readCronHeartbeats } from "@/lib/cron-heartbeat"
import { ALERT_EMAIL_ENV, alertRecipients, alertSubject, missedCrons, type CronEntry, type Missed } from "@/lib/cron-watchdog"
import { getDb } from "@/lib/firebase-admin"
import { founderEmails } from "@/lib/founder-guard"
import { QUEUES, QUEUE_READ_LIMIT, heartbeatDue, overdueQueues, readQueue, type QueueAlert, type QueueReading } from "@/lib/queue-age"
import { DEFAULT_FROM, assertVerifiedSender, getResend } from "@/lib/resend"
import vercelConfig from "@/vercel.json"

export const runtime = "nodejs"
export const maxDuration = 60

/** The watchdog runs hourly; a slot that became overdue within the last check window is reported once. */
const CHECK_WINDOW_MS = 60 * 60_000
/** An overdue queue is reported again at most once a day while it stays overdue. */
const QUEUE_REPEAT_MS = 24 * 60 * 60_000
/** The watchdog's own state: when it last sent the heartbeat, and when it last reported each queue. */
const STATE_DOC = { collection: "watchdog_state", id: "founder-channel" }

/**
 * GET /api/cron/cron-watchdog (hourly, vercel.json). Three checks, one alert email to ADMIN_ALERT_EMAIL, or, when that
 * holds no address, to the founder channel (ADMIN_FOUNDER_EMAIL, the Intake SOP's founder channel). Every subject starts
 * "[434 alert]" so the alerts can be filtered:
 *  - **never fired:** the crons that should have fired and did not (lib/cron-watchdog.ts);
 *  - **queue age:** work waiting past its queue's limit (lib/queue-age.ts), each queue reported at most once a day;
 *  - **heartbeat:** once a day, after 13:00 UTC, a short all-clear even when nothing is wrong, so a broken alert path
 *    shows as a missing email rather than as silence.
 * Its own run is recorded in cron_runs like any job, and its own heartbeat is what /api/cron-health reports, so the
 * watchdog is watched too (a GitHub Actions schedule).
 */
export async function GET(request: NextRequest) {
  return runCronJob("cron-watchdog", request, async () => {
    const now = new Date()
    const db = getDb()
    const crons = (vercelConfig as { crons?: CronEntry[] }).crons ?? []
    const heartbeats = await readCronHeartbeats()
    const self = heartbeats.get("cron-watchdog")
    const watchingSince = self?.firstFiredAt ? new Date(self.firstFiredAt) : null
    const missed = missedCrons(crons, heartbeats, watchingSince, now, new Date(now.getTime() - CHECK_WINDOW_MS))

    const readings: QueueReading[] = []
    const unreadable: string[] = []
    for (const q of QUEUES) {
      try {
        const snap = await db.collection(q.collection).where(q.where.field, "==", q.where.equals).limit(QUEUE_READ_LIMIT).get()
        readings.push(readQueue(q, snap.docs.map((d) => d.data())))
      } catch (e) {
        unreadable.push(`${q.name}: ${(e as Error).message}`)
      }
    }
    const stateRef = db.collection(STATE_DOC.collection).doc(STATE_DOC.id)
    const state = ((await stateRef.get()).data() ?? {}) as { heartbeatAt?: string; queueAlertedAt?: Record<string, string> }
    const alerted = state.queueAlertedAt ?? {}
    const overdue = overdueQueues(readings, now).filter((a) => !alerted[a.queue] || now.getTime() - Date.parse(alerted[a.queue]) >= QUEUE_REPEAT_MS)
    const sendHeartbeat = heartbeatDue(now, state.heartbeatAt ?? null)

    const detail = { crons: crons.length, heartbeats: heartbeats.size, watchingSince: watchingSince?.toISOString() ?? null, missed, queues: readings.map((r) => ({ queue: r.queue.name, waiting: r.waiting, oldestAt: r.oldestAt, truncated: r.truncated })), overdue, unreadable, heartbeat: sendHeartbeat }
    const problem = missed.length || overdue.length || unreadable.length
    if (!problem && !sendHeartbeat) return { message: `All ${crons.length} crons fired on schedule; no queue overdue`, detail }

    const to = alertRecipients(process.env, founderEmails)
    if (!to.length) return { status: "error" as const, message: `Something to report, and neither ${ALERT_EMAIL_ENV} nor ADMIN_FOUNDER_EMAIL holds an address to tell`, detail }
    assertVerifiedSender(DEFAULT_FROM)
    const { error } = await getResend().emails.send({ from: DEFAULT_FROM, to, subject: subject(missed, overdue, unreadable), text: body(missed, overdue, unreadable, readings, crons.length) })
    if (error) throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`)
    const at = now.toISOString()
    await stateRef.set({ ...(sendHeartbeat ? { heartbeatAt: at } : {}), queueAlertedAt: { ...alerted, ...Object.fromEntries(overdue.map((a) => [a.queue, at])) } }, { merge: true })
    // What is reported is the thing being watched, not a failure of this job: the run succeeded in telling someone.
    return { message: problem ? `Alerted: ${[...missed.map((m) => `${m.job} missed`), ...overdue.map((q) => `${q.queue} overdue`), ...unreadable.map(() => "a queue unreadable")].join(", ")}` : "Daily heartbeat sent", detail }
  })
}

function subject(missed: Missed[], overdue: QueueAlert[], unreadable: string[]): string {
  const parts: string[] = []
  if (missed.length) parts.push(missed.length === 1 ? `${missed[0].job} did not fire` : `${missed.length} crons did not fire`)
  if (overdue.length) parts.push(overdue.length === 1 ? `${overdue[0].queue} waiting ${overdue[0].ageHours}h` : `${overdue.length} queues overdue`)
  if (unreadable.length) parts.push(`${unreadable.length} queue(s) unreadable`)
  return alertSubject(parts.length ? `Watchdog: ${parts.join("; ")}` : "Watchdog: all clear (daily heartbeat)")
}

function body(missed: Missed[], overdue: QueueAlert[], unreadable: string[], readings: QueueReading[], cronCount: number): string {
  const lines: string[] = []
  if (missed.length) {
    lines.push("These automatic jobs were due and have not fired since:", "")
    lines.push(...missed.map((m) => `- ${m.job} (schedule "${m.schedule}", UTC): due ${m.dueAt}; last fired ${m.lastFiredAt ?? "never, since the watchdog began"}`))
    lines.push("", "A job that fires and fails is in cron_runs; one listed here did not start at all. Check the project's Cron Jobs", `settings in Vercel and the job's route. Heartbeats: Firestore ${CRON_HEARTBEATS_COLLECTION}.`, "")
  }
  if (overdue.length) {
    lines.push("Work waiting past its limit:", "")
    lines.push(...overdue.map((q) => `- ${q.queue}: ${q.waiting}${q.truncated ? "+" : ""} ${q.what}; the oldest has waited ${q.ageHours} h (limit ${q.limitHours} h), since ${q.oldestAt}`))
    lines.push("", "Each queue is reported again at most once a day while it stays overdue.", "")
  }
  if (unreadable.length) lines.push("Queues the watchdog could not read:", "", ...unreadable.map((u) => `- ${u}`), "")
  if (!missed.length && !overdue.length && !unreadable.length) {
    lines.push(`All clear. ${cronCount} crons are watched and none missed; queues now:`, "")
    lines.push(...readings.map((r) => `- ${r.queue.name}: ${r.waiting}${r.truncated ? "+" : ""} waiting${r.oldestAt ? `, oldest since ${r.oldestAt}` : ""}`))
    lines.push("", "This message comes once a day so that a broken alert path shows as a missing email.", "")
  }
  lines.push("Sent by the cron watchdog (app/api/cron/cron-watchdog), which checks every hour.")
  return lines.join("\n")
}
