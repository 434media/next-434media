/**
 * The incremental Firestore → Mailchimp push (lib/mailchimp-push-plan.ts): what counts as new or changed, when the
 * daily full pass starts, the time budget, and what is remembered after a run. Pure; no Firestore, no Mailchimp.
 * Run: tsx --test lib/__tests__/mailchimp-push-plan.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  FULL_PASS_EVERY_MS,
  MERGE_TEXT_MAX,
  cleanMergeText,
  isPermanentlyDeletedRefusal,
  isInvalidAddressRefusal,
  isComplianceStateRefusal,
  COMPLIANCE_STATE_SUPPRESSION_REASON,
  errorEmail,
  staleSourceFix,
  stillRemoved,
  PUSH_CHUNK,
  drainPending,
  fingerprint,
  isFullPassDue,
  nextSentSet,
  pendingMembers,
  pushRequests,
  redactEmails,
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

test("drainPending: sends with each request's tags; a rejected member waits, a failed request is retried", async () => {
  const calls: Array<{ emails: string[]; tags: string[] }> = []
  const push: PushFn = async (members, tags) => {
    calls.push({ emails: members.map((x) => x.email), tags })
    return {
      newMembers: 1,
      updatedMembers: members.length - 3,
      errors: [
        { email: "BAD@example.com", code: "ERROR_GENERIC", message: "bad@example.com looks fake or invalid" },
        { email: "flaky@example.com", code: "request_failed", message: "fetch failed" },
      ],
    }
  }
  const pending = [m("ok@example.com", ["a"]), m("bad@example.com", ["a"]), m("flaky@example.com", ["a"]), m("ok2@example.com", ["a"])]
  const r = await drainPending(pending, push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(calls, [
    { emails: ["ok@example.com", "bad@example.com", "flaky@example.com", "ok2@example.com"], tags: ["a"] },
  ])
  assert.equal(r.attempted, 4)
  assert.equal(r.errors, 2)
  assert.equal(r.retryable, 1)
  assert.equal(r.deferred, 0)
  // The rejected member is remembered (not resent hourly); the failed request is not.
  assert.deepEqual(new Set(r.accepted), new Set([fingerprint(pending[0]), fingerprint(pending[1]), fingerprint(pending[3])]))
  assert.deepEqual(r.reasons, [
    { code: "ERROR_GENERIC", count: 1, sample: "<email> looks fake or invalid" },
    { code: "request_failed", count: 1, sample: "fetch failed" },
  ])
})

test("drainPending: an error with no code is grouped as unknown and not retried", async () => {
  const push: PushFn = async () => ({ newMembers: 0, updatedMembers: 0, errors: [{ email: "x@example.com" }] })
  const r = await drainPending([m("x@example.com")], push, { deadline: Number.POSITIVE_INFINITY })
  assert.equal(r.retryable, 0)
  assert.deepEqual(r.reasons, [{ code: "unknown", count: 1, sample: "" }])
  assert.equal(r.accepted.length, 1)
})

test("redactEmails: removes addresses, keeps the rest", () => {
  assert.equal(
    redactEmails("jane.doe+news@sub.example.com is in a compliance state; contact <a@example.com>."),
    "<email> is in a compliance state; contact <<email>>.",
  )
  assert.equal(redactEmails("no address here"), "no address here")
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
  // After a run, members not accepted (deferred, or a failed request) are pending again.
  assert.deepEqual(pendingMembers(plan, new Set(out)), [])
  assert.deepEqual(pendingMembers(plan, new Set(nextSentSet(plan, new Set(), []))).length, 2)
})

const DELETED = "a@example.com was permanently deleted and cannot be re-imported. The contact must re-subscribe to get back on the list."

test("isPermanentlyDeletedRefusal: the batch message and the single-member title; nothing else", () => {
  assert.ok(isPermanentlyDeletedRefusal(DELETED))
  assert.ok(isPermanentlyDeletedRefusal("Forgotten Email Not Subscribed"))
  assert.ok(!isPermanentlyDeletedRefusal("Your merge fields were invalid."))
  assert.ok(!isPermanentlyDeletedRefusal(undefined))
})

test("drainPending: a permanently deleted refusal is reported for marking and not retried", async () => {
  const push: PushFn = async (members) => ({
    newMembers: 0,
    updatedMembers: members.length - 1,
    errors: [{ email: "Gone@Example.com", code: "ERROR_GENERIC", message: DELETED.replace("a@example.com", "Gone@Example.com") }],
  })
  const r = await drainPending([m("gone@example.com"), m("ok@example.com")], push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(r.removed, [{ email: "gone@example.com", reason: "permanently_deleted" }])
  assert.equal(r.retryable, 0)
  assert.equal(r.accepted.length, 2)
  assert.equal(r.reasons[0].sample.includes("@"), false)
})

test("drainPending: merge-field refusals are grouped by the field Mailchimp names, with no address", async () => {
  const push: PushFn = async () => ({
    newMembers: 0,
    updatedMembers: 0,
    errors: [
      { email: "a@example.com", code: "ERROR_GENERIC", message: "Your merge fields were invalid.", field: "PHONE", fieldMessage: "Please enter a valid phone for a@example.com" },
      { email: "b@example.com", code: "ERROR_GENERIC", message: "Your merge fields were invalid.", field: "PHONE", fieldMessage: "Please enter a valid phone for b@example.com" },
      { email: "c@example.com", code: "ERROR_GENERIC", message: "Your merge fields were invalid.", field: "FNAME" },
    ],
  })
  const r = await drainPending([m("a@example.com"), m("b@example.com"), m("c@example.com")], push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(r.reasons.map((x) => [x.code, x.field, x.count]), [["ERROR_GENERIC", "PHONE", 2], ["ERROR_GENERIC", "FNAME", 1]])
  assert.match(r.reasons[0].sample, /merge fields were invalid\. Please enter a valid phone/)
  assert.equal(r.reasons[0].sample.includes("@"), false)
  assert.deepEqual(r.removed, [])
})

test("stillRemoved: skipped until consent is dated after the refusal; unknown dates keep the mark", () => {
  const at = "2026-11-19T00:00:00.000Z"
  assert.ok(stillRemoved(at, undefined))
  assert.ok(stillRemoved(at, "2026-11-01T00:00:00Z"))
  assert.ok(stillRemoved(at, at))
  assert.ok(stillRemoved(at, "not a date"))
  assert.ok(!stillRemoved(at, "2026-11-20T00:00:00Z"))
  assert.ok(stillRemoved("", "2026-11-20T00:00:00Z"))
})

test("cleanMergeText: strings only, control characters and extra space removed, capped, blank left out", () => {
  assert.equal(cleanMergeText("  Ana \n  María\t"), "Ana María")
  assert.equal(cleanMergeText("   "), undefined)
  assert.equal(cleanMergeText(""), undefined)
  assert.equal(cleanMergeText(42), undefined)
  assert.equal(cleanMergeText(["Ana"]), undefined)
  assert.equal(cleanMergeText("x".repeat(400))!.length, MERGE_TEXT_MAX)
  assert.equal(cleanMergeText("Zoë"), "Zoë")
})

const SOURCE_REFUSAL = (stored: string) => ({
  code: "ERROR_GENERIC",
  message: "Your merge fields were invalid.",
  field: "MMERGE7",
  fieldMessage: `Value must be one of: In-Person Contact (Business Card/V-Card), Acquired Lists (bought or received), Social Media, 434MEDIA (not ${stored})`,
})

test("staleSourceFix: only 434Media and Website on MMERGE7 become 434MEDIA; anything else is left alone", () => {
  assert.deepEqual(staleSourceFix(SOURCE_REFUSAL("434Media")), { MMERGE7: "434MEDIA" })
  assert.deepEqual(staleSourceFix(SOURCE_REFUSAL("Website")), { MMERGE7: "434MEDIA" })
  assert.equal(staleSourceFix(SOURCE_REFUSAL("website")), undefined)
  assert.equal(staleSourceFix(SOURCE_REFUSAL("Referral")), undefined)
  assert.equal(staleSourceFix(SOURCE_REFUSAL("toString")), undefined)
  assert.equal(staleSourceFix({ ...SOURCE_REFUSAL("434Media"), field: "MMERGE8" }), undefined)
  assert.equal(staleSourceFix({ message: "Your merge fields were invalid." }), undefined)
})

test("drainPending: a stale Source refusal is sent again with Source corrected, in the same tags; others stay logged", async () => {
  const calls: Array<{ members: Array<{ email: string; mergeFields?: Record<string, string> }>; tags: string[] }> = []
  const push: PushFn = async (members, tags) => {
    calls.push({ members: members.map(({ email, mergeFields }) => ({ email, ...(mergeFields ? { mergeFields } : {}) })), tags })
    if (calls.length === 1) {
      return {
        newMembers: 0,
        updatedMembers: 1,
        errors: [
          { email: "a@example.com", ...SOURCE_REFUSAL("434Media") },
          { email: "b@example.com", ...SOURCE_REFUSAL("Website") },
          { email: "c@example.com", ...SOURCE_REFUSAL("Referral") },
        ],
      }
    }
    return { newMembers: 0, updatedMembers: members.length, errors: [] }
  }
  const pending = ["a", "b", "c", "ok"].map((x) => m(`${x}@example.com`, ["t"]))
  const r = await drainPending(pending, push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(calls[1], {
    members: [
      { email: "a@example.com", mergeFields: { MMERGE7: "434MEDIA" } },
      { email: "b@example.com", mergeFields: { MMERGE7: "434MEDIA" } },
    ],
    tags: ["t"],
  })
  assert.equal(calls.length, 2)
  assert.equal(r.attempted, 4)
  assert.equal(r.updatedMembers, 3)
  assert.equal(r.sourceFixed, 2)
  assert.equal(r.errors, 1)
  assert.deepEqual(r.reasons.map((x) => [x.field, x.count]), [["MMERGE7", 1]])
  assert.match(r.reasons[0].sample, /\(not Referral\)/)
  assert.equal(r.accepted.length, 4)
})

test("drainPending: a stale Source member refused again on the resend is counted once, with the resend's error", async () => {
  let n = 0
  const push: PushFn = async () => {
    n++
    return n === 1
      ? { newMembers: 0, updatedMembers: 0, errors: [{ email: "a@example.com", ...SOURCE_REFUSAL("Website") }] }
      : { newMembers: 0, updatedMembers: 0, errors: [{ email: "a@example.com", code: "ERROR_GENERIC", message: "Your merge fields were invalid.", field: "PHONE" }] }
  }
  const r = await drainPending([m("a@example.com")], push, { deadline: Number.POSITIVE_INFINITY })
  assert.equal(r.sourceFixed, 0)
  assert.equal(r.errors, 1)
  assert.deepEqual(r.reasons.map((x) => x.field), ["PHONE"])
})

const INVALID = "x@example.com looks fake or invalid, please enter a real email address."

test("isInvalidAddressRefusal: Mailchimp's fake-or-invalid refusal only", () => {
  assert.ok(isInvalidAddressRefusal(INVALID))
  assert.ok(!isInvalidAddressRefusal(DELETED))
  assert.ok(!isInvalidAddressRefusal(undefined))
})

test("stillRemoved: an invalid address stays skipped whatever the consent", () => {
  assert.ok(stillRemoved("2026-11-20T00:00:00Z", "2026-12-01T00:00:00Z", "invalid_address"))
  assert.ok(!stillRemoved("2026-11-20T00:00:00Z", "2026-12-01T00:00:00Z", "permanently_deleted"))
})

test("errorEmail: the named address, else the first address in the message", () => {
  assert.equal(errorEmail({ email: " A@Example.com ", message: DELETED }), "a@example.com")
  assert.equal(errorEmail({ email: "", message: DELETED.replace("a@example.com", "Gone@Example.com") }), "gone@example.com")
  assert.equal(errorEmail({ email: "", message: "no address" }), "")
})

// Reproduces the 2026-11-20 00:00Z full pass: the log showed "ERROR_GENERIC ×17" with one deletion sample, but only
// one of the 17 was a deletion, and only that one was marked. Grouping by code hid the other messages.
test("drainPending: refusals of one code but different messages are logged apart; deleted and invalid are both marked", async () => {
  const push: PushFn = async () => ({
    newMembers: 0,
    updatedMembers: 0,
    errors: [
      { email: "gone@example.com", code: "ERROR_GENERIC", message: DELETED.replace("a@example.com", "gone@example.com") },
      { email: "x@example.com", code: "ERROR_GENERIC", message: INVALID },
      { email: "", code: "ERROR_GENERIC", message: INVALID.replace("x@example.com", "y@example.com") },
      { email: "c@example.com", code: "ERROR_GENERIC", message: "c@example.com is in a compliance state due to unsubscribe, bounce, or compliance review and cannot be subscribed." },
    ],
  })
  const plan = ["gone", "x", "y", "c"].map((x) => m(`${x}@example.com`))
  const r = await drainPending(plan, push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(r.removed, [
    { email: "gone@example.com", reason: "permanently_deleted" },
    { email: "x@example.com", reason: "invalid_address" },
    { email: "y@example.com", reason: "invalid_address" },
  ])
  assert.deepEqual(r.reasons.map((x) => x.count), [2, 1])
  assert.equal(r.errors, 3)
  assert.match(r.reasons[0].sample, /looks fake or invalid/)
  assert.ok(!r.reasons.some((x) => /compliance state/.test(x.sample)))
  assert.ok(r.reasons.every((x) => !x.sample.includes("@")))
  assert.deepEqual(r.suppressed, ["c@example.com"])
})

const COMPLIANCE = "c@example.com is in a compliance state due to unsubscribe, bounce, or compliance review and cannot be subscribed."

test("isComplianceStateRefusal: Mailchimp's compliance-state message; not deletion, invalid or merge-field refusals", () => {
  assert.ok(isComplianceStateRefusal(COMPLIANCE))
  assert.ok(!isComplianceStateRefusal(DELETED))
  assert.ok(!isComplianceStateRefusal(INVALID))
  assert.ok(!isComplianceStateRefusal("Your merge fields were invalid."))
  assert.ok(!isComplianceStateRefusal(undefined))
  assert.equal(COMPLIANCE_STATE_SUPPRESSION_REASON, "mailchimp-compliance-state")
})

// Reproduces the 2026-11-21 01:00Z full pass: 15 compliance-state refusals, retried on every full pass until now.
test("drainPending: compliance-state refusals are reported for suppression once each, not as errors, not marked removed, not retried", async () => {
  const refused = Array.from({ length: 15 }, (_, i) => `u${i}@example.com`)
  const push: PushFn = async (members) => ({
    newMembers: 0,
    updatedMembers: members.length - refused.length,
    errors: [
      ...refused.map((e) => ({ email: "", code: "ERROR_GENERIC", message: COMPLIANCE.replace("c@example.com", e.toUpperCase()) })),
      { email: "u0@example.com", code: "ERROR_GENERIC", message: COMPLIANCE.replace("c@example.com", "u0@example.com") },
    ],
  })
  const plan = [...refused, "ok@example.com"].map((e) => m(e))
  const r = await drainPending(plan, push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(r.suppressed, refused)
  assert.deepEqual(r.removed, [])
  assert.equal(r.retryable, 0)
  assert.equal(r.accepted.length, plan.length)
  assert.equal(r.errors, 0)
  assert.deepEqual(r.reasons, [])
})

test("drainPending: a failed request is retried, never suppressed", async () => {
  const push: PushFn = async (members) => ({
    newMembers: 0,
    updatedMembers: 0,
    errors: members.map((x) => ({ email: x.email, code: "request_failed", message: "socket hang up" })),
  })
  const r = await drainPending([m("a@example.com")], push, { deadline: Number.POSITIVE_INFINITY })
  assert.deepEqual(r.suppressed, [])
  assert.equal(r.retryable, 1)
})
