"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Loader2,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Target,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import {
  VERTICAL_LABELS,
  PAINPOINT_STATUS_LABELS,
  PAINPOINT_SOURCE_LABELS,
} from "@/types/crm-types"
import type {
  Painpoint,
  PainpointStatus,
  PainpointSource,
  Vertical,
  Cohort,
} from "@/types/crm-types"

// Mirrors AdminRole in lib/auth.ts — declared locally because that module pulls
// in `next/headers` (server-only) and this is a client component.
type AdminRole = "crm_super_admin" | "full_admin" | "crm_only" | "intern"

const STATUS_COLORS: Record<PainpointStatus, string> = {
  submitted: "bg-neutral-100 text-neutral-600 border-neutral-200",
  triaged: "bg-amber-50 text-amber-700 border-amber-200",
  vetted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  activated: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-600 border-red-200",
  archived: "bg-neutral-100 text-neutral-400 border-neutral-200",
}

const VERTICALS = Object.keys(VERTICAL_LABELS) as Vertical[]
const STATUSES = Object.keys(PAINPOINT_STATUS_LABELS) as PainpointStatus[]
const SOURCES = Object.keys(PAINPOINT_SOURCE_LABELS) as PainpointSource[]
// Interns can advance a painpoint through authoring; "activated" is operator-only
// (it seeds a cohort's problem set) and excluded from the intern status dropdown.
const AUTHOR_STATUSES: PainpointStatus[] = ["submitted", "triaged", "vetted", "rejected", "archived"]
const OPERATOR_ROLES: AdminRole[] = ["full_admin", "crm_super_admin"]

const LABEL = "block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1"
const FIELD =
  "w-full px-3 py-2 text-sm bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"

// The four fields that make a painpoint "venture-credible" — the vetting bar.
const CREDIBILITY_FIELDS = [
  { key: "whoIsAffected", label: "Who's affected" },
  { key: "currentWorkaround", label: "Current workaround" },
  { key: "costImpact", label: "Cost impact" },
  { key: "evidence", label: "Evidence" },
] as const

type PainpointForm = {
  title: string
  vertical: Vertical
  status: PainpointStatus
  source: PainpointSource
  underwriterName: string
  underwriterRole: string
  sponsorName: string
  problemStatement: string
  salesFraming: string
  builderBrief: string
  whoIsAffected: string
  currentWorkaround: string
  costImpact: string
  frequency: string
  evidence: string
  notes: string
}

const EMPTY_FORM: PainpointForm = {
  title: "",
  vertical: "cybersecurity",
  status: "submitted",
  source: "manual",
  underwriterName: "",
  underwriterRole: "",
  sponsorName: "",
  problemStatement: "",
  salesFraming: "",
  builderBrief: "",
  whoIsAffected: "",
  currentWorkaround: "",
  costImpact: "",
  frequency: "",
  evidence: "",
  notes: "",
}

function credibilityScore(p: { whoIsAffected?: string; currentWorkaround?: string; costImpact?: string; evidence?: string }) {
  return CREDIBILITY_FIELDS.filter((f) => (p[f.key] ?? "").toString().trim() !== "").length
}

