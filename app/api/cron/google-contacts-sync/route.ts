import { type NextRequest } from "next/server"
import { runCronJob } from "@/lib/cron-auth"
import { runSyncNow } from "@/lib/google-contacts/server"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * The Google Contacts sync, every 15 minutes: continues the one-time import, then reads changes with the sync token.
 * Writes to Google only when the founder has switched write-back on. Before the founder connects, a run only notes
 * that it is not connected.
 */
export async function GET(request: NextRequest) {
  return runCronJob("google-contacts-sync", request, async () => {
    const out = await runSyncNow()
    if (out.state === "ok") {
      const r = out.result
      return {
        message: `${r.phase}: ${r.imported} imported, ${r.linked} linked, ${r.updated} updated, ${r.arrivals} new arrivals, ${r.written} written`,
        detail: { ...r },
        status: r.errors.length ? "partial" : "success",
      }
    }
    // Not configured or not connected yet is not a failure; a reconnect or an error is.
    const failed = out.state === "error" || out.state === "reconnect"
    return { message: `google-contacts-sync: ${out.state}`, status: failed ? "error" : "success" }
  })
}
