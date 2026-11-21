/**
 * Polí's rule pass, slice 1 (434 build sequence V1 item 4, "Polí in draft"; plan 2026-11-19, the nine decisions; Chief
 * of Staff SOP 1.1 §2). Rules only: no model call, no send, no Gmail. It rides the existing `agent-sweep` cron.
 *
 * Slice 1 reads the open CRM tasks and places each on one declared path of the playbook table (SOP §2). It chooses
 * among declared paths only and never invents one:
 *  - `assign`: a task with no owner ("Who owns this?") or no due date ("When is this due?");
 *  - `follow-up`: a task overdue, or idle 7 days ("Nudge?"; decision 9);
 *  - `handled-elsewhere`: a task an assistant already created through the 434 connector (`source: "connector"`): no new
 *    task, a ledger entry only.
 * A finding that needs the founder's decision becomes one founder-owned CRM task (`source: "poli"`; decision 2). The
 * rest is the one Today line. The other paths (reply-due, intake, brief, needs_context, suggestion) need inputs a rule
 * cannot read yet: untriaged arrivals already show on To do as their own rows and intake already drafts them.
 *
 * No duplicates: one open Polí task per record at most, and each finding has a fixed id built from the record and the
 * time it last changed, so a later pass over the same state finds the task (or its ledger task) and writes nothing.
 * A record that has not changed is never raised twice, even after its Polí task is completed.
 *
 * To do does not flood: at most MAX_OPEN_POLI Polí tasks are open at once; the rest wait, counted on the Today line.
 *
 * Pure. lib/agent/poli-server.ts reads and writes.
 */
import type { TodayLine } from "./today"

export const POLI_SKILL = "chief-of-staff"
export const POLI_ACTOR = `skill:${POLI_SKILL}`
export const POLI_SOURCE = "poli"
/** The source an assistant's task carries when it was created through the 434 connector (slice 2 writes it). */
export const CONNECTOR_SOURCE = "connector"
export const POLI_OBJECTIVE = "poli-finding"
/** Decision 9: the follow-up threshold, 7 idle days. */
export const IDLE_DAYS = 7
/** At most this many Polí tasks open at once (the plan's "To do floods" guardrail). */
export const MAX_OPEN_POLI = 10
const DAY_MS = 24 * 60 * 60 * 1000

export const POLI_PATHS = ["assign", "follow-up", "handled-elsewhere"] as const
export type PoliPath = (typeof POLI_PATHS)[number]
/** Why a record is on its path; also the order findings are raised in. */
export type PoliWhy = "no-owner" | "overdue" | "idle" | "no-due-date" | "assistant-created"

/** The fields of a CRM task the pass reads. Timestamps arrive as ISO strings (poli-server.ts coerces them). */
export interface PoliTaskView {
  id: string
  ref?: string
  title?: string
  assigned_to?: string
  due_date?: string
  status?: string
  brand?: string
  source?: string
  created_at?: string | null
  updated_at?: string | null
  /** On a Polí task: what it was raised for. */
  poli?: { path?: string; record?: string }
}

export interface PoliFinding {
  path: PoliPath
  why: PoliWhy
  task: PoliTaskView
  /** The record it is about: "crm_tasks:<id>". */
  record: string
  /** The fixed id of this finding: the ledger task's and, when raised, the Polí CRM task's. */
  id: string
}

const CLOSED = new Set(["completed", "deferred"])
const UNOWNED = new Set(["", "unassigned"])

export const recordKey = (taskId: string) => `crm_tasks:${taskId}`

/** When the record last changed, in ms, or null when it cannot be read (then it is left alone). */
function changedAt(t: PoliTaskView): number | null {
  for (const v of [t.updated_at, t.created_at]) {
    const ms = v ? Date.parse(v) : NaN
    if (Number.isFinite(ms)) return ms
  }
  return null
}

/** A due date's end of day, in ms. "2026-11-20" is due through that day. */
function dueEnd(due: string | undefined): number | null {
  if (!due) return null
  const day = /^\d{4}-\d{2}-\d{2}$/.test(due) ? Date.parse(`${due}T23:59:59.999Z`) : Date.parse(due)
  return Number.isFinite(day) ? day : null
}

/** The declared path for one open CRM task, or null when there is nothing to do. Polí's own tasks are never routed. */
export function routeTask(t: PoliTaskView, now: string): { path: PoliPath; why: PoliWhy } | null {
  if (CLOSED.has(t.status ?? "") || t.source === POLI_SOURCE) return null
  if (t.source === CONNECTOR_SOURCE) return { path: "handled-elsewhere", why: "assistant-created" }
  const at = Date.parse(now)
  if (UNOWNED.has((t.assigned_to ?? "").trim().toLowerCase())) return { path: "assign", why: "no-owner" }
  const due = dueEnd(t.due_date)
  if (due !== null && due < at) return { path: "follow-up", why: "overdue" }
  const changed = changedAt(t)
  if (changed !== null && at - changed >= IDLE_DAYS * DAY_MS) return { path: "follow-up", why: "idle" }
  if (!t.due_date) return { path: "assign", why: "no-due-date" }
  return null
}

/** The finding's fixed id: path, record, and the time the record last changed. Null when that time is unreadable. */
export function findingId(path: PoliPath, t: PoliTaskView): string | null {
  const changed = changedAt(t)
  if (changed === null || !/^[A-Za-z0-9_-]{1,120}$/.test(t.id)) return null
  return `poli-${path}-${t.id}-${changed}`
}

const WHY_ORDER: Record<PoliWhy, number> = { "no-owner": 0, overdue: 1, idle: 2, "no-due-date": 3, "assistant-created": 4 }

