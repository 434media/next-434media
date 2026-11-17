/**
 * The incremental Firestore → Mailchimp push (lib/mailchimp-push-plan.ts): what counts as new or changed, when the
 * daily full pass starts, the time budget, and what is remembered after a run. Pure; no Firestore, no Mailchimp.
 * Run: tsx --test lib/__tests__/mailchimp-push-plan.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  FULL_PASS_EVERY_MS,
  PUSH_CHUNK,
  drainPending,
  fingerprint,
  isFullPassDue,
  nextSentSet,
  pendingMembers,
  pushRequests,
  type PlannedMember,
  type PushFn,
} from "../mailchimp-push-plan"

const m = (email: string, tags: string[] = ["434media"], firstName?: string): PlannedMember => ({ email, tags, firstName })

test("fingerprint: stable across tag order and email case, changes with tags or name", () => {
  const a = m("a@example.com", ["b", "a"])
  assert.equal(fingerprint(a), fingerprint(m("A@EXAMPLE.com", ["a", "b"])))
  assert.notEqual(fingerprint(a), fingerprint(m("a@example.com", ["a", "b", "c"])))
  assert.notEqual(fingerprint(a), fingerprint(m("a@example.com", ["a", "b"], "Ana")))
  assert.match(fingerprint(a), /^[0-9a-f]{12}$/)
})

test("isFullPassDue: first run, a day later, unreadable; not within the day", () => {
  const now = new Date("2026-11-17T12:00:00Z")
  assert.ok(isFullPassDue(undefined, now))
  assert.ok(isFullPassDue("garbage", now))
  assert.ok(isFullPassDue(new Date(now.getTime() - FULL_PASS_EVERY_MS).toISOString(), now))
  assert.ok(!isFullPassDue(new Date(now.getTime() - FULL_PASS_EVERY_MS + 60_000).toISOString(), now))
})

test("pendingMembers: only new or changed members", () => {
  const known = m("known@example.com")
  const sent = new Set([fingerprint(known), fingerprint(m("retagged@example.com", ["old"]))])
  const plan = [known, m("new@example.com"), m("retagged@example.com", ["new"])]
  assert.deepEqual(pendingMembers(plan, sent).map((p) => p.email), ["new@example.com", "retagged@example.com"])
  assert.equal(pendingMembers(plan, new Set()).length, 3, "an empty set (the full pass) sends everyone")
})

test("pushRequests: one tag-set per request, at most PUSH_CHUNK members", () => {
  const plan = [
    ...Array.from({ length: PUSH_CHUNK + 1 }, (_, i) => m(`a${i}@example.com`, ["a"])),
    m("b@example.com", ["b"]),
  ]
  const reqs = pushRequests(plan)
  assert.deepEqual(reqs.map((r) => [r.tags.join("|"), r.members.length]), [["a", PUSH_CHUNK], ["a", 1], ["b", 1]])
})

test("drainPending: sends with each request's tags, retries errored members next run", async () => {
  const calls: Array<{ emails: string[]; tags: string[] }> = []
  const push: PushFn = async (members, tags) => {
    calls.push({ emails: members.map((x) => x.email), tags })
    return { newMembers: 1, updatedMembers: members.length - 2, errors: [{ email: "BAD@example.com" }] }
  }
  const pending = [m("ok@example.com", ["a"]), m("bad@example.com", ["a"]), m("ok2@example.com", ["a"])]
  const r = await drainPending(pending, push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(calls, [{ emails: ["ok@example.com", "bad@example.com", "ok2@example.com"], tags: ["a"] }])
  assert.equal(r.attempted, 3)
  assert.equal(r.errors, 1)
  assert.equal(r.deferred, 0)
  assert.deepEqual(new Set(r.accepted), new Set([fingerprint(pending[0]), fingerprint(pending[2])]))
})

test("drainPending: stops at the deadline and defers the rest", async () => {
  let clock = 0
  const push: PushFn = async (members) => {
    clock += 100
    return { newMembers: members.length, updatedMembers: 0, errors: [] }
  }
  const pending = [m("a@example.com", ["a"]), m("b@example.com", ["b"]), m("c@example.com", ["c"])]
  const r = await drainPending(pending, push, { deadline: 150, now: () => clock })
  assert.equal(r.attempted, 2)
  assert.equal(r.deferred, 1)
  assert.equal(r.accepted.length, 2)
})

test("nextSentSet: keeps current remembered, adds accepted, drops what left the plan", () => {
  const stay = m("stay@example.com")
  const gone = m("gone@example.com")
  const fresh = m("fresh@example.com")
  const plan = [stay, fresh]
  const out = nextSentSet(plan, new Set([fingerprint(stay), fingerprint(gone)]), [fingerprint(fresh)])
  assert.deepEqual(out, [fingerprint(stay), fingerprint(fresh)].sort())
  // After a run, members not accepted (deferred or errored) are pending again.
  assert.deepEqual(pendingMembers(plan, new Set(out)), [])
  assert.deepEqual(pendingMembers(plan, new Set(nextSentSet(plan, new Set(), []))).length, 2)
})
