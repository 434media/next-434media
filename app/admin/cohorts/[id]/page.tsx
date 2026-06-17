"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, Loader2, Star, AlertTriangle } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { SQUAD_LABELS, type SquadKey } from "@/components/crm/types"
import { VERTICAL_LABELS } from "@/types/crm-types"
import type { Cohort, CohortTask, Builder, BuilderStatus, TaskStatus } from "@/types/crm-types"

const SQUADS = Object.keys(SQUAD_LABELS) as SquadKey[]
const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "not_started", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Done" },
]
const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "completed", "blocked", "deferred"]
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "To do",
  in_progress: "In progress",
  completed: "Done",
  blocked: "Blocked",
  deferred: "Deferred",
}
const BUILDER_STATUS_LABELS: Record<BuilderStatus, string> = {
  applied: "Applied",
  accepted: "Accepted",
  active: "Active",
  shipped: "Shipped",
  demoed: "Demoed",
  withdrawn: "Withdrawn",
}
// Which column a task renders in (blocked/deferred fall into "To do" with a badge).
const columnFor = (s: TaskStatus): TaskStatus =>
  s === "in_progress" || s === "completed" ? s : "not_started"

function CohortDetailInner({ cohortId }: { cohortId: string }) {
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [tasks, setTasks] = useState<CohortTask[]>([])
  const [builders, setBuilders] = useState<Builder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [week, setWeek] = useState<number | "all">("all")
  const [newTask, setNewTask] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cRes, tRes, bRes] = await Promise.all([
        fetch(`/api/admin/crm/cohorts?id=${cohortId}`),
        fetch(`/api/admin/crm/cohort-tasks?cohortId=${cohortId}`),
        fetch(`/api/admin/crm/builders?cohortId=${cohortId}`),
      ])
      const [cBody, tBody, bBody] = await Promise.all([cRes.json(), tRes.json(), bRes.json()])
      if (!cRes.ok || !cBody.success) throw new Error(cBody.error ?? "Cohort not found")
      setCohort(cBody.data as Cohort)
      setTasks(tBody.success ? (tBody.data as CohortTask[]) : [])
      setBuilders(bBody.success ? (bBody.data as Builder[]) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [cohortId])

  useEffect(() => {
    load()
  }, [load])

  const visible = tasks.filter((t) => week === "all" || t.week === week)

  const addTask = async (squad: SquadKey) => {
    const title = (newTask[squad] ?? "").trim()
    if (!title) return
    try {
      const res = await fetch("/api/admin/crm/cohort-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId, squad, title, week: week === "all" ? undefined : week }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to add task")
      setTasks((prev) => [...prev, body.data as CohortTask])
      setNewTask((m) => ({ ...m, [squad]: "" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add task")
    }
  }

  const patchTask = async (id: string, updates: Partial<CohortTask>) => {
    const prev = tasks
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...updates } : t)))
    try {
      const res = await fetch("/api/admin/crm/cohort-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to update task")
    } catch (err) {
      setTasks(prev) // revert
      setError(err instanceof Error ? err.message : "Failed to update task")
    }
  }

  const deleteTask = async (id: string) => {
    const prev = tasks
    setTasks((ts) => ts.filter((t) => t.id !== id))
    try {
      const res = await fetch(`/api/admin/crm/cohort-tasks?id=${id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to delete task")
    } catch (err) {
      setTasks(prev)
      setError(err instanceof Error ? err.message : "Failed to delete task")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading cohort…
      </div>
    )
  }
  if (error && !cohort) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/admin/cohorts" className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-neutral-900">
          <ArrowLeft className="w-4 h-4" /> Cohorts
        </Link>
        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }
  if (!cohort) return null

  const weeksPresent = Array.from(new Set(tasks.map((t) => t.week).filter((w): w is number => typeof w === "number"))).sort(
    (a, b) => a - b,
  )

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <Link
          href="/admin/cohorts"
          className="inline-flex items-center gap-1.5 text-[13px] text-neutral-500 hover:text-neutral-900"
        >
          <ArrowLeft className="w-4 h-4" /> Cohorts
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{cohort.name}</h1>
          <p className="text-[13px] text-neutral-500 mt-0.5">
            {VERTICAL_LABELS[cohort.vertical]} · {cohort.hostBrand}
            {cohort.sponsorName ? ` · Sponsor: ${cohort.sponsorName}` : ""}
            {cohort.demoDayDate ? ` · Demo day ${cohort.demoDayDate}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Week</label>
          <select
            value={week}
            onChange={(e) => setWeek(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="px-2 py-1 text-[12px] bg-white border border-neutral-200 rounded-md"
          >
            <option value="all">All</option>
            {[1, 2, 3, 4, 5, 6].map((w) => (
              <option key={w} value={w}>
                Week {w}
                {weeksPresent.includes(w) ? "" : " (none)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Rollup */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Squad progress</div>
          <div className="space-y-1.5">
            {SQUADS.map((sq) => {
              const sqTasks = visible.filter((t) => t.squad === sq)
              const done = sqTasks.filter((t) => t.status === "completed").length
              const pct = sqTasks.length ? Math.round((done / sqTasks.length) * 100) : 0
              return (
                <div key={sq} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-[12px] text-neutral-700 truncate">{SQUAD_LABELS[sq]}</span>
                  <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-14 text-right text-[11px] text-neutral-500">
                    {done}/{sqTasks.length}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Builders ({builders.length})
          </div>
          {builders.length === 0 ? (
            <div className="text-[12px] text-neutral-400">No builders yet (add them on the Cohorts list).</div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(BUILDER_STATUS_LABELS) as BuilderStatus[]).map((s) => {
                const n = builders.filter((b) => b.status === s).length
                if (!n) return null
                return (
                  <div key={s} className="text-[12px] text-neutral-600">
                    <span className="font-semibold text-neutral-900">{n}</span> {BUILDER_STATUS_LABELS[s]}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Board — squad swimlanes × status columns */}
      <div className="space-y-3">
        {SQUADS.map((sq) => {
          const sqTasks = visible.filter((t) => t.squad === sq)
          return (
            <div key={sq} className="bg-white border border-neutral-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-neutral-900">{SQUAD_LABELS[sq]}</span>
                <span className="text-[11px] text-neutral-400">{sqTasks.length} tasks</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {COLUMNS.map((col) => (
                  <div key={col.key} className="bg-neutral-50 rounded-md p-2 min-h-[60px]">
                    <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 px-1">
                      {col.label}
                    </div>
                    <div className="space-y-1.5">
                      {sqTasks
                        .filter((t) => columnFor(t.status) === col.key)
                        .map((t) => (
                          <div key={t.id} className="bg-white border border-neutral-200 rounded-md p-2">
                            <div className="flex items-start gap-1.5">
                              {t.isDeliverable && <Star className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />}
                              <span className="flex-1 min-w-0 text-[12px] text-neutral-800 break-words">{t.title}</span>
                              <button
                                type="button"
                                onClick={() => deleteTask(t.id)}
                                className="text-neutral-300 hover:text-red-500 shrink-0"
                                title="Delete task"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {t.assigned_to && (
                              <div className="mt-1 text-[10px] text-neutral-400 truncate">{t.assigned_to}</div>
                            )}
                            <div className="mt-1.5 flex items-center gap-1">
                              <select
                                value={t.status}
                                onChange={(e) => patchTask(t.id, { status: e.target.value as TaskStatus })}
                                className="text-[10px] px-1 py-0.5 rounded border border-neutral-200 bg-white"
                              >
                                {TASK_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {TASK_STATUS_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => patchTask(t.id, { isDeliverable: !t.isDeliverable })}
                                title={t.isDeliverable ? "Unmark deliverable" : "Mark as Friday deliverable"}
                                className={`text-[10px] ${t.isDeliverable ? "text-amber-500" : "text-neutral-300 hover:text-amber-500"}`}
                              >
                                <Star className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={newTask[sq] ?? ""}
                  onChange={(e) => setNewTask((m) => ({ ...m, [sq]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addTask(sq)
                    }
                  }}
                  placeholder={`Add task to ${SQUAD_LABELS[sq]}…`}
                  className="flex-1 px-3 py-1.5 text-[12px] bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
                />
                <button
                  type="button"
                  onClick={() => addTask(sq)}
                  disabled={!(newTask[sq] ?? "").trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-100 text-neutral-700 text-[12px] font-semibold hover:bg-neutral-200 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CohortDetailPage() {
  const params = useParams<{ id: string }>()
  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        {params?.id ? <CohortDetailInner cohortId={params.id} /> : null}
      </div>
    </AdminRoleGuard>
  )
}
