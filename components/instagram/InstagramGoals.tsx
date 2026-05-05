"use client"

import { useEffect, useState } from "react"
import { Target, Pencil, Check, X } from "lucide-react"
import { formatNumber } from "../../lib/instagram-utils"

// Goals are scoped per-account. Targets are per-period (matching the page's
// active date range). Persisted in localStorage; nothing server-side.
type GoalKey = "reach" | "engagement_rate" | "website_clicks" | "new_followers"

interface GoalsState {
  reach: number
  engagement_rate: number // percentage value (e.g. 3 means 3%)
  website_clicks: number
  new_followers: number
}

interface InstagramGoalsProps {
  account: string
  rangeLabel: string
  current: {
    reach: number
    engagement_rate: number // already as percentage value
    website_clicks: number
    new_followers: number
  }
  isConnected: boolean
}

const STORAGE_PREFIX = "ig:goals:v1:"

const DEFAULT_GOALS: GoalsState = {
  reach: 10000,
  engagement_rate: 3,
  website_clicks: 100,
  new_followers: 50,
}

const LABELS: Record<GoalKey, { label: string; suffix?: string; eyebrow: string }> = {
  reach: { label: "Reach", eyebrow: "Accounts reached" },
  engagement_rate: { label: "Engagement rate", suffix: "%", eyebrow: "Industry avg 1–3%" },
  website_clicks: { label: "Website clicks", eyebrow: "Profile → site" },
  new_followers: { label: "New followers", eyebrow: "Audience growth" },
}

function loadGoals(account: string): GoalsState {
  if (typeof window === "undefined") return DEFAULT_GOALS
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + account)
    if (!raw) return DEFAULT_GOALS
    const parsed = JSON.parse(raw) as Partial<GoalsState>
    return { ...DEFAULT_GOALS, ...parsed }
  } catch {
    return DEFAULT_GOALS
  }
}

function saveGoals(account: string, goals: GoalsState) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + account, JSON.stringify(goals))
  } catch {
    // ignore quota / disabled storage
  }
}

function progressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500"
  if (pct >= 75) return "bg-neutral-900"
  if (pct >= 50) return "bg-neutral-600"
  return "bg-neutral-400"
}

export function InstagramGoals({ account, rangeLabel, current, isConnected }: InstagramGoalsProps) {
  const [goals, setGoals] = useState<GoalsState>(DEFAULT_GOALS)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<GoalsState>(DEFAULT_GOALS)

  // Re-hydrate when account changes
  useEffect(() => {
    const next = loadGoals(account)
    setGoals(next)
    setDraft(next)
    setEditing(false)
  }, [account])

  if (!isConnected) return null

  const tiles: Array<{ key: GoalKey; current: number; target: number }> = [
    { key: "reach", current: current.reach, target: goals.reach },
    { key: "engagement_rate", current: current.engagement_rate, target: goals.engagement_rate },
    { key: "website_clicks", current: current.website_clicks, target: goals.website_clicks },
    { key: "new_followers", current: current.new_followers, target: goals.new_followers },
  ]

  const startEdit = () => {
    setDraft(goals)
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft(goals)
    setEditing(false)
  }
  const saveEdit = () => {
    setGoals(draft)
    saveGoals(account, draft)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
      {/* Header */}
      <div className="border-b border-neutral-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-neutral-900 font-medium text-sm">Goals</h3>
            <p className="text-neutral-500 text-xs">Targets for {rangeLabel.toLowerCase()}</p>
          </div>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
            <button
              onClick={saveEdit}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        ) : (
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            aria-label="Edit goals"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      {/* Goal tiles */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({ key, current: c, target: t }) => {
          const pct = t > 0 ? Math.min((c / t) * 100, 999) : 0
          const meta = LABELS[key]
          const displayCurrent =
            key === "engagement_rate" ? `${c.toFixed(2)}${meta.suffix ?? ""}` : formatNumber(c)
          const displayTarget =
            key === "engagement_rate" ? `${t.toFixed(2)}${meta.suffix ?? ""}` : formatNumber(t)
          const reached = pct >= 100

          return (
            <div
              key={key}
              className="rounded-md ring-1 ring-neutral-200/70 p-3 hover:ring-neutral-300 transition-colors"
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span
                  className={`inline-block h-1 w-1 rounded-full ${reached ? "bg-emerald-500" : "bg-neutral-400"}`}
                  aria-hidden="true"
                />
                {meta.label}
              </p>

              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    step={key === "engagement_rate" ? 0.1 : 1}
                    value={draft[key]}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setDraft((prev) => ({ ...prev, [key]: Number.isFinite(v) ? v : 0 }))
                    }}
                    className="w-full h-8 px-2 rounded-md ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 focus:outline-none text-sm font-medium tabular-nums text-neutral-900"
                  />
                  {meta.suffix && <span className="text-neutral-500 text-xs">{meta.suffix}</span>}
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-neutral-900 font-semibold tabular-nums text-lg">
                      {displayCurrent}
                    </span>
                    <span className="text-neutral-400 text-xs tabular-nums">/ {displayTarget}</span>
                  </div>
                  <div className="mt-2 h-1 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-[width] ${progressColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-neutral-500">
                    {pct.toFixed(0)}% of target
                  </p>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
