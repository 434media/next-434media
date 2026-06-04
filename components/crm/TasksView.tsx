"use client"

import { useState } from "react"
import {
  Search,
  Plus,
  Users,
  Building,
  Calendar,
  AlertCircle,
  Clock,
  Filter,
  CheckCircle2,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react"
import { getDueDateStatus, formatDate, BRANDS, normalizeAssigneeName, isValidAssigneeName, parseLocalDate } from "./types"
import type { Task } from "./types"
import { useSelection, BulkActionBar } from "@/components/admin/SubmissionStateUI"

type UrgencyFilter = "all" | "overdue" | "due-soon" | "on-track"

// Mono dot-color map for status pills. Replaces the legacy TASK_STATUS_COLORS
// (saturated bg/text pairs) — pill chrome is now mono everywhere.
const STATUS_DOT: Record<string, string> = {
  not_started: "bg-neutral-400",
  in_progress: "bg-blue-500",
  to_do: "bg-sky-500",
  ready_for_review: "bg-amber-500",
  completed: "bg-emerald-500",
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  to_do: "To do",
  ready_for_review: "Ready for review",
  completed: "Completed",
}

// Helper to check if a completed task is within the 60-day visibility window
function isCompletedTaskVisible(task: Task): boolean {
  if (task.status !== "completed") return true

  let referenceDate: Date
  if (task.due_date) {
    referenceDate = parseLocalDate(task.due_date)
  } else if (task.updated_at) {
    referenceDate = parseLocalDate(task.updated_at)
  } else if (task.created_at) {
    referenceDate = parseLocalDate(task.created_at)
  } else {
    return false
  }

  if (isNaN(referenceDate.getTime())) return false

  const now = new Date()
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  sixtyDaysAgo.setHours(0, 0, 0, 0)

  return referenceDate >= sixtyDaysAgo
}

interface TasksViewProps {
  tasks: Task[]
  searchQuery: string
  brandFilter: string
  assigneeFilter: string
  onSearchChange: (query: string) => void
  onBrandFilterChange: (brand: string) => void
  onAssigneeFilterChange: (assignee: string) => void
  onAddTask: () => void
  onOpenTask: (task: Task) => void
  onQuickStatusChange?: (taskId: string, newStatus: string) => void
  onBulkDelete?: (ids: string[]) => Promise<void> | void
}

type StatusSort = "default" | "not_started" | "in_progress" | "to_do" | "ready_for_review" | "completed"

export function TasksView({
  tasks,
  searchQuery,
  brandFilter,
  assigneeFilter,
  onSearchChange,
  onBrandFilterChange,
  onAssigneeFilterChange,
  onAddTask,
  onOpenTask,
  onQuickStatusChange,
  onBulkDelete,
}: TasksViewProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all")
  const [showCompleted, setShowCompleted] = useState(false)
  const [statusSort, setStatusSort] = useState<StatusSort>("default")
  const { selected, toggle, set, clear } = useSelection()

  // Helper to check if a task is assigned to a specific person (primary OR secondary)
  const isAssignedTo = (task: Task, assignee: string): boolean => {
    if (task.assigned_to === assignee) return true
    if (task.secondary_assigned_to) {
      if (Array.isArray(task.secondary_assigned_to)) {
        return task.secondary_assigned_to.includes(assignee)
      } else {
        return task.secondary_assigned_to === assignee
      }
    }
    return false
  }

  // Get unique assignees from tasks for the filter dropdown
  const uniqueAssignees = Array.from(
    new Set(
      tasks.flatMap(t => {
        const assignees: string[] = []
        if (t.assigned_to && typeof t.assigned_to === "string" && t.assigned_to.trim() !== "") {
          assignees.push(normalizeAssigneeName(t.assigned_to))
        }
        if (t.secondary_assigned_to) {
          if (Array.isArray(t.secondary_assigned_to)) {
            t.secondary_assigned_to.forEach(s => {
              if (typeof s === "string" && s.trim() !== "") {
                assignees.push(normalizeAssigneeName(s))
              }
            })
          } else if (typeof t.secondary_assigned_to === "string" && t.secondary_assigned_to.trim() !== "") {
            assignees.push(normalizeAssigneeName(t.secondary_assigned_to))
          }
        }
        return assignees
      })
      .filter(name => isValidAssigneeName(name) && name !== "Unassigned")
    )
  ).sort()

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (!isCompletedTaskVisible(task)) return false
    if (task.status === "completed" && !showCompleted) return false

    const secondaryAssigneesStr = task.secondary_assigned_to
      ? (Array.isArray(task.secondary_assigned_to)
          ? task.secondary_assigned_to.join(" ")
          : task.secondary_assigned_to)
      : ""
    const matchesSearch =
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      secondaryAssigneesStr.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBrand = brandFilter === "all" || task.brand === brandFilter
    const matchesAssignee = assigneeFilter === "all" || isAssignedTo(task, assigneeFilter)

    const dueDateStatus = getDueDateStatus(task.due_date, task.status)
    let matchesUrgency = true
    if (urgencyFilter === "overdue") {
      matchesUrgency = dueDateStatus === "overdue"
    } else if (urgencyFilter === "due-soon") {
      matchesUrgency = dueDateStatus === "approaching"
    } else if (urgencyFilter === "on-track") {
      matchesUrgency = dueDateStatus === "normal" || dueDateStatus === null
    }

    return matchesSearch && matchesBrand && matchesAssignee && matchesUrgency
  })

  // Count completed tasks for the toggle button
  const completedCount = tasks.filter(t => {
    if (t.status !== "completed" || !isCompletedTaskVisible(t)) return false
    if (assigneeFilter !== "all" && !isAssignedTo(t, assigneeFilter)) return false
    if (brandFilter !== "all" && t.brand !== brandFilter) return false
    if (searchQuery) {
      const secondaryStr = t.secondary_assigned_to
        ? (Array.isArray(t.secondary_assigned_to)
            ? t.secondary_assigned_to.join(" ")
            : t.secondary_assigned_to)
        : ""
      const matchesSearch =
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        secondaryStr.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false
    }
    return true
  }).length

  // Sort tasks based on statusSort selection
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (statusSort !== "default") {
      const aMatches = a.status === statusSort
      const bMatches = b.status === statusSort
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
    }

    if (a.status === "completed" && b.status === "completed") {
      const dateA = a.due_date ? parseLocalDate(a.due_date).getTime() : parseLocalDate(a.updated_at || a.created_at).getTime()
      const dateB = b.due_date ? parseLocalDate(b.due_date).getTime() : parseLocalDate(b.updated_at || b.created_at).getTime()
      return dateB - dateA
    }

    if (statusSort !== "completed") {
      if (a.status === "completed" && b.status !== "completed") return 1
      if (a.status !== "completed" && b.status === "completed") return -1
    }

    const statusA = getDueDateStatus(a.due_date, a.status)
    const statusB = getDueDateStatus(b.due_date, b.status)

    const priorityOrder = { overdue: 0, approaching: 1, normal: 2, null: 3 }
    const priorityA = priorityOrder[statusA ?? "null"]
    const priorityB = priorityOrder[statusB ?? "null"]

    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }

    if (a.due_date && b.due_date) {
      return parseLocalDate(a.due_date).getTime() - parseLocalDate(b.due_date).getTime()
    }

    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  // Counts for quick stats
  const overdueCount = sortedTasks.filter(t => getDueDateStatus(t.due_date, t.status) === "overdue").length
  const approachingCount = sortedTasks.filter(t => getDueDateStatus(t.due_date, t.status) === "approaching").length

  // Multi-select (bulk delete) over the currently-visible rows
  const allVisibleIds = sortedTasks.map((t) => t.id)
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))
  const someSelected = allVisibleIds.some((id) => selected.has(id))
  const toggleAll = () => (allSelected ? clear() : set(allVisibleIds))

  // Reusable mono filter-pill class. Active = dark fill, inactive = light + ring.
  const filterPillClass = (active: boolean, disabled: boolean) =>
    `inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium tabular-nums transition-colors ${
      active
        ? "bg-neutral-900 text-white"
        : disabled
        ? "bg-neutral-50 text-neutral-400 ring-1 ring-neutral-200/70 cursor-default"
        : "bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
    }`

  return (
    <div className="space-y-6">
      {/* Header with Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-neutral-900">Tasks</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Manage and track CRM-related tasks. Sorted by urgency.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Overdue */}
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "overdue" ? "all" : "overdue")}
            disabled={overdueCount === 0 && urgencyFilter !== "overdue"}
            className={filterPillClass(urgencyFilter === "overdue", overdueCount === 0)}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${overdueCount > 0 ? "bg-red-500" : "bg-neutral-300"}`} aria-hidden="true" />
            <AlertCircle className="w-3.5 h-3.5" />
            {overdueCount} overdue
          </button>

          {/* Due Soon */}
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "due-soon" ? "all" : "due-soon")}
            disabled={approachingCount === 0 && urgencyFilter !== "due-soon"}
            className={filterPillClass(urgencyFilter === "due-soon", approachingCount === 0)}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${approachingCount > 0 ? "bg-amber-500" : "bg-neutral-300"}`} aria-hidden="true" />
            <Clock className="w-3.5 h-3.5" />
            {approachingCount} due soon
          </button>

          {/* Completed toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            disabled={completedCount === 0}
            title={showCompleted ? "Hide completed tasks" : "Show completed tasks (last 60 days)"}
            className={filterPillClass(showCompleted, completedCount === 0)}
          >
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${completedCount > 0 ? "bg-emerald-500" : "bg-neutral-300"}`} aria-hidden="true" />
            {showCompleted ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {completedCount} completed
          </button>

          {/* Clear filter — small text link, not a styled button */}
          {urgencyFilter !== "all" && (
            <button
              onClick={() => setUrgencyFilter("all")}
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <Filter className="w-3 h-3" />
              Clear filter
            </button>
          )}

          <span className="text-xs tabular-nums text-neutral-500 ml-1">
            {sortedTasks.length} of {tasks.filter(isCompletedTaskVisible).length}
          </span>
        </div>
      </div>

      {/* Toolbar — flat strip, no wrapper card */}
      <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-2 w-full lg:w-auto">
          <div className="relative flex-1 min-w-50 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-neutral-400"
            />
          </div>
          <select
            value={brandFilter}
            onChange={(e) => onBrandFilterChange(e.target.value)}
            aria-label="Filter by platform"
            className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400 min-w-35"
          >
            <option value="all">All platforms</option>
            {BRANDS.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeFilterChange(e.target.value)}
            aria-label="Filter by assignee"
            className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400 min-w-40"
          >
            <option value="all">All assignees</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
          <select
            value={statusSort}
            onChange={(e) => setStatusSort(e.target.value as StatusSort)}
            aria-label="Sort by status"
            className="h-9 px-3 rounded-md bg-white ring-1 ring-neutral-200 text-sm text-neutral-700 focus:outline-none focus:ring-neutral-400 min-w-25"
          >
            <option value="default">Status</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="to_do">To do</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <button
          onClick={onAddTask}
          className="inline-flex items-center gap-2 h-9 px-4 text-sm bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>

      {/* Tasks Table */}
      {sortedTasks.length === 0 ? (
        <div className="py-14 text-center bg-white rounded-md ring-1 ring-neutral-200/70">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-4">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h4 className="text-base font-medium text-neutral-900 mb-1">
            {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
          </h4>
          <p className="text-sm text-neutral-500 max-w-md mx-auto mb-5">
            {tasks.length === 0
              ? "Add your first task to start tracking work across the CRM."
              : "Try clearing filters or expanding the search."}
          </p>
          {tasks.length === 0 && (
            <button
              onClick={onAddTask}
              className="inline-flex items-center gap-2 h-9 px-4 text-sm bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-md ring-1 ring-neutral-200/70 overflow-hidden bg-white">
          <div className="overflow-x-auto max-h-[calc(100dvh-320px)]">
            <table className="w-full">
              <thead className="bg-neutral-50/60 sticky top-0 z-10 border-b border-neutral-100">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all tasks"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected }}
                      onChange={toggleAll}
                      className="rounded border-neutral-300 align-middle"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em]">
                    Task
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] hidden md:table-cell">
                    Platform
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] hidden sm:table-cell">
                    Assignee
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] hidden lg:table-cell">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {sortedTasks.map((task) => {
                  const dueDateStatus = getDueDateStatus(task.due_date, task.status)

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onOpenTask(task)}
                      className={`transition-colors cursor-pointer ${selected.has(task.id) ? "bg-neutral-50" : "hover:bg-neutral-50"}`}
                    >
                      {/* Multi-select checkbox — its own cell; stops the row from
                          opening when toggled */}
                      <td className="px-4 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${task.title || "task"}`}
                          checked={selected.has(task.id)}
                          onChange={() => toggle(task.id)}
                          className="rounded border-neutral-300 mt-1"
                        />
                      </td>
                      {/* Task title — colored dot encodes urgency at the row level */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2.5 max-w-md">
                          <span
                            className={`mt-1.5 inline-block h-1.5 w-1.5 rounded-full shrink-0 ${
                              task.status === "completed"
                                ? "bg-emerald-500"
                                : dueDateStatus === "overdue"
                                ? "bg-red-500"
                                : dueDateStatus === "approaching"
                                ? "bg-amber-500"
                                : "bg-neutral-300"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className={`font-medium text-sm line-clamp-1 ${task.status === "completed" ? "text-neutral-500 line-through" : "text-neutral-900"}`}>
                              {task.title || "Untitled task"}
                            </p>
                            {task.client_name && (
                              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                                {task.client_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status cell — overdue/due-soon flag + status pill */}
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1.5">
                          {dueDateStatus === "overdue" && task.status !== "completed" && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 w-fit">
                              <span className="inline-block h-1 w-1 rounded-full bg-red-500" aria-hidden="true" />
                              Overdue
                            </span>
                          )}
                          {dueDateStatus === "approaching" && task.status !== "completed" && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 w-fit">
                              <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                              Due soon
                            </span>
                          )}
                          {onQuickStatusChange ? (
                            <div className="relative w-fit">
                              <span className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status] ?? STATUS_DOT.not_started}`} aria-hidden="true" />
                              <select
                                value={task.status}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  onQuickStatusChange(task.id, e.target.value)
                                }}
                                className="text-xs font-medium pl-6 pr-2 py-1 rounded-full cursor-pointer bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 focus:outline-none focus:ring-neutral-400 appearance-none"
                                title="Change status"
                                aria-label={`Change status (currently ${STATUS_LABEL[task.status] ?? task.status})`}
                              >
                                <option value="not_started">Not started</option>
                                <option value="in_progress">In progress</option>
                                <option value="to_do">To do</option>
                                <option value="ready_for_review">Ready for review</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 w-fit">
                              <span className={`inline-block h-1 w-1 rounded-full ${STATUS_DOT[task.status] ?? STATUS_DOT.not_started}`} aria-hidden="true" />
                              {STATUS_LABEL[task.status] ?? task.status.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Platform — neutral pill, no urgency to encode */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {task.brand ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700">
                            <Building className="w-3 h-3 text-neutral-400" />
                            {task.brand}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-neutral-400" />
                            <span className="text-sm text-neutral-700 max-w-37.5 truncate">
                              {normalizeAssigneeName(
                                typeof task.assigned_to === "string"
                                  ? task.assigned_to
                                  : (task.assigned_to as { name?: string })?.name || "Unassigned"
                              )}
                            </span>
                          </div>
                          {task.secondary_assigned_to && (
                            <span className="text-xs text-neutral-500 pl-5 truncate max-w-37.5">
                              +{Array.isArray(task.secondary_assigned_to)
                                ? task.secondary_assigned_to.map(s => normalizeAssigneeName(s)).join(", ")
                                : normalizeAssigneeName(task.secondary_assigned_to)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Date — text turns red only when overdue; tabular-nums always */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {task.due_date ? (
                          <span
                            className={`flex items-center gap-1.5 text-sm tabular-nums ${
                              dueDateStatus === "overdue"
                                ? "text-red-600 font-semibold"
                                : "text-neutral-700 font-medium"
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                            {formatDate(task.due_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">No due date</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk-action bar — the shared component used by the Audiences/Inbox tabs,
          so multi-select looks and behaves identically across the app. */}
      {onBulkDelete && (
        <BulkActionBar
          count={selected.size}
          onClear={clear}
          actions={[
            {
              key: "delete",
              label: "Delete",
              icon: Trash2,
              destructive: true,
              run: async () => {
                await onBulkDelete(Array.from(selected))
                clear()
              },
            },
          ]}
        />
      )}
    </div>
  )
}
