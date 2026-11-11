/**
 * The cron watchdog's decision (lib/cron-watchdog.ts, V1 item 2): schedules, due times, grace, and which jobs missed.
 * Pure; the route's Firestore read and email are not exercised here.
 * Run: tsx --test lib/__tests__/cron-watchdog.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import vercelConfig from "../../vercel.json"
import { ALERT_SUBJECT_PREFIX, alertRecipients, alertSubject, graceMs, jobOf, lastDue, missedCrons, parseCron, type CronEntry, type Heartbeat } from "../cron-watchdog"

const at = (iso: string) => new Date(iso)
const beats = (...b: [string, string, string?][]) => new Map<string, Heartbeat>(b.map(([job, last, first]) => [job, { job, lastFiredAt: last, ...(first ? { firstFiredAt: first } : {}) }]))

test("every schedule in vercel.json parses, and the watchdog is one of them", () => {
  const crons = (vercelConfig as { crons: CronEntry[] }).crons
  for (const c of crons) assert.ok(lastDue(c.schedule, at("2026-11-10T12:00:00Z")), c.path)
  assert.ok(crons.some((c) => jobOf(c.path) === "cron-watchdog"))
  // Every cron route has a schedule, and no schedule names a route that runs nothing.
  assert.equal(new Set(crons.map((c) => jobOf(c.path))).size, crons.length)
})

test("parseCron: the forms vercel.json uses, in UTC, and refuses what it cannot read", () => {
  assert.ok(parseCron("*/15 * * * *")(at("2026-11-10T12:45:00Z")))
  assert.ok(!parseCron("*/15 * * * *")(at("2026-11-10T12:44:00Z")))
  assert.ok(parseCron("0 13 * * 1-5")(at("2026-11-13T13:00:00Z"))) // Friday
  assert.ok(!parseCron("0 13 * * 1-5")(at("2026-11-14T13:00:00Z"))) // Saturday
  assert.ok(parseCron("0 12 * * 1")(at("2026-11-09T12:00:00Z"))) // Monday
  assert.ok(parseCron("0 0 * * 7")(at("2026-11-15T00:00:00Z"))) // 7 is Sunday too
  assert.ok(parseCron("0 9,21 1 * *")(at("2026-12-01T21:00:00Z")))
  for (const bad of ["* * * *", "60 * * * *", "@daily", "0 9 * JAN *", "*/0 * * * *"]) assert.throws(() => parseCron(bad), bad)
})

test("lastDue and grace", () => {
  assert.equal(lastDue("0 8 * * *", at("2026-11-10T07:59:00Z"))?.toISOString(), "2026-11-09T08:00:00.000Z")
  assert.equal(lastDue("0 13 * * 1", at("2026-11-10T00:00:00Z"))?.toISOString(), "2026-11-09T13:00:00.000Z")
  assert.equal(lastDue("* * * * *", at("2026-11-10T07:59:42Z"))?.toISOString(), "2026-11-10T07:59:00.000Z")
  assert.equal(graceMs("* * * * *", at("2026-11-10T07:59:00Z")), 15 * 60_000)
  assert.equal(graceMs("0 * * * *", at("2026-11-10T07:00:00Z")), 75 * 60_000)
  assert.equal(graceMs("0 8 * * *", at("2026-11-10T08:00:00Z")), 75 * 60_000)
})

test("a daily job that fired is fine; one that did not is missed once its grace has passed", () => {
  const crons = [{ path: "/api/cron/ga4-snapshot", schedule: "0 8 * * *" }]
  const since = at("2026-11-01T00:00:00Z")
  // Fired at 08:02: fine all day.
  assert.deepEqual(missedCrons(crons, beats(["ga4-snapshot", "2026-11-10T08:02:00Z"]), since, at("2026-11-10T12:00:00Z")), [])
  // Last fired yesterday. Within grace (09:00) nothing is said; after it (09:30) it is missed.
  const stale = beats(["ga4-snapshot", "2026-11-09T08:01:00Z"])
  assert.deepEqual(missedCrons(crons, stale, since, at("2026-11-10T09:00:00Z")), [])
  const m = missedCrons(crons, stale, since, at("2026-11-10T09:30:00Z"))
  assert.deepEqual(m, [{ job: "ga4-snapshot", schedule: "0 8 * * *", dueAt: "2026-11-10T08:00:00.000Z", lastFiredAt: "2026-11-09T08:01:00Z" }])
})

