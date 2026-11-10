import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { CRON_HEARTBEATS_COLLECTION, readCronHeartbeats } from "@/lib/cron-heartbeat"
import { missedCrons, type CronEntry, type Missed } from "@/lib/cron-watchdog"
import { founderEmails } from "@/lib/founder-guard"
import { DEFAULT_FROM, assertVerifiedSender, getResend } from "@/lib/resend"
import vercelConfig from "@/vercel.json"

export const runtime = "nodejs"
export const maxDuration = 60

/** The watchdog runs hourly; a slot that became overdue within the last check window is reported once. */
const CHECK_WINDOW_MS = 60 * 60_000

/**
 * GET /api/cron/cron-watchdog (hourly, vercel.json): finds the crons that should have fired and did not, and emails the
 * founder (ADMIN_FOUNDER_EMAIL) the list. Its own run, and how many it found, is recorded in cron_runs like any job, and
 * its own heartbeat is what /api/cron-health reports, so the watchdog is watched too (a GitHub Actions schedule).
 */
export async function GET(request: NextRequest) {
  return runCronJob("cron-watchdog", request, async () => {
    const now = new Date()
    const crons = (vercelConfig as { crons?: CronEntry[] }).crons ?? []
    const heartbeats = await readCronHeartbeats()
    const self = heartbeats.get("cron-watchdog")
    const watchingSince = self?.firstFiredAt ? new Date(self.firstFiredAt) : null
    const missed = missedCrons(crons, heartbeats, watchingSince, now, new Date(now.getTime() - CHECK_WINDOW_MS))
    const detail = { crons: crons.length, heartbeats: heartbeats.size, watchingSince: watchingSince?.toISOString() ?? null, missed }
    if (!missed.length) return { message: `All ${crons.length} crons fired on schedule`, detail }

    const to = founderEmails()
    if (!to.length) return { status: "error" as const, message: `${missed.length} cron(s) missed, and ADMIN_FOUNDER_EMAIL holds no address to tell`, detail }
    assertVerifiedSender(DEFAULT_FROM)
    const { error } = await getResend().emails.send({ from: DEFAULT_FROM, to, subject: subject(missed), text: body(missed) })
    if (error) throw new Error(`Resend send failed: ${error.message ?? JSON.stringify(error)}`)
    // A missed cron is the thing being reported, not a failure of this job: the run succeeded in telling someone.
    return { message: `Alerted: ${missed.map((m) => m.job).join(", ")} missed`, detail }
  })
}

function subject(missed: Missed[]): string {
  return missed.length === 1 ? `Cron missed: ${missed[0].job} did not fire` : `Crons missed: ${missed.length} jobs did not fire`
}

function body(missed: Missed[]): string {
  return [
    "These automatic jobs were due and have not fired since:",
    "",
    ...missed.map((m) => `- ${m.job} (schedule "${m.schedule}", UTC): due ${m.dueAt}; last fired ${m.lastFiredAt ?? "never, since the watchdog began"}`),
    "",
    "A job that fires and fails is in cron_runs; one listed here did not start at all. Check the project's Cron Jobs",
    `settings in Vercel and the job's route. Heartbeats: Firestore ${CRON_HEARTBEATS_COLLECTION}.`,
    "",
    "Sent by the cron watchdog (app/api/cron/cron-watchdog), which checks every hour.",
  ].join("\n")
}
