"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  CheckCircle2,
  Zap,
  ArrowRight,
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
  const router = useRouter()
  const [layout, setLayout] = useState<ViewLayout>("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming")
  const [sortField, setSortField] = useState<SortField>("start_date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showCompletedAll, setShowCompletedAll] = useState(false)

  // Status change state
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
    router.push("/admin/project-management/events/new")
  }

  const openEdit = (event: PMEvent) => {
    router.push(`/admin/project-management/events/${event.id}/edit`)
  }

  const viewEvent = (event: PMEvent) => {
    router.push(`/admin/project-management/events/${event.id}`)
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
    <div className="space-y-5">
      {/* Tabs & Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
            {([
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
          <div className="relative shrink-0">
            <span className="flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold tracking-tight text-purple-800">
              {categorized["in-progress"].length} event{categorized["in-progress"].length > 1 ? "s" : ""} happening now
            </span>
            <span className="text-sm text-purple-600 ml-2 font-medium">
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
      <div className="flex items-center justify-between text-sm text-neutral-500 tracking-wide">
        <span className="font-medium">
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
        <div className="grid gap-4 grid-cols-1">
          <AnimatePresence mode="popLayout">
            {displayEvents.map((event, idx) => (
              <EventCard
                key={event.id}
                event={event}
                tab={activeTab}
                index={idx}
                onView={() => viewEvent(event)}
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
          onView={(event) => viewEvent(event)}
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
      desc: 'Click "Add Event" to create one',
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ delay: index * 0.025 }}
      className={`group relative overflow-hidden bg-white transition-all duration-200 rounded-xl cursor-pointer ${
        isLive
          ? "border-2 border-purple-300 shadow-md shadow-purple-100/50 hover:border-purple-400"
          : tab === "completed"
          ? "border border-neutral-200 opacity-75 hover:opacity-100 hover:border-neutral-300"
          : "border border-neutral-200 hover:border-neutral-400 hover:shadow-sm"
      }`}
      onClick={onView}
    >
      {/* Live top accent */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-purple-500 via-purple-400 to-purple-500 animate-pulse" />
      )}

      <div className="flex items-stretch">
        {/* Left: Thumbnail */}
        <div className={`relative w-28 sm:w-36 shrink-0 overflow-hidden ${
          isLive ? "bg-purple-50" : "bg-neutral-50"
        }`}>
          {event.photo_banner || event.img_ai ? (
            <img
              src={event.photo_banner || event.img_ai}
              alt={event.name}
              className={`w-full h-full object-cover ${
                tab === "completed" ? "grayscale-30" : ""
              }`}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className={`w-8 h-8 ${isLive ? "text-purple-300" : "text-neutral-300"}`} />
            </div>
          )}
          {isLive && (
            <div className="absolute top-2 left-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
              </span>
            </div>
          )}
        </div>

        {/* Center: Event Info */}
        <div className="flex-1 min-w-0 px-4 sm:px-5 py-3.5 flex flex-col justify-center gap-1.5">
          {/* Row 1: Name + Status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className={`text-base font-bold tracking-tight leading-snug truncate ${
              tab === "completed" ? "text-neutral-500" : "text-neutral-900"
            }`}>
              {event.name}
            </h3>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowStatusMenu(!showStatusMenu) }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md ${
                  STATUS_BADGE_SOLID[event.status] || "bg-neutral-500 text-white"
                } hover:ring-2 hover:ring-offset-1 hover:ring-neutral-300 transition-all`}
              >
                {event.status}
                <ChevronDown className="w-2.5 h-2.5 opacity-70" />
              </button>
              <AnimatePresence>
                {showStatusMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-35 z-30"
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
          </div>

          {/* Row 2: Key details — date, venue, location */}
          <div className="flex items-center gap-4 text-sm text-neutral-500 flex-wrap">
            <span className="inline-flex items-center gap-1.5 font-medium text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              {formatDate(event.start_date || event.date)}
              {event.end_date && event.end_date !== (event.start_date || event.date) && (
                <span className="text-neutral-400 font-normal">– {formatDate(event.end_date)}</span>
              )}
            </span>
            {(event.venue_name || event.location) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span className="truncate max-w-48">
                  {event.venue_name || event.location}
                </span>
              </span>
            )}
            {event.website_url && (
              <a
                href={event.website_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Link</span>
              </a>
            )}
          </div>

          {/* Row 3: Budget summary (inline) */}
          {budgetHealth && (
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                <DollarSign className="w-3 h-3" />
                <span>${(event.actual_expenses || 0).toLocaleString()}</span>
                <span className="text-neutral-300">/</span>
                <span>${(event.budget || event.estimated_expenses || 0).toLocaleString()}</span>
              </div>
              <div className="w-20 bg-neutral-100 rounded-full h-1.5">
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
              <span className={`text-[11px] font-semibold ${budgetHealth.color}`}>
                {budgetHealth.percent}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Countdown + Actions */}
        <div className="flex items-center gap-3 px-4 sm:px-5 shrink-0 border-l border-neutral-100">
          {/* Countdown */}
          {days !== null && tab !== "completed" && (
            <div className={`text-center px-3 py-1.5 rounded-lg ${
              days <= 0
                ? "bg-purple-50 text-purple-700"
                : days <= 7
                ? "bg-red-50 text-red-700"
                : days <= 30
                ? "bg-amber-50 text-amber-700"
                : "bg-neutral-50 text-neutral-600"
            }`}>
              <div className="text-lg font-extrabold leading-none tabular-nums">
                {days <= 0 ? (days === 0 ? "0" : Math.abs(days)) : days}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider mt-0.5">
                {days === 0 ? "Today" : days < 0 ? "days ago" : days === 1 ? "day" : "days"}
              </div>
            </div>
          )}

          {tab === "completed" && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </span>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
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
                          className={`w-10 h-7 rounded object-cover shrink-0 ${
                            tab === "completed" ? "grayscale-30" : ""
                          }`}
                        />
                      )}
                      <span className="font-semibold text-neutral-900 truncate max-w-50">
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
                  <td className="px-4 py-3 text-neutral-600 truncate max-w-45">
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

