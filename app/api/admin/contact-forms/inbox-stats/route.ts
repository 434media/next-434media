import { NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getDb } from "@/lib/firebase-admin"
import { getContactForms } from "@/lib/firestore-contact-forms"

// GET /api/admin/contact-forms/inbox-stats
//
// Stage 5 — response-queue aggregates for the /admin/inbox header strip.
// Joins contact_forms (the source) with submission_states (sparse sidecar
// holding triaged/replied/archived/spam + updatedAt). Returns four numbers:
//
//   awaitingReply       count of submissions in state "new" or "triaged"
//   oldestAwaitingIso   created_at of the earliest awaiting-reply submission
//   repliedToday        count of state-changes to "replied" since today UTC
//   avgResponseTimeMs   mean (replied.updatedAt - submission.created_at) over
//                       the last 30 days; null when no data
//
// This is the only place that needs the joined view, so a dedicated endpoint
// is cleaner than expanding the existing /states GET — that hook is hot-path
// per-row state lookup and shouldn't carry aggregation responsibilities.

export const runtime = "nodejs"

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const RESPONSE_TIME_WINDOW_MS = 30 * ONE_DAY_MS

// 434media operates out of San Antonio — Central Time. Using America/Chicago
// (instead of server-local UTC) ensures "today" aligns with the rep's wall
// clock and rolls over at local midnight, not 6 PM CDT / 5 PM CST.
const REP_TIMEZONE = "America/Chicago"

function getTodayStartMsInTimezone(timeZone: string): number {
  const now = new Date()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  )
  // Some Intl impls return "24" for midnight; normalize to 0.
  const hour = (Number(parts.hour) || 0) % 24
  const minute = Number(parts.minute) || 0
  const second = Number(parts.second) || 0
  // Wall-clock elapsed since target-TZ midnight = the time since today started
  // in that TZ. Subtract from `now` to get midnight as a UTC ms.
  const elapsedMsToday = (hour * 3600 + minute * 60 + second) * 1000
  return now.getTime() - elapsedMsToday
}

interface InboxStats {
  awaitingReply: number
  oldestAwaitingIso: string | null
  repliedToday: number
  avgResponseTimeMs: number | null
  totalSubmissions: number
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const submissions = await getContactForms()

    // Pull every submission_state where source = contact_forms in one query.
    // Sidecar is sparse (no records for "new"), so this stays small.
    const db = getDb()
    const statesSnap = await db
      .collection("submission_states")
      .where("source", "==", "contact_forms")
      .get()

    const stateBySubmissionId = new Map<string, { state: string; updatedAt: string }>()
    for (const doc of statesSnap.docs) {
      const data = doc.data()
      if (data?.sourceId && data.state && data.updatedAt) {
        stateBySubmissionId.set(data.sourceId, {
          state: data.state as string,
          updatedAt: data.updatedAt as string,
        })
      }
    }

    // "Today" is anchored to America/Chicago (the 434media team's local TZ),
    // not server UTC. Rolls over at local midnight via wall-clock derivation.
    const todayStartMs = getTodayStartMsInTimezone(REP_TIMEZONE)
    const now = Date.now()
    const responseTimeCutoffMs = now - RESPONSE_TIME_WINDOW_MS

    let awaitingReply = 0
    let oldestAwaitingMs = Infinity
    let oldestAwaitingIso: string | null = null
    let repliedToday = 0
    let totalResponseTime = 0
    let responseTimeCount = 0

    for (const sub of submissions) {
      const stateRec = stateBySubmissionId.get(sub.id)
      const state = stateRec?.state ?? "new"

      if (state === "new" || state === "triaged") {
        awaitingReply++
        if (sub.created_at) {
          const subMs = new Date(sub.created_at).getTime()
          if (Number.isFinite(subMs) && subMs < oldestAwaitingMs) {
            oldestAwaitingMs = subMs
            oldestAwaitingIso = sub.created_at
          }
        }
      }

      if (state === "replied" && stateRec?.updatedAt) {
        const repliedMs = new Date(stateRec.updatedAt).getTime()
        if (Number.isFinite(repliedMs)) {
          if (repliedMs >= todayStartMs) {
            repliedToday++
          }
          // Average-response-time only counts replies in the last 30 days so
          // we don't drag the metric down with old archived records.
          if (repliedMs >= responseTimeCutoffMs && sub.created_at) {
            const subMs = new Date(sub.created_at).getTime()
            if (Number.isFinite(subMs) && repliedMs >= subMs) {
              totalResponseTime += repliedMs - subMs
              responseTimeCount++
            }
          }
        }
      }
    }

    const stats: InboxStats = {
      awaitingReply,
      oldestAwaitingIso,
      repliedToday,
      avgResponseTimeMs:
        responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : null,
      totalSubmissions: submissions.length,
    }

    return NextResponse.json({ success: true, stats })
  } catch (err) {
    console.error("[GET /api/admin/contact-forms/inbox-stats]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to compute inbox stats" },
      { status: 500 },
    )
  }
}
