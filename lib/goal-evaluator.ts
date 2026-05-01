import { getAnalyticsSummary, getTopEvents } from "./google-analytics"
import { getLeads } from "./firestore-leads"
import type { Goal, GoalPeriod } from "./firestore-goals"

/**
 * Resolve the current period start/end for a goal. We use calendar months
 * (1st of month → today) and ISO weeks (Monday → today). Day-of-period
 * tracking lets us compute "pace" — am I on track or behind for the period?
 */
export interface PeriodWindow {
  startDate: string
  endDate: string
  /** Days elapsed in the period (1-indexed: today = 1 if it just started). */
  dayOfPeriod: number
  /** Total days in the period (28-31 for monthly, 7 for weekly). */
  totalDays: number
  /** Day-of-period as a fraction 0–1, capped to 1 at end of period. */
  paceFraction: number
}

export function periodWindow(period: GoalPeriod, ref: Date = new Date()): PeriodWindow {
  const today = new Date(ref)
  today.setUTCHours(0, 0, 0, 0)
  const fmt = (d: Date) => d.toISOString().split("T")[0]

  if (period === "weekly") {
    // ISO week: Monday → Sunday
    const day = today.getUTCDay() // 0 = Sun
    const offset = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setUTCDate(monday.getUTCDate() + offset)
    const dayOfPeriod = Math.floor((today.getTime() - monday.getTime()) / 86400000) + 1
    return {
      startDate: fmt(monday),
      endDate: fmt(today),
      dayOfPeriod,
      totalDays: 7,
      paceFraction: Math.min(1, dayOfPeriod / 7),
    }
  }

  // Monthly: 1st of current month → today
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const lastOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
  const dayOfPeriod = Math.floor((today.getTime() - firstOfMonth.getTime()) / 86400000) + 1
  const totalDays = lastOfMonth.getUTCDate()
  return {
    startDate: fmt(firstOfMonth),
    endDate: fmt(today),
    dayOfPeriod,
    totalDays,
    paceFraction: Math.min(1, dayOfPeriod / totalDays),
  }
}

export interface GoalEvaluation {
  goal: Goal
  /** The actual current value for the period. */
  current: number
  /** Computed period window. */
  window: PeriodWindow
  /** current / target — capped to 1.5 for display sanity. 0 if target is 0. */
  progress: number
  /** "on" = at-or-ahead-of pace. "behind" = below pace. "ahead" = significantly ahead. "n/a" = no usable data. */
  status: "on" | "behind" | "ahead" | "n/a"
  /** Optional human-readable reason if status === "n/a" (e.g. "GA4 unavailable"). */
  reason?: string
}

/** Pull the current period value for a single goal. */
export async function evaluateGoal(goal: Goal): Promise<GoalEvaluation> {
  const window = periodWindow(goal.period)
  const empty = (status: GoalEvaluation["status"], reason?: string): GoalEvaluation => ({
    goal,
    current: 0,
    window,
    progress: 0,
    status,
    reason,
  })

  let current = 0
  try {
    if (goal.source.startsWith("ga4:") && goal.propertyId) {
      // Native GA4 metric. Pull a summary for the current period of the property.
      const metricKey = goal.source.slice("ga4:".length)
      const summary = await getAnalyticsSummary(window.startDate, window.endDate, goal.propertyId)
      switch (metricKey) {
        case "sessions":
          current = summary.totalSessions
          break
        case "totalUsers":
          current = summary.totalUsers
          break
        case "screenPageViews":
          current = summary.totalPageViews
          break
        case "engagementRate":
          current = summary.engagementRate
          break
        case "engagedSessions":
          current = summary.engagedSessions
          break
        default:
          return empty("n/a", `Unknown GA4 metric "${metricKey}"`)
      }
    } else if (goal.source === "ga4_event" && goal.propertyId && goal.eventName) {
      // Top-events lookup, find by event name. We pull 50 to widen the
      // chance the named event makes the cut.
      const events = await getTopEvents(window.startDate, window.endDate, goal.propertyId, 50)
      const match = events.data.find((e) => e.eventName === goal.eventName)
      current = match?.eventCount ?? 0
    } else if (goal.source === "crm:leads_created") {
      // Leads with created_at in the period.
      const leads = await getLeads()
      current = leads.filter((l) => l.created_at >= window.startDate && l.created_at <= `${window.endDate}T23:59:59.999Z`).length
    } else if (goal.source === "crm:leads_converted") {
      // Leads with converted_at in the period.
      const leads = await getLeads()
      current = leads.filter(
        (l) =>
          !!l.converted_at &&
          l.converted_at >= window.startDate &&
          l.converted_at <= `${window.endDate}T23:59:59.999Z`,
      ).length
    } else {
      return empty("n/a", "Goal source missing required configuration")
    }
  } catch (err) {
    return empty("n/a", err instanceof Error ? err.message : String(err))
  }

  // Bounce-rate-style metrics where lower is better — invert progress logic.
  // For invertGoodness goals: progress = target / current (capped). Pace
  // status flips: "behind" means current is HIGHER than the linear pace.
  let progress: number
  let status: GoalEvaluation["status"]

  if (goal.invertGoodness) {
    // Lower-is-better — being below target = good.
    progress = goal.target > 0 ? Math.min(1.5, goal.target / Math.max(current, 0.0001)) : 0
    if (current === 0) status = "ahead"
    else if (current <= goal.target) status = "on"
    else status = "behind"
  } else {
    progress = goal.target > 0 ? Math.min(1.5, current / goal.target) : 0
    const expectedAtPace = goal.target * window.paceFraction
    if (current >= expectedAtPace * 1.15) status = "ahead"
    else if (current >= expectedAtPace * 0.85) status = "on"
    else status = "behind"
  }

  return { goal, current, window, progress, status }
}

/** Evaluate every goal that applies to a property (its own + portfolio-wide) in parallel. */
export async function evaluateGoalsForProperty(propertyId: string, goals: Goal[]): Promise<GoalEvaluation[]> {
  const applicable = goals.filter((g) => g.propertyId === propertyId || g.propertyId === null)
  return Promise.all(applicable.map((g) => evaluateGoal(g)))
}
