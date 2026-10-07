/**
 * The outreach sequence cannot send a step twice (2b fix 11).
 *
 * The store below behaves like a Firestore transaction: `update` reads a
 * version, yields (so concurrent callers interleave), and commits only if the
 * version is unchanged — otherwise it re-runs the function, as Firestore does.
 * This proves the claim logic; Firestore's own transaction guarantee is what
 * production relies on underneath it.
 *
 * Run: tsx --test lib/__tests__/outreach-claim.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  CLAIM_STALE_MS,
  decideClaim,
  idempotencyKey,
  sendStepOnce,
  type ClaimableSequence,
  type SequenceStore,
  type StepSender,
} from "../outreach-claim"
import { stepGapMinutes } from "../outreach-step-gap"

interface Seq extends ClaimableSequence {
  sent: number[]
}

class FakeStore implements SequenceStore<Seq> {
  docs = new Map<string, { seq: Seq; version: number }>()
  conflicts = 0
  put(id: string, seq: Seq) {
    this.docs.set(id, { seq: structuredClone(seq), version: 0 })
  }
  get(id: string) {
    return this.docs.get(id)!.seq
  }
  async update<T>(id: string, fn: (seq: Seq | undefined) => { next?: Seq; result: T }): Promise<T> {
    for (;;) {
      const doc = this.docs.get(id)
      const version = doc?.version ?? -1
      const { next, result } = fn(doc ? structuredClone(doc.seq) : undefined)
      await new Promise((r) => setImmediate(r)) // let concurrent transactions interleave
      const now = this.docs.get(id)
      if ((now?.version ?? -1) !== version) {
        this.conflicts++
        continue // retry, as a Firestore transaction does on contention
      }
      if (next) this.docs.set(id, { seq: structuredClone(next), version: version + 1 })
      return result
    }
  }
}

/** Records every send; can fail on demand, or "crash" after sending. */
class FakeSender implements StepSender {
  calls: string[] = []
  failNext = false
  async send(key: string) {
    await new Promise((r) => setImmediate(r))
    if (this.failNext) {
      this.failNext = false
      throw new Error("Resend 500")
    }
    this.calls.push(key)
    return { id: `email-${this.calls.length}` }
  }
}

const active = (step = 1): Seq => ({ status: "active", next_step: step, enrolled_at: "2026-10-07T00:00:00.000Z", sent: [] })
const advance = (seq: Seq) => ({
  next: { ...seq, sent: [...seq.sent, seq.next_step!], next_step: seq.next_step! < 3 ? seq.next_step! + 1 : null },
})
const run = (store: FakeStore, sender: FakeSender, leadId: string, step: number, runId: string, now = () => new Date()) =>
  sendStepOnce({ leadId, step, runId, now, store, sender, advance })

test("two simultaneous runs on one lead send the step once", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  store.put("L1", active(1))
  const results = await Promise.all([run(store, sender, "L1", 1, "a"), run(store, sender, "L1", 1, "b")])
  assert.equal(sender.calls.length, 1)
  assert.deepEqual(results.map((r) => r.action).sort(), ["sent", "skipped"])
  assert.deepEqual(store.get("L1").sent, [1])
  assert.equal(store.get("L1").next_step, 2)
  assert.equal(store.get("L1").claim, null)
  assert.ok(store.conflicts > 0, "the race must actually have happened")
})

test("enrolment racing the cron sends step 1 once", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  store.put("L1", active(1))
  await Promise.all([run(store, sender, "L1", 1, "enroll"), run(store, sender, "L1", 1, "cron")])
  assert.equal(sender.calls.length, 1)
})

test("overlapping cron runs across three leads send each lead once", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  for (const id of ["A", "B", "C"]) store.put(id, active(2))
  const tick = (runId: string) => Promise.all(["A", "B", "C"].map((id) => run(store, sender, id, 2, runId)))
  await Promise.all([tick("r1"), tick("r2"), tick("r3")])
  assert.equal(sender.calls.length, 3)
  assert.deepEqual([...new Set(sender.calls)].length, 3)
  for (const id of ["A", "B", "C"]) assert.deepEqual(store.get(id).sent, [2])
})

