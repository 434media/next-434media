"use client"

import { Calendar, Zap, CheckCircle2, Plus } from "lucide-react"
import type { EventTab } from "./event-helpers"

interface EventEmptyStateProps {
  tab: EventTab
  searchQuery: string
  onAddNew: () => void
}

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
    desc: 'Click "New event" in the toolbar to create one',
  },
}

export function EventEmptyState({ tab, searchQuery, onAddNew }: EventEmptyStateProps) {
  const msg = messages[tab]
  const Icon = msg.icon

  return (
    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-12 text-center">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm font-medium text-neutral-900 mb-1">
        {searchQuery ? "No matching events" : msg.title}
      </p>
      <p className="text-xs text-neutral-500">
        {searchQuery ? "Try adjusting your search or filters" : msg.desc}
      </p>
      {!searchQuery && tab === "upcoming" && (
        <button
          onClick={onAddNew}
          className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New event
        </button>
      )}
    </div>
  )
}
