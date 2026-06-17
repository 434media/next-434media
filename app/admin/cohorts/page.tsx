"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus, Trash2, Users, AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { VERTICAL_LABELS } from "@/types/crm-types"
import type {
  Cohort,
  CohortStatus,
  Vertical,
  Builder,
  BuilderStatus,
  Brand,
} from "@/types/crm-types"

const STATUS_LABELS: Record<CohortStatus, string> = {
  forming: "Forming",
  problem_set: "Problem set",
  recruiting: "Recruiting",
  active: "Active",
  demo_day: "Demo day",
  complete: "Complete",
  cancelled: "Cancelled",
}
const STATUS_COLORS: Record<CohortStatus, string> = {
  forming: "bg-neutral-100 text-neutral-600 border-neutral-200",
  problem_set: "bg-indigo-50 text-indigo-700 border-indigo-200",
  recruiting: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  demo_day: "bg-blue-50 text-blue-700 border-blue-200",
  complete: "bg-neutral-100 text-neutral-500 border-neutral-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
}
const BUILDER_STATUS_LABELS: Record<BuilderStatus, string> = {
  applied: "Applied",
  accepted: "Accepted",
  active: "Active",
  shipped: "Shipped",
  demoed: "Demoed",
  withdrawn: "Withdrawn",
}
const BRANDS: Brand[] = ["434 Media", "Vemos Vamos", "DEVSA", "Digital Canvas", "TXMX Boxing"]
const STATUSES = Object.keys(STATUS_LABELS) as CohortStatus[]
const VERTICALS = Object.keys(VERTICAL_LABELS) as Vertical[]
const BUILDER_STATUSES = Object.keys(BUILDER_STATUS_LABELS) as BuilderStatus[]

const LABEL = "block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1"
const FIELD =
  "w-full px-3 py-2 text-sm bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"

type CohortForm = {
  name: string
  vertical: Vertical
  hostBrand: Brand
  status: CohortStatus
  sponsorName: string
  workshopDate: string
  bridgeStart: string
  bridgeEnd: string
  demoDayDate: string
  capacity: string
  notes: string
}

const EMPTY_FORM: CohortForm = {
  name: "",
  vertical: "cybersecurity",
  hostBrand: "Digital Canvas",
  status: "forming",
  sponsorName: "",
  workshopDate: "",
  bridgeStart: "",
  bridgeEnd: "",
  demoDayDate: "",
  capacity: "",
  notes: "",
}

