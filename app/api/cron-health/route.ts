import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** The watchdog is due hourly; two missed checks plus slack is stale. */
const STALE_MS = 2 * 60 * 60_000 + 15 * 60_000

/**
 * GET /api/cron-health: whether the cron watchdog (app/api/cron/cron-watchdog) itself fired recently. Public and
 * read-only, so a GitHub Actions schedule can watch the watchdog with no secret (.github/workflows/cron-watchdog.yml);
 * it says only that, and when, since the crons it watches are already public in vercel.json. One document read, cached
 * at the edge for five minutes so repeated requests cost nothing. 503 when stale or unreadable, so the watcher fails.
 */
export async function GET() {
  const headers = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" }
  try {
    const { getDb } = await import("@/lib/firebase-admin")
    const { CRON_HEARTBEATS_COLLECTION } = await import("@/lib/cron-heartbeat")
    const snap = await getDb().collection(CRON_HEARTBEATS_COLLECTION).doc("cron-watchdog").get()
    const last = snap.exists ? (snap.data()?.lastFiredAt as string | undefined) : undefined
    const ok = !!last && Date.now() - new Date(last).getTime() < STALE_MS
    return NextResponse.json({ ok, watchdogLastFiredAt: last ?? null }, { status: ok ? 200 : 503, headers })
  } catch (error) {
    console.error("[GET /api/cron-health]", error)
    return NextResponse.json({ ok: false, error: "heartbeat unreadable" }, { status: 503, headers })
  }
}
