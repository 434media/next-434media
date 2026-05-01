"use client"

import { useEffect, useState } from "react"
import { Plus, Loader2, Trash2, Target, Edit, X, Check } from "lucide-react"

interface Goal {
  id: string
  name: string
  source: string
  eventName?: string
  target: number
  period: "monthly" | "weekly"
  propertyId: string | null
  invertGoodness?: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface AnalyticsProperty {
  id: string
  name: string
  isConfigured?: boolean
}

const SOURCE_OPTIONS: Array<{ value: string; label: string; group: string; requiresProperty: boolean }> = [
  { value: "ga4:sessions", label: "GA4 — Sessions", group: "Google Analytics", requiresProperty: true },
  { value: "ga4:totalUsers", label: "GA4 — Users", group: "Google Analytics", requiresProperty: true },
  { value: "ga4:screenPageViews", label: "GA4 — Page views", group: "Google Analytics", requiresProperty: true },
  { value: "ga4:engagementRate", label: "GA4 — Engagement rate", group: "Google Analytics", requiresProperty: true },
  { value: "ga4:engagedSessions", label: "GA4 — Engaged sessions", group: "Google Analytics", requiresProperty: true },
  { value: "ga4_event", label: "GA4 — Custom event count", group: "Google Analytics", requiresProperty: true },
  { value: "crm:leads_created", label: "CRM — Leads created", group: "CRM", requiresProperty: false },
  { value: "crm:leads_converted", label: "CRM — Leads converted", group: "CRM", requiresProperty: false },
]

export function GoalsTab() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [properties, setProperties] = useState<AnalyticsProperty[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState("")
  const [source, setSource] = useState<string>("ga4:sessions")
  const [eventName, setEventName] = useState("")
  const [target, setTarget] = useState("")
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly")
  const [propertyId, setPropertyId] = useState<string>("")
  const [invertGoodness, setInvertGoodness] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [goalsRes, propsRes] = await Promise.all([
          fetch("/api/admin/analytics/goals"),
          fetch("/api/analytics?endpoint=properties"),
        ])
        if (!cancelled) {
          if (goalsRes.ok) {
            const data = await goalsRes.json()
            setGoals(data.goals ?? [])
          }
          if (propsRes.ok) {
            const data = await propsRes.json()
            setProperties(data.properties ?? [])
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const sourceMeta = SOURCE_OPTIONS.find((s) => s.value === source)
  const requiresProperty = !!sourceMeta?.requiresProperty
  const requiresEventName = source === "ga4_event"

  const resetForm = () => {
    setName("")
    setSource("ga4:sessions")
    setEventName("")
    setTarget("")
    setPeriod("monthly")
    setPropertyId("")
    setInvertGoodness(false)
    setError(null)
  }

  const handleAdd = async () => {
    setError(null)
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    const targetNum = parseFloat(target)
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setError("Target must be a positive number")
      return
    }
    if (requiresProperty && !propertyId) {
      setError("This goal type requires a property selection")
      return
    }
    if (requiresEventName && !eventName.trim()) {
      setError("Event name is required for custom event goals")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/admin/analytics/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          source,
          eventName: requiresEventName ? eventName.trim() : undefined,
          target: targetNum,
          period,
          propertyId: requiresProperty ? propertyId : null,
          invertGoodness,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create goal")
      setGoals((prev) => [data.goal, ...prev])
      setShowForm(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string, goalName: string) => {
    if (!confirm(`Delete goal "${goalName}"?`)) return
    try {
      const res = await fetch(`/api/admin/analytics/goals/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setGoals((prev) => prev.filter((g) => g.id !== id))
    } catch {
      // toast or inline error could go here; for now silent
    }
  }

  const propertyName = (id: string | null) => {
    if (!id) return "All properties"
    return properties.find((p) => p.id === id)?.name || id
  }

  const sourceLabel = (s: string) => SOURCE_OPTIONS.find((o) => o.value === s)?.label || s

  if (isLoading) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-12 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Goals</h3>
            <p className="text-[12px] text-neutral-500 mt-0.5">
              Track key metrics against monthly or weekly targets. Goals appear at the top of the
              analytics page for the property they're scoped to.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-[12px] font-medium rounded-md hover:bg-neutral-800"
          >
            {showForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                Add goal
              </>
            )}
          </button>
        </div>

        {showForm && (
          <div className="p-4 bg-neutral-50 border-b border-neutral-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Newsletter signups"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Target (per period)
                </label>
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="e.g. 350"
                  step="any"
                  min="0"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Metric source
                </label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <optgroup label="Google Analytics">
                    {SOURCE_OPTIONS.filter((o) => o.group === "Google Analytics").map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="CRM">
                    {SOURCE_OPTIONS.filter((o) => o.group === "CRM").map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as "monthly" | "weekly")}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {requiresEventName && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Event name (must match GA4 event name exactly)
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. lead_capture, newsletter_signup"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
                />
              </div>
            )}

            {requiresProperty && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Property scope
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
                >
                  <option value="">Select a property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!requiresProperty && (
              <div className="text-[11px] text-neutral-500 bg-white border border-neutral-200 rounded-md p-2">
                CRM-source goals are portfolio-wide — they apply to every property's analytics page.
              </div>
            )}

            <label className="flex items-center gap-2 text-[12px] text-neutral-600">
              <input
                type="checkbox"
                checked={invertGoodness}
                onChange={(e) => setInvertGoodness(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Lower is better (use for things like bounce rate)
            </label>

            {error && (
              <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-[13px] font-medium rounded-md hover:bg-neutral-800 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save goal
            </button>
          </div>
        )}

        {goals.length === 0 ? (
          <div className="p-12 text-center">
            <Target className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-neutral-700">No goals yet</p>
            <p className="text-[12px] text-neutral-500 mt-1">
              Add your first goal to start tracking metrics against targets.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-neutral-50">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Source</th>
                <th className="text-left px-4 py-2">Property</th>
                <th className="text-right px-4 py-2">Target</th>
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-right px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {goals.map((g) => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 text-[13px] font-medium text-neutral-900">{g.name}</td>
                  <td className="px-4 py-2.5 text-[12px] text-neutral-600">
                    {sourceLabel(g.source)}
                    {g.eventName && (
                      <span className="ml-1 text-neutral-400 font-mono text-[11px]">
                        ({g.eventName})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-neutral-600">
                    {propertyName(g.propertyId)}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-neutral-700 text-right tabular-nums">
                    {g.target.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-neutral-600 capitalize">{g.period}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id, g.name)}
                      className="p-1 text-neutral-300 hover:text-red-600 transition-colors"
                      aria-label={`Delete ${g.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
