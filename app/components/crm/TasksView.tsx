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
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-react"
import { TASK_STATUS_COLORS, getDueDateStatus, formatDate, BRANDS, normalizeAssigneeName, isValidAssigneeName, parseLocalDate } from "./types"
import type { Task, Brand } from "./types"

type UrgencyFilter = "all" | "overdue" | "due-soon" | "on-track"

// Helper to check if a completed task is within the 60-day visibility window
// Uses due_date as the reference since that's what drives task sorting internally
function isCompletedTaskVisible(task: Task): boolean {
  if (task.status !== "completed") return true
  
  // Use due_date as the reference for the 60-day window
  // Fall back to updated_at or created_at if no due date
  let referenceDate: Date
  if (task.due_date) {
    // Use parseLocalDate to handle YYYY-MM-DD format correctly
    referenceDate = parseLocalDate(task.due_date)
  } else if (task.updated_at) {
    referenceDate = parseLocalDate(task.updated_at)
  } else if (task.created_at) {
    referenceDate = parseLocalDate(task.created_at)
  } else {
    // If no date available, assume it's old and should be hidden
    return false
  }
  
  // Validate the date is valid
  if (isNaN(referenceDate.getTime())) return false
  
  const now = new Date()
  // Calculate 60 days ago from today
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  sixtyDaysAgo.setHours(0, 0, 0, 0) // Start of day
  
  // Only show completed tasks with due dates from the last 60 days
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
}

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
}: TasksViewProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all")
  const [showCompleted, setShowCompleted] = useState(false)
  
  // Get unique assignees from tasks for the filter dropdown
  // Normalize names and filter out short names like "jake", "barb", etc.
  const uniqueAssignees = Array.from(
    new Set(
      tasks
        .map(t => t.assigned_to)
        .filter((assignee): assignee is string => 
          typeof assignee === "string" && assignee.trim() !== ""
        )
        .map(normalizeAssigneeName)
        .filter(name => isValidAssigneeName(name) && name !== "Unassigned")
    )
  ).sort()

  // Filter tasks (including urgency filter and completed task visibility)
  const filteredTasks = tasks.filter((task) => {
    // First, check if completed task is within 60-day window
    if (!isCompletedTaskVisible(task)) return false
    
    // Hide completed tasks unless showCompleted is true
    if (task.status === "completed" && !showCompleted) return false
    
    const matchesSearch = 
      task.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBrand = brandFilter === "all" || task.brand === brandFilter
    const matchesAssignee = assigneeFilter === "all" || task.assigned_to === assigneeFilter
    
    // Urgency filter
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
  
  // Count completed tasks (within 60-day window) for the toggle button
  // This count should be dynamic based on the current assignee filter
  const completedCount = tasks.filter(t => {
    // Must be completed and within 60-day window
    if (t.status !== "completed" || !isCompletedTaskVisible(t)) return false
    
    // Apply assignee filter if set
    if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false
    
    // Apply brand filter if set
    if (brandFilter !== "all" && t.brand !== brandFilter) return false
    
    // Apply search filter if set
    if (searchQuery) {
      const matchesSearch = 
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false
    }
    
    return true
  }).length

  // Sort tasks: completed tasks by due date (most recent first), then overdue, then due soon, then by due date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // If showing completed tasks, sort them by due date (most recent due dates first)
    // This puts December due dates at the top
    if (a.status === "completed" && b.status === "completed") {
      // Parse due dates using parseLocalDate to avoid timezone issues
      const dateA = a.due_date ? parseLocalDate(a.due_date).getTime() : parseLocalDate(a.updated_at || a.created_at).getTime()
      const dateB = b.due_date ? parseLocalDate(b.due_date).getTime() : parseLocalDate(b.updated_at || b.created_at).getTime()
      return dateB - dateA // Most recent due dates first
    }
    
    // Completed tasks go after active tasks (unless both are completed)
    if (a.status === "completed" && b.status !== "completed") return 1
    if (a.status !== "completed" && b.status === "completed") return -1
    
    const statusA = getDueDateStatus(a.due_date, a.status)
    const statusB = getDueDateStatus(b.due_date, b.status)
    
    // Priority order: overdue > approaching > normal > null (no due date or completed)
    const priorityOrder = { overdue: 0, approaching: 1, normal: 2, null: 3 }
    const priorityA = priorityOrder[statusA ?? "null"]
    const priorityB = priorityOrder[statusB ?? "null"]
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB
    }
    
    // Within same priority, sort by due date (soonest first)
    if (a.due_date && b.due_date) {
      return parseLocalDate(a.due_date).getTime() - parseLocalDate(b.due_date).getTime()
    }
    
    // Tasks with due dates before tasks without
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    
    // Finally, sort by created date (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  
  // Count overdue and approaching tasks for quick stats
  const overdueCount = sortedTasks.filter(t => getDueDateStatus(t.due_date, t.status) === "overdue").length
  const approachingCount = sortedTasks.filter(t => getDueDateStatus(t.due_date, t.status) === "approaching").length

  return (
    <div className="space-y-6">
      {/* Header with Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all CRM-related tasks. Sorted by urgency.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick urgency stats - clickable to filter */}
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "overdue" ? "all" : "overdue")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
              urgencyFilter === "overdue"
                ? "bg-red-100 border border-red-300 ring-1 ring-red-200"
                : overdueCount > 0
                ? "bg-red-50 border border-red-200 hover:bg-red-100"
                : "bg-gray-100 border border-gray-200 opacity-50"
            }`}
            disabled={overdueCount === 0 && urgencyFilter !== "overdue"}
          >
            <AlertCircle className={`w-3.5 h-3.5 ${overdueCount > 0 || urgencyFilter === "overdue" ? "text-red-600" : "text-gray-400"}`} />
            <span className={`text-xs font-medium ${overdueCount > 0 || urgencyFilter === "overdue" ? "text-red-600" : "text-gray-400"}`}>
              {overdueCount} overdue
            </span>
          </button>
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "due-soon" ? "all" : "due-soon")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
              urgencyFilter === "due-soon"
                ? "bg-amber-100 border border-amber-300 ring-1 ring-amber-200"
                : approachingCount > 0
                ? "bg-amber-50 border border-amber-200 hover:bg-amber-100"
                : "bg-gray-100 border border-gray-200 opacity-50"
            }`}
            disabled={approachingCount === 0 && urgencyFilter !== "due-soon"}
          >
            <Clock className={`w-3.5 h-3.5 ${approachingCount > 0 || urgencyFilter === "due-soon" ? "text-amber-600" : "text-gray-400"}`} />
            <span className={`text-xs font-medium ${approachingCount > 0 || urgencyFilter === "due-soon" ? "text-amber-600" : "text-gray-400"}`}>
              {approachingCount} due soon
            </span>
          </button>
          {/* Completed tasks toggle */}
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
              showCompleted
                ? "bg-emerald-100 border border-emerald-300 ring-1 ring-emerald-200"
                : completedCount > 0
                ? "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                : "bg-gray-100 border border-gray-200 opacity-50"
            }`}
            disabled={completedCount === 0}
            title={showCompleted ? "Hide completed tasks" : "Show completed tasks (last 60 days)"}
          >
            {showCompleted ? (
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span className={`text-xs font-medium ${showCompleted ? "text-emerald-600" : "text-gray-500"}`}>
              {completedCount} completed
            </span>
          </button>
          {/* Clear urgency filter */}
          {urgencyFilter !== "all" && (
            <button
              onClick={() => setUrgencyFilter("all")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-300 hover:bg-gray-200 transition-all"
            >
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">Clear filter</span>
            </button>
          )}
          <span className="text-sm text-gray-500">{sortedTasks.length} of {tasks.filter(isCompletedTaskVisible).length} tasks</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between p-4 rounded-xl bg-white shadow-sm border border-gray-200">
        <div className="flex flex-1 flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:bg-white"
            />
          </div>
          <select
            value={brandFilter}
            onChange={(e) => onBrandFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 min-w-[140px]"
          >
            <option value="all">All Platforms</option>
            {BRANDS.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 min-w-[160px]"
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onAddTask}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors text-white font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Tasks Table */}
      {sortedTasks.length === 0 ? (
        <div className="p-8 text-center text-gray-400 rounded-xl border border-gray-200 bg-white">
          {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Task
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell bg-gray-50">
                    Platform
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell bg-gray-50">
                    Assignee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell bg-gray-50">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedTasks.map((task) => {
                  const dueDateStatus = getDueDateStatus(task.due_date, task.status)
                  
                  return (
                    <tr 
                      key={task.id} 
                      onClick={() => onOpenTask(task)}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        task.status === "completed"
                          ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                          : dueDateStatus === "overdue" 
                          ? "bg-red-50/50 hover:bg-red-50" 
                          : dueDateStatus === "approaching"
                          ? "bg-amber-50/50 hover:bg-amber-50"
                          : ""
                      }`}
                    >
                      {/* Task Title with Opportunity/Client Info */}
                      <td className="px-4 py-4">
                        <div className="max-w-md">
                          <p className={`font-medium text-sm line-clamp-1 ${task.status === "completed" ? "text-gray-500 line-through" : "text-gray-900"}`}>
                            {task.title || "Untitled Task"}
                          </p>
                          {(task.client_name) && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                              {task.client_name}
                            </p>
                          )}
                        </div>
                      </td>
                      
                      {/* Status with urgency indicator */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          {task.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-600 w-fit">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : (
                            <>
                              {dueDateStatus === "overdue" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 w-fit">
                                  <AlertCircle className="w-3 h-3" />
                                  Overdue
                                </span>
                              )}
                              {dueDateStatus === "approaching" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-600 w-fit">
                                  <Clock className="w-3 h-3" />
                                  Due Soon
                                </span>
                              )}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium w-fit ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.not_started}`}>
                                {task.status.replace(/_/g, " ")}
                              </span>
                            </>
                          )}
                        </div>
                      </td>
                      
                      {/* Platform */}
                      <td className="px-4 py-4 hidden md:table-cell">
                        {task.brand ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            <Building className="w-3 h-3 mr-1" />
                            {task.brand}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      
                      {/* Assignee with Secondary */}
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-sm text-gray-700 max-w-[150px] truncate">
                              {normalizeAssigneeName(
                                typeof task.assigned_to === "string" 
                                  ? task.assigned_to 
                                  : (task.assigned_to as { name?: string })?.name || "Unassigned"
                              )}
                            </span>
                          </div>
                          {task.secondary_assigned_to && (
                            <span className="text-xs text-gray-500 pl-5 truncate max-w-[150px]">
                              +{Array.isArray(task.secondary_assigned_to) 
                                ? task.secondary_assigned_to.map(s => normalizeAssigneeName(s)).join(", ")
                                : normalizeAssigneeName(task.secondary_assigned_to)
                              }
                            </span>
                          )}
                        </div>
                      </td>
                      
                      {/* Due Date */}
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {task.due_date ? (
                          <span className={`flex items-center gap-1.5 text-sm ${
                            dueDateStatus === "overdue"
                              ? "text-red-600 font-medium"
                              : dueDateStatus === "approaching"
                              ? "text-amber-600 font-medium"
                              : "text-gray-600"
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(task.due_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No due date</span>
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
    </div>
  )
}
