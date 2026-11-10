/**
 * The cron watchdog (434 build sequence V1 item 2: "an alert for an automatic job that never fires"; checklist §11, "A
 * cron run that never fires raises no alert"). A failed run already leaves a record (lib/cron-auth.ts, cron_runs); a run
 * that never starts leaves nothing, and nothing reads an absence. So every cron marks a heartbeat when it fires
 * (lib/cron-heartbeat.ts), and the watchdog compares each schedule in vercel.json, the one list of them, with the
 * jobs' heartbeats.
 *
 * Pure: schedules, due times and the decision. The route (app/api/cron/cron-watchdog) reads and alerts.
 */

/** One cron from vercel.json. */
export interface CronEntry { path: string; schedule: string }
export interface Heartbeat { job: string; lastFiredAt: string; firstFiredAt?: string }
export interface Missed { job: string; schedule: string; dueAt: string; lastFiredAt: string | null }

/** `/api/cron/feed-publish` → `feed-publish`, the name runCronJob records under. */
export const jobOf = (path: string) => path.replace(/^\/api\/cron\//, "").replace(/\/+$/, "")

type Field = (n: number) => boolean
const RANGES: [number, number][] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]

/**
 * A five-field cron expression (minute hour day-of-month month day-of-week, UTC, as Vercel runs them) as a matcher.
 * Supports `*`, `*\/n`, `a`, `a-b`, `a-b/n` and comma lists, which is all vercel.json uses; anything else throws, so a
 * schedule the watchdog cannot read is reported rather than skipped.
 */
export function parseCron(expr: string): (d: Date) => boolean {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`cron "${expr}": expected 5 fields`)
  const fields: Field[] = parts.map((p, i) => {
    const [lo, hi] = RANGES[i]
    const tests = p.split(",").map((term) => {
      const m = /^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/.exec(term)
      if (!m) throw new Error(`cron "${expr}": cannot read "${term}"`)
      const from = m[1] === "*" ? lo : Number(m[2])
      const to = m[1] === "*" ? hi : m[3] !== undefined ? Number(m[3]) : m[4] ? hi : from
      const step = m[4] ? Number(m[4]) : 1
      if (from < lo || to > hi || from > to || step < 1) throw new Error(`cron "${expr}": "${term}" is out of range`)
      return (n: number) => n >= from && n <= to && (n - from) % step === 0
    })
    return (n: number) => tests.some((t) => t(n))
  })
  const [min, hour, dom, mon, dow] = fields
  const domAny = parts[2] === "*", dowAny = parts[4] === "*"
  return (d: Date) => {
    if (!min(d.getUTCMinutes()) || !hour(d.getUTCHours()) || !mon(d.getUTCMonth() + 1)) return false
    const w = d.getUTCDay()
    const dayOk = dow(w) || (w === 0 && dow(7))
    // Standard cron: when both day fields are restricted, either may match.
    if (domAny && dowAny) return true
    if (domAny) return dayOk
    if (dowAny) return dom(d.getUTCDate())
    return dom(d.getUTCDate()) || dayOk
  }
}

/** The latest minute at or before `at` that the schedule fires on, searching back up to 31 days; null if none. */
export function lastDue(expr: string, at: Date): Date | null {
  const matches = parseCron(expr)
  const t = new Date(Math.floor(at.getTime() / 60_000) * 60_000)
  for (let i = 0; i < 31 * 24 * 60; i++, t.setTime(t.getTime() - 60_000)) if (matches(t)) return new Date(t)
  return null
}

/** The gap between two consecutive due times ending at `due`: how often the job runs. */
function interval(expr: string, due: Date): number {
  const before = lastDue(expr, new Date(due.getTime() - 60_000))
  return before ? due.getTime() - before.getTime() : 31 * 24 * 60 * 60_000
}

/**
 * Slack given before a due time counts as missed: Vercel may start a cron a little late, and on some plans anywhere
 * within its hour. A job that runs every few minutes gets 15 minutes; an hourly or slower one 75.
 */
export function graceMs(expr: string, due: Date): number {
  return interval(expr, due) < 60 * 60_000 ? 15 * 60_000 : 75 * 60_000
}

/**
 * The jobs that should have fired and did not. For each cron: its latest due time that is past its grace; missed when
 * the job has not fired since then (a minute's tolerance for clock skew). A job with no heartbeat counts as missed only
 * once the watchdog has been watching since before that due time, so a new deploy does not report weekly jobs that
 * simply have not come round yet.
 *
 * `newSince`: report only slots that became overdue after this time, so an hourly watchdog alerts once for a missed
 * daily run rather than every hour; a job due every few minutes is newly overdue at each check, so its alert repeats
 * hourly while it stays down.
 */
export function missedCrons(crons: CronEntry[], heartbeats: Map<string, Heartbeat>, watchingSince: Date | null, now: Date, newSince?: Date): Missed[] {
  const out: Missed[] = []
  for (const c of crons) {
    const job = jobOf(c.path)
    if (job === "cron-watchdog") continue
    // The latest due time whose grace has run out.
    let due = lastDue(c.schedule, now)
    while (due && now.getTime() - due.getTime() < graceMs(c.schedule, due)) due = lastDue(c.schedule, new Date(due.getTime() - 60_000))
    if (!due) continue
    const overdueAt = new Date(due.getTime() + graceMs(c.schedule, due))
    if (newSince && overdueAt <= newSince) continue
    const hb = heartbeats.get(job)
    if (hb) {
      if (new Date(hb.lastFiredAt).getTime() >= due.getTime() - 60_000) continue
    } else if (!watchingSince || watchingSince.getTime() > due.getTime()) {
      continue
    }
    out.push({ job, schedule: c.schedule, dueAt: due.toISOString(), lastFiredAt: hb?.lastFiredAt ?? null })
  }
  return out
}
