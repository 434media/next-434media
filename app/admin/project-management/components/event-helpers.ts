import type { PMEvent } from "@/types/project-management-types"

// ============================================
// Shared types — used by EventsSection orchestrator + extracted EventCard /
// EventTable / EventEmptyState components.
// ============================================

export type SortField = "name" | "start_date" | "status" | "venue_name" | "budget"
export type SortDir = "asc" | "desc"
export type ViewLayout = "grid" | "table"
export type EventTab = "upcoming" | "in-progress" | "completed" | "all"

// ============================================
// Status pill chrome — kept neutral; the dot is the only carrier of status
// meaning so the system reads consistently across admin.
// ============================================

export const STATUS_DOT: Record<string, string> = {
  planning: "bg-amber-500",
  confirmed: "bg-blue-500",
  "in-progress": "bg-sky-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
}

export const STATUS_COLORS: Record<string, string> = {
  planning: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
  confirmed: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
  "in-progress": "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
  completed: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
  cancelled: "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200",
}

export const STATUS_BADGE_SOLID: Record<string, string> = {
  planning: "bg-neutral-900 text-white",
  confirmed: "bg-neutral-900 text-white",
  "in-progress": "bg-neutral-900 text-white",
  completed: "bg-neutral-900 text-white",
  cancelled: "bg-neutral-900 text-white",
}

// ============================================
// Helper Functions
// ============================================

export function getDaysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(dateStr + "T00:00:00")
  const diff = eventDate.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function categorizeEvent(event: PMEvent): EventTab {
  if (event.status === "completed" || event.status === "cancelled") return "completed"
  if (event.status === "in-progress") return "in-progress"

  const startDate = event.start_date || event.date
  const endDate = event.end_date || startDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (startDate) {
    const start = new Date(startDate + "T00:00:00")
    const end = endDate ? new Date(endDate + "T00:00:00") : start

    if (today >= start && today <= end) return "in-progress"
    if (today > end) return "completed"
  }

  return "upcoming"
}

export function formatCountdown(days: number | null): string {
  if (days === null) return "Date TBD"
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days <= 7) return `${days}d away`
  if (days <= 30) return `${Math.ceil(days / 7)}w away`
  return `${Math.ceil(days / 30)}mo away`
}

export function getBudgetHealth(
  event: PMEvent,
): { label: string; color: string; percent: number } | null {
  const budget = event.budget || event.estimated_expenses
  const actual = event.actual_expenses
  if (!budget || actual === undefined) return null

  const percent = Math.round((actual / budget) * 100)
  if (percent <= 80) return { label: "Under budget", color: "text-emerald-600", percent }
  if (percent <= 100) return { label: "On track", color: "text-blue-600", percent }
  if (percent <= 120) return { label: "Over budget", color: "text-amber-600", percent }
  return { label: "Over budget", color: "text-red-600", percent }
}