export interface PoliPlan {
  /** Findings to raise now as founder-owned tasks, most urgent first. */
  raise: PoliFinding[]
  /** Findings that need a decision but wait, because MAX_OPEN_POLI Polí tasks are open. */
  held: PoliFinding[]
  /** Records an assistant already raised: a ledger entry only. */
  handled: PoliFinding[]
  /** Open Polí tasks, by path. */
  open: Record<"assign" | "follow-up", number>
  /** The newest task an assistant created (the last true-up), or null. */
  lastTrueUp: string | null
}

/** One pass over the open tasks: what to raise, what waits, what is handled elsewhere. */
export function planPass(tasks: PoliTaskView[], now: string, maxOpen = MAX_OPEN_POLI): PoliPlan {
  const open = { assign: 0, "follow-up": 0 }
  const raised = new Set<string>()
  let lastTrueUp: string | null = null
  for (const t of tasks) {
    if (t.source === CONNECTOR_SOURCE && t.created_at && (!lastTrueUp || t.created_at > lastTrueUp)) lastTrueUp = t.created_at
    if (t.source !== POLI_SOURCE || CLOSED.has(t.status ?? "")) continue
    if (t.poli?.record) raised.add(t.poli.record)
    if (t.poli?.path === "assign" || t.poli?.path === "follow-up") open[t.poli.path]++
  }
  const needs: PoliFinding[] = []
  const handled: PoliFinding[] = []
  for (const t of tasks) {
    const r = routeTask(t, now)
    if (!r) continue
    const record = recordKey(t.id)
    const id = findingId(r.path, t)
    if (!id) continue
    const f: PoliFinding = { ...r, task: t, record, id }
    if (r.path === "handled-elsewhere") handled.push(f)
    else if (!raised.has(record)) needs.push(f)
  }
  needs.sort((a, b) => WHY_ORDER[a.why] - WHY_ORDER[b.why] || (changedAt(a.task) ?? 0) - (changedAt(b.task) ?? 0) || a.id.localeCompare(b.id))
  const room = Math.max(0, maxOpen - open.assign - open["follow-up"])
  return { raise: needs.slice(0, room), held: needs.slice(room), handled, open, lastTrueUp }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The founder-owned CRM task for a finding. Words come from the rules, never from a model. */
export function poliTaskRecord(f: PoliFinding, founder: string, now: string): Record<string, unknown> {
  const t = f.task
  const label = clip([t.ref, t.title?.trim() || "Untitled task"].filter(Boolean).join(" "), 140)
  const title =
    f.why === "no-owner" ? `Who owns this? ${label}` : f.why === "no-due-date" ? `When is this due? ${label}` : `Nudge ${t.assigned_to?.trim() || "the owner"}? ${label}`
  const detail =
    f.why === "no-owner"
      ? "It has no owner."
      : f.why === "no-due-date"
        ? `It has no due date. Owner: ${t.assigned_to}.`
        : f.why === "overdue"
          ? `It was due ${t.due_date}. Owner: ${t.assigned_to}.`
          : `No change in ${IDLE_DAYS} days or more. Owner: ${t.assigned_to}.`
  return {
    title,
    description: `${detail} Raised by Polí's rule pass (no model). Complete this task when it is decided; Polí does not raise the same task again until it changes.`,
    assigned_to: founder,
    assigned_by: "Polí",
    status: "not_started",
    priority: f.why === "overdue" || f.why === "no-owner" ? "high" : "medium",
    ...(t.brand ? { brand: t.brand } : {}),
    source: POLI_SOURCE,
    poli: { path: f.path, why: f.why, record: f.record, ...(t.ref ? { record_ref: t.ref } : {}), agent_task: f.id },
    created_at: now,
    updated_at: now,
  }
}

export type PoliMode = "off" | "proof" | "draft"

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "yesterday 8:02 AM" style, in Central time, for the last true-up. */
function whenShort(iso: string, now: string): string {
  const tz = "America/Chicago"
  const day = (d: string) => new Date(d).toLocaleDateString("en-US", { timeZone: tz })
  const time = new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
  if (day(iso) === day(now)) return `today ${time}`
  if (day(iso) === day(new Date(Date.parse(now) - DAY_MS).toISOString())) return `yesterday ${time}`
  return `${new Date(iso).toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" })} ${time}`
}

/**
 * Polí's one Today line (decision 2 and 7; Display Standard 3.14): the decisions waiting, the ones held back, and when
 * the last true-up wrote tasks. Left out while Polí is off and nothing of its is open.
 */
export function poliTodayLine(plan: PoliPlan, mode: PoliMode, now: string): TodayLine | null {
  const openTotal = plan.open.assign + plan.open["follow-up"]
  if (mode === "off" && openTotal === 0) return null
  const parts: string[] = []
  if (mode === "proof") {
    const would = plan.raise.length + plan.held.length
    parts.push(would ? `Proof: would raise ${plural(would, "decision")}; nothing written` : "Proof: nothing to raise")
  } else if (openTotal) {
    const by = [plan.open["follow-up"] && plural(plan.open["follow-up"], "follow-up"), plan.open.assign && `${plan.open.assign} who owns or when`].filter(Boolean)
    parts.push(`${plural(openTotal, "decision")} for you (${by.join(", ")})`)
    if (mode === "off") parts.push("Polí is off")
  } else parts.push("No decisions waiting")
  if (mode === "draft" && plan.raise.length) parts.push(`${plan.raise.length} more to raise on the next pass`)
  if (mode !== "proof" && plan.held.length) parts.push(`${plan.held.length} more held back`)
  parts.push(`Last true-up: ${plan.lastTrueUp ? whenShort(plan.lastTrueUp, now) : "none yet"}`)
  return { key: "poli", tone: openTotal ? "late" : "info", title: "Polí", detail: parts.join(" · "), href: "/admin/tasks", linkLabel: "Tasks" }
}
