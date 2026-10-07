import { type NextRequest, NextResponse } from "next/server"
import { Timestamp } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"

export const CRON_RUNS_COLLECTION = "cron_runs"

/** Run records expire 90 days after they start, through a Firestore TTL policy
 *  on `expireAt` (founder decision, 2026-10-07; 2b fix 11). */
export const CRON_RUN_RETENTION_DAYS = 90

export function cronRunExpireAt(startedAt: Date): Timestamp {
  return Timestamp.fromMillis(startedAt.getTime() + CRON_RUN_RETENTION_DAYS * 24 * 60 * 60 * 1000)
}

export interface CronRunRecord {
  job: string
  startedAt: string
  finishedAt: string
  durationMs: number
  status: "success" | "error" | "partial"
  message?: string
  detail?: Record<string, unknown>
  expireAt?: Timestamp
}

export function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    )
  }

  // Bearer only. The `?secret=` form put the secret in URLs and request logs;
  // a manual run sends the same header Vercel Cron does (2b fix 11).
  const header = request.headers.get("authorization") || ""
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

export async function recordCronRun(record: CronRunRecord): Promise<void> {
  try {
    const db = getDb()
    await db.collection(CRON_RUNS_COLLECTION).add({ ...record, expireAt: cronRunExpireAt(new Date(record.startedAt)) })
  } catch (error) {
    console.error(`[cron:${record.job}] Failed to write run record:`, error)
  }
}

export async function runCronJob<T>(
  job: string,
  request: NextRequest,
  // `status` lets a job report a partial or failed run it did not throw for;
  // anything but "success" returns HTTP 500, so Vercel marks the run failed.
  handler: () => Promise<{
    message: string
    detail?: Record<string, unknown>
    data?: T
    status?: "success" | "partial" | "error"
  }>,
): Promise<NextResponse> {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  const startedAt = new Date()
  console.log(`[cron:${job}] starting at ${startedAt.toISOString()}`)

  try {
    const result = await handler()
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()

    const status = result.status ?? "success"
    await recordCronRun({
      job,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      status,
      message: result.message,
      detail: result.detail,
    })

    if (status === "success") {
      console.log(`[cron:${job}] success in ${durationMs}ms — ${result.message}`)
    } else {
      console.error(`[cron:${job}] ${status} in ${durationMs}ms — ${result.message}`)
    }
    return NextResponse.json(
      {
        ok: status === "success",
        job,
        status,
        durationMs,
        message: result.message,
        detail: result.detail,
        data: result.data,
      },
      { status: status === "success" ? 200 : 500 },
    )
  } catch (error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const message = error instanceof Error ? error.message : String(error)

    await recordCronRun({
      job,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      status: "error",
      message,
    })

    console.error(`[cron:${job}] failed in ${durationMs}ms:`, error)
    return NextResponse.json(
      { ok: false, job, durationMs, error: message },
      { status: 500 },
    )
  }
}
