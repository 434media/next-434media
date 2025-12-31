"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { 
  Search, 
  RefreshCw, 
  Users, 
  Building, 
  Calendar, 
  AlertCircle, 
  Clock,
  MessageSquare,
  Link2,
  FileText,
  Filter
} from "lucide-react"
import { TASK_STATUS_COLORS, getDueDateStatus, formatDate, BRANDS } from "./types"
import type { Task, Brand } from "./types"

type UrgencyFilter = "all" | "overdue" | "due-soon" | "on-track"

interface TasksViewProps {
  tasks: Task[]
  searchQuery: string
  brandFilter: string
  assigneeFilter: string
  onSearchChange: (query: string) => void
  onBrandFilterChange: (brand: string) => void
  onAssigneeFilterChange: (assignee: string) => void
  onRefresh: () => void
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
  onRefresh,
  onOpenTask,
}: TasksViewProps) {
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all")
  
  // Get unique assignees from tasks for the filter dropdown
  const uniqueAssignees = Array.from(new Set(tasks.map(t => t.assigned_to).filter(Boolean))) as string[]

  // Filter tasks (including urgency filter)
  const filteredTasks = tasks.filter((task) => {
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

  // Sort tasks: overdue first, then due soon, then by due date (soonest first), then tasks without due dates
  const sortedTasks = [...filteredTasks].sort((a, b) => {
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
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
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
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-neutral-400 mt-1">
            Manage and track all CRM-related tasks. Sorted by urgency.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Quick urgency stats - clickable to filter */}
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "overdue" ? "all" : "overdue")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
              urgencyFilter === "overdue"
                ? "bg-red-500/20 border border-red-500/50 ring-1 ring-red-500/30"
                : overdueCount > 0
                ? "bg-red-500/10 border border-red-500/30 hover:bg-red-500/20"
                : "bg-neutral-800 border border-neutral-700 opacity-50"
            }`}
            disabled={overdueCount === 0 && urgencyFilter !== "overdue"}
          >
            <AlertCircle className={`w-3.5 h-3.5 ${overdueCount > 0 || urgencyFilter === "overdue" ? "text-red-400" : "text-neutral-500"}`} />
            <span className={`text-xs font-medium ${overdueCount > 0 || urgencyFilter === "overdue" ? "text-red-400" : "text-neutral-500"}`}>
              {overdueCount} overdue
            </span>
          </button>
          <button
            onClick={() => setUrgencyFilter(urgencyFilter === "due-soon" ? "all" : "due-soon")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all ${
              urgencyFilter === "due-soon"
                ? "bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30"
                : approachingCount > 0
                ? "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20"
                : "bg-neutral-800 border border-neutral-700 opacity-50"
            }`}
            disabled={approachingCount === 0 && urgencyFilter !== "due-soon"}
          >
            <Clock className={`w-3.5 h-3.5 ${approachingCount > 0 || urgencyFilter === "due-soon" ? "text-amber-400" : "text-neutral-500"}`} />
            <span className={`text-xs font-medium ${approachingCount > 0 || urgencyFilter === "due-soon" ? "text-amber-400" : "text-neutral-500"}`}>
              {approachingCount} due soon
            </span>
          </button>
          <span className="text-sm text-neutral-400">{sortedTasks.length} of {tasks.length} tasks</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between p-4 rounded-xl bg-neutral-900/50 border border-neutral-800">
        <div className="flex flex-1 flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
            />
          </div>
          <select
            value={brandFilter}
            onChange={(e) => onBrandFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500 min-w-[140px]"
          >
            <option value="all">All Brands</option>
            {BRANDS.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500 min-w-[160px]"
          >
            <option value="all">All Assignees</option>
            {uniqueAssignees.map((assignee) => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
          {urgencyFilter !== "all" && (
            <button
              onClick={() => setUrgencyFilter("all")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors text-neutral-400"
            >
              <Filter className="w-4 h-4" />
              Clear filter
            </button>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Tasks Grid */}
      {sortedTasks.length === 0 ? (
        <div className="p-8 text-center text-neutral-500 rounded-xl border border-neutral-800">
          {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {sortedTasks.map((task) => {
            const dueDateStatus = getDueDateStatus(task.due_date, task.status)
            
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onOpenTask(task)}
                className={`flex flex-col p-4 rounded-xl bg-neutral-900 border cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  dueDateStatus === "overdue" 
                    ? "border-red-500/50 hover:border-red-500 ring-1 ring-red-500/20" 
                    : dueDateStatus === "approaching"
                    ? "border-amber-500/50 hover:border-amber-500 ring-1 ring-amber-500/20"
                    : "border-neutral-800 hover:border-neutral-600"
                }`}
              >
                {/* Urgency Banner - Combined with status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {dueDateStatus === "overdue" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                    {dueDateStatus === "approaching" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                        <Clock className="w-3 h-3" />
                        Due Soon
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TASK_STATUS_COLORS[task.status] || TASK_STATUS_COLORS.not_started}`}>
                      {task.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  {task.due_date && (
                    <span className={`flex items-center gap-1 text-xs whitespace-nowrap ${
                      dueDateStatus === "overdue"
                        ? "text-red-400 font-medium"
                        : dueDateStatus === "approaching"
                        ? "text-amber-400 font-medium"
                        : "text-neutral-500"
                    }`}>
                      <Calendar className="w-3 h-3" />
                      {formatDate(task.due_date)}
                    </span>
                  )}
                </div>

                {/* Task Title */}
                <h4 className="font-medium text-sm mb-2 line-clamp-2 flex-1">{task.title || "Untitled Task"}</h4>

                {/* Description or Tags */}
                {task.description ? (
                  <p className="text-xs text-neutral-400 mb-3 line-clamp-2">{task.description}</p>
                ) : task.tags && task.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {task.tags.slice(0, 3).map((tag, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 text-xs rounded bg-neutral-800 text-neutral-400">
                        {tag}
                      </span>
                    ))}
                    {task.tags.length > 3 && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-neutral-800 text-neutral-500">
                        +{task.tags.length - 3}
                      </span>
                    )}
                  </div>
                ) : null}

                {/* Task Meta Footer */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-auto border-t border-neutral-800">
                  {/* Left side: Assignee & Brand */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate max-w-[80px]">{task.assigned_to || "Unassigned"}</span>
                    </span>
                    {task.brand && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 truncate max-w-[80px]">
                        {task.brand}
                      </span>
                    )}
                  </div>
                  
                  {/* Right side: Client & Indicators */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.client_name && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500" title={task.client_name}>
                        <Building className="w-3 h-3" />
                      </span>
                    )}
                    {task.comments && task.comments.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500" title={`${task.comments.length} comments`}>
                        <MessageSquare className="w-3 h-3" />
                        <span className="text-[10px]">{task.comments.length}</span>
                      </span>
                    )}
                    {task.web_links && task.web_links.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500" title={`${task.web_links.length} links`}>
                        <Link2 className="w-3 h-3" />
                      </span>
                    )}
                    {task.attachments && task.attachments.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-neutral-500" title={`${task.attachments.length} attachments`}>
                        <FileText className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
