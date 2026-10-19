"use client"

import { useEffect, useState } from "react"
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { formatCurrency } from "../types"
import type { BrandGoal } from "../types"

/**
 * Edit the annual revenue target per brand. The brand list, colors, and
 * descriptions are a fixed contract (seeded in components/crm/types); only the
 * target is editable here, stored as a per-brand override and surfaced live on
 * the Dashboard pacing strip, the Pipeline brand cards, and the Opportunities
 * kanban goal tracker. Super-admin only.
 */
export function BrandGoalsTab() {
  const [goals, setGoals] = useState<BrandGoal[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [pendingBrand, setPendingBrand] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/brand-goals")
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to load brand goals")
      const gs = body.goals as BrandGoal[]
      setGoals(gs)
      setDrafts(Object.fromEntries(gs.map((g) => [g.brand, String(g.annualGoal)])))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500)
      return () => clearTimeout(t)
    }
  }, [toast])

  const save = async (g: BrandGoal) => {
    const annualGoal = Number(drafts[g.brand])
    if (!Number.isFinite(annualGoal) || annualGoal <= 0) {
      setToast({ message: "Target must be a positive number", type: "error" })
      return
    }
    setPendingBrand(g.brand)
    try {
      const res = await fetch("/api/admin/crm/brand-goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: g.brand, annualGoal }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to update target")
      const gs = body.goals as BrandGoal[]
      setGoals(gs)
      setDrafts(Object.fromEntries(gs.map((x) => [x.brand, String(x.annualGoal)])))
      setToast({ message: `${g.brand} target updated`, type: "success" })
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to update target", type: "error" })
    } finally {
      setPendingBrand(null)
    }
  }

  const includedHint = (g: BrandGoal) =>
    g.includedBrands && g.includedBrands.length > 1
      ? `Combined: ${g.includedBrands.join(", ")}`
      : g.description

  return (
    <div className="space-y-4">
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

      <div>
        <h2 className="text-base font-semibold text-neutral-900">Brand sales goals</h2>
        <p className="text-[12px] text-neutral-500">
          Annual revenue targets that drive the Dashboard pacing, Pipeline cards, and kanban goal
          tracker. Brand grouping is fixed — only the target is editable.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading brand goals…
        </div>
      ) : (
        <div className="bg-white border border-neutral-200 rounded-lg divide-y divide-neutral-100">
          {goals.map((g) => {
            const dirty = drafts[g.brand] !== String(g.annualGoal)
            const pending = pendingBrand === g.brand
            return (
              <div key={g.brand} className="flex items-center gap-3 px-4 py-3">
                <div
                  className="shrink-0 w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-neutral-900 truncate">{g.brand}</div>
                  <div className="text-[12px] text-neutral-500 truncate">{includedHint(g)}</div>
                </div>

                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-neutral-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={drafts[g.brand] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [g.brand]: e.target.value }))}
                    className="w-36 pl-6 pr-3 py-1.5 text-sm text-right tabular-nums bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"
                  />
                  <div className="mt-0.5 text-right text-[11px] text-neutral-400 tabular-nums">
                    {Number.isFinite(Number(drafts[g.brand])) && Number(drafts[g.brand]) > 0
                      ? formatCurrency(Number(drafts[g.brand]), true)
                      : "—"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => save(g)}
                  disabled={!dirty || pending}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Save
                </button>
              </div>
            )
          })}
          {goals.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-neutral-400">
              No brand goals configured.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
