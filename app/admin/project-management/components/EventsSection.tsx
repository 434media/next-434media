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
  ArrowRight,
} from "lucide-react"
import type { PMEvent } from "@/types/project-management-types"
import { EventEmptyState } from "./EventEmptyState"
import { EventCard } from "./EventCard"
import { EventTable } from "./EventTable"
import {
  getDaysUntil,
  categorizeEvent,
  type SortField,
  type SortDir,
  type ViewLayout,
  type EventTab,
} from "./event-helpers"

interface EventsSectionProps {
  events: PMEvent[]
  onDelete: (id: string) => void
  onSave: (event: Partial<PMEvent>, isNew: boolean) => Promise<void>
  onDuplicate?: (event: PMEvent) => void
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

export default function EventsSection({
  events,
  onDelete,
  onSave,
  onDuplicate,
  showToast,
}: EventsSectionProps) {
  const router = useRouter()
  // Smart default: grid for ≤ 12 (recognition wins), table above (density wins).
  // The user can still toggle and we honor that — only the initial choice is data-driven.
  const [layout, setLayout] = useState<ViewLayout>(() => (events.length > 12 ? "table" : "grid"))
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<EventTab>("upcoming")
  const [sortField, setSortField] = useState<SortField>("start_date")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showCompletedAll, setShowCompletedAll] = useState(false)

  const [statusChangeEvent, setStatusChangeEvent] = useState<string | null>(null)

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

    groups.upcoming.sort((a, b) => {
      const dateA = a.start_date || a.date || "9999"
      const dateB = b.start_date || b.date || "9999"
      return dateA.localeCompare(dateB)
    })

    groups["in-progress"].sort((a, b) => {
      const dateA = a.end_date || a.start_date || a.date || "9999"
      const dateB = b.end_date || b.start_date || b.date || "9999"
      return dateA.localeCompare(dateB)
    })

    groups.completed.sort((a, b) => {
      const dateA = a.start_date || a.date || ""
      const dateB = b.start_date || b.date || ""
      return dateB.localeCompare(dateA)
    })

    return groups
  }, [events])

  const metrics = useMemo(() => {
    const upcoming = categorized.upcoming
    const inProgress = categorized["in-progress"]

    const nextEvent = upcoming[0] || null
    const nextDays = nextEvent ? getDaysUntil(nextEvent.start_date || nextEvent.date) : null

    const activeEvents = [...upcoming, ...inProgress]
    const totalBudget = activeEvents.reduce(
      (sum, e) => sum + (e.budget || e.estimated_expenses || 0),
      0,
    )
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

  const filteredEvents = useMemo(() => {
    let result = [...(categorized[activeTab] || [])]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.venue_name?.toLowerCase().includes(q) ||
          e.location?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q),
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

  const completedToShow =
    activeTab === "completed" && !showCompletedAll ? filteredEvents.slice(0, 6) : filteredEvents

  const displayEvents = activeTab === "completed" ? completedToShow : filteredEvents

  return (
    <div className="space-y-5">
      {/* Tabs & Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Inner tabs — segmented control matching the rest of admin */}
          <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
            {(
              [
                {
                  id: "upcoming" as EventTab,
                  label: "Upcoming",
                  count: categorized.upcoming.length,
                  dot: "bg-amber-500",
                },
                {
                  id: "completed" as EventTab,
                  label: "Completed",
                  count: categorized.completed.length,
                  dot: "bg-emerald-500",
                },
                {
                  id: "all" as EventTab,
                  label: "All",
                  count: events.length,
                  dot: "bg-neutral-400",
                },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id)
                    setShowCompletedAll(false)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <span
                    className={`inline-block h-1 w-1 rounded-full ${tab.dot}`}
                    aria-hidden="true"
                  />
                  {tab.label}
                  <span
                    className={`tabular-nums text-[10px] ${
                      isActive ? "text-white/70" : "text-neutral-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
              <button
                onClick={() => setLayout("grid")}
                className={`inline-flex items-center justify-center w-9 transition-colors ${
                  layout === "grid"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLayout("table")}
                className={`inline-flex items-center justify-center w-9 transition-colors ${
                  layout === "table"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
                title="Table view"
                aria-label="Table view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={openNew}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New event
            </button>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search events…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Happening Now Banner — neutral pill with sky dot for state */}
      {activeTab !== "in-progress" && categorized["in-progress"].length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 bg-white rounded-md ring-1 ring-neutral-200/70"
        >
          <span className="relative inline-flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              <span className="text-neutral-700 normal-case tracking-normal text-sm">
                {categorized["in-progress"].length} event
                {categorized["in-progress"].length > 1 ? "s" : ""} happening now
              </span>
            </p>
            <p className="text-xs text-neutral-500 truncate mt-0.5">
              {categorized["in-progress"].map((e) => e.name).join(", ")}
            </p>
          </div>
          <button
            onClick={() => setActiveTab("in-progress")}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors shrink-0"
          >
            View
            <ArrowRight className="w-3 h-3" />
          </button>
        </motion.div>
      )}

      {/* Results Info */}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="tabular-nums">
          {displayEvents.length} event{displayEvents.length !== 1 ? "s" : ""}
          {searchQuery && (
            <span className="text-neutral-400"> matching &quot;{searchQuery}&quot;</span>
          )}
        </span>
        {activeTab === "completed" && filteredEvents.length > 6 && (
          <button
            onClick={() => setShowCompletedAll(!showCompletedAll)}
            className="text-[11px] font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 px-2 py-1 rounded transition-colors"
          >
            {showCompletedAll ? "Show less" : `Show all ${filteredEvents.length} completed`}
          </button>
        )}
      </div>

      {/* Content */}
      {displayEvents.length === 0 ? (
        <EventEmptyState tab={activeTab} searchQuery={searchQuery} onAddNew={openNew} />
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
                onDuplicate={onDuplicate ? () => onDuplicate(event) : undefined}
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

      {activeTab === "completed" && !showCompletedAll && filteredEvents.length > 6 && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowCompletedAll(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Show {filteredEvents.length - 6} more completed events
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
