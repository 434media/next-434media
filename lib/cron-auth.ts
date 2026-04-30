import { type NextRequest, NextResponse } from "next/server"
import { getDb } from "./firebase-admin"

export const CRON_RUNS_COLLECTION = "cron_runs"

export interface CronRunRecord {
  job: string
  startedAt: string
  finishedAt: string
  durationMs: number
  status: "success" | "error" | "partial"
  message?: string
  detail?: Record<string, unknown>
}

export function authorizeCronRequest(request: NextRequest): NextResponse | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    )
  }

  const header = request.headers.get("authorization") || ""
  const isVercelCron = header === `Bearer ${expected}`

  const url = new URL(request.url)
  const querySecret = url.searchParams.get("secret")
  const isManualRun = querySecret === expected

  if (!isVercelCron && !isManualRun) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

export async function recordCronRun(record: CronRunRecord): Promise<void> {
  try {
    const db = getDb()
    await db.collection(CRON_RUNS_COLLECTION).add(record)
  } catch (error) {
    console.error(`[cron:${record.job}] Failed to write run record:`, error)
  }
}

export async function runCronJob<T>(
  job: string,
  request: NextRequest,
  handler: () => Promise<{ message: string; detail?: Record<string, unknown>; data?: T }>,
): Promise<NextResponse> {
  const unauthorized = authorizeCronRequest(request)
  if (unauthorized) return unauthorized

  const startedAt = new Date()
  console.log(`[cron:${job}] starting at ${startedAt.toISOString()}`)

  try {
    const result = await handler()
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()

    await recordCronRun({
      job,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      status: "success",
      message: result.message,
      detail: result.detail,
    })

    console.log(`[cron:${job}] success in ${durationMs}ms — ${result.message}`)
    return NextResponse.json({
      ok: true,
      job,
      durationMs,
      message: result.message,
      detail: result.detail,
      data: result.data,
    })
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
