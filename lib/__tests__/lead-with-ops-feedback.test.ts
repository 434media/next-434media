/**
 * Offline. The Lead with Ops feedback route: a "Yes, let's set up a call"
 * answer emails Carroll once, with the founder copied and Reply-To set to the
 * submitter; the other two answers send nothing; a failed send still returns
 * 200 because the row is already saved. BotID, Firestore and Resend are fakes.
 *
 * Run: tsx --test lib/__tests__/lead-with-ops-feedback.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { handleFeedbackPost, type FeedbackDeps } from "../lead-with-ops-feedback-handler"
import { CALL_REQUEST_FROM, type CallRequestMessage } from "../lead-with-ops-call-request"
import { assertVerifiedSender } from "../resend"
import { TALK_FURTHER_OPTIONS } from "../lead-with-ops-feedback"

const NOW = new Date("2026-10-24T15:30:00.000Z")

const body = (over: Record<string, unknown> = {}) => ({
  email: "Pat.Jones@Example.com ",
  name: "Pat Jones",
  company: "Example Holdings",
  sessionValue: 1,
  mostUseful: "The ops-first framing.\nMore examples next time.",
  talkFurther: TALK_FURTHER_OPTIONS[0],
  role: "VP / Director",
  industry: "Other",
  industryOther: "Hospitality",
  biggestQuestion: "Where to start <with> our data?",
  heardAbout: "Adam Carroll",
  ...over,
})

const request = (payload: unknown) =>
  new Request("https://www.434media.com/api/lead-with-ops/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://www.434media.com" },
    body: JSON.stringify(payload),
  })

function fakes(opts: { sendFails?: boolean; saveFails?: boolean } = {}) {
  const rows: Record<string, unknown>[] = []
  const sent: CallRequestMessage[] = []
  const deps: FeedbackDeps = {
    requireHuman: async () => ({ ok: true }),
    saveRow: async (row) => {
      if (opts.saveFails) throw new Error("firestore down")
      rows.push(row)
    },
    sendCallRequest: async (message) => {
      sent.push(message)
      if (opts.sendFails) throw new Error("resend 500")
    },
    now: () => NOW,
  }
  return { deps, rows, sent }
}

test("yes: saves the row, then sends one email to Adam, cc the founder, Reply-To the submitter", async () => {
  const { deps, rows, sent } = fakes()
  const res = await handleFeedbackPost(request(body()), deps)
  assert.equal(res.status, 200)
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].tags, ["event-feedback", "lead-with-ops-2026-06-18", "feedback-wants-call"])
  assert.equal(sent.length, 1)
  const m = sent[0]
  assert.deepEqual(m.to, ["adam@carrollstrategyoperations.com"])
  assert.deepEqual(m.cc, ["marcos@434media.com"])
  assert.equal(m.replyTo, "pat.jones@example.com")
  assert.equal(m.from, CALL_REQUEST_FROM)
  assert.doesNotThrow(() => assertVerifiedSender(m.from))
  assert.match(m.subject, /Pat Jones, Example Holdings/)
  for (const s of [
    "Name: Pat Jones",
    "Email: pat.jones@example.com",
    "Company: Example Holdings",
    "Role: VP / Director",
    "Industry: Other: Hospitality",
    "Submitted: Oct 24, 2026, 10:30 AM (Central)",
    "The ops-first framing.\nMore examples next time.",
    "Where to start <with> our data?",
  ]) {
    assert.ok(m.text.includes(s), `text has ${JSON.stringify(s)}`)
  }
  assert.ok(m.html.includes("Where to start &lt;with&gt; our data?"), "html escapes the answers")
  assert.ok(!m.html.includes("<with>"))
})

test("maybe and not now: the row is saved, no email", async () => {
  for (const talkFurther of TALK_FURTHER_OPTIONS.slice(1)) {
    const { deps, rows, sent } = fakes()
    const res = await handleFeedbackPost(request(body({ talkFurther })), deps)
    assert.equal(res.status, 200, talkFurther)
    assert.equal(rows.length, 1, talkFurther)
    assert.equal(sent.length, 0, talkFurther)
  }
})

test("a failed send still returns 200; the row is already saved", async () => {
  const { deps, rows, sent } = fakes({ sendFails: true })
  const res = await handleFeedbackPost(request(body()), deps)
  assert.equal(res.status, 200)
  assert.equal(rows.length, 1)
  assert.equal(sent.length, 1)
})

test("a failed save returns 503 and sends nothing", async () => {
  const { deps, sent } = fakes({ saveFails: true })
  const res = await handleFeedbackPost(request(body()), deps)
  assert.equal(res.status, 503)
  assert.equal(sent.length, 0)
})

test("an invalid submission saves and sends nothing", async () => {
  const { deps, rows, sent } = fakes()
  const res = await handleFeedbackPost(request(body({ talkFurther: "Sure" })), deps)
  assert.equal(res.status, 400)
  assert.equal(rows.length, 0)
  assert.equal(sent.length, 0)
})

test("a newline in name or company stays out of the subject line", async () => {
  const { deps, sent } = fakes()
  await handleFeedbackPost(request(body({ name: "Pat\r\nBcc: x@y.z", company: "Co\nX" })), deps)
  assert.equal(sent.length, 1)
  assert.ok(!/[\r\n]/.test(sent[0].subject))
})
