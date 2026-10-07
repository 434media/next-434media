import { type NextRequest } from "next/server"
import { CRON_RUNS_COLLECTION, cronRunExpireAt, runCronJob } from "@/lib/cron-auth"
import { getDb } from "@/lib/firebase-admin"

export const runtime = "nodejs"
export const maxDuration = 300

// GET /api/cron/cron-runs-ttl-backfill — one-off, NOT scheduled in vercel.json.
// Gives every cron_runs record that predates `expireAt` the same rule new ones
// get: expireAt = its own start + 90 days, so the Firestore TTL policy on
// cron_runs.expireAt removes old and new records under one rule (founder
// decision, 2026-10-07; 2b fix 11). Writes no other field and deletes nothing.
// Idempotent: records that already have expireAt are left alone. Pages through
// the collection by document id and stops before the time limit; if `done` is
// false, call again with `?after=<lastId>` from the response.
export async function GET(req: NextRequest) {
  return runCronJob("cron-runs-ttl-backfill", req, async () => {
    const db = getDb()
    const col = db.collection(CRON_RUNS_COLLECTION)
    const deadline = Date.now() + 240_000
    const now = Date.now()
    let after = req.nextUrl.searchParams.get("after") || undefined
    let scanned = 0
    let backfilled = 0
    let alreadyHad = 0
    let pastRetention = 0
    let invalidStart = 0
    let done = false

    while (Date.now() < deadline) {
      let q = col.orderBy("__name__").limit(500)
      if (after) q = q.startAfter(after)
      const snap = await q.get()
      if (snap.empty) {
        done = true
        break
      }
      const batch = db.batch()
      let writes = 0
      for (const doc of snap.docs) {
        scanned++
        const data = doc.data()
        if (data.expireAt) {
          alreadyHad++
          continue
        }
        const parsed = typeof data.startedAt === "string" ? Date.parse(data.startedAt) : NaN
        const start = Number.isFinite(parsed) ? new Date(parsed) : doc.createTime.toDate()
        if (!Number.isFinite(parsed)) invalidStart++
        const expireAt = cronRunExpireAt(start)
        if (expireAt.toMillis() <= now) pastRetention++
        batch.update(doc.ref, { expireAt })
        writes++
      }
      if (writes) await batch.commit()
      backfilled += writes
      after = snap.docs[snap.docs.length - 1].id
      if (snap.size < 500) {
        done = true
        break
      }
    }

    return {
      message: `cron_runs TTL backfill: ${backfilled} backfilled · ${alreadyHad} already had expireAt · ${pastRetention} already past 90 days · ${done ? "done" : "more to do"}`,
      detail: { scanned, backfilled, alreadyHad, pastRetention, invalidStart, done, lastId: after ?? null },
    }
  })
}
