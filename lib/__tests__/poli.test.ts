/**
 * Polí's rule pass, slice 1 (lib/agent/poli.ts, lib/agent/poli-server.ts; V1 item 4): which path each open task takes,
 * the founder-owned tasks and ledger entries it writes, that a second pass writes nothing, the open-task cap, the
 * switch, the Today line, and that no model is called. In-memory store with Firestore's transaction rules.
 * Run: tsx --test lib/__tests__/poli.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { MemoryAgentDb } from "./helpers/agent-db"
import { verifyChain } from "../agent/ledger"
import { IDLE_DAYS, MAX_OPEN_POLI, planPass, poliTodayLine, routeTask, type PoliMode, type PoliTaskView } from "../agent/poli"
import { CRM_TASKS, readPoliMode, runPoliPass, taskView, toIso, type PoliPassDeps } from "../agent/poli-server"
import { todayBrief } from "../agent/today"
import { STAGING_PROJECT_ID } from "../preview-auth"

const NOW = "2026-11-21T15:00:00.000Z"
const DAY = 24 * 3_600_000
const daysAgo = (d: number) => new Date(Date.parse(NOW) - d * DAY).toISOString()
const fresh = daysAgo(1)

/** A healthy task: owned, dated in the future, changed yesterday. Nothing to do. */
const base = (id: string, over: Partial<PoliTaskView> = {}): PoliTaskView => ({
  id,
  title: `Task ${id}`,
  assigned_to: "Jesse Hernandez",
  due_date: "2026-12-15",
  status: "not_started",
  created_at: daysAgo(3),
  updated_at: fresh,
  ...over,
})

function store(tasks: PoliTaskView[]) {
  const db = new MemoryAgentDb()
  for (const t of tasks) {
    const { id, ...rest } = t
    db.col(CRM_TASKS).set(id, JSON.parse(JSON.stringify(rest)))
  }
  return db
}

function deps(db: MemoryAgentDb, over: Partial<PoliPassDeps> = {}): PoliPassDeps {
  return {
    db,
    mode: async () => "draft",
    listOpen: async () => ({
      tasks: [...db.col(CRM_TASKS).entries()].map(([id, d]) => taskView(id, d as Record<string, unknown>)).filter((t) => t.status !== "completed"),
      truncated: false,
    }),
    founder: async () => "Founder Name",
    now: () => NOW,
    ...over,
  }
}

const poliTasks = (db: MemoryAgentDb) => [...db.col(CRM_TASKS).entries()].filter(([, d]) => (d as { source?: string }).source === "poli")

test("each open task takes one declared path, or none", () => {
  assert.equal(routeTask(base("a"), NOW), null)
  assert.deepEqual(routeTask(base("a", { assigned_to: "" }), NOW), { path: "assign", why: "no-owner" })
  assert.deepEqual(routeTask(base("a", { assigned_to: "Unassigned" }), NOW), { path: "assign", why: "no-owner" })
  assert.deepEqual(routeTask(base("a", { due_date: "2026-11-20" }), NOW), { path: "follow-up", why: "overdue" })
  // Due today is not overdue.
  assert.equal(routeTask(base("a", { due_date: "2026-11-21" }), NOW), null)
  assert.deepEqual(routeTask(base("a", { updated_at: daysAgo(IDLE_DAYS) }), NOW), { path: "follow-up", why: "idle" })
  assert.equal(routeTask(base("a", { updated_at: daysAgo(IDLE_DAYS - 1) }), NOW), null)
  assert.deepEqual(routeTask(base("a", { due_date: undefined }), NOW), { path: "assign", why: "no-due-date" })
  assert.deepEqual(routeTask(base("a", { source: "connector", assigned_to: "" }), NOW), { path: "handled-elsewhere", why: "assistant-created" })
  // Closed tasks and Polí's own are never routed.
  assert.equal(routeTask(base("a", { status: "completed", assigned_to: "" }), NOW), null)
  assert.equal(routeTask(base("a", { status: "deferred", assigned_to: "" }), NOW), null)
  assert.equal(routeTask(base("a", { source: "poli", due_date: undefined }), NOW), null)
})

test("the plan raises the most urgent first, one open Polí task per record, and holds the rest past the cap", () => {
  const tasks = [
    base("nodate", { due_date: undefined }),
    base("idle", { updated_at: daysAgo(20) }),
    base("late", { due_date: "2026-11-01" }),
    base("owner", { assigned_to: "" }),
    base("raised", { assigned_to: "" }),
    base("p1", { source: "poli", poli: { path: "assign", record: "crm_tasks:raised" } }),
  ]
  const plan = planPass(tasks, NOW, 3)
  assert.deepEqual(plan.raise.map((f) => f.task.id), ["owner", "late"])
  assert.deepEqual(plan.held.map((f) => f.task.id), ["idle", "nodate"])
  assert.deepEqual(plan.open, { assign: 1, "follow-up": 0 })
  assert.equal(plan.lastTrueUp, null)
})

