/**
 * Exam reports, kept (V1 item 4, the proof slice): the runner hands back the report after every case, the stored
 * document is compact and bounded, and a run left running past the time limit reads as timed out, keeping the cases it
 * finished. Invented data only; nothing is written.
 * Run: tsx --test lib/__tests__/exam-reports.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { recordedExecutor, type Recordings } from "../exam/executors"
import { reportMarkdown, runSuite, type ExamReport } from "../exam/runner"
import { loadSuite } from "../exam/suite"
import { OUTPUT_CHARS, RUN_LIMIT_MS, examRunState, reportDoc, startedReport, type ExamRunMeta } from "../agent/exam-reports"
import { PROTECTED_TARGETS } from "../engine/protected-config"

const BASELINE = join(__dirname, "..", "exam", "suites", "baseline")
const rec = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures/exam", name), "utf8")) as Recordings
const meta: ExamRunMeta = { id: "baseline-20261114T220000000Z-mock", suite: "baseline", skill: "exam-assistant", model: "mock", commit: "a".repeat(40), planned: 6, startedAt: "2026-11-14T22:00:00.000Z" }

const hasUndefined = (v: unknown): boolean =>
  v === undefined || (Array.isArray(v) ? v.some(hasUndefined) : v !== null && typeof v === "object" ? Object.values(v).some(hasUndefined) : false)

test("the runner hands back the report so far after every case, and a failing save stops nothing", async () => {
  const suite = await loadSuite(BASELINE)
  const seen: number[] = []
  const r = await runSuite(suite, recordedExecutor(rec("baseline-good.json")), {
    onCase: (partial) => {
      seen.push(partial.cases.length)
      if (partial.cases.length === 2) throw new Error("Firestore is down")
    },
  })
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6])
  assert.equal(r.cases.length, 6)
  assert.equal(r.totals.pass, 6)
})

test("the stored report is compact: markdown, one line per case, the answer cut, no undefined fields", async () => {
  const suite = await loadSuite(BASELINE)
  const r = await runSuite(suite, recordedExecutor(rec("baseline-good.json")))
  const long: ExamReport = { ...r, cases: r.cases.map((c, i) => (i === 0 ? { ...c, output: { ...c.output, text: "x".repeat(OUTPUT_CHARS + 50) } } : c)) }
  const done = reportDoc(meta, long, reportMarkdown(long), "done", "2026-11-14T22:05:00.000Z")
  assert.equal(done.status, "done")
  assert.equal(done.finishedAt, long.finishedAt)
  assert.equal(done.planned, 6)
  assert.equal(done.cases.length, 6)
  assert.equal(done.cases[0].output.length, OUTPUT_CHARS)
  assert.equal(done.cases[0].outputCut, true)
  assert.equal(done.cases[1].outputCut, false)
  assert.match(done.markdown, /6 pass, 0 fail of 6/)
  assert.equal(done.totals?.pass, 6)
  assert.ok(!hasUndefined(done), "Firestore refuses undefined values")
  assert.ok(!("toolCalls" in done.cases[0]), "tool calls are not stored")

  const running = reportDoc(meta, { ...r, cases: r.cases.slice(0, 2) }, "", "running", "2026-11-14T22:01:00.000Z")
  assert.equal(running.finishedAt, undefined)
  assert.equal(running.cases.length, 2)
  assert.ok(!hasUndefined(startedReport(meta)))
})

test("a run left running past the time limit reads as timed out; a finished or failed one reads as it is", () => {
  const start = Date.parse(meta.startedAt)
  assert.equal(examRunState({ status: "running", startedAt: meta.startedAt }, new Date(start + 60_000)), "running")
  assert.equal(examRunState({ status: "running", startedAt: meta.startedAt }, new Date(start + RUN_LIMIT_MS + 1)), "timed-out")
  assert.equal(examRunState({ status: "done", startedAt: meta.startedAt }, new Date(start + RUN_LIMIT_MS + 1)), "done")
  assert.equal(examRunState({ status: "failed", startedAt: meta.startedAt }, new Date(start + RUN_LIMIT_MS + 1)), "failed")
  assert.ok(RUN_LIMIT_MS > 800_000, "longer than the route's maxDuration")
})

test("a skill run never writes the exam reports; only the founder's exam route does", () => {
  assert.ok((PROTECTED_TARGETS as readonly string[]).includes("agent_exam_reports"))
  const route = readFileSync(join(__dirname, "..", "..", "app/api/admin/engine/exam/route.ts"), "utf8")
  assert.match(route, /export const maxDuration = 800/)
})
