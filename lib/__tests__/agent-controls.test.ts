/**
 * Offline. The proof slice's controls: the ledger and task registry (lib/agent/ledger.ts, ledger-server.ts), the kill
 * switch (lib/agent/controls.ts), the email send executor (lib/agent/send-email.ts) and decision memory
 * (lib/core-model/decisions.ts). Every store is in memory; nothing is sent.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { AGENT_LEDGER_COLLECTION, GENESIS, LedgerRefused, buildEntry, checkFields, newTask, planStop, verifyChain, type LedgerEntry } from "../agent/ledger"
import { applyStop, createTask, step } from "../agent/ledger-server"
import { STOPPED, parseControls, readAgentControls, sendAllowed, skillMode, type AgentControls } from "../agent/controls"
import { SEND_APPROVALS_COLLECTION, TEST_SINK_RECIPIENTS, recipientRefusal, sendApprovedEmail, type SendDeps } from "../agent/send-email"
import { DEFAULT_APPROVAL_TTL_MS, contentHash, decide, draftApproval, type EmailPayload, type SendApproval } from "../send-approval"
import { DecisionRefused, buildDecision, summarizeForSkill } from "../core-model/decisions"
import { MemoryAgentDb } from "./helpers/agent-db"

const NOW = "2026-11-14T12:00:00.000Z"
const at = (ms = 0) => new Date(Date.parse(NOW) + ms).toISOString()
const task = (id = "task-1", parent?: string) =>
  newTask({ id, property: "434", objective: "intake-reply", workflow: "434-intake-qualification/draft", budgetUsd: 0.5, lineage: { event: "contact_forms:abc123", ...(parent ? { parent } : {}) }, now: NOW })

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("ledger entries carry ids and hashes only: words, names and addresses are refused", () => {
  assert.doesNotThrow(() => checkFields({ kind: "draft_queued", actor: "skill:434-intake-qualification", refs: { approval: "ap-1", activity: "contact_forms:abc" }, hashes: { draft: "a".repeat(64) }, outcome: "qualified", reasonCode: "first-reply" }))
  const bad: unknown[] = [
    { kind: "sent", actor: "system", body: "Hello Dana" },
    { kind: "sent", actor: "system", subject: "Re: your inquiry" },
    { kind: "sent", actor: "system", refs: { activity: "dana@lonestar.example" } },
    { kind: "sent", actor: "system", refs: { activity: "Dana Ortiz wrote in" } },
    { kind: "sent", actor: "system", refs: { name: "x" } },
    { kind: "sent", actor: "system", hashes: { draft: "not a hash" } },
    { kind: "sent", actor: "dana@lonestar.example" },
    { kind: "sent", actor: "system", reasonCode: "The founder thought the tone was off" },
    { kind: "sent", actor: "system", outcome: "maybe" },
    { kind: "whatever", actor: "system" },
  ]
  for (const f of bad) assert.throws(() => checkFields(f as never), LedgerRefused, JSON.stringify(f))
})

test("the ledger is a hash chain: a removed, reordered or altered entry is caught", () => {
  let t = task()
  const entries: LedgerEntry[] = []
  for (const kind of ["task_created", "run_started", "run_finished", "draft_queued"] as const) {
    const e = buildEntry(t, { kind, actor: "system" }, at(entries.length))
    entries.push(e)
    t = { ...t, seq: e.seq, head: e.hash }
  }
  assert.equal(entries[0].prev, GENESIS)
  assert.deepEqual(verifyChain(entries), { ok: true })
  assert.equal(verifyChain([entries[0], entries[2], entries[3]]).ok, false)
  assert.equal(verifyChain([entries[1], entries[0], ...entries.slice(2)]).ok, false)
  assert.equal(verifyChain([entries[0], { ...entries[1], reasonCode: "edited" }, ...entries.slice(2)]).ok, false)
})

test("the ledger module never updates or deletes an entry: create only", () => {
  const src = readFileSync(join(__dirname, "../agent/ledger-server.ts"), "utf8")
  assert.match(src, /t\.create\(db\.collection\(AGENT_LEDGER_COLLECTION\)/)
  assert.doesNotMatch(src, /AGENT_LEDGER_COLLECTION\)\.doc\([^)]*\)\)?\.(update|delete|set)\(/)
  assert.doesNotMatch(src, /t\.(update|delete)\(/)
  assert.doesNotMatch(src, /set\(db\.collection\(AGENT_LEDGER_COLLECTION\)/)
})

test("a task is created once, its entries chain, and its state moves only along allowed edges", async () => {
  const db = new MemoryAgentDb()
  await createTask(db, task(), "system", NOW)
  await assert.rejects(createTask(db, task(), "system", NOW), /already exists/)
  await step(db, { taskId: "task-1", at: at(1), decide: () => ({ fields: { kind: "run_started", actor: "skill:434-intake-qualification" }, to: "running" }) })
  await assert.rejects(step(db, { taskId: "task-1", at: at(2), decide: () => ({ fields: { kind: "sent", actor: "system" }, to: "sent" }) }), /cannot move from running to sent/)
  assert.equal(db.task("task-1")!.state, "running")
  assert.equal(db.task("task-1")!.seq, 2)
  assert.deepEqual(verifyChain(db.entries("task-1")), { ok: true })
  assert.throws(() => newTask({ id: "t", property: "434", objective: "x", workflow: "y", budgetUsd: 1, lineage: { event: "dana@lonestar.example" }, now: NOW }), /event id/)
})

test("a CRM write and its ledger entry commit together, or neither does", async () => {
  const db = new MemoryAgentDb()
  await createTask(db, task(), "system", NOW)
  db.failNextCommit = "unavailable"
  await assert.rejects(step(db, { taskId: "task-1", at: at(1), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: "ap-1" } }, write: (tx) => tx.setDoc("crm_send_approvals", "ap-1", { x: 1 }) }) }), /unavailable/)
  assert.equal(db.get("crm_send_approvals", "ap-1"), undefined)
  assert.equal(db.entries("task-1").length, 1)
  // A failure inside the step's decision writes nothing either.
  await assert.rejects(step(db, { taskId: "task-1", at: at(1), decide: () => { throw new Error("refused") } }), /refused/)
  assert.equal(db.entries("task-1").length, 1)
  await step(db, { taskId: "task-1", at: at(2), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: "ap-1" } }, write: (tx) => tx.setDoc("crm_send_approvals", "ap-1", { x: 1 }) }) })
  assert.deepEqual(db.get("crm_send_approvals", "ap-1"), { x: 1 })
  assert.equal(db.entries("task-1").length, 2)
})

test("a read after a write in one transaction is refused, as Firestore refuses it", async () => {
  const db = new MemoryAgentDb()
  await assert.rejects(db.run(async (tx) => { tx.setDoc("c", "a", {}); await tx.getDoc("c", "a") }), /read after a write/)
})

// ── The kill switch ─────────────────────────────────────────────────────────────────────────────────────────────────
const LIVE: AgentControls = { stopped: false, skills: { "434-intake-qualification": "proof" }, sends: { intake_reply: true }, ask: false }

test("the kill switch fails closed: missing, malformed, unreadable or off-Production reads as stopped", async () => {
  for (const v of [undefined, null, "on", {}, { stopped: "false" }, { stopped: 0 }]) {
    const c = parseControls(v)
    assert.equal(c.stopped, true, JSON.stringify(v))
    assert.equal(sendAllowed(c, "intake_reply"), false)
  }
  const prod = { VERCEL_ENV: "production" }
  assert.equal((await readAgentControls(async () => { throw new Error("unavailable") }, prod)).stopped, true)
  assert.equal((await readAgentControls(async () => ({ stopped: false, sends: { intake_reply: true } }), { VERCEL_ENV: "preview" })).stopped, true)
  const live = await readAgentControls(async () => ({ stopped: false, skills: { "434-intake-qualification": "proof", other: "autonomous" }, sends: { intake_reply: true } }), prod)
  assert.equal(sendAllowed(live, "intake_reply"), true)
  assert.equal(skillMode(live, "434-intake-qualification"), "proof")
  assert.equal(skillMode(live, "other"), "off")
  assert.equal(skillMode(live, "unknown"), "off")
  assert.equal(sendAllowed(parseControls({ stopped: false, sends: { intake_reply: "yes" } }), "intake_reply"), false)
})

test("a stop overrides every skill mode and every send flag", () => {
  const stopped = parseControls({ stopped: true, skills: { "434-intake-qualification": "draft" }, sends: { intake_reply: true } })
  assert.equal(skillMode(stopped, "434-intake-qualification"), "off")
  assert.equal(sendAllowed(stopped, "intake_reply"), false)
  assert.equal(STOPPED.stopped, true)
})

test("a stop cancels open tasks and their descendants, and sends caught mid-flight go to a person", async () => {
  const tasks = [
    { id: "a", state: "awaiting_review" as const, lineage: { event: "e:1" } },
    { id: "b", state: "sending" as const, lineage: { event: "e:2" } },
    { id: "c", state: "sent" as const, lineage: { event: "e:3" } },
    { id: "d", state: "queued" as const, lineage: { event: "e:4", parent: "a" } },
    { id: "e", state: "queued" as const, lineage: { event: "e:5" } },
  ]
  assert.deepEqual(planStop(tasks), { cancel: ["a", "d", "e"], reconcile: ["b"] })
  assert.deepEqual(planStop(tasks, "a"), { cancel: ["a", "d"], reconcile: [] })

  const db = new MemoryAgentDb()
  for (const id of ["a", "b"]) await createTask(db, task(id), "system", NOW)
  await step(db, { taskId: "a", at: at(1), decide: () => ({ fields: { kind: "run_started", actor: "system" }, to: "running" }) })
  const done = await applyStop(db, { cancel: ["a", "b"], reconcile: [] }, "founder", () => at(2))
  assert.deepEqual(done.cancelled, ["a", "b"])
  assert.equal(db.task("a")!.cancelled, true)
  assert.equal(db.entries("a").at(-1)!.kind, "cancelled")
  // A finished task is left alone.
  assert.deepEqual(await applyStop(db, { cancel: ["a"], reconcile: [] }, "founder", () => at(3)), { cancelled: [], reconcile: [] })
})

// ── The send executor ───────────────────────────────────────────────────────────────────────────────────────────────
const SINK = TEST_SINK_RECIPIENTS[0]
const payload = (to = SINK): EmailPayload => ({ from: "434 Media <hello@send.434media.com>", to: [to], replyTo: "ops@434media.com", subject: "Your production inquiry", text: "Thanks for writing to 434 Media. A few questions to shape a scope." })

async function setup(opts: { to?: string; approve?: boolean; controls?: AgentControls[] } = {}) {
  const db = new MemoryAgentDb()
  await createTask(db, task(), "system", NOW)
  let a: SendApproval = draftApproval({ id: "ap-1", path: "intake_reply", taskId: "task-1", payload: payload(opts.to), reviewReason: "First reply to a new client", now: NOW })
  await step(db, { taskId: "task-1", at: at(1), decide: () => ({ fields: { kind: "run_started", actor: "system" }, to: "running" }) })
  await step(db, { taskId: "task-1", at: at(2), decide: () => ({ fields: { kind: "draft_queued", actor: "skill:434-intake-qualification", refs: { approval: "ap-1" }, hashes: { draft: a.hash }, outcome: "qualified" }, to: "awaiting_review", write: (tx) => tx.createDoc(SEND_APPROVALS_COLLECTION, "ap-1", a) }) })
  if (opts.approve !== false) {
    a = decide(a, { decision: "approved", by: "founder", at: at(60_000), shownHash: a.hash, reasonCode: "as-drafted", reason: "Reads right." })
    await step(db, { taskId: "task-1", at: at(60_000), decide: () => ({ fields: { kind: "approved", actor: "founder", refs: { approval: "ap-1" }, hashes: { approval: a.hash }, reasonCode: "as-drafted" }, to: "approved", write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, "ap-1", a) }) })
  }
  const sends: { payload: EmailPayload; key: string }[] = []
  const reads = [...(opts.controls ?? [])]
  let clock = 120_000
  const deps: SendDeps = {
    db,
    controls: async () => (reads.length ? reads.shift()! : LIVE),
    dispatch: async (p, key) => (sends.push({ payload: p, key }), { messageId: `re_${sends.length}` }),
    now: () => at(clock++),
    runId: "run-a",
    actor: "founder",
  }
  return { db, deps, sends, approval: a }
}

test("an approved draft sends once, to the test sink, and the CRM keeps the sent text in full", async () => {
  const { db, deps, sends, approval } = await setup()
  const r = await sendApprovedEmail("ap-1", deps)
  assert.equal(r.sent, true)
  assert.equal(sends.length, 1)
  assert.equal(sends[0].key, "run-a:send")
  assert.deepEqual(sends[0].payload, approval.payload)
  const stored = db.get<SendApproval>(SEND_APPROVALS_COLLECTION, "ap-1")!
  assert.equal(stored.receipt?.messageId, "re_1")
  assert.ok(stored.consumed)
  assert.equal(db.task("task-1")!.state, "sent")
  // #300's record: one Activity, the body whole, linked to the recipient by address.
  assert.ok(r.sent && r.recorded)
  const activity = db.get<Record<string, unknown>>(CRM_COLLECTIONS.ACTIVITIES, (r as { activityId: string }).activityId)!
  assert.equal(activity.body, approval.payload.text)
  assert.equal((activity.email as { path: string }).path, "contact_form_reply")
  assert.deepEqual((activity.contact as { email: string }).email, SINK)
  // The ledger: claimed, intent, sent; ids and hashes only, and the chain holds.
  const kinds = db.entries("task-1").map((e) => e.kind)
  assert.deepEqual(kinds.slice(-3), ["send_claimed", "send_intent", "sent"])
  const sent = db.entries("task-1").at(-1)!
  assert.equal(sent.hashes?.sent, contentHash(approval.payload))
  assert.ok(!JSON.stringify(db.entries("task-1")).includes(approval.payload.text))
  assert.ok(!JSON.stringify(db.entries("task-1")).includes(SINK))
  assert.deepEqual(verifyChain(db.entries("task-1")), { ok: true })
  // A second tap finds the approval consumed.
  const again = await sendApprovedEmail("ap-1", { ...deps, runId: "run-b" })
  assert.equal(again.sent, false)
  assert.equal(sends.length, 1)
})

test("a real person's address is refused: in the proof slice only the test sink can receive", async () => {
  assert.equal(recipientRefusal([SINK]), null)
  assert.equal(recipientRefusal(["Dana <DELIVERED@resend.dev>"]), null)
  // Resend's labelled test address is allowed by name only; another label, or a label on a real domain, is not.
  assert.equal(recipientRefusal(["delivered+reject@resend.dev"]), null)
  assert.notEqual(recipientRefusal(["delivered+other@resend.dev"]), null)
  assert.notEqual(recipientRefusal(["dana+reject@lonestar.example"]), null)
  assert.notEqual(recipientRefusal(["dana@lonestar.example"]), null)
  assert.notEqual(recipientRefusal([SINK, "dana@lonestar.example"]), null)
  const { db, deps, sends } = await setup({ to: "dana@lonestar.example" })
  const r = await sendApprovedEmail("ap-1", deps)
  assert.deepEqual([r.sent, (r as { code: string }).code], [false, "recipient-not-allowed"])
  assert.equal(sends.length, 0)
  assert.equal(db.entries("task-1").at(-1)!.kind, "send_refused")
})

test("an unapproved, expired or cancelled draft does not send", async () => {
  {
    const { deps, sends } = await setup({ approve: false })
    assert.equal((await sendApprovedEmail("ap-1", deps)).sent, false)
    assert.equal(sends.length, 0)
  }
  {
    const { deps, sends } = await setup()
    const r = await sendApprovedEmail("ap-1", { ...deps, now: () => at(DEFAULT_APPROVAL_TTL_MS + 1) })
    assert.deepEqual([r.sent, (r as { code: string }).code], [false, "not-sendable"])
    assert.equal(sends.length, 0)
  }
  {
    const { db, deps, sends } = await setup()
    await applyStop(db, { cancel: ["task-1"], reconcile: [] }, "founder", () => at(70_000))
    assert.equal((await sendApprovedEmail("ap-1", deps)).sent, false)
    assert.equal(sends.length, 0)
  }
})

test("an approval edited after the founder approved it does not send", async () => {
  const { db, deps, sends } = await setup()
  const a = db.get<SendApproval>(SEND_APPROVALS_COLLECTION, "ap-1")!
  db.col(SEND_APPROVALS_COLLECTION).set("ap-1", { ...a, payload: { ...a.payload, text: "Something the founder never saw." } })
  const r = await sendApprovedEmail("ap-1", deps)
  assert.deepEqual([r.sent, (r as { code: string }).code], [false, "not-sendable"])
  assert.equal(sends.length, 0)
})

test("the kill switch is read immediately before the send: a stop after the intent sends nothing and spends the approval", async () => {
  const stopped = parseControls({ stopped: true })
  // Before anything: refused at once.
  {
    const { db, deps, sends } = await setup({ controls: [stopped] })
    const r = await sendApprovedEmail("ap-1", deps)
    assert.deepEqual([r.sent, (r as { code: string }).code], [false, "sends-stopped"])
    assert.equal(sends.length, 0)
    assert.equal(db.entries("task-1").at(-1)!.kind, "kill_blocked")
    assert.equal(db.task("task-1")!.state, "approved")
  }
  // Between the intent and the provider: the second read stops it.
  {
    const { db, deps, sends } = await setup({ controls: [LIVE, stopped] })
    const r = await sendApprovedEmail("ap-1", deps)
    assert.deepEqual([r.sent, (r as { code: string }).code], [false, "stopped-before-dispatch"])
    assert.equal(sends.length, 0)
    const stored = db.get<SendApproval>(SEND_APPROVALS_COLLECTION, "ap-1")!
    assert.ok(stored.abortedBeforeDispatch)
    assert.equal(db.task("task-1")!.state, "failed")
    // Unstopped, it still never sends: a new draft and approval are needed.
    const again = await sendApprovedEmail("ap-1", { ...deps, runId: "run-b", controls: async () => LIVE })
    assert.equal(again.sent, false)
    assert.equal(sends.length, 0)
  }
})

test("a lost provider answer is never retried: the task waits for a person", async () => {
  const { db, deps } = await setup()
  let calls = 0
  const r = await sendApprovedEmail("ap-1", { ...deps, dispatch: async () => { calls++; throw new Error("socket hang up") } })
  assert.deepEqual([r.sent, (r as { uncertain?: boolean }).uncertain], [false, true])
  assert.equal(db.task("task-1")!.state, "needs_reconciliation")
  assert.equal(db.entries("task-1").at(-1)!.kind, "send_outcome_unknown")
  await sendApprovedEmail("ap-1", { ...deps, runId: "run-b" })
  assert.equal(calls, 1)
})

test("two taps at once send once", async () => {
  const { deps, sends } = await setup()
  const results = await Promise.allSettled([sendApprovedEmail("ap-1", deps), sendApprovedEmail("ap-1", { ...deps, runId: "run-b" })])
  assert.equal(sends.length, 1)
  assert.equal(results.filter((x) => x.status === "fulfilled" && x.value.sent).length, 1)
})

// ── Decision memory ─────────────────────────────────────────────────────────────────────────────────────────────────
test("decision memory: each decision its own bounded record; the newest few go to a skill", () => {
  const d = (n: number, over = {}) => buildDecision({ id: `d-${n}`, subject: { kind: "organization", id: "org-1" }, chosen: `option ${n}`, why: `because ${n}`, by: "founder", at: at(n * 1000), ...over })
  const one = d(1, { open_concern: "Budget unclear", revisit_when: "They name a budget" })
  assert.equal(one.subject_key, "organization:org-1")
  assert.throws(() => d(2, { why: " " }), DecisionRefused)
  assert.throws(() => d(2, { chosen: "x".repeat(301) }), /next helper/)
  assert.throws(() => d(2, { by: "dana@lonestar.example" }), DecisionRefused)
  assert.throws(() => d(2, { subject: { kind: "lead", id: "x" } }), DecisionRefused)
  const summary = summarizeForSkill([d(1), one, d(2), d(3), d(4), d(5), d(6)], 3)
  assert.equal(summary.split("\n").length, 3)
  assert.match(summary.split("\n")[0], /option 6/)
  assert.equal(summarizeForSkill([]), "")
})

test("the ledger collection is not a CRM collection, and the approvals and decisions are", () => {
  assert.equal(SEND_APPROVALS_COLLECTION, "crm_send_approvals")
  assert.equal(CRM_COLLECTIONS.DECISIONS, "crm_decisions")
  assert.ok(!Object.values(CRM_COLLECTIONS).includes(AGENT_LEDGER_COLLECTION as never))
})