test("draft: a finding becomes a founder-owned task and three chained ledger entries, committed together", async () => {
  const db = store([base("t1", { ref: "TSK-7", assigned_to: "", brand: "DEVSA" }), base("ok")])
  const numbered: string[] = []
  const r = await runPoliPass(deps(db, { numberTask: async (id) => void numbered.push(id) }))
  assert.equal(r.raised.length, 1)
  const id = r.raised[0]
  assert.match(id, /^poli-assign-t1-\d+$/)
  const task = db.get<Record<string, unknown>>(CRM_TASKS, id)!
  assert.equal(task.source, "poli")
  assert.equal(task.assigned_to, "Founder Name")
  assert.equal(task.status, "not_started")
  assert.equal(task.brand, "DEVSA")
  assert.equal(task.title, "Who owns this? TSK-7 Task t1")
  assert.deepEqual(task.poli, { path: "assign", why: "no-owner", record: "crm_tasks:t1", record_ref: "TSK-7", agent_task: id })
  const entries = db.entries(id)
  assert.deepEqual(entries.map((e) => e.kind), ["task_created", "run_started", "routed"])
  assert.equal(entries[2].reasonCode, "assign")
  assert.deepEqual(entries[2].refs, { event: "crm_tasks:t1", record: `crm_tasks:${id}` })
  assert.ok(entries.every((e) => e.actor === "skill:chief-of-staff"))
  assert.equal(verifyChain(entries).ok, true)
  assert.equal(db.task(id)?.state, "done")
  assert.equal(db.task(id)?.budgetUsd, 0)
  assert.deepEqual(numbered, [id])
})

test("idempotent: a second pass over the same state writes nothing, even after the Polí task is completed", async () => {
  const db = store([base("t1", { due_date: "2026-11-01" })])
  const first = await runPoliPass(deps(db))
  assert.equal(first.raised.length, 1)
  const commits = db.commits
  const second = await runPoliPass(deps(db))
  assert.equal(second.raised.length, 0)
  assert.equal(db.commits, commits)
  // The founder completes Polí's task; the record has not changed, so it is not raised again.
  const [pid, pdoc] = poliTasks(db)[0]
  db.col(CRM_TASKS).set(pid, { ...(pdoc as object), status: "completed" })
  const third = await runPoliPass(deps(db))
  assert.equal(third.raised.length, 0)
  assert.equal(third.skipped, 1)
  assert.equal(poliTasks(db).length, 1)
  // The record changes and is still overdue: a new finding.
  db.col(CRM_TASKS).set("t1", { ...(db.get<object>(CRM_TASKS, "t1") as object), updated_at: NOW })
  const fourth = await runPoliPass(deps(db))
  assert.equal(fourth.raised.length, 1)
  assert.equal(poliTasks(db).length, 2)
})

test("two passes racing write each finding once", async () => {
  const db = store([base("a", { assigned_to: "" }), base("b", { due_date: undefined })])
  const [x, y] = await Promise.all([runPoliPass(deps(db)), runPoliPass(deps(db))])
  assert.equal(x.raised.length + y.raised.length, 2)
  assert.equal(poliTasks(db).length, 2)
})

test("the cap: never more than MAX_OPEN_POLI Polí tasks open; the rest are held", async () => {
  const many = Array.from({ length: MAX_OPEN_POLI + 4 }, (_, i) => base(`n${i}`, { assigned_to: "" }))
  const db = store(many)
  const r = await runPoliPass(deps(db))
  assert.equal(r.raised.length, MAX_OPEN_POLI)
  assert.equal(r.held, 4)
  const again = await runPoliPass(deps(db))
  assert.equal(again.raised.length, 0)
  assert.equal(again.held, 4)
})

test("a record that changed since the list was read is left for the next pass", async () => {
  const db = store([base("t1", { assigned_to: "" })])
  const r = await runPoliPass(
    deps(db, {
      listOpen: async () => {
        const out = { tasks: [taskView("t1", db.get<Record<string, unknown>>(CRM_TASKS, "t1")!)], truncated: false }
        db.col(CRM_TASKS).set("t1", { ...(db.get<object>(CRM_TASKS, "t1") as object), assigned_to: "Barbara Carreon" })
        return out
      },
    }),
  )
  assert.equal(r.raised.length, 0)
  assert.equal(r.skipped, 1)
  assert.equal(poliTasks(db).length, 0)
})

test("handled elsewhere: an assistant's task gets a ledger entry only, once", async () => {
  const db = store([base("c1", { source: "connector", assigned_to: "" })])
  const r = await runPoliPass(deps(db))
  assert.equal(r.handled.length, 1)
  assert.equal(r.raised.length, 0)
  assert.equal(poliTasks(db).length, 0)
  const entries = db.entries(r.handled[0])
  assert.equal(entries.at(-1)?.reasonCode, "handled-elsewhere")
  assert.deepEqual(entries.at(-1)?.refs, { event: "crm_tasks:c1" })
  assert.equal((await runPoliPass(deps(db))).handled.length, 0)
})