function PainpointsInner() {
  const [painpoints, setPainpoints] = useState<Painpoint[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [role, setRole] = useState<AdminRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [drawer, setDrawer] = useState<{ mode: "create" | "edit"; painpoint: Painpoint | null } | null>(null)
  const [form, setForm] = useState<PainpointForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<PainpointStatus | "all">("all")
  const [query, setQuery] = useState("")

  const isOperator = role != null && OPERATOR_ROLES.includes(role)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/painpoints")
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to load painpoints")
      setPainpoints(body.data as Painpoint[])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // Resolve role (drives the operator-only activation control).
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => setRole((d?.user?.role as AdminRole) ?? null))
      .catch(() => setRole(null))
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  // Operators can assign a painpoint to a cohort — load the cohort list lazily.
  useEffect(() => {
    if (!isOperator || cohorts.length > 0) return
    fetch("/api/admin/crm/cohorts")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setCohorts(d.data as Cohort[])
      })
      .catch(() => {})
  }, [isOperator, cohorts.length])

  const cohortName = (id?: string | null) => (id ? cohorts.find((c) => c.id === id)?.name : undefined)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return painpoints.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.problemStatement.toLowerCase().includes(q) ||
        (p.sponsorName ?? "").toLowerCase().includes(q) ||
        (p.underwriterName ?? "").toLowerCase().includes(q)
      )
    })
  }, [painpoints, statusFilter, query])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setDrawer({ mode: "create", painpoint: null })
  }

  const openEdit = (p: Painpoint) => {
    setForm({
      title: p.title,
      vertical: p.vertical,
      status: p.status,
      source: p.source,
      underwriterName: p.underwriterName ?? "",
      underwriterRole: p.underwriterRole ?? "",
      sponsorName: p.sponsorName ?? "",
      problemStatement: p.problemStatement,
      salesFraming: p.salesFraming ?? "",
      builderBrief: p.builderBrief ?? "",
      whoIsAffected: p.whoIsAffected ?? "",
      currentWorkaround: p.currentWorkaround ?? "",
      costImpact: p.costImpact ?? "",
      frequency: p.frequency ?? "",
      evidence: p.evidence ?? "",
      notes: p.notes ?? "",
    })
    setDrawer({ mode: "edit", painpoint: p })
  }

  const handleSave = async () => {
    if (!drawer) return
    if (!form.title.trim()) return setToast({ message: "Title is required", type: "error" })
    if (!form.problemStatement.trim())
      return setToast({ message: "Problem statement is required", type: "error" })
    setSaving(true)
    try {
      const isEdit = drawer.mode === "edit" && drawer.painpoint
      const res = await fetch("/api/admin/crm/painpoints", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { id: drawer.painpoint!.id, ...form } : form),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to save painpoint")
      setToast({ message: isEdit ? "Painpoint updated" : "Painpoint created", type: "success" })
      setDrawer(null)
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to save painpoint", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  // Operator-only: activate a vetted painpoint into a cohort's problem set.
  const activateInto = async (cohortId: string) => {
    if (!drawer?.painpoint) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/crm/painpoints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: drawer.painpoint.id, status: "activated", cohortId }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to activate painpoint")
      setToast({ message: "Activated into cohort", type: "success" })
      setDrawer(null)
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to activate", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!drawer?.painpoint) return
    if (!confirm(`Delete painpoint "${drawer.painpoint.title}"? Use Archive instead to keep it.`)) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/crm/painpoints?id=${drawer.painpoint.id}`, { method: "DELETE" })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to delete painpoint")
      setToast({ message: "Painpoint deleted", type: "success" })
      setDrawer(null)
      await refresh()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to delete painpoint", type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const formStatuses = isOperator ? STATUSES : AUTHOR_STATUSES
  const liveScore = credibilityScore(form)

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
            <h1 className="text-lg font-semibold text-neutral-900">Painpoints</h1>
            <p className="text-[12px] text-neutral-500">
              The program's intake front door — underwriter problems, translated for sales &amp; builders.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5" />
            New painpoint
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                statusFilter === "all"
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-500 border-neutral-200 hover:text-neutral-800"
              }`}
            >
              All ({painpoints.length})
            </button>
            {STATUSES.map((s) => {
              const n = painpoints.filter((p) => p.status === s).length
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md border ${
                    statusFilter === s
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-500 border-neutral-200 hover:text-neutral-800"
                  }`}
                >
                  {PAINPOINT_STATUS_LABELS[s]} ({n})
                </button>
              )
            })}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, problem, sponsor…"
              className="pl-8 pr-3 py-1.5 text-[12px] bg-white border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 w-56"
            />
          </div>
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
            Loading painpoints…
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-lg px-4 py-12 text-center text-[13px] text-neutral-400">
            {painpoints.length === 0
              ? 'No painpoints yet. Click "New painpoint" to capture the first one.'
              : "No painpoints match this filter."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const score = credibilityScore(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openEdit(p)}
                  className="text-left bg-white border border-neutral-200 rounded-lg p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[14px] font-semibold text-neutral-900 truncate">{p.title}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold rounded border ${STATUS_COLORS[p.status]}`}
                    >
                      {PAINPOINT_STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-neutral-500">
                    {VERTICAL_LABELS[p.vertical]}
                    {p.sponsorName ? ` · ${p.sponsorName}` : ""}
                  </div>
                  <p className="mt-1.5 text-[12px] text-neutral-500 line-clamp-2">{p.problemStatement}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-medium ${
                        score === 4 ? "text-emerald-600" : score >= 2 ? "text-amber-600" : "text-neutral-400"
                      }`}
                      title="Venture-credibility fields filled (who / workaround / cost / evidence)"
                    >
                      Credibility {score}/4
                    </span>
                    {p.cohortId && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                        <Target className="w-3 h-3" />
                        {cohortName(p.cohortId) ?? "Activated"}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <DetailDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.mode === "edit" ? "Edit painpoint" : "New painpoint"}
        subtitle={drawer?.mode === "edit" ? drawer.painpoint?.title : undefined}
        width="lg"
        footer={
          <div className="flex items-center justify-between gap-2">
            {drawer?.mode === "edit" && isOperator ? (
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
          <div className="px-4 sm:px-5 py-4 space-y-5">
            {/* The problem */}
            <section className="space-y-3">
              <div>
                <label className={LABEL}>Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="SOC analysts drown in false-positive alerts"
                  className={FIELD}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
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
                  <label className={LABEL}>Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PainpointStatus }))}
                    className={FIELD}
                  >
                    {formStatuses.map((s) => (
                      <option key={s} value={s}>
                        {PAINPOINT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as PainpointSource }))}
                    className={FIELD}
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {PAINPOINT_SOURCE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>
                  Problem statement <span className="text-neutral-300 normal-case">(the underwriter's words)</span>
                </label>
                <textarea
                  value={form.problemStatement}
                  onChange={(e) => setForm((f) => ({ ...f, problemStatement: e.target.value }))}
                  rows={3}
                  placeholder="What is the raw operational problem, as the underwriter describes it?"
                  className={FIELD}
                />
              </div>
            </section>

            {/* The underwriter */}
            <section className="space-y-3 pt-1 border-t border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider pt-2">Underwriter</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Name</label>
                  <input
                    type="text"
                    value={form.underwriterName}
                    onChange={(e) => setForm((f) => ({ ...f, underwriterName: e.target.value }))}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Role / title</label>
                  <input
                    type="text"
                    value={form.underwriterRole}
                    onChange={(e) => setForm((f) => ({ ...f, underwriterRole: e.target.value }))}
                    className={FIELD}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Sponsor org</label>
                <input
                  type="text"
                  value={form.sponsorName}
                  onChange={(e) => setForm((f) => ({ ...f, sponsorName: e.target.value }))}
                  placeholder="Acme Security Inc."
                  className={FIELD}
                />
              </div>
            </section>

            {/* Bi-audience translation */}
            <section className="space-y-3 pt-1 border-t border-neutral-100">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider pt-2">
                Bi-audience translation
              </p>
              <div>
                <label className={LABEL}>
                  Sales framing <span className="text-neutral-300 normal-case">(why a sponsor should fund it)</span>
                </label>
                <textarea
                  value={form.salesFraming}
                  onChange={(e) => setForm((f) => ({ ...f, salesFraming: e.target.value }))}
                  rows={2}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>
                  Builder brief <span className="text-neutral-300 normal-case">(what a builder could ship)</span>
                </label>
                <textarea
                  value={form.builderBrief}
                  onChange={(e) => setForm((f) => ({ ...f, builderBrief: e.target.value }))}
                  rows={2}
                  className={FIELD}
                />
              </div>
            </section>

            {/* Venture credibility */}
            <section className="space-y-3 pt-1 border-t border-neutral-100">
              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                  Venture credibility
                </p>
                <span
                  className={`text-[10px] font-semibold ${
                    liveScore === 4 ? "text-emerald-600" : liveScore >= 2 ? "text-amber-600" : "text-neutral-400"
                  }`}
                >
                  {liveScore}/4 to vet
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Who's affected</label>
                  <input
                    type="text"
                    value={form.whoIsAffected}
                    onChange={(e) => setForm((f) => ({ ...f, whoIsAffected: e.target.value }))}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>Frequency</label>
                  <input
                    type="text"
                    value={form.frequency}
                    onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                    placeholder="daily / per incident…"
                    className={FIELD}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Current workaround</label>
                <textarea
                  value={form.currentWorkaround}
                  onChange={(e) => setForm((f) => ({ ...f, currentWorkaround: e.target.value }))}
                  rows={2}
                  placeholder="What do they do today? (proves the pain is real)"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>
                  Cost impact <span className="text-neutral-300 normal-case">($ / time / risk — market-sizing input)</span>
                </label>
                <input
                  type="text"
                  value={form.costImpact}
                  onChange={(e) => setForm((f) => ({ ...f, costImpact: e.target.value }))}
                  placeholder="~$2M/yr in analyst time + missed breaches"
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL}>Evidence</label>
                <textarea
                  value={form.evidence}
                  onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
                  rows={2}
                  placeholder="Quotes, links, data backing the claim"
                  className={FIELD}
                />
              </div>
            </section>

            <div>
              <label className={LABEL}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className={FIELD}
              />
            </div>

            {/* Activation — operator only */}
            {drawer.mode === "edit" && isOperator && (
              <div className="pt-2 border-t border-neutral-100">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Activate into a cohort
                </p>
                {drawer.painpoint?.cohortId ? (
                  <p className="text-[12px] text-emerald-700 inline-flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    In {cohortName(drawer.painpoint.cohortId) ?? "a cohort"}'s problem set
                  </p>
                ) : cohorts.length === 0 ? (
                  <p className="text-[12px] text-neutral-400">No cohorts available to activate into.</p>
                ) : (
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && activateInto(e.target.value)}
                    disabled={saving}
                    className={FIELD}
                  >
                    <option value="">Select a cohort to activate this painpoint…</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  )
}

export default function PainpointsPage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <PainpointsInner />
    </AdminRoleGuard>
  )
}
