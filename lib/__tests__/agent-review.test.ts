/**
 * Offline. The proof slice's PR 3: the founder-review queue and the console (lib/agent/review.ts), the decision with
 * its decision memory and ledger entry (lib/agent/review-server.ts decideApproval), and the founder guard on every new
 * route. The store is in memory; nothing is sent.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CRM_COLLECTIONS } from "../../types/crm-types"
import { FLAG_SHORT, REVIEW_WAIT_LIMIT_MS, shortFlag, costSummary, groupReasons, handoffWaits, reviewItem, runSummary, sortQueue, type StoredApproval } from "../agent/review"
import { DISMISS_DEFAULT_REASON, decideApproval, dismissSolicitation, type DismissDeps, type DismissedSender } from "../agent/review-server"
import type { Activity } from "../../types/core-model"
import { SEND_APPROVALS_COLLECTION, TEST_SINK_RECIPIENTS, sendApprovedEmail } from "../agent/send-email"
import { createTask, step } from "../agent/ledger-server"
import { buildEntry, newTask, verifyChain, type AgentTask, type LedgerEntry } from "../agent/ledger"
import { parseControls } from "../agent/controls"
import { decide, draftApproval, type SendApproval } from "../send-approval"
import { QUEUES } from "../queue-age"
import { MemoryAgentDb } from "./helpers/agent-db"

const NOW = "2026-11-14T12:00:00.000Z"
const at = (ms = 0) => new Date(Date.parse(NOW) + ms).toISOString()
const SINK = TEST_SINK_RECIPIENTS[0]
const HOUR = 3_600_000

function approval(id: string, createdAt: string, over: Partial<StoredApproval> = {}): StoredApproval {
  const a = draftApproval({ id, path: "intake_reply", taskId: `task-${id}`, payload: { from: "434 Media <hello@send.434media.com>", to: [SINK], subject: `Subject ${id}`, text: "Thanks for writing." }, reviewReason: "First reply to a new contact", now: createdAt })
  return { ...a, routing: { outcome: "qualified" }, intake: { record: "record", nextOwner: "founder", due: "2026-11-17", returnCondition: "no reply" }, ...over }
}
const decided = (a: SendApproval, d: "approved" | "rejected", code: string, when: string, reason = `because ${code}`) =>
  decide(a, { decision: d, by: "founder", at: when, shownHash: a.hash, reasonCode: code, reason })

// ── The queue and the console, as data ──────────────────────────────────────────────────────────────────────────────
test("the queue shows waiting drafts first, oldest first, and marks one waiting past 24 hours as late", () => {
  const old = approval("a", at(-30 * HOUR))
  const fresh = approval("b", at(-1 * HOUR))
  const done = decided(approval("c", at(-2 * HOUR)), "rejected", "tone", at(-HOUR)) as StoredApproval
  const items = sortQueue([fresh, done, old].map((a) => reviewItem(a, NOW)))
  assert.deepEqual(items.map((i) => i.id), ["a", "b", "c"])
  assert.equal(items[0].late, true)
  assert.equal(items[1].late, false)
  assert.equal(items[2].status, "rejected")
  assert.equal(items[2].waitingMs, null)
  assert.equal(items[0].waitingMs, 30 * HOUR)
  assert.ok(30 * HOUR >= REVIEW_WAIT_LIMIT_MS)
  // What the founder sees is what is hashed and sent.
  assert.equal(items[0].text, old.payload.text)
  assert.equal(items[0].hash, old.hash)
})

test("reasons are grouped by the week; three repeats of one reason become a proposed rule, never 'other'", () => {
  const list: StoredApproval[] = []
  for (let n = 0; n < 3; n++) list.push(decided(approval(`t${n}`, at(-5 * HOUR)), "rejected", "tone", at(-4 * HOUR + n), `too formal ${n}`) as StoredApproval)
  for (let n = 0; n < 4; n++) list.push(decided(approval(`o${n}`, at(-5 * HOUR)), "rejected", "other", at(-4 * HOUR)) as StoredApproval)
  list.push(decided(approval("ok", at(-5 * HOUR)), "approved", "as-drafted", at(-4 * HOUR)) as StoredApproval)
  list.push(decided(approval("old", at(-9 * 24 * HOUR)), "rejected", "tone", at(-8 * 24 * HOUR)) as StoredApproval)
  list.push(approval("pending", at(-HOUR)))
  const groups = groupReasons(list, NOW)
  const tone = groups.find((g) => g.code === "tone")!
  assert.equal(tone.count, 3)
  assert.equal(tone.proposeRule, true)
  assert.deepEqual(tone.examples, ["too formal 2", "too formal 1", "too formal 0"])
  assert.equal(groups.find((g) => g.code === "other")!.proposeRule, false)
  assert.equal(groups.find((g) => g.code === "as-drafted")!.proposeRule, false)
})

function chain(taskId: string, steps: [LedgerEntry["kind"], number][]): LedgerEntry[] {
  let t = { id: taskId, seq: 0, head: "genesis" }
  return steps.map(([kind, ms]) => {
    const e = buildEntry(t, { kind, actor: "system" }, at(ms))
    t = { id: taskId, seq: e.seq, head: e.hash }
    return e
  })
}

test("handoff waits come from the ledger: arrival to draft, draft to decision, approval to sent", () => {
  const entries = [
    ...chain("t1", [["task_created", 0], ["run_started", 1000], ["draft_queued", 60_000], ["approved", 2 * HOUR], ["send_claimed", 2 * HOUR + 1], ["sent", 2 * HOUR + 3000]]),
    ...chain("t2", [["task_created", 0], ["draft_queued", 120_000], ["rejected", 6 * HOUR]]),
  ]
  const w = Object.fromEntries(handoffWaits(entries).map((x) => [x.handoff, x]))
  assert.deepEqual([w["arrival-to-draft"].samples, w["arrival-to-draft"].medianMs, w["arrival-to-draft"].maxMs], [2, 90_000, 120_000])
  assert.equal(w["draft-to-decision"].maxMs, 6 * HOUR - 120_000)
  assert.deepEqual([w["decision-to-send"].samples, w["decision-to-send"].medianMs], [1, 3000])
})

test("runs by state, failures with the ledger's reason, and cost by day, brand and task", () => {
  const t = (id: string, state: AgentTask["state"]) => ({ ...newTask({ id, property: "434", objective: "o", workflow: "w", budgetUsd: 1, lineage: { event: `e:${id}` }, now: NOW }), state })
  const tasks = [t("a", "sent"), t("b", "failed"), t("c", "needs_reconciliation"), t("d", "awaiting_review")]
  const entries = [...chain("b", [["task_created", 0], ["run_started", 1]]).map((e, n) => (n === 1 ? { ...e, reasonCode: "not-pinned" } : e))]
  const s = runSummary(tasks, entries)
  assert.deepEqual(s.byState, { sent: 1, failed: 1, needs_reconciliation: 1, awaiting_review: 1 })
  assert.deepEqual(s.failures.map((f) => [f.taskId, f.reasonCode]).sort(), [["b", "not-pinned"], ["c", undefined]])
  const c = costSummary([
    { at: "2026-11-13T10:00:00Z", task: "a", property: "434", usd: 0.01 },
    { at: "2026-11-14T10:00:00Z", task: "a", property: "434", usd: 0.02 },
    { at: "2026-11-14T11:00:00Z", task: "untracked", usd: 0.005 },
  ])
  assert.equal(Math.round(c.totalUsd * 1000), 35)
  assert.deepEqual(c.byDay.map((r) => r.key), ["2026-11-14", "2026-11-13"])
  assert.deepEqual([c.byTask[0].key, c.byTask[0].calls, Math.round(c.byTask[0].usd * 1000)], ["a", 2, 30])
  assert.equal(c.byProperty.find((r) => r.key === "(none)")!.calls, 1)
})

test("the watchdog watches the review queue (24 hours) and tasks that never started (1 hour)", () => {
  const review = QUEUES.find((q) => q.name === "agent-review")!
  assert.deepEqual([review.collection, review.where, review.limitMs], ["agent_tasks", { field: "state", equals: "awaiting_review" }, 24 * HOUR])
  assert.equal(QUEUES.find((q) => q.name === "agent-tasks-queued")!.limitMs, HOUR)
})

// ── The decision ────────────────────────────────────────────────────────────────────────────────────────────────────
async function drafted() {
  const db = new MemoryAgentDb()
  const a = approval("1", NOW)
  await createTask(db, newTask({ id: a.taskId, property: "434", objective: "intake-reply", workflow: "w", budgetUsd: 1, lineage: { event: "contact_forms:f1" }, now: NOW }), "system", NOW)
  await step(db, { taskId: a.taskId, at: at(1), decide: () => ({ fields: { kind: "run_started", actor: "system" }, to: "running" }) })
  await step(db, { taskId: a.taskId, at: at(2), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: a.id }, hashes: { draft: a.hash } }, to: "awaiting_review", write: (tx) => tx.createDoc(SEND_APPROVALS_COLLECTION, a.id, a) }) })
  return { db, a }
}

test("approving records the decision on the shown hash, a decision-memory record and the ledger entry, together; then it sends once", async () => {
  const { db, a } = await drafted()
  const out = await decideApproval({ approvalId: a.id, decision: "approved", shownHash: a.hash, reasonCode: "proof-run", reason: "Proof run: reads right." }, at(HOUR), db)
  assert.equal(out.approval?.reasonCode, "proof-run")
  assert.deepEqual(out.routing, a.routing)
  const memory = db.get<{ subject: { kind: string; id: string }; chosen: string; why: string; by: string; task_id: string }>(CRM_COLLECTIONS.DECISIONS, `dec-${a.id}`)!
  assert.equal(memory.subject.kind, "contact")
  assert.match(memory.subject.id, /^[a-f0-9]{64}$/)
  assert.match(memory.chosen, /Approved the intake reply \(routing: qualified\)/)
  assert.equal(memory.why, "Proof run: reads right.")
  assert.equal(memory.by, "founder")
  const last = db.entries(a.taskId).at(-1)!
  assert.deepEqual([last.kind, last.actor, last.reasonCode, last.refs?.decision], ["approved", "founder", "proof-run", `dec-${a.id}`])
  assert.ok(!JSON.stringify(db.entries(a.taskId)).includes("reads right"))
  assert.equal(db.task(a.taskId)!.state, "approved")
  // A second decision is refused.
  await assert.rejects(decideApproval({ approvalId: a.id, decision: "rejected", shownHash: a.hash, reasonCode: "tone", reason: "no" }, at(HOUR + 1), db), /already has a decision/)
  // And the approval sends through every control, once.
  const sends: string[] = []
  const deps = { db, controls: async () => parseControls({ stopped: false, sends: { intake_reply: true } }), dispatch: async (_p: unknown, key: string) => (sends.push(key), { messageId: "re_1" }), now: () => at(2 * HOUR), runId: "run-x", actor: "founder" }
  assert.equal((await sendApprovedEmail(a.id, deps)).sent, true)
  assert.equal((await sendApprovedEmail(a.id, { ...deps, runId: "run-y" })).sent, false)
  assert.equal(sends.length, 1)
  assert.deepEqual(verifyChain(db.entries(a.taskId)), { ok: true })
})

test("a decision is refused without a listed reason, without words, on a changed draft, or on a cancelled task", async () => {
  {
    const { db, a } = await drafted()
    await assert.rejects(decideApproval({ approvalId: a.id, decision: "approved", shownHash: a.hash, reasonCode: "tone", reason: "x" }, at(HOUR), db), /Pick a reason/)
    await assert.rejects(decideApproval({ approvalId: a.id, decision: "rejected", shownHash: a.hash, reasonCode: "tone", reason: "   " }, at(HOUR), db), /reason is required/)
    await assert.rejects(decideApproval({ approvalId: a.id, decision: "approved", shownHash: "0".repeat(64), reasonCode: "as-drafted", reason: "ok" }, at(HOUR), db), /changed since it was shown/)
    assert.equal(db.col(CRM_COLLECTIONS.DECISIONS).size, 0)
    assert.equal(db.task(a.taskId)!.state, "awaiting_review")
  }
  {
    const { db, a } = await drafted()
    await step(db, { taskId: a.taskId, at: at(3), decide: () => ({ fields: { kind: "cancelled", actor: "founder" }, to: "cancelled" }) })
    await assert.rejects(decideApproval({ approvalId: a.id, decision: "approved", shownHash: a.hash, reasonCode: "as-drafted", reason: "ok" }, at(HOUR), db), /cancelled/)
  }
})

test("a rejection is recorded with its reason and a look-again note, and the draft never sends", async () => {
  const { db, a } = await drafted()
  await decideApproval({ approvalId: a.id, decision: "rejected", shownHash: a.hash, reasonCode: "routing", reason: "This belongs with the partner." }, at(HOUR), db)
  assert.equal(db.task(a.taskId)!.state, "rejected")
  assert.ok(db.get<{ revisit_when?: string }>(CRM_COLLECTIONS.DECISIONS, `dec-${a.id}`)!.revisit_when)
  const r = await sendApprovedEmail(a.id, { db, controls: async () => parseControls({ stopped: false, sends: { intake_reply: true } }), dispatch: async () => ({ messageId: "x" }), now: () => at(2 * HOUR), runId: "r", actor: "founder" })
  assert.equal(r.sent, false)
})

// ── The guard ───────────────────────────────────────────────────────────────────────────────────────────────────────
test("every queue, switch, pin and exam route runs the founder guard first, and the page does too", () => {
  const root = join(__dirname, "..", "..")
  const routes = [
    "app/api/admin/review/route.ts",
    "app/api/admin/review/[id]/route.ts",
    "app/api/admin/review/waiting/route.ts",
    "app/api/admin/review/dismiss/route.ts",
    "app/api/admin/review/[id]/send/route.ts",
    "app/api/admin/agent/controls/route.ts",
    "app/api/admin/agent/skills/pin/route.ts",
    "app/api/admin/engine/exam/route.ts",
  ]
  for (const r of routes) {
    const src = readFileSync(join(root, r), "utf8")
    const handlers = [...src.matchAll(/export async function (GET|POST|PATCH)/g)].length
    const guarded = [...src.matchAll(/export async function (?:GET|POST|PATCH)\([^)]*\)\s*\{\n\s*const auth = await requireFounder\(/g)].length
    assert.ok(handlers > 0 && handlers === guarded, `${r}: every handler starts with requireFounder`)
  }
  // The console's page (the Agents page, 2026-11-16) is guarded before it renders; /admin/review is now the
  // "Waiting on you" view on the People page, whose drafts load from the founder-only routes above.
  const page = readFileSync(join(root, "app/admin/agents/page.tsx"), "utf8")
  assert.match(page, /founderPageAccess\("\/admin\/agents"\)/)
  assert.match(page, /forbidden\(\)/)
  assert.match(readFileSync(join(root, "app/admin/review/page.tsx"), "utf8"), /redirect\("\/admin\/todo"\)/)
})

// ── The flag, short (founder, 2026-11-19) ───────────────────────────────────────────────────────────────────────────
test("a flag shows its first sentence, at most 160 characters, with the rest one tap away", () => {
  assert.deepEqual(shortFlag("Agency asks for white-label work; decide whether to waive credit."), { short: "Agency asks for white-label work; decide whether to waive credit.", truncated: false })
  const long = "Online Marketing Gurus offers a referral partnership; decide whether to answer. They describe commissions, a portfolio of clients and a long pitch about results."
  assert.deepEqual(shortFlag(long), { short: "Online Marketing Gurus offers a referral partnership; decide whether to answer.", truncated: true })
  const run = shortFlag("word ".repeat(80))
  assert.ok(run.truncated && run.short.length <= FLAG_SHORT + 1 && run.short.endsWith("…"))
})

// ── Dismiss: spam or solicitation (founder, 2026-11-19) ─────────────────────────────────────────────────────────────
const ARRIVAL = (over: Partial<Activity> = {}) =>
  ({ id: "contact_forms:f1", type: "form", source: "website_form", occurred_at: NOW, contact: { name: "Pat Vendor", email: "Pat@Gurus.example", company: "Gurus" }, triaged: false, ...over }) as unknown as Activity

function dismissDeps(activity: Activity | null, fail: Partial<Record<keyof DismissDeps, boolean>> = {}) {
  const calls = { triaged: [] as string[], spam: [] as string[], senders: [] as DismissedSender[], decisions: [] as { id: string; chosen: string }[] }
  const boom = (k: keyof DismissDeps) => { if (fail[k]) throw new Error(`${k} down`) }
  const deps: DismissDeps = {
    activity: async () => activity,
    triage: async (a) => (boom("triage"), void calls.triaged.push(a.id)),
    markSpam: async (id) => (boom("markSpam"), void calls.spam.push(id)),
    recordSender: async (row) => (boom("recordSender"), void calls.senders.push(row)),
    recordDecision: async (m) => (boom("recordDecision"), void calls.decisions.push(m)),
  }
  return { deps, calls }
}

test("dismissing a draft rejects it as a solicitation, sends nothing, marks the submission spam, records the sender and closes the arrival", async () => {
  const { db, a: plain } = await drafted()
  const a = { ...plain, arrival: { formId: "f1", receivedAt: NOW } }
  await step(db, { taskId: a.taskId, at: at(3), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: a.id } }, write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, a.id, a) }) })
  const { deps, calls } = dismissDeps(ARRIVAL())
  const out = await dismissSolicitation({ activityId: "contact_forms:f1", approvalId: a.id, shownHash: a.hash, actor: "founder@example.test" }, deps, at(HOUR), db)
  assert.deepEqual(out, { dismissed: true, activityId: "contact_forms:f1", draftRejected: true, leftInbox: true, warnings: [] })
  const stored = db.get<StoredApproval>(SEND_APPROVALS_COLLECTION, a.id)!
  assert.equal(stored.rejection?.reasonCode, "solicitation")
  assert.equal(stored.rejection?.reason, DISMISS_DEFAULT_REASON)
  assert.equal(db.task(a.taskId)!.state, "rejected")
  assert.match(db.get<{ chosen: string }>(CRM_COLLECTIONS.DECISIONS, `dec-${a.id}`)!.chosen, /Dismissed the arrival as spam or a solicitation; no reply/)
  assert.deepEqual(calls.spam, ["f1"])
  assert.deepEqual(calls.senders.map((r) => [r.email, r.domain, r.formId]), [["pat@gurus.example", "gurus.example", "f1"]])
  assert.deepEqual(calls.triaged, ["contact_forms:f1"])
  assert.equal(calls.decisions.length, 0, "the rejection wrote the decision memory")
  // Nothing sends: the rejected draft is refused by the send path.
  const r = await sendApprovedEmail(a.id, { db, controls: async () => parseControls({ stopped: false, sends: { intake_reply: true } }), dispatch: async () => ({ messageId: "x" }), now: () => at(2 * HOUR), runId: "r", actor: "founder" })
  assert.equal(r.sent, false)
})

test("dismissing an arrival held with no draft records the decision; a free-mail sender is recorded without a domain", async () => {
  const db = new MemoryAgentDb()
  const { deps, calls } = dismissDeps(ARRIVAL({ contact: { email: "pat.vendor@gmail.com" } } as Partial<Activity>))
  const out = await dismissSolicitation({ activityId: "contact_forms:f1", reason: "SEO pitch", actor: "founder@example.test" }, deps, at(HOUR), db)
  assert.equal(out.draftRejected, false)
  assert.deepEqual(calls.decisions.map((d) => [d.id, d.chosen]), [["dec-dismiss-f1", "Dismissed the arrival as spam or a solicitation; no reply was sent"]])
  assert.deepEqual(calls.senders.map((r) => [r.email, r.domain]), [["pat.vendor@gmail.com", ""]])
  assert.deepEqual(calls.spam, ["f1"])
  assert.deepEqual(calls.triaged, ["contact_forms:f1"])
})

test("a dismissal is refused for another kind of arrival, a draft for a different arrival, or a changed draft; a later step that fails is a warning", async () => {
  const { db, a: plain } = await drafted()
  const a = { ...plain, arrival: { formId: "other", receivedAt: NOW } }
  await step(db, { taskId: a.taskId, at: at(3), decide: () => ({ fields: { kind: "draft_queued", actor: "system", refs: { approval: a.id } }, write: (tx) => tx.setDoc(SEND_APPROVALS_COLLECTION, a.id, a) }) })
  await assert.rejects(dismissSolicitation({ activityId: "phone:1", actor: "f" }, dismissDeps(ARRIVAL()).deps, at(HOUR), db), /website-form arrival/)
  await assert.rejects(dismissSolicitation({ activityId: "contact_forms:f1", approvalId: a.id, shownHash: a.hash, actor: "f" }, dismissDeps(ARRIVAL()).deps, at(HOUR), db), /different arrival/)
  await assert.rejects(dismissSolicitation({ activityId: "contact_forms:other", approvalId: a.id, shownHash: "0".repeat(64), actor: "f" }, dismissDeps(ARRIVAL({ id: "contact_forms:other" } as Partial<Activity>)).deps, at(HOUR), db), /changed since it was shown/)
  await assert.rejects(dismissSolicitation({ activityId: "contact_forms:f9", actor: "f" }, dismissDeps(null).deps, at(HOUR), db), /not in the inbox/)
  const { deps, calls } = dismissDeps(ARRIVAL(), { markSpam: true, triage: true })
  const out = await dismissSolicitation({ activityId: "contact_forms:f1", actor: "f" }, deps, at(HOUR), new MemoryAgentDb())
  assert.equal(out.leftInbox, false)
  assert.equal(out.warnings.length, 2)
  assert.equal(calls.senders.length, 1, "the sender is still recorded")
})