test("a run that dies after sending leaves the step paused for review, never re-sent", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  store.put("L1", active(1))
  // Simulate the crash: claim taken and email sent, settle never ran.
  const t0 = new Date("2026-10-07T15:00:00.000Z")
  await store.update("L1", (seq) => ({ next: { ...seq!, claim: { step: 1, claimed_at: t0.toISOString(), run_id: "dead" } }, result: null }))
  await sender.send(idempotencyKey("L1", active().enrolled_at, 1))
  // Next day's run.
  const r = await run(store, sender, "L1", 1, "next-day", () => new Date(t0.getTime() + 24 * 3600 * 1000))
  assert.equal(r.action, "stale")
  assert.equal(sender.calls.length, 1, "no second send")
  assert.equal(store.get("L1").status, "paused")
  assert.equal(store.get("L1").needs_review?.step, 1)
})

test("a fresh claim held by another run is skipped, not treated as stale", () => {
  const now = new Date("2026-10-07T15:05:00.000Z")
  const seq = { ...active(1), claim: { step: 1, claimed_at: new Date(now.getTime() - CLAIM_STALE_MS + 1000).toISOString(), run_id: "x" } }
  assert.deepEqual(decideClaim(seq, 1, now), { kind: "skip", reason: "claimed" })
})

test("a Resend error releases the claim; the next run sends once, with the same key", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  store.put("L1", active(1))
  sender.failNext = true
  await assert.rejects(run(store, sender, "L1", 1, "r1"), /Resend 500/)
  assert.equal(store.get("L1").claim, null)
  assert.equal(store.get("L1").next_step, 1)
  const r = await run(store, sender, "L1", 1, "r2")
  assert.equal(r.action, "sent")
  assert.deepEqual(sender.calls, [idempotencyKey("L1", active().enrolled_at, 1)])
})

test("paused, stopped and already-advanced sequences send nothing", async () => {
  const store = new FakeStore(); const sender = new FakeSender()
  store.put("P", { ...active(1), status: "paused" })
  store.put("S", { ...active(1), status: "stopped" })
  store.put("M", active(2))
  const r = await Promise.all([run(store, sender, "P", 1, "x"), run(store, sender, "S", 1, "x"), run(store, sender, "M", 1, "x")])
  assert.deepEqual(r.map((x) => (x.action === "skipped" ? x.reason : x.action)), ["not_active", "not_active", "step_moved"])
  assert.equal(sender.calls.length, 0)
})

test("the idempotency key is stable per lead, enrolment and step", () => {
  assert.equal(idempotencyKey("L1", "e", 2), idempotencyKey("L1", "e", 2))
  assert.notEqual(idempotencyKey("L1", "e", 2), idempotencyKey("L1", "e", 3))
  assert.notEqual(idempotencyKey("L1", "e", 2), idempotencyKey("L1", "f", 2))
  assert.ok(idempotencyKey("x".repeat(300), "e", 1).length <= 256)
})

test("production ignores SEQUENCE_STEP_GAP_MINUTES; preview and local honour it", () => {
  assert.equal(stepGapMinutes({ SEQUENCE_STEP_GAP_MINUTES: "1", VERCEL_ENV: "production" }), 0)
  assert.equal(stepGapMinutes({ SEQUENCE_STEP_GAP_MINUTES: "1", VERCEL_ENV: "preview" }), 1)
  assert.equal(stepGapMinutes({ SEQUENCE_STEP_GAP_MINUTES: "2" }), 2)
  assert.equal(stepGapMinutes({ VERCEL_ENV: "preview" }), 0)
  assert.equal(stepGapMinutes({ SEQUENCE_STEP_GAP_MINUTES: "nope", VERCEL_ENV: "preview" }), 0)
})