function CohortsInner() {
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; cohort: Cohort | null } | null>(null)
  const [form, setForm] = useState<CohortForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  // builders for the open cohort
  const [builders, setBuilders] = useState<Builder[]>([])
  const [buildersLoading, setBuildersLoading] = useState(false)
  const [newBuilder, setNewBuilder] = useState("")

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/cohorts")
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to load cohorts")
      setCohorts(body.data as Cohort[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setBuilders([])
    setDrawer({ mode: "create", cohort: null })
  }

  const openEdit = async (c: Cohort) => {
    setForm({
      name: c.name,
      vertical: c.vertical,
      hostBrand: c.hostBrand,
      status: c.status,
      sponsorName: c.sponsorName ?? "",
      workshopDate: c.workshopDate ?? "",
      bridgeStart: c.bridgeStart ?? "",
      bridgeEnd: c.bridgeEnd ?? "",
      demoDayDate: c.demoDayDate ?? "",
      capacity: c.capacity != null ? String(c.capacity) : "",
      notes: c.notes ?? "",
    })
    setDrawer({ mode: "edit", cohort: c })
    setBuilders([])
    setBuildersLoading(true)
    try {
      const res = await fetch(`/api/admin/crm/builders?cohortId=${c.id}`)
      const body = await res.json()
      if (res.ok && body.success) setBuilders(body.data as Builder[])
    } catch {
      /* non-fatal */
    } finally {
      setBuildersLoading(false)
    }
  }

  const payloadFromForm = () => ({
    name: form.name,
    vertical: form.vertical,
    hostBrand: form.hostBrand,
    status: form.status,
    sponsorName: form.sponsorName,
    workshopDate: form.workshopDate,
    bridgeStart: form.bridgeStart,
    bridgeEnd: form.bridgeEnd,
    demoDayDate: form.demoDayDate,
    capacity: form.capacity.trim() === "" ? undefined : Number(form.capacity),
    notes: form.notes,
  })

  const handleSave = async () => {
    if (!drawer) return
    if (!form.name.trim()) {
      setToast({ message: "Name is required", type: "error" })
      return
    }
    setSaving(true)
    try {
      const isEdit = drawer.mode === "edit" && drawer.cohort
      const res = await fetch("/api/admin/crm/cohorts", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: drawer.cohort!.id, ...payloadFromForm() } : payloadFromForm()),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to save cohort")
      setToast({ message: isEdit ? "Cohort updated" : "Cohort created", type: "success" })
      setDrawer(null)
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to save cohort", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!drawer?.cohort) return
    if (!confirm(`Delete cohort "${drawer.cohort.name}"? This does not delete its builders.`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/crm/cohorts?id=${drawer.cohort.id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to delete cohort")
      setToast({ message: "Cohort deleted", type: "success" })
      setDrawer(null)
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to delete cohort", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const addBuilder = async () => {
    if (!drawer?.cohort || !newBuilder.trim()) return
    try {
      const res = await fetch("/api/admin/crm/builders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cohortId: drawer.cohort.id, name: newBuilder.trim() }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to add builder")
      setBuilders((b) => [...b, body.data as Builder])
      setNewBuilder("")
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to add builder", type: "error" })
    }
  }

  const updateBuilderStatus = async (builder: Builder, status: BuilderStatus) => {
    try {
      const res = await fetch("/api/admin/crm/builders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: builder.id, status }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to update builder")
      setBuilders((b) => b.map((x) => (x.id === builder.id ? { ...x, status } : x)))
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to update builder", type: "error" })
    }
  }

  const removeBuilder = async (builder: Builder) => {
    try {
      const res = await fetch(`/api/admin/crm/builders?id=${builder.id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to remove builder")
      setBuilders((b) => b.filter((x) => x.id !== builder.id))
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to remove builder", type: "error" })
    }
  }

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {toast && (
          <div
            className={`flex items-center gap-2 p-3 rounded-lg border text-[13px] font-medium ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Cohorts</h1>
            <p className="text-[12px] text-neutral-500">
              {loading ? "Loading…" : `${cohorts.length} ${cohorts.length === 1 ? "cohort" : "cohorts"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            New cohort
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading cohorts…
          </div>
        ) : cohorts.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg px-4 py-12 text-center text-[13px] text-neutral-400">
            No cohorts yet. Click "New cohort" to create the first one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cohorts.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-neutral-200 rounded-lg hover:border-neutral-300 hover:shadow-sm transition-all"
              >
                <Link href={`/admin/cohorts/${c.id}`} className="block text-left p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[14px] font-semibold text-neutral-900 truncate">{c.name}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${STATUS_COLORS[c.status]}`}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    {VERTICAL_LABELS[c.vertical]} · {c.hostBrand}
                  </div>
                  {c.sponsorName && (
                    <div className="mt-0.5 text-[12px] text-neutral-400">Sponsor: {c.sponsorName}</div>
                  )}
                  {c.demoDayDate && (
                    <div className="mt-2 text-[11px] text-neutral-400">Demo day {c.demoDayDate}</div>
                  )}
                </Link>
                <div className="px-4 pb-3">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="text-[11px] font-medium text-neutral-400 hover:text-neutral-700"
                  >
                    Edit details &amp; builders
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DetailDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.mode === "edit" ? "Edit cohort" : "New cohort"}
        subtitle={drawer?.mode === "edit" ? drawer.cohort?.name : undefined}
        width="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {drawer?.mode === "edit" ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="text-[12px] font-medium text-neutral-400 hover:text-red-600 disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="px-3 py-1.5 rounded-md text-[12px] font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        }
      >
        {drawer && (
          <div className="px-4 sm:px-5 py-4 space-y-4">
            <div>
              <label className={LABEL}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Cyber 2026 Q3 — Acme-sponsored"
                className={FIELD}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Vertical</label>
                <select
                  value={form.vertical}
                  onChange={(e) => setForm((f) => ({ ...f, vertical: e.target.value as Vertical }))}
                  className={FIELD}
                >
                  {VERTICALS.map((v) => (
                    <option key={v} value={v}>
                      {VERTICAL_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Host brand</label>
                <select
                  value={form.hostBrand}
                  onChange={(e) => setForm((f) => ({ ...f, hostBrand: e.target.value as Brand }))}
                  className={FIELD}
                >
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CohortStatus }))}
                  className={FIELD}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Capacity</label>
                <input
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="# builders / teams"
                  className={FIELD}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>
                Sponsor <span className="text-neutral-300 normal-case">(underwriter — name for now)</span>
              </label>
              <input
                type="text"
                value={form.sponsorName}
                onChange={(e) => setForm((f) => ({ ...f, sponsorName: e.target.value }))}
                placeholder="Acme Security Inc."
                className={FIELD}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Workshop</label>
                <input
                  type="date"
                  value={form.workshopDate}
                  onChange={(e) => setForm((f) => ({ ...f, workshopDate: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Demo day</label>
                <input
                  type="date"
                  value={form.demoDayDate}
                  onChange={(e) => setForm((f) => ({ ...f, demoDayDate: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Bridge start</label>
                <input
                  type="date"
                  value={form.bridgeStart}
                  onChange={(e) => setForm((f) => ({ ...f, bridgeStart: e.target.value }))}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Bridge end</label>
                <input
                  type="date"
                  value={form.bridgeEnd}
                  onChange={(e) => setForm((f) => ({ ...f, bridgeEnd: e.target.value }))}
                  className={FIELD}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className={FIELD}
              />
            </div>

            {drawer.mode === "edit" && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Builders ({builders.length})
                  </span>
                </div>
                {buildersLoading ? (
                  <div className="text-[12px] text-neutral-400 py-2">Loading builders…</div>
                ) : (
                  <div className="space-y-2">
                    {builders.map((b) => (
                      <div key={b.id} className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-[13px] text-neutral-800 truncate">
                          {b.name}
                          {b.teamName ? <span className="text-neutral-400"> · {b.teamName}</span> : null}
                        </span>
                        <select
                          value={b.status}
                          onChange={(e) => updateBuilderStatus(b, e.target.value as BuilderStatus)}
                          className="px-2 py-1 text-[11px] font-medium rounded border border-neutral-200 bg-white"
                        >
                          {BUILDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {BUILDER_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeBuilder(b)}
                          className="text-neutral-300 hover:text-red-500"
                          title="Remove builder"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newBuilder}
                        onChange={(e) => setNewBuilder(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addBuilder()
                          }
                        }}
                        placeholder="Add builder / team name"
                        className="flex-1 px-3 py-1.5 text-[13px] bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={addBuilder}
                        disabled={!newBuilder.trim()}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-neutral-100 text-neutral-700 text-[12px] font-semibold hover:bg-neutral-200 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}

export default function CohortsPage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <CohortsInner />
    </AdminRoleGuard>
  )
}
