/**
 * Today, the front door's daily brief, slice 1 (lib/agent/today.ts, V1 item 4): which lines show, what they say, where
 * they link, and the guardrail of at most three lines. Pure; nothing is read or stored.
 * Run: tsx --test lib/__tests__/today.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { costSince, todayBrief, type TodayInput } from "../agent/today"
import { QUEUES } from "../queue-age"

const NOW = "2026-11-17T14:00:00.000Z"
const HOUR = 3_600_000
const ago = (h: number) => new Date(Date.parse(NOW) - h * HOUR).toISOString()
const quiet: TodayInput = {
  now: NOW,
  overdue: [],
  missed: [],
  unreadable: [],
  runs: { byState: {}, failures: [] },
  costs: { totalUsd: 0, byDay: [], byProperty: [], byTask: [] },
  cost24hUsd: 0,
}

test("a quiet day is all clear, with no lines", () => {
  const t = todayBrief(quiet)
  assert.equal(t.allClear, true)
  assert.deepEqual(t.lines, [])
  assert.equal(t.at, NOW)
})

test("queues past their limit make one line, longest wait first, linking where that queue is worked", () => {
  const t = todayBrief({
    ...quiet,
    overdue: [
      { queue: "content-pipeline-drafts", what: "", waiting: 1, oldestAt: ago(7), ageHours: 7, limitHours: 6, truncated: false },
      { queue: "agent-review", what: "", waiting: 2, oldestAt: ago(31), ageHours: 31, limitHours: 24, truncated: false },
    ],
  })
  assert.equal(t.allClear, false)
  assert.equal(t.lines.length, 1)
  const [late] = t.lines
  assert.equal(late.title, "Past its limit")
  assert.equal(late.detail, "Agent drafts: 2, oldest 31 h (limit 24 h). Content drafts: 1, oldest 7 h (limit 6 h).")
  assert.equal(late.href, "/admin/todo")
})

test("every watched queue has a short name and a place to open", () => {
  for (const q of QUEUES) {
    const t = todayBrief({ ...quiet, overdue: [{ queue: q.name, what: q.what, waiting: 1, oldestAt: ago(100), ageHours: 100, limitHours: 1, truncated: false }] })
    assert.ok(!t.lines[0].detail.startsWith(q.name), `${q.name} has no short name`)
    assert.match(t.lines[0].href, /^\/admin\//)
  }
})

test("failed runs in the last 24 hours, missed jobs and unreadable queues make one 'Needs a check' line", () => {
  const t = todayBrief({
    ...quiet,
    runs: { byState: {}, failures: [
      { taskId: "a", state: "failed", at: ago(2) },
      { taskId: "b", state: "failed", at: ago(30) }, // older than a day: not today's
    ] },
    missed: [{ job: "story-list", schedule: "0 12 * * *", dueAt: ago(2), lastFiredAt: ago(26) }],
  })
  assert.equal(t.allClear, false)
  assert.deepEqual(t.lines.map((l) => l.key), ["check"])
  assert.equal(t.lines[0].detail, "1 agent run failed or needs a check in the last 24 h. story-list did not run when due.")
  assert.equal(t.lines[0].href, "/admin/agents")
})

test("a failure older than a day alone leaves the day all clear", () => {
  const t = todayBrief({ ...quiet, runs: { byState: {}, failures: [{ taskId: "b", state: "failed", at: ago(30) }] } })
  assert.equal(t.allClear, true)
})

test("model cost shows when there is any, and does not end 'all clear'", () => {
  const t = todayBrief({
    ...quiet,
    costs: { totalUsd: 2.87, byDay: [], byProperty: [], byTask: [{ key: "intake", usd: 1.9, calls: 12 }] },
    cost24hUsd: 0.4123,
  })
  assert.equal(t.allClear, true)
  assert.deepEqual(t.lines.map((l) => l.key), ["cost"])
  assert.equal(t.lines[0].detail, "Last 24 h $0.41 · last 7 days $2.87 · top task: intake $1.90")
})

test("guardrail: never more than three lines", () => {
  const t = todayBrief({
    ...quiet,
    overdue: [{ queue: "agent-tasks-queued", what: "", waiting: 1, oldestAt: ago(3), ageHours: 3, limitHours: 1, truncated: true }],
    missed: [{ job: "a", schedule: "* * * * *", dueAt: ago(1), lastFiredAt: null }, { job: "b", schedule: "* * * * *", dueAt: ago(1), lastFiredAt: null }],
    unreadable: ["x: boom"],
    costs: { totalUsd: 1, byDay: [], byProperty: [], byTask: [] },
    cost24hUsd: 1,
  })
  assert.deepEqual(t.lines.map((l) => l.key), ["late", "check", "cost"])
  assert.match(t.lines[0].detail, /Agent tasks not started: 1\+/)
  assert.equal(t.lines[1].detail, "2 scheduled jobs did not run when due (a, b). 1 queue could not be read.")
})

test("costSince counts only the window before now", () => {
  const records = [{ at: ago(1), usd: 0.25 }, { at: ago(23), usd: 0.5 }, { at: ago(25), usd: 9 }, { at: ago(2), usd: Number.NaN }]
  assert.equal(costSince(records, NOW), 0.75)
})

test("the Today card stays founder only and stores nothing", () => {
  const route = readFileSync(join(__dirname, "../../app/api/admin/review/route.ts"), "utf8")
  assert.match(route, /requireFounder\("GET \/api\/admin\/review"\)/)
  const today = readFileSync(join(__dirname, "../agent/today.ts"), "utf8")
  assert.doesNotMatch(today, /firebase|getDb|\.set\(|\.add\(|fetch\(/)
})
