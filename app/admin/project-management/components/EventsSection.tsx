"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  LayoutGrid,
  LayoutList,
  Calendar,
  MapPin,
  DollarSign,
  Globe,
  Building2,
  Trash2,
  Edit2,
  Eye,
  X,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Zap,
  Timer,
  ArrowRight,
  BarChart3,
} from "lucide-react"
import type { PMEvent } from "../../../types/project-management-types"
import { PM_EVENT_STATUSES } from "../../../types/project-management-types"

// ============================================
// Props
// ============================================
interface EventsSectionProps {
  events: PMEvent[]
  onDelete: (id: string) => void
  onSave: (event: Partial<PMEvent>, isNew: boolean) => Promise<void>
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

type SortField = "name" | "start_date" | "status" | "venue_name" | "budget"
type SortDir = "asc" | "desc"
type ViewLayout = "grid" | "table"
type EventTab = "upcoming" | "in-progress" | "completed" | "all"

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  "in-progress": "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
}

const STATUS_BADGE_SOLID: Record<string, string> = {
  planning: "bg-amber-500 text-white",
  confirmed: "bg-blue-500 text-white",
  "in-progress": "bg-purple-500 text-white",
  completed: "bg-emerald-500 text-white",
  cancelled: "bg-red-500 text-white",
}

const STATUS_DOT: Record<string, string> = {
  planning: "bg-amber-500",
  confirmed: "bg-blue-500",
  "in-progress": "bg-purple-500",
  completed: "bg-emerald-500",
  cancelled: "bg-red-500",
}

// ============================================
// Helpers
// ============================================

function getDaysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(dateStr + "T00:00:00")
  const diff = eventDate.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function categorizeEvent(event: PMEvent): EventTab {
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

function formatCountdown(days: number | null): string {
  if (days === null) return "Date TBD"
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  if (days < 0) return `${Math.abs(days)}d ago`
  if (days <= 7) return `${days}d away`
  if (days <= 30) return `${Math.ceil(days / 7)}w away`
  return `${Math.ceil(days / 30)}mo away`
}

function getBudgetHealth(event: PMEvent): { label: string; color: string; percent: number } | null {
  const budget = event.budget || event.estimated_expenses
  const actual = event.actual_expenses
  if (!budget || actual === undefined) return null

  const percent = Math.round((actual / budget) * 100)
  if (percent <= 80) return { label: "Under budget", color: "text-emerald-600", percent }
  if (percent <= 100) return { label: "On track", color: "text-blue-600", percent }
  if (percent <= 120) return { label: "Over budget", color: "text-amber-600", percent }
  return { label: "Over budget", color: "text-red-600", percent }
}

// ============================================
// Main Component
// ============================================
export default function EventsSection({ events, onDelete, onSave, showToast }: EventsSectionProps) {
  const [layout, setLayout] = useState<ViewLayout>("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming")
  const [sortField, setSortField] = useState<SortField>("start_date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showCompletedAll, setShowCompletedAll] = useState(false)

  // Modal states
  const [formOpen, setFormOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<PMEvent | null>(null)
  const [detailEvent, setDetailEvent] = useState<PMEvent | null>(null)
  const [statusChangeEvent, setStatusChangeEvent] = useState<string | null>(null)

  // Categorize events
  const categorized = useMemo(() => {
    const groups: Record<EventTab, PMEvent[]> = {
      upcoming: [],
      "in-progress": [],
      completed: [],
      all: [],
    }

    events.forEach((event) => {
      const cat = categorizeEvent(event)
      groups[cat].push(event)
      groups.all.push(event)
    })

    // Sort upcoming by nearest date first
    groups.upcoming.sort((a, b) => {
      const dateA = a.start_date || a.date || "9999"
      const dateB = b.start_date || b.date || "9999"
      return dateA.localeCompare(dateB)
    })

    // Sort in-progress by end date (soonest ending first)
    groups["in-progress"].sort((a, b) => {
      const dateA = a.end_date || a.start_date || a.date || "9999"
      const dateB = b.end_date || b.start_date || b.date || "9999"
      return dateA.localeCompare(dateB)
    })

    // Sort completed by most recent first
    groups.completed.sort((a, b) => {
      const dateA = a.start_date || a.date || ""
      const dateB = b.start_date || b.date || ""
      return dateB.localeCompare(dateA)
    })

    return groups
  }, [events])

  // Dashboard metrics
  const metrics = useMemo(() => {
    const upcoming = categorized.upcoming
    const inProgress = categorized["in-progress"]

    const nextEvent = upcoming[0] || null
    const nextDays = nextEvent ? getDaysUntil(nextEvent.start_date || nextEvent.date) : null

    const activeEvents = [...upcoming, ...inProgress]
    const totalBudget = activeEvents.reduce((sum, e) => sum + (e.budget || e.estimated_expenses || 0), 0)
    const totalActual = activeEvents.reduce((sum, e) => sum + (e.actual_expenses || 0), 0)

    return {
      upcoming: upcoming.length,
      inProgress: inProgress.length,
      completed: categorized.completed.length,
      total: events.length,
      nextEvent,
      nextDays,
      totalBudget,
      totalActual,
    }
  }, [categorized, events])

  // Filter current tab
  const filteredEvents = useMemo(() => {
    let result = [...(categorized[activeTab] || [])]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.venue_name?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      )
    }

    if (activeTab === "all") {
      result.sort((a, b) => {
        let valA: string | number = ""
        let valB: string | number = ""
        switch (sortField) {
          case "name":
            valA = a.name?.toLowerCase() || ""
            valB = b.name?.toLowerCase() || ""
            break
          case "start_date":
            valA = a.start_date || a.date || ""
            valB = b.start_date || b.date || ""
            break
          case "status":
            valA = a.status || ""
            valB = b.status || ""
            break
          case "venue_name":
            valA = a.venue_name?.toLowerCase() || ""
            valB = b.venue_name?.toLowerCase() || ""
            break
          case "budget":
            valA = a.budget || 0
            valB = b.budget || 0
            break
        }
        if (valA < valB) return sortDir === "asc" ? -1 : 1
        if (valA > valB) return sortDir === "asc" ? 1 : -1
        return 0
      })
    }

    return result
  }, [categorized, activeTab, searchQuery, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-300" />
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-neutral-900" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-neutral-900" />
    )
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "TBD"
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const openNew = () => {
    setEditingEvent(null)
    setFormOpen(true)
  }

  const openEdit = (event: PMEvent) => {
    setEditingEvent(event)
    setFormOpen(true)
  }

  const handleQuickStatusChange = async (event: PMEvent, newStatus: PMEvent["status"]) => {
    setStatusChangeEvent(event.id)
    try {
      await onSave({ ...event, status: newStatus }, false)
      showToast(`"${event.name}" marked as ${newStatus}`, "success")
    } catch {
      showToast("Failed to update status", "error")
    } finally {
      setStatusChangeEvent(null)
    }
  }

  const completedToShow = activeTab === "completed" && !showCompletedAll
    ? filteredEvents.slice(0, 6)
    : filteredEvents

  const displayEvents = activeTab === "completed" ? completedToShow : filteredEvents

  return (
    <div className="space-y-6">
      {/* Dashboard Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="col-span-2 relative overflow-hidden bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl p-5"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <Timer className="w-3.5 h-3.5" />
              Next Event
            </div>
            {metrics.nextEvent ? (
              <>
                <h3 className="text-lg font-bold leading-tight mb-1 truncate">
                  {metrics.nextEvent.name}
                </h3>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-300">
                    {formatDate(metrics.nextEvent.start_date || metrics.nextEvent.date)}
                  </span>
                  <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs font-bold">
                    {formatCountdown(metrics.nextDays)}
                  </span>
                </div>
                {metrics.nextEvent.venue_name && (
                  <div className="flex items-center gap-1.5 text-neutral-400 text-xs mt-2">
                    <MapPin className="w-3 h-3" />
                    {metrics.nextEvent.venue_name}
                  </div>
                )}
              </>
            ) : (
              <p className="text-neutral-400 text-sm">No upcoming events scheduled</p>
            )}
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full" />
          <div className="absolute -right-2 -bottom-2 w-20 h-20 bg-white/5 rounded-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white border border-neutral-200 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Zap className="w-3.5 h-3.5" />
            Active
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-black text-neutral-900">
              {metrics.inProgress + metrics.upcoming}
            </span>
            <div className="flex flex-col text-xs text-neutral-500 mb-1">
              {metrics.inProgress > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  {metrics.inProgress} live
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {metrics.upcoming} upcoming
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-neutral-200 rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            Budget
          </div>
          {metrics.totalBudget > 0 ? (
            <>
              <span className="text-2xl font-black text-neutral-900">
                ${metrics.totalActual.toLocaleString()}
              </span>
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                  <span>of ${metrics.totalBudget.toLocaleString()}</span>
                  <span className={
                    metrics.totalActual <= metrics.totalBudget ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"
                  }>
                    {Math.round((metrics.totalActual / metrics.totalBudget) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-neutral-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      metrics.totalActual <= metrics.totalBudget ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(100, (metrics.totalActual / metrics.totalBudget) * 100)}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <span className="text-sm text-neutral-400">No budgets set</span>
          )}
        </motion.div>
      </div>

      {/* Tabs & Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
            {([
              { id: "in-progress" as EventTab, label: "Happening Now", count: categorized["in-progress"].length, dot: "bg-purple-500" },
              { id: "upcoming" as EventTab, label: "Upcoming", count: categorized.upcoming.length, dot: "bg-amber-500" },
              { id: "completed" as EventTab, label: "Completed", count: categorized.completed.length, dot: "bg-emerald-500" },
              { id: "all" as EventTab, label: "All", count: events.length, dot: "bg-neutral-500" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowCompletedAll(false) }}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                  activeTab === tab.id ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-600"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-100 rounded-lg p-0.5">
              <button
                onClick={() => setLayout("grid")}
                className={`p-2 rounded-md transition-colors ${
                  layout === "grid" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout("table")}
                className={`p-2 rounded-md transition-colors ${
                  layout === "table" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
          />
        </div>
      </div>

      {/* Happening Now Banner */}
      {activeTab !== "in-progress" && categorized["in-progress"].length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl"
        >
          <div className="relative flex-shrink-0">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-purple-800">
              {categorized["in-progress"].length} event{categorized["in-progress"].length > 1 ? "s" : ""} happening now
            </span>
            <span className="text-sm text-purple-600 ml-2">
              {categorized["in-progress"].map(e => e.name).join(", ")}
            </span>
          </div>
          <button
            onClick={() => setActiveTab("in-progress")}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
          >
            View
            <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
        {activeTab === "completed" && filteredEvents.length > 6 && (
          <button
            onClick={() => setShowCompletedAll(!showCompletedAll)}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            {showCompletedAll ? "Show less" : `Show all ${filteredEvents.length} completed`}
          </button>
        )}
      </div>

      {/* Content */}
      {displayEvents.length === 0 ? (
        <EmptyState tab={activeTab} searchQuery={searchQuery} onAddNew={openNew} />
      ) : layout === "grid" ? (
        <div className={`grid gap-5 ${
          activeTab === "in-progress"
            ? "sm:grid-cols-1 lg:grid-cols-2"
            : "sm:grid-cols-2 lg:grid-cols-3"
        }`}>
          <AnimatePresence mode="popLayout">
            {displayEvents.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                tab={activeTab}
                index={idx}
                onView={() => setDetailEvent(event)}
                onEdit={() => openEdit(event)}
                onDelete={() => onDelete(event.id)}
                onStatusChange={handleQuickStatusChange}
                isChangingStatus={statusChangeEvent === event.id}
                formatDate={formatDate}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <EventTable
          events={displayEvents}
          tab={activeTab}
          sortField={sortField}
          sortDir={sortDir}
          toggleSort={toggleSort}
          SortIcon={SortIcon}
          formatDate={formatDate}
          onView={(event) => setDetailEvent(event)}
          onEdit={(event) => openEdit(event)}
          onDelete={(id) => onDelete(id)}
          onStatusChange={handleQuickStatusChange}
          isChangingStatus={statusChangeEvent}
        />
      )}

      {/* Show more for completed */}
      {activeTab === "completed" && !showCompletedAll && filteredEvents.length > 6 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowCompletedAll(true)}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg transition-colors shadow-sm"
          >
            Show {filteredEvents.length - 6} more completed events
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {formOpen && (
          <EventFormModal
            event={editingEvent}
            onClose={() => { setFormOpen(false); setEditingEvent(null) }}
            onSave={onSave}
            showToast={showToast}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {detailEvent && (
          <EventDetailModal
            event={detailEvent}
            onClose={() => setDetailEvent(null)}
            onEdit={(event) => { setDetailEvent(null); openEdit(event) }}
            onDelete={(id) => { setDetailEvent(null); onDelete(id) }}
            onStatusChange={handleQuickStatusChange}
          />
        )}
      </AnimatePresence>
    </div>
  )
}


// ============================================
// Empty State
// ============================================
function EmptyState({ tab, searchQuery, onAddNew }: { tab: EventTab; searchQuery: string; onAddNew: () => void }) {
  const messages: Record<EventTab, { icon: typeof Calendar; title: string; desc: string }> = {
    "in-progress": {
      icon: Zap,
      title: "No events happening right now",
      desc: "Events that are currently live will appear here",
    },
    upcoming: {
      icon: Calendar,
      title: "No upcoming events",
      desc: "Schedule your next event to see it here",
    },
    completed: {
      icon: CheckCircle2,
      title: "No completed events",
      desc: "Events that have concluded will appear here",
    },
    all: {
      icon: Calendar,
      title: "No events found",
      desc: 'Click "Add Event" to create one or sync from Airtable',
    },
  }

  const msg = messages[tab]
  const Icon = msg.icon

  return (
    <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
      <Icon className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
      <p className="text-neutral-600 font-medium">{searchQuery ? "No matching events" : msg.title}</p>
      <p className="text-neutral-400 text-sm mt-1">
        {searchQuery ? "Try adjusting your search" : msg.desc}
      </p>
      {!searchQuery && tab === "upcoming" && (
        <button
          onClick={onAddNew}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      )}
    </div>
  )
}


// ============================================
// Event Card Component
// ============================================
interface EventCardProps {
  event: PMEvent
  tab: EventTab
  index: number
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (event: PMEvent, status: PMEvent["status"]) => void
  isChangingStatus: boolean
  formatDate: (dateStr?: string) => string
}

function EventCard({ event, tab, index, onView, onEdit, onDelete, onStatusChange, isChangingStatus, formatDate }: EventCardProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const days = getDaysUntil(event.start_date || event.date)
  const budgetHealth = getBudgetHealth(event)
  const isLive = tab === "in-progress" || categorizeEvent(event) === "in-progress"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03 }}
      className={`group relative overflow-hidden bg-white transition-all duration-300 rounded-xl cursor-pointer ${
        isLive
          ? "border-2 border-purple-300 shadow-lg shadow-purple-100/50 hover:border-purple-400"
          : tab === "completed"
          ? "border border-neutral-200 opacity-80 hover:opacity-100 hover:border-neutral-300"
          : "border border-neutral-200 hover:border-neutral-900 hover:shadow-md"
      }`}
      onClick={onView}
    >
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500 animate-pulse z-10" />
      )}

      {/* Banner */}
      <div className={`relative ${isLive ? "aspect-[21/9]" : "aspect-[16/9]"} bg-neutral-100 overflow-hidden`}>
        {event.photo_banner || event.img_ai ? (
          <img
            src={event.photo_banner || event.img_ai}
            alt={event.name}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              tab === "completed" ? "grayscale-[30%]" : ""
            }`}
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${
            isLive
              ? "bg-gradient-to-br from-purple-100 to-purple-200"
              : "bg-gradient-to-br from-neutral-100 to-neutral-200"
          }`}>
            <Calendar className={`w-12 h-12 ${isLive ? "text-purple-300" : "text-neutral-300"}`} />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-3 left-3 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu) }}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md flex items-center gap-1.5 ${
              STATUS_BADGE_SOLID[event.status] || "bg-neutral-500 text-white"
            } hover:ring-2 hover:ring-white/50 transition-all`}
          >
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
            )}
            {event.status}
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>

          <AnimatePresence>
            {showStatusMenu && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-[140px] z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {PM_EVENT_STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setShowStatusMenu(false)
                      if (status !== event.status) onStatusChange(event, status)
                    }}
                    disabled={isChangingStatus}
                    className={`w-full text-left px-3 py-2 text-xs font-semibold capitalize flex items-center gap-2 transition-colors ${
                      status === event.status
                        ? "bg-neutral-50 text-neutral-900"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                    {status}
                    {status === event.status && <CheckCircle2 className="w-3 h-3 ml-auto text-neutral-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Countdown badge */}
        {days !== null && tab !== "completed" && (
          <div className="absolute top-3 right-3 z-10">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-md backdrop-blur-sm ${
              days <= 0
                ? "bg-purple-500/90 text-white"
                : days <= 7
                ? "bg-red-500/90 text-white"
                : days <= 30
                ? "bg-amber-500/90 text-white"
                : "bg-white/90 text-neutral-700"
            }`}>
              {formatCountdown(days)}
            </span>
          </div>
        )}

        {event.on_budget && tab !== "completed" && (
          <div className="absolute bottom-3 right-3 z-10">
            <span className="bg-white/90 backdrop-blur-sm px-2 py-1 text-xs font-medium rounded-md">
              {event.on_budget}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 border-t border-neutral-100">
        <div className={`w-8 h-1 mb-3 ${isLive ? "bg-purple-400" : "bg-yellow-400"}`} />
        <h3 className={`text-lg font-bold leading-tight mb-2 ${
          tab === "completed" ? "text-neutral-600" : "text-neutral-900"
        }`}>
          {event.name}
        </h3>

        <div className="flex items-center gap-2 text-sm text-neutral-600 mb-1.5">
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-medium">{formatDate(event.start_date || event.date)}</span>
          {event.end_date && event.end_date !== (event.start_date || event.date) && (
            <span className="text-neutral-400">- {formatDate(event.end_date)}</span>
          )}
        </div>

        {(event.venue_name || event.location) && (
          <div className="flex items-start gap-2 text-sm text-neutral-500 mb-1.5">
            <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-400" />
            <div>
              {event.venue_name && (
                <span className="font-medium text-neutral-700">{event.venue_name}</span>
              )}
              {event.venue_name && event.venue_location && <br />}
              {event.venue_location && (
                <span className="text-xs text-neutral-400">{event.venue_location}</span>
              )}
              {!event.venue_name && event.location && (
                <span className="text-neutral-500">{event.location}</span>
              )}
            </div>
          </div>
        )}

        {/* Budget bar */}
        {budgetHealth && (
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-neutral-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Budget
              </span>
              <span className={`font-semibold ${budgetHealth.color}`}>
                {budgetHealth.percent}% - {budgetHealth.label}
              </span>
            </div>
            <div className="w-full bg-neutral-100 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  budgetHealth.percent <= 80 ? "bg-emerald-500"
                    : budgetHealth.percent <= 100 ? "bg-blue-500"
                    : budgetHealth.percent <= 120 ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, budgetHealth.percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1">
              <span>${(event.actual_expenses || 0).toLocaleString()} spent</span>
              <span>${(event.budget || event.estimated_expenses || 0).toLocaleString()} budget</span>
            </div>
          </div>
        )}

        {/* Completed footer */}
        {tab === "completed" && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
            {event.actual_expenses !== undefined && event.budget !== undefined && (
              <span className="text-xs text-neutral-400 ml-auto">
                Final: ${event.actual_expenses.toLocaleString()} / ${event.budget.toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        {(days === null || tab === "completed") && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-1.5 bg-white/90 backdrop-blur-sm rounded-md text-neutral-600 hover:text-neutral-900 shadow-sm"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1.5 bg-white/90 backdrop-blur-sm rounded-md text-neutral-600 hover:text-red-600 shadow-sm"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}


// ============================================
// Event Table Component
// ============================================
interface EventTableProps {
  events: PMEvent[]
  tab: EventTab
  sortField: SortField
  sortDir: SortDir
  toggleSort: (field: SortField) => void
  SortIcon: React.FC<{ field: SortField }>
  formatDate: (dateStr?: string) => string
  onView: (event: PMEvent) => void
  onEdit: (event: PMEvent) => void
  onDelete: (id: string) => void
  onStatusChange: (event: PMEvent, status: PMEvent["status"]) => void
  isChangingStatus: string | null
}

function EventTable({
  events, tab, toggleSort, SortIcon, formatDate,
  onView, onEdit, onDelete, onStatusChange, isChangingStatus,
}: EventTableProps) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50">
              {tab !== "all" && <th className="px-4 py-3 w-10" />}
              {([
                { field: "name" as SortField, label: "Event" },
                { field: "start_date" as SortField, label: "Date" },
                { field: "status" as SortField, label: "Status" },
                { field: "venue_name" as SortField, label: "Venue" },
                { field: "budget" as SortField, label: "Budget" },
              ] as const).map((col) => (
                <th
                  key={col.field}
                  onClick={() => toggleSort(col.field)}
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 cursor-pointer hover:text-neutral-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon field={col.field} />
                  </div>
                </th>
              ))}
              {tab === "upcoming" && (
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Countdown
                </th>
              )}
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.map((event) => {
              const days = getDaysUntil(event.start_date || event.date)
              const isLive = categorizeEvent(event) === "in-progress"

              return (
                <tr
                  key={event.id}
                  className={`transition-colors cursor-pointer ${
                    isLive
                      ? "bg-purple-50/50 hover:bg-purple-50"
                      : tab === "completed"
                      ? "hover:bg-neutral-50 opacity-70 hover:opacity-100"
                      : "hover:bg-neutral-50"
                  }`}
                  onClick={() => onView(event)}
                >
                  {tab !== "all" && (
                    <td className="px-4 py-3">
                      {isLive && (
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
                        </span>
                      )}
                      {tab === "completed" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(event.photo_banner || event.img_ai) && (
                        <img
                          src={event.photo_banner || event.img_ai}
                          alt=""
                          className={`w-10 h-7 rounded object-cover flex-shrink-0 ${
                            tab === "completed" ? "grayscale-[30%]" : ""
                          }`}
                        />
                      )}
                      <span className="font-semibold text-neutral-900 truncate max-w-[200px]">
                        {event.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {formatDate(event.start_date || event.date)}
                    {event.end_date && event.end_date !== (event.start_date || event.date) && (
                      <span className="text-neutral-400 text-xs"> - {formatDate(event.end_date)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${
                      STATUS_COLORS[event.status] || "bg-neutral-100 text-neutral-600 border-neutral-200"
                    }`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 truncate max-w-[180px]">
                    {event.venue_name || event.location || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {event.budget ? (
                      <div>
                        <span>${event.budget.toLocaleString()}</span>
                        {event.actual_expenses !== undefined && (
                          <span className={`text-xs ml-1 ${
                            event.actual_expenses <= event.budget ? "text-emerald-600" : "text-red-600"
                          }`}>
                            ({Math.round((event.actual_expenses / event.budget) * 100)}%)
                          </span>
                        )}
                      </div>
                    ) : "\u2014"}
                  </td>
                  {tab === "upcoming" && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {days !== null && (
                        <span className={`px-2 py-1 text-xs font-bold rounded-md ${
                          days <= 7
                            ? "bg-red-100 text-red-700"
                            : days <= 30
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-600"
                        }`}>
                          {formatCountdown(days)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); onView(event) }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(event) }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {tab === "upcoming" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onStatusChange(event, "confirmed")
                          }}
                          disabled={event.status === "confirmed" || isChangingStatus === event.id}
                          className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-30"
                          title="Confirm event"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(event.id) }}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ============================================
// Event Form Modal
// ============================================
interface EventFormModalProps {
  event: PMEvent | null
  onClose: () => void
  onSave: (event: Partial<PMEvent>, isNew: boolean) => Promise<void>
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

function EventFormModal({ event, onClose, onSave, showToast }: EventFormModalProps) {
  const isNew = !event
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Partial<PMEvent>>(
    event || {
      name: "",
      date: "",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      location: "",
      venue_name: "",
      venue_location: "",
      venue_address: "",
      venue_map_link: "",
      description: "",
      agenda_overview: "",
      status: "planning",
      budget: undefined,
      estimated_expenses: undefined,
      actual_expenses: undefined,
      website_url: "",
      notes: "",
    }
  )

  const handleChange = (field: keyof PMEvent, value: string | number | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) {
      showToast("Event name is required", "error")
      return
    }
    setIsSaving(true)
    try {
      await onSave(form, isNew)
      onClose()
    } catch {
      // error handled by parent
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 pb-4 bg-white border-b border-neutral-200 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {isNew ? "Add Event" : "Edit Event"}
            </h2>
            <p className="text-sm text-neutral-500 mt-0.5">
              {isNew ? "Create a new event" : `Editing ${event?.name}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Basic Information</legend>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Event Name <span className="text-red-500">*</span></label>
              <input type="text" value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select value={form.status || "planning"} onChange={(e) => handleChange("status", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200">
                  {PM_EVENT_STATUSES.map((s) => (<option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Website URL</label>
                <input type="url" value={form.website_url || ""} onChange={(e) => handleChange("website_url", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
              <textarea rows={3} value={form.description || ""} onChange={(e) => handleChange("description", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-none" />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Date & Time</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                <input type="date" value={form.start_date || ""} onChange={(e) => handleChange("start_date", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                <input type="date" value={form.end_date || ""} onChange={(e) => handleChange("end_date", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Time</label>
                <input type="time" value={form.start_time || ""} onChange={(e) => handleChange("start_time", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Time</label>
                <input type="time" value={form.end_time || ""} onChange={(e) => handleChange("end_time", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Venue</legend>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Venue Name</label>
                <input type="text" value={form.venue_name || ""} onChange={(e) => handleChange("venue_name", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Location</label>
                <input type="text" value={form.location || ""} onChange={(e) => handleChange("location", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Venue Address</label>
              <input type="text" value={form.venue_address || ""} onChange={(e) => handleChange("venue_address", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Map Link</label>
              <input type="url" value={form.venue_map_link || ""} onChange={(e) => handleChange("venue_map_link", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Budget</legend>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Budget</label>
                <input type="number" min={0} step="0.01" value={form.budget ?? ""} onChange={(e) => handleChange("budget", e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Estimated</label>
                <input type="number" min={0} step="0.01" value={form.estimated_expenses ?? ""} onChange={(e) => handleChange("estimated_expenses", e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Actual</label>
                <input type="number" min={0} step="0.01" value={form.actual_expenses ?? ""} onChange={(e) => handleChange("actual_expenses", e.target.value ? parseFloat(e.target.value) : undefined)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">Additional</legend>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Agenda Overview</label>
              <textarea rows={3} value={form.agenda_overview || ""} onChange={(e) => handleChange("agenda_overview", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea rows={3} value={form.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Banner Image URL</label>
              <input type="url" value={form.photo_banner || ""} onChange={(e) => handleChange("photo_banner", e.target.value)} className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200" />
            </div>
          </fieldset>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isNew ? "Create Event" : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}


// ============================================
// Event Detail Modal
// ============================================
interface EventDetailModalProps {
  event: PMEvent
  onClose: () => void
  onEdit: (event: PMEvent) => void
  onDelete: (id: string) => void
  onStatusChange: (event: PMEvent, status: PMEvent["status"]) => void
}

function EventDetailModal({ event, onClose, onEdit, onDelete, onStatusChange }: EventDetailModalProps) {
  const days = getDaysUntil(event.start_date || event.date)
  const budgetHealth = getBudgetHealth(event)
  const isLive = categorizeEvent(event) === "in-progress"
  const isCompleted = categorizeEvent(event) === "completed"

  const formatDateLong = (dateStr?: string) => {
    if (!dateStr) return "Date TBD"
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl ${
          isLive ? "ring-2 ring-purple-300" : ""
        }`}
      >
        {isLive && (
          <div className="h-1 bg-gradient-to-r from-purple-500 via-purple-400 to-purple-500 rounded-t-2xl animate-pulse" />
        )}

        {(event.photo_banner || event.img_ai) && (
          <div className="relative aspect-[16/9] bg-neutral-100 overflow-hidden rounded-t-2xl">
            <img src={event.photo_banner || event.img_ai} alt={event.name} className={`w-full h-full object-cover ${isCompleted ? "grayscale-[20%]" : ""}`} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {days !== null && !isCompleted && (
              <div className="absolute bottom-4 right-4">
                <span className={`px-3 py-1.5 text-sm font-bold rounded-lg backdrop-blur-sm ${
                  isLive ? "bg-purple-500/90 text-white" : days <= 7 ? "bg-red-500/90 text-white" : "bg-white/90 text-neutral-700"
                }`}>
                  {isLive ? "Happening Now" : formatCountdown(days)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className={`w-10 h-1 mb-3 ${isLive ? "bg-purple-400" : "bg-yellow-400"}`} />
              <h2 className="text-2xl font-bold text-neutral-900 leading-tight">{event.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(event)} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors" title="Edit">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={() => onDelete(event.id)} className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border flex items-center gap-1.5 ${
              STATUS_COLORS[event.status] || "bg-neutral-100 text-neutral-600 border-neutral-200"
            }`}>
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                </span>
              )}
              {event.days_to_go || event.status}
            </span>
            {event.on_budget && (
              <span className="px-3 py-1.5 text-sm rounded-full bg-neutral-100 border border-neutral-200">{event.on_budget} Budget</span>
            )}
            {event.month && (
              <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">{event.month}</span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              {!isCompleted && event.status !== "completed" && (
                <button onClick={() => onStatusChange(event, "completed")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Complete
                </button>
              )}
              {!isLive && event.status !== "in-progress" && !isCompleted && (
                <button onClick={() => onStatusChange(event, "in-progress")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors">
                  <Zap className="w-3.5 h-3.5" />
                  Mark Live
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">Date</p>
                <p className="text-sm font-semibold text-neutral-900">{formatDateLong(event.start_date || event.date)}</p>
                {event.end_date && event.end_date !== event.start_date && (
                  <p className="text-xs text-neutral-500">to {formatDateLong(event.end_date)}</p>
                )}
                {(event.start_time || event.end_time) && (
                  <p className="text-xs text-neutral-400 mt-0.5">{event.start_time}{event.end_time ? ` - ${event.end_time}` : ""}</p>
                )}
              </div>
            </div>

            {(event.venue_name || event.location) && (
              <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-white border border-neutral-200 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-neutral-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">Venue</p>
                  <p className="text-sm font-semibold text-neutral-900 truncate">{event.venue_name || ""}</p>
                  {event.venue_location && <p className="text-xs text-neutral-500 truncate">{event.venue_location}</p>}
                </div>
              </div>
            )}
          </div>

          {event.agenda_overview && (
            <div>
              <h4 className="text-xs text-neutral-400 uppercase tracking-wide font-semibold mb-2">Agenda Overview</h4>
              <div className="p-4 bg-neutral-50 rounded-xl text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{event.agenda_overview}</div>
            </div>
          )}

          {(event.actual_expenses !== undefined || event.estimated_expenses !== undefined || event.budget !== undefined) && (
            <div>
              <h4 className="text-xs text-neutral-400 uppercase tracking-wide font-semibold mb-3">Budget</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {event.budget !== undefined && (
                  <div className="p-3 bg-neutral-50 rounded-xl text-center">
                    <p className="text-xs text-neutral-400 mb-1">Budget</p>
                    <p className="text-lg font-bold text-neutral-900">${event.budget.toLocaleString()}</p>
                  </div>
                )}
                {event.estimated_expenses !== undefined && (
                  <div className="p-3 bg-neutral-50 rounded-xl text-center">
                    <p className="text-xs text-neutral-400 mb-1">Estimated</p>
                    <p className="text-lg font-bold text-neutral-900">${event.estimated_expenses.toLocaleString()}</p>
                  </div>
                )}
                {event.actual_expenses !== undefined && (
                  <div className="p-3 bg-neutral-50 rounded-xl text-center">
                    <p className="text-xs text-neutral-400 mb-1">Actual</p>
                    <p className="text-lg font-bold text-neutral-900">${event.actual_expenses.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {budgetHealth && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-neutral-500">Budget utilization</span>
                    <span className={`font-semibold ${budgetHealth.color}`}>{budgetHealth.percent}% - {budgetHealth.label}</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${
                      budgetHealth.percent <= 80 ? "bg-emerald-500" : budgetHealth.percent <= 100 ? "bg-blue-500" : budgetHealth.percent <= 120 ? "bg-amber-500" : "bg-red-500"
                    }`} style={{ width: `${Math.min(100, budgetHealth.percent)}%` }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {event.venue_map_link && (
              <a href={event.venue_map_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                <MapPin className="w-4 h-4" />
                View Map
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {event.website_url && (
              <a href={event.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                <Globe className="w-4 h-4" />
                Website
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {(event.description || event.notes) && (
            <div>
              <h4 className="text-xs text-neutral-400 uppercase tracking-wide font-semibold mb-2">Notes</h4>
              <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{event.description || event.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