test("an hourly watchdog reports a missed daily run once, and a stopped per-minute job every check", () => {
  const daily = [{ path: "/api/cron/ga4-snapshot", schedule: "0 8 * * *" }]
  const stale = beats(["ga4-snapshot", "2026-11-09T08:01:00Z"])
  const since = at("2026-11-01T00:00:00Z")
  const check = (iso: string) => missedCrons(daily, stale, since, at(iso), new Date(at(iso).getTime() - 3_600_000)).length
  assert.equal(check("2026-11-10T09:30:00Z"), 1) // overdue at 09:15: new in this hour
  assert.equal(check("2026-11-10T10:30:00Z"), 0) // the same miss: already told
  const minute = [{ path: "/api/cron/content-pipeline", schedule: "* * * * *" }]
  const dead = beats(["content-pipeline", "2026-11-10T06:00:00Z"])
  for (const iso of ["2026-11-10T09:30:00Z", "2026-11-10T10:30:00Z"]) assert.equal(missedCrons(minute, dead, since, at(iso), new Date(at(iso).getTime() - 3_600_000)).length, 1, iso)
})

test("a job with no heartbeat is missed only once the watchdog was watching before it was due", () => {
  const weekly = [{ path: "/api/cron/weekly-digest", schedule: "0 13 * * 1" }]
  // Watching since Tuesday: last Monday's slot predates it, so nothing is claimed.
  assert.deepEqual(missedCrons(weekly, beats(), at("2026-11-10T10:00:00Z"), at("2026-11-12T10:00:00Z")), [])
  // Watching since the week before: Monday's slot passed with no beat.
  assert.equal(missedCrons(weekly, beats(), at("2026-11-02T00:00:00Z"), at("2026-11-12T10:00:00Z"))[0]?.lastFiredAt, null)
  // Not yet watching at all: nothing is claimed.
  assert.deepEqual(missedCrons(weekly, beats(), null, at("2026-11-12T10:00:00Z")), [])
})

test("the watchdog does not report itself", () => {
  const crons = [{ path: "/api/cron/cron-watchdog", schedule: "30 * * * *" }]
  assert.deepEqual(missedCrons(crons, beats(), at("2026-01-01T00:00:00Z"), at("2026-11-10T12:00:00Z")), [])
})

test("alerts go to ADMIN_ALERT_EMAIL when it holds an address, and to the founder channel otherwise", () => {
  const founder = () => ["founder@example.com"]
  assert.deepEqual(alertRecipients({ ADMIN_ALERT_EMAIL: "Alerts@Example.com, ops@example.com" }, founder), ["alerts@example.com", "ops@example.com"])
  assert.deepEqual(alertRecipients({ ADMIN_ALERT_EMAIL: "alerts@example.com, not-an-address" }, founder), ["alerts@example.com"])
  assert.deepEqual(alertRecipients({}, founder), ["founder@example.com"])
  assert.deepEqual(alertRecipients({ ADMIN_ALERT_EMAIL: "  " }, founder), ["founder@example.com"])
  assert.deepEqual(alertRecipients({ ADMIN_ALERT_EMAIL: "nobody, still-nobody@" }, founder), ["founder@example.com"])
  assert.deepEqual(alertRecipients({}, () => []), [])
})

test("the alert address never changes who signs in as the founder", () => {
  // ADMIN_ALERT_EMAIL is read only for the watchdog's recipients; the founder list is the fallback, untouched.
  let asked = 0
  alertRecipients({ ADMIN_ALERT_EMAIL: "alerts@example.com" }, () => { asked++; return ["founder@example.com"] })
  assert.equal(asked, 0)
})

test("every watchdog subject starts with the alert prefix", () => {
  assert.equal(ALERT_SUBJECT_PREFIX, "[434 alert]")
  assert.equal(alertSubject("Watchdog: all clear (daily heartbeat)"), "[434 alert] Watchdog: all clear (daily heartbeat)")
  assert.ok(alertSubject("Watchdog: feed-publish did not fire").startsWith("[434 alert] "))
})
