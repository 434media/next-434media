"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Target, Loader2, ArrowUpRight, Settings } from "lucide-react"

interface GoalsKpiPanelProps {
  propertyId: string
}

type Status = "on" | "behind" | "ahead" | "n/a"

interface Goal {
  id: string
  name: string
  source: string
  eventName?: string
  target: number
  period: "monthly" | "weekly"
  propertyId: string | null
  invertGoodness?: boolean
}

interface GoalEvaluation {
  goal: Goal
  current: number
  window: { startDate: string; endDate: string; dayOfPeriod: number; totalDays: number; paceFraction: number }
  progress: number
  status: Status
  reason?: string
}

const STATUS_STYLE: Record<Status, { dot: string; bar: string; text: string; label: string }> = {
  ahead: { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-700", label: "Ahead" },
  on: { dot: "bg-emerald-500", bar: "bg-emerald-500", text: "text-emerald-700", label: "On pace" },
  behind: { dot: "bg-amber-500", bar: "bg-amber-500", text: "text-amber-700", label: "Behind" },
  "n/a": { dot: "bg-neutral-300", bar: "bg-neutral-300", text: "text-neutral-500", label: "—" },
}

function formatValue(source: string, value: number): string {
  if (source === "ga4:engagementRate") return `${(value * 100).toFixed(1)}%`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

export function GoalsKpiPanel({ propertyId }: GoalsKpiPanelProps) {
  const [evaluations, setEvaluations] = useState<GoalEvaluation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasFiredOnce, setHasFiredOnce] = useState(false)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `/api/admin/analytics/goals/evaluate?propertyId=${encodeURIComponent(propertyId)}`,
        )
        if (!res.ok) {
          if (!cancelled) {
            setEvaluations([])
            setHasFiredOnce(true)
          }
          return
        }
        const data = await res.json()
        if (cancelled) return
        setEvaluations(data.evaluations ?? [])
        setHasFiredOnce(true)
      } catch {
        if (!cancelled) {
          setEvaluations([])
          setHasFiredOnce(true)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [propertyId])

  // Hide entirely on first load (no flash) and when there are zero goals
  // configured for this property. Settings page is the entry point.
  if (isLoading || !hasFiredOnce) return null
  if (evaluations.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-neutral-100">
        <Target className="w-4 h-4 text-neutral-500" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Goals
        </span>
        <span className="text-[10px] text-neutral-400 ml-2">
          {evaluations.length} {evaluations.length === 1 ? "goal" : "goals"}
        </span>
        <Link
          href="/admin/crm/settings?tab=goals"
          className="ml-auto inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-700"
        >
          <Settings className="w-3 h-3" />
          Manage
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-100">
        {evaluations.map((ev) => {
          const style = STATUS_STYLE[ev.status]
          // Progress bar maxes at 100% visually; the actual progress can exceed 1.0
          // (overachievement). We render >100% as a full bar with a trailing badge.
          const visualProgress = Math.min(1, ev.progress)
          const overshoot = ev.progress > 1
          return (
            <div key={ev.goal.id} className="bg-white p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-neutral-900 truncate">{ev.goal.name}</p>
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {ev.goal.period === "weekly" ? "This week" : "This month"} · day{" "}
                    {ev.window.dayOfPeriod} / {ev.window.totalDays}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${style.text} bg-white border border-neutral-200`}
                  title={ev.reason}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-neutral-900 tabular-nums leading-none">
                  {formatValue(ev.goal.source, ev.current)}
                </span>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  / {formatValue(ev.goal.source, ev.goal.target)}
                </span>
                {overshoot && (
                  <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700">
                    <ArrowUpRight className="w-3 h-3" />
                    {Math.round(ev.progress * 100)}%
                  </span>
                )}
              </div>

              {/* Progress bar with pace marker. The dashed marker shows where
                  the linear pace says we should be at this point in the period. */}
              <div className="relative h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${style.bar} transition-all duration-500`}
                  style={{ width: `${(visualProgress * 100).toFixed(1)}%` }}
                />
              </div>
              <div className="relative h-2 mt-0.5">
                {/* Pace tick — where you'd need to be to be on track */}
                {!ev.goal.invertGoodness && ev.window.paceFraction < 1 && (
                  <div
                    className="absolute top-0 w-px h-2 bg-neutral-400"
                    style={{ left: `${(ev.window.paceFraction * 100).toFixed(1)}%` }}
                    title={`Pace target — day ${ev.window.dayOfPeriod} of ${ev.window.totalDays}`}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
