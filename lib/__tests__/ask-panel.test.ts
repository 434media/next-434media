/**
 * Offline. The Ask panel, slice 1 (lib/ask/; V1 item 4): who is offered the tools, the money and send refusals, the
 * Undo rules for a task edit, the hash-bound Confirm, the switch, the ledger's new kinds, and one whole turn on the
 * engine with a scripted model and an invented skill. Every store is in memory; nothing is sent.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { MockLanguageModelV4 } from "ai/test"
import { fingerprint, type SkillFiles } from "../skills/loader"
import { ASK_SKILL, ASK_TOOLS, ASK_TOOL_LIMIT, CONTEXT_TOOL, toolsFor } from "../connector-434/tools"
import { askOn, parseControls, type AgentControls } from "../agent/controls"
import { checkFields, newTask, verifyChain } from "../agent/ledger"
import { createTask } from "../agent/ledger-server"
import { refusal } from "../engine/tool-policy"
import { ASK_DECLARATIONS, UNDO_WINDOW_MS, askActor, askPermitted, classifyAsk, proposalHash, stageMoveProblem, boundedHistory } from "../ask/policy"
import { AskRefused, TASKS_COLLECTION, applyTaskEdit, undoTaskEdit } from "../ask/edits"
import { confirmStageChange, parseConfirm, type ConfirmDeps } from "../ask/confirm"
import { runAskTurn, type AskData, type AskDeps, type AskPerson } from "../ask/run"
import type { SkillPin } from "../agent/intake"
import { MemoryAgentDb } from "./helpers/agent-db"
import { ASK_COST_KIND, ASK_MODEL, ASK_MONTHLY_CAP_USD, askCapMessage, askMonthlyCapUsd, askSpendOf, monthStartOf } from "../ask/limits"
import { modelAllowed } from "../engine/models"

const NOW = "2026-11-18T15:00:00.000Z"
const at = (ms = 0) => new Date(Date.parse(NOW) + ms).toISOString()
const COMMIT = "b".repeat(40)
const ON: AgentControls = parseControls({ stopped: false, sends: {}, ask: true })
const FOUNDER: AskPerson = { email: "founder@example.test", role: "full_admin", founder: true, actor: "founder", permitted: true }
const MEMBER: AskPerson = { email: "member@example.test", role: "crm_only", founder: false, actor: "member:abc123", permitted: true }

// ── Who is offered what ─────────────────────────────────────────────────────────────────────────────────────────────
test("a person without admin-ask gets no Ask tool; a holder gets them, at most eight with the context tool", () => {
  assert.deepEqual(toolsFor({ email: "a@example.test", role: "full_admin", skills: [] }).map((t) => t.name), [CONTEXT_TOOL.name])
  assert.deepEqual(toolsFor({ email: "a@example.test", role: "crm_super_admin", skills: ["434-intake-qualification"] }).map((t) => t.name), [CONTEXT_TOOL.name])
  const held = toolsFor({ email: "a@example.test", role: "intern", skills: [ASK_SKILL] })
  assert.equal(held.length, 1 + ASK_TOOLS.length)
  assert.ok(held.length <= ASK_TOOL_LIMIT)
  // No tool sends, publishes, or carries a money word in its name.
  for (const t of held) {
    assert.ok(["read", "draft", "write"].includes(t.class), `${t.name} is ${t.class}`)
    assert.doesNotMatch(t.name, /send|email|post|publish|invoice|pay|finance/)
  }
})

test("the permission is the founder, or an explicit skill:admin-ask entry; a role grants nothing", () => {
  assert.equal(askPermitted({ founder: true, record: null }), true)
  assert.equal(askPermitted({ founder: false, record: { role: "crm_super_admin", isActive: true, permissions: [] } }), false)
  assert.equal(askPermitted({ founder: false, record: { role: "crm_only", isActive: true, permissions: ["content"] } }), false)
  assert.equal(askPermitted({ founder: false, record: { role: "crm_only", isActive: true, permissions: ["skill:admin-ask"] } }), true)
  assert.equal(askPermitted({ founder: false, record: { role: "crm_only", isActive: false, permissions: ["skill:admin-ask"] } }), false)
  assert.equal(askActor({ founder: false, memberId: "abc123" }), "member:abc123")
  assert.equal(askActor({ founder: false, memberId: "a@b.c" }), null)
  assert.equal(askActor({ founder: true }), "founder")
})

test("the tool policy admits the write tools at the approval level and refuses them at draft (the plan's open check)", () => {
  const never = () => false
  for (const t of ASK_TOOLS.filter((x) => x.class === "write")) {
    assert.equal(refusal(t.name, ASK_DECLARATIONS[t.name], "approval", never), null)
    assert.match(refusal(t.name, ASK_DECLARATIONS[t.name], "draft", never) ?? "", /draft level has none/)
    assert.match(refusal(t.name, ASK_DECLARATIONS[t.name], "autonomous", never) ?? "", /never autonomous/)
  }
  assert.equal(refusal("propose_stage_change", ASK_DECLARATIONS.propose_stage_change, "draft", never), null)
})

// ── Money and sends ─────────────────────────────────────────────────────────────────────────────────────────────────
test("money and send requests are refused with a link, before any model call", async () => {
  for (const q of ["What did we invoice Riverwalk last month?", "Log a payment of $500", "Show me the revenue projection", "What's our rate for a shoot?"]) {
    assert.equal(classifyAsk(q)?.kind, "money", q)
    assert.equal(classifyAsk(q)?.link.href, "/admin/finance")
  }
  for (const q of ["Email Sam back that we can do the 12th", "Send the reply to Dana", "please reply to Lee", "Post this on Instagram", "Can you forward the brief to Barb"]) {
    assert.equal(classifyAsk(q)?.kind, "send", q)
    assert.equal(classifyAsk(q)?.link.href, "/admin/todo")
  }
  for (const q of ["What's waiting on me today?", "Who emailed us from Riverwalk?", "Move the deck task to Friday", "Make Lee a lead"]) {
    assert.equal(classifyAsk(q), null, q)
  }
  const { deps, calls } = turnSetup()
  const out = await runAskTurn({ question: "Send Dana the reply", history: [] }, FOUNDER, deps)
  assert.equal(out.ok, false)
  assert.equal(!out.ok && out.code, "refused-send")
  assert.equal(!out.ok && out.link?.href, "/admin/todo")
  assert.equal(calls.length, 0)
})

// ── The switch ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("Ask is off unless stored exactly on, and a stop turns it off", () => {
  assert.equal(askOn(parseControls({ stopped: false, sends: {} })), false)
  assert.equal(askOn(parseControls({ stopped: false, sends: {}, ask: "yes" })), false)
  assert.equal(askOn(parseControls({ stopped: true, sends: {}, ask: true })), false)
  assert.equal(askOn(ON), true)
})

test("a turn with the switch off, or for a person not granted, makes no task and no call", async () => {
  const off = turnSetup({ controls: parseControls({ stopped: false, sends: {} }) })
  const a = await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, off.deps)
  assert.equal(!a.ok && a.code, "off")
  const denied = turnSetup()
  const b = await runAskTurn({ question: "What's waiting?", history: [] }, { ...MEMBER, permitted: false }, denied.deps)
  assert.equal(!b.ok && b.code, "not-permitted")
  assert.equal(off.db.col("agent_tasks").size + denied.db.col("agent_tasks").size, 0)
  assert.equal(off.calls.length + denied.calls.length, 0)
})

// ── The ledger ──────────────────────────────────────────────────────────────────────────────────────────────────────
test("the ledger takes edit_applied and edit_undone with a record id, and still refuses words", () => {
  assert.doesNotThrow(() => checkFields({ kind: "edit_applied", actor: "member:abc123", refs: { activity: "ask-1-e1", record: "task9" }, hashes: { input: "a".repeat(64) } }))
  assert.doesNotThrow(() => checkFields({ kind: "edit_undone", actor: "founder", refs: { record: "task9" } }))
  assert.throws(() => checkFields({ kind: "edit_applied", actor: "founder", refs: { record: "dana@example.test" } }))
  assert.throws(() => checkFields({ kind: "edit_applied", actor: "founder", refs: { record: "Move the deck to Friday" } }))
})

// ── Task edits and Undo ─────────────────────────────────────────────────────────────────────────────────────────────
async function editSetup() {
  const db = new MemoryAgentDb()
  const turn = "ask-turn1"
  await createTask(db, newTask({ id: turn, property: "434", objective: "ask", workflow: "admin-ask/approval", budgetUsd: 0.5, lineage: { event: "ask:turn1" }, requestedBy: "member:abc123", now: NOW }), "member:abc123", NOW)
  db.col(TASKS_COLLECTION).set("task9", { title: "Deck for Riverwalk", status: "in_progress", assigned_to: "Barb", due_date: "2026-11-20", priority: "high" })
  return { db, turn }
}

test("a task edit writes the task, a record_edit Activity with the value before, and edit_applied, together", async () => {
  const { db, turn } = await editSetup()
  const e = await applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "task9", patch: { due_date: "2026-11-21", status: "completed" }, by: MEMBER.email, actor: MEMBER.actor!, now: at(1000) })
  const task = db.get<Record<string, unknown>>(TASKS_COLLECTION, "task9")!
  assert.equal(task.due_date, "2026-11-21")
  assert.equal(task.status, "completed")
  assert.equal(task.completed_date, at(1000))
  assert.equal(task.priority, "high", "untouched fields stay")
  const act = db.get<{ type: string; change: { field: string; before: unknown }[]; created_by: string }>("crm_activities", e.activityId)!
  assert.equal(act.type, "record_edit")
  assert.equal(act.created_by, MEMBER.email)
  assert.deepEqual(act.change.find((c) => c.field === "due_date")?.before, "2026-11-20")
  assert.ok(db.get("crm_activity_triage", e.activityId), "triaged at once, so it never reaches the inbox")
  const entries = db.entries(turn)
  assert.equal(entries.at(-1)?.kind, "edit_applied")
  assert.deepEqual(entries.at(-1)?.refs, { activity: e.activityId, record: "task9" })
  assert.ok(verifyChain(entries).ok)
  assert.doesNotMatch(JSON.stringify(entries), /Riverwalk|member@example/)
})

test("Undo puts the values back once, for the maker or the founder, inside the window only", async () => {
  const { db, turn } = await editSetup()
  const e = await applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "task9", patch: { assigned_to: "Jesse" }, by: MEMBER.email, actor: MEMBER.actor!, now: at(0) })
  // Someone else, not the founder: refused.
  await assert.rejects(undoTaskEdit({ db, activityId: e.activityId, by: "other@example.test", founder: false, actor: "member:zzz", now: at(1000) }), (err: AskRefused) => err.status === 403)
  // After the window: refused, even for the maker.
  await assert.rejects(undoTaskEdit({ db, activityId: e.activityId, by: MEMBER.email, founder: false, actor: MEMBER.actor!, now: at(UNDO_WINDOW_MS + 1) }), (err: AskRefused) => err.status === 409 && /Too late/.test(err.message))
  assert.equal(db.get<Record<string, unknown>>(TASKS_COLLECTION, "task9")!.assigned_to, "Jesse")
  // The maker, in time: back.
  await undoTaskEdit({ db, activityId: e.activityId, by: MEMBER.email, founder: false, actor: MEMBER.actor!, now: at(5000) })
  assert.equal(db.get<Record<string, unknown>>(TASKS_COLLECTION, "task9")!.assigned_to, "Barb")
  assert.equal(db.entries(turn).at(-1)?.kind, "edit_undone")
  // Twice: refused.
  await assert.rejects(undoTaskEdit({ db, activityId: e.activityId, by: MEMBER.email, founder: false, actor: MEMBER.actor!, now: at(6000) }), (err: AskRefused) => err.status === 409)
})

test("the founder may undo another person's edit; a field changed again since is never overwritten", async () => {
  const { db, turn } = await editSetup()
  const e = await applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "task9", patch: { status: "blocked" }, by: MEMBER.email, actor: MEMBER.actor!, now: at(0) })
  db.col(TASKS_COLLECTION).set("task9", { ...db.get<object>(TASKS_COLLECTION, "task9"), status: "deferred" })
  await assert.rejects(undoTaskEdit({ db, activityId: e.activityId, by: FOUNDER.email, founder: true, actor: "founder", now: at(1000) }), /changed since/)
  db.col(TASKS_COLLECTION).set("task9", { ...db.get<object>(TASKS_COLLECTION, "task9"), status: "blocked" })
  await undoTaskEdit({ db, activityId: e.activityId, by: FOUNDER.email, founder: true, actor: "founder", now: at(2000) })
  assert.equal(db.get<Record<string, unknown>>(TASKS_COLLECTION, "task9")!.status, "in_progress")
})

test("a task edit with nothing to change, a bad date or an unknown task writes nothing", async () => {
  const { db, turn } = await editSetup()
  const seq = db.task(turn)!.seq
  await assert.rejects(applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "task9", patch: { due_date: "Friday" }, by: MEMBER.email, actor: MEMBER.actor!, now: NOW }), /YYYY-MM-DD/)
  await assert.rejects(applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "task9", patch: { status: "in_progress" }, by: MEMBER.email, actor: MEMBER.actor!, now: NOW }), /already has/)
  await assert.rejects(applyTaskEdit({ db, turnTaskId: turn, n: 1, taskId: "nope", patch: { status: "blocked" }, by: MEMBER.email, actor: MEMBER.actor!, now: NOW }), /not found/)
  assert.equal(db.task(turn)!.seq, seq)
  assert.equal(db.col("crm_activities").size, 0)
})

// ── Confirm ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function confirmSetup(target: { from: string | null; revision: string }) {
  const db = new MemoryAgentDb()
  const applied: string[] = []
  const deps: ConfirmDeps = {
    db,
    controls: async () => ON,
    data: { stageTarget: async () => ({ name: "Riverwalk Events", ...target }) },
    apply: async (kind, id, to) => void applied.push(`${kind}:${id}:${to}`),
    now: () => NOW,
  }
  return { db, deps, applied }
}

test("a Confirm with a stale hash is refused and changes nothing; a fresh one goes through the existing path", async () => {
  const shown = { kind: "opportunity" as const, id: "opp1", from: "proposal", to: "closed_won", revision: "2026-11-18T10:00:00.000Z" }
  const hash = proposalHash(shown)
  // The record moved since the card was shown.
  const stale = confirmSetup({ from: "proposal", revision: "2026-11-18T14:00:00.000Z" })
  await createTask(stale.db, newTask({ id: "ask-t1", property: "434", objective: "ask", workflow: "admin-ask/approval", budgetUsd: 0.5, lineage: { event: "ask:t1" }, requestedBy: "founder", now: NOW }), "founder", NOW)
  await assert.rejects(confirmStageChange({ taskId: "ask-t1", kind: "opportunity", id: "opp1", to: "closed_won", hash }, FOUNDER, stale.deps), (e: AskRefused) => e.status === 409 && /out of date/.test(e.message))
  assert.deepEqual(stale.applied, [])
  // As shown: made, and on the ledger with the hash.
  const fresh = confirmSetup({ from: "proposal", revision: shown.revision })
  await createTask(fresh.db, newTask({ id: "ask-t1", property: "434", objective: "ask", workflow: "admin-ask/approval", budgetUsd: 0.5, lineage: { event: "ask:t1" }, requestedBy: "founder", now: NOW }), "founder", NOW)
  await confirmStageChange({ taskId: "ask-t1", kind: "opportunity", id: "opp1", to: "closed_won", hash }, FOUNDER, fresh.deps)
  assert.deepEqual(fresh.applied, ["opportunity:opp1:closed_won"])
  const last = fresh.db.entries("ask-t1").at(-1)!
  assert.equal(last.kind, "edit_applied")
  assert.equal(last.hashes?.approval, hash)
})

test("a Confirm refuses another person's card, a customer moving back, and a malformed body", async () => {
  const s = confirmSetup({ from: "customer", revision: "r1" })
  await createTask(s.db, newTask({ id: "ask-t2", property: "434", objective: "ask", workflow: "admin-ask/approval", budgetUsd: 0.5, lineage: { event: "ask:t2" }, requestedBy: "member:abc123", now: NOW }), "member:abc123", NOW)
  const back = { kind: "person" as const, id: "p1", from: "customer", to: "lead", revision: "r1" }
  await assert.rejects(confirmStageChange({ taskId: "ask-t2", ...back, hash: proposalHash(back) }, MEMBER, s.deps), /never reverts/)
  const other = confirmSetup({ from: "lead", revision: "r1" })
  await createTask(other.db, newTask({ id: "ask-t3", property: "434", objective: "ask", workflow: "admin-ask/approval", budgetUsd: 0.5, lineage: { event: "ask:t3" }, requestedBy: "member:someone", now: NOW }), "member:someone", NOW)
  const up = { kind: "person" as const, id: "p1", from: "lead", to: "customer", revision: "r1" }
  await assert.rejects(confirmStageChange({ taskId: "ask-t3", ...up, hash: proposalHash(up) }, MEMBER, other.deps), (e: AskRefused) => e.status === 403)
  assert.deepEqual(s.applied.concat(other.applied), [])
  assert.equal(parseConfirm({ taskId: "ask-t3", kind: "opportunity", id: "x", to: "paid", hash: "a".repeat(64) }), null)
  assert.equal(parseConfirm({ taskId: "intake-1", kind: "opportunity", id: "x", to: "closed_won", hash: "a".repeat(64) }), null)
  assert.equal(stageMoveProblem("opportunity", "proposal", "proposal"), "It is already at that stage.")
})

// ── One whole turn ──────────────────────────────────────────────────────────────────────────────────────────────────
const SKILL: SkillFiles = {
  "SKILL.md": `---\nname: ${ASK_SKILL}\ndescription: Invented test skill. Answer questions about invented admin data.\nallowed-tools: get_434_context whats_waiting find triage_arrival update_task propose_stage_change\n---\n\n# Invented Ask\n\nAnswer from the tools. Never send; never touch money.\n`,
}
const PIN: SkillPin = { skill: ASK_SKILL, commit: COMMIT, sha256: fingerprint(SKILL), catalogSha256: "c".repeat(64), ceiling: "approval", pinnedBy: "founder", pinnedAt: NOW }
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 5, text: 5, reasoning: 0 } }

function scriptedModel(steps: { tool?: string; input?: unknown; text?: string }[]) {
  const calls: unknown[] = []
  const model = new MockLanguageModelV4({
    doGenerate: async (o) => {
      calls.push(o)
      const s = steps[Math.min(calls.length - 1, steps.length - 1)]
      if (s.tool) return { content: [{ type: "tool-call" as const, toolCallId: String(calls.length), toolName: s.tool, input: JSON.stringify(s.input) }], finishReason: { unified: "tool-calls" as const, raw: undefined }, usage, warnings: [] }
      return { content: [{ type: "text" as const, text: s.text ?? "Done." }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [] }
    },
  })
  return { model, calls }
}

function turnSetup(opts: { controls?: AgentControls; pin?: SkillPin | null; steps?: { tool?: string; input?: unknown; text?: string }[]; turns?: number; monthSpend?: () => Promise<number> } = {}) {
  const db = new MemoryAgentDb()
  db.col(TASKS_COLLECTION).set("task9", { title: "Deck for Riverwalk", status: "in_progress", assigned_to: "Barb", due_date: "2026-11-20" })
  const { model, calls } = scriptedModel(opts.steps ?? [{ text: "Nothing is waiting." }])
  const data: AskData = {
    context: async () => ({ company: "invented" }),
    waiting: async () => ({ drafts: [], arrivals: [] }),
    find: async () => ({ tasks: [{ id: "task9", title: "Deck for Riverwalk" }] }),
    triage: async (id) => ({ activityId: id, label: "Lee: made a lead" }),
    stageTarget: async () => ({ name: "Riverwalk Events", from: "proposal", revision: "r1" }),
  }
  let clock = 0, n = 0
  const slugs: string[] = []
  const monthStarts: string[] = []
  const deps: AskDeps = {
    db,
    controls: async () => opts.controls ?? ON,
    pin: async () => (opts.pin === undefined ? PIN : opts.pin),
    skillAt: async () => SKILL,
    turnsToday: async () => opts.turns ?? 0,
    monthSpend: async (start) => {
      monthStarts.push(start)
      return opts.monthSpend ? opts.monthSpend() : 0
    },
    monthlyCapUsd: ASK_MONTHLY_CAP_USD,
    taskSpend: async () => 0,
    model: (slug) => {
      slugs.push(slug)
      return model
    },
    data,
    now: () => at(clock++ * 1000),
    newId: () => `id${++n}`,
  }
  return { db, deps, calls, slugs, monthStarts }
}

test("a turn runs on the engine as a task requested by the person, applies a task edit with Undo, and proposes a stage change", async () => {
  const { db, deps } = turnSetup({
    steps: [
      { tool: "find", input: { query: "deck", kinds: ["tasks"] } },
      { tool: "update_task", input: { task_id: "task9", due_date: "2026-11-21" } },
      { tool: "propose_stage_change", input: { kind: "opportunity", id: "opp1", to: "closed_won" } },
      { text: "Moved the deck to the 21st. Confirm the Riverwalk win below." },
    ],
  })
  const out = await runAskTurn({ question: "Move the deck task to the 21st and mark Riverwalk won", history: [] }, MEMBER, deps)
  assert.ok(out.ok, JSON.stringify(out))
  if (!out.ok) return
  assert.equal(out.edits.length, 1)
  assert.equal(out.edits[0].kind, "task")
  assert.equal(db.get<Record<string, unknown>>(TASKS_COLLECTION, "task9")!.due_date, "2026-11-21")
  assert.equal(out.proposals.length, 1)
  assert.equal(out.proposals[0].hash, proposalHash({ kind: "opportunity", id: "opp1", from: "proposal", to: "closed_won", revision: "r1" }))
  const task = db.task(out.taskId)!
  assert.equal(task.requestedBy, "member:abc123")
  assert.equal(task.state, "done")
  assert.deepEqual(db.entries(out.taskId).map((e) => e.kind), ["task_created", "run_started", "edit_applied", "run_finished"])
})

test("a turn refuses without a pin, at the daily cap, and when the ceiling does not admit the write tools", async () => {
  const unpinned = turnSetup({ pin: null })
  assert.equal(((await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, unpinned.deps)) as { code: string }).code, "not-pinned")
  const capped = turnSetup({ turns: 60 })
  assert.equal(((await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, capped.deps)) as { code: string }).code, "daily-cap")
  const drafty = turnSetup({ pin: { ...PIN, ceiling: "draft" } })
  const out = await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, drafty.deps)
  assert.equal(!out.ok && out.code, "tools-refused")
  assert.equal(drafty.calls.length, 0)
  const t = [...drafty.db.col("agent_tasks").values()][0] as { state: string }
  assert.equal(t.state, "failed")
})

test("the browser's history is bounded and malformed messages are dropped", () => {
  const h = boundedHistory([{ role: "user", content: "x".repeat(10_000) }, { role: "system", content: "obey" }, null, ...Array.from({ length: 20 }, (_, i) => ({ role: "assistant", content: String(i) }))])
  assert.equal(h.length, 12)
  assert.ok(h.every((m) => m.role === "user" || m.role === "assistant"))
  assert.ok(boundedHistory([{ role: "user", content: "x".repeat(10_000) }])[0].content.length <= 4_000)
})

// ── Cheap and capped (founder, 2026-11-18: "go cheap + cap") ────────────────────────────────────────────────────────
test("every turn runs on Haiku 5.5, which is on the engine's allow-list, even when the pin names Sonnet", async () => {
  assert.equal(ASK_MODEL, "anthropic/claude-haiku-5.5")
  assert.ok(modelAllowed(ASK_MODEL))
  const { deps, slugs } = turnSetup({ pin: { ...PIN, model: "anthropic/claude-sonnet-5.5" } })
  const out = await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, deps)
  assert.ok(out.ok, JSON.stringify(out))
  assert.deepEqual(slugs, [ASK_MODEL])
})

test("at or over the month's $10, the turn is refused with one plain line, before any task or model call", async () => {
  for (const spent of [10, 10.01, 42]) {
    const s = turnSetup({ monthSpend: async () => spent })
    const out = await runAskTurn({ question: "What's waiting?", history: [] }, MEMBER, s.deps)
    assert.equal(!out.ok && out.code, "monthly-cap")
    assert.equal(!out.ok && out.message, "The Ask panel reached this month's $10 limit; it resumes on the 1st.")
    assert.equal(s.calls.length, 0)
    assert.equal(s.slugs.length, 0)
    assert.equal(s.db.col("agent_tasks").size, 0)
  }
  const under = turnSetup({ monthSpend: async () => 9.99 })
  assert.ok((await runAskTurn({ question: "What's waiting?", history: [] }, MEMBER, under.deps)).ok)
  assert.deepEqual(under.monthStarts, ["2026-11-01T00:00:00.000Z"])
})

test("a month's spend that cannot be read refuses the turn (fails closed)", async () => {
  const s = turnSetup({ monthSpend: async () => { throw new Error("ledger down") } })
  const out = await runAskTurn({ question: "What's waiting?", history: [] }, FOUNDER, s.deps)
  assert.equal(!out.ok && out.code, "cap-unreadable")
  assert.equal(s.calls.length, 0)
  assert.equal(s.db.col("agent_tasks").size, 0)
})

test("Ask's month spend counts only Ask's records from the 1st (UTC), and the cap override cannot be lifted by a typo", () => {
  const since = monthStartOf("2026-11-18T15:00:00.000Z")
  assert.equal(since, "2026-11-01T00:00:00.000Z")
  const total = askSpendOf(
    [
      { kind: ASK_COST_KIND, at: "2026-11-01T00:00:00.000Z", usd: 1.25 },
      { kind: ASK_COST_KIND, at: "2026-11-17T09:00:00.000Z", usd: 0.5 },
      { kind: ASK_COST_KIND, at: "2026-10-31T23:59:59.999Z", usd: 100 },
      { kind: "content-pipeline", at: "2026-11-10T00:00:00.000Z", usd: 100 },
      { kind: ASK_COST_KIND, at: "2026-11-10T00:00:00.000Z", usd: Number.NaN },
      { kind: ASK_COST_KIND, at: "2026-11-10T00:00:00.000Z" },
    ],
    since,
  )
  assert.equal(total, 1.75)
  assert.equal(askMonthlyCapUsd({}), 10)
  assert.equal(askMonthlyCapUsd({ ASK_MONTHLY_CAP_USD: "25" }), 25)
  for (const bad of ["", "ten", "0", "-5", "Infinity"]) assert.equal(askMonthlyCapUsd({ ASK_MONTHLY_CAP_USD: bad }), 10)
  assert.equal(askCapMessage(12.5), "The Ask panel reached this month's $12.50 limit; it resumes on the 1st.")
})