test("off and proof write nothing; an unresolved founder raises nothing", async () => {
  for (const mode of ["off", "proof"] as PoliMode[]) {
    const db = store([base("t1", { assigned_to: "" })])
    const r = await runPoliPass(deps(db, { mode: async () => mode }))
    assert.equal(r.note, mode)
    assert.equal(db.commits, 0)
  }
  const db = store([base("t1", { assigned_to: "" })])
  const r = await runPoliPass(deps(db, { founder: async () => null }))
  assert.equal(r.note, "founder-unresolved")
  assert.equal(r.held, 1)
  assert.equal(db.commits, 0)
})

test("the switch: production reads the kill switch; only a staging preview may run; anything else is off", async () => {
  const draft = async () => ({ stopped: false, skills: { "chief-of-staff": "draft" } })
  assert.equal(await readPoliMode({ VERCEL_ENV: "production" }, draft), "draft")
  assert.equal(await readPoliMode({ VERCEL_ENV: "production" }, async () => ({ stopped: true, skills: { "chief-of-staff": "draft" } })), "off")
  assert.equal(await readPoliMode({ VERCEL_ENV: "production" }, async () => undefined), "off")
  const staging = {
    VERCEL_ENV: "preview",
    GCP_PROJECT_NUMBER: "1",
    GCP_WORKLOAD_IDENTITY_POOL_ID: "p",
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "v",
    GCP_SERVICE_ACCOUNT_EMAIL: `staging-app@${STAGING_PROJECT_ID}.iam.gserviceaccount.com`,
    FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: STAGING_PROJECT_ID,
  }
  assert.equal(await readPoliMode(staging, draft), "draft")
  assert.equal(await readPoliMode({ ...staging, FIREBASE_PROJECT_ID: "prod-project" }, draft), "off")
  assert.equal(await readPoliMode({ VERCEL_ENV: "development" }, draft), "off")
  assert.equal(await readPoliMode(staging, async () => { throw new Error("boom") }), "off")
})

test("Today's Polí line: open decisions, what is held back, and the last true-up", () => {
  const tasks = [
    base("p1", { source: "poli", poli: { path: "follow-up", record: "crm_tasks:x" } }),
    base("p2", { source: "poli", poli: { path: "follow-up", record: "crm_tasks:y" } }),
    base("p3", { source: "poli", poli: { path: "assign", record: "crm_tasks:z" } }),
    base("c1", { source: "connector", created_at: "2026-11-20T14:02:00.000Z" }),
  ]
  const line = poliTodayLine(planPass(tasks, NOW), "draft", NOW)!
  assert.equal(line.key, "poli")
  assert.equal(line.tone, "late")
  assert.equal(line.href, "/admin/tasks")
  assert.equal(line.detail, "3 decisions for you (2 follow-ups, 1 who owns or when) · Last true-up: yesterday 8:02 AM")
  assert.equal(poliTodayLine(planPass([], NOW), "off", NOW), null)
  assert.equal(poliTodayLine(planPass([], NOW), "draft", NOW)!.detail, "No decisions waiting · Last true-up: none yet")
  assert.equal(poliTodayLine(planPass([base("a", { assigned_to: "" })], NOW), "proof", NOW)!.detail, "Proof: would raise 1 decision; nothing written · Last true-up: none yet")
  // On the card it never counts against All clear, and the card stays at five lines at most.
  const t = todayBrief({ now: NOW, overdue: [], missed: [], unreadable: [], runs: { byState: {}, failures: [] }, costs: { totalUsd: 1, byDay: [], byProperty: [], byTask: [] }, cost24hUsd: 0, poli: line })
  assert.equal(t.allClear, true)
  assert.deepEqual(t.lines.map((l) => l.key), ["poli", "cost"])
  assert.ok(t.lines.length <= 5)
})

test("timestamps in every stored shape read as ISO", () => {
  assert.equal(toIso({ _seconds: 1_763_737_200, _nanoseconds: 0 }), "2025-11-21T15:00:00.000Z")
  assert.equal(toIso({ toDate: () => new Date(NOW) }), NOW)
  assert.equal(toIso(NOW), NOW)
  assert.equal(toIso("not a date"), null)
  assert.equal(toIso(undefined), null)
})

test("guardrail: Polí's code calls no model and sends nothing", () => {
  for (const f of ["poli.ts", "poli-server.ts"]) {
    const src = readFileSync(join(__dirname, "..", "agent", f), "utf8")
    for (const banned of ["ai-gateway", "from \"ai\"", "generateText", "send-email", "sendApprovedEmail", "resend", "googleapis"]) {
      assert.ok(!src.toLowerCase().includes(banned.toLowerCase()), `${f} must not reference ${banned}`)
    }
  }
})
