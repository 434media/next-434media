"use client"

import { Edit2, Trash2, CheckCircle2, Eye } from "lucide-react"
import type { PMEvent } from "@/types/project-management-types"
import {
  STATUS_COLORS,
  getDaysUntil,
  categorizeEvent,
  formatCountdown,
  type EventTab,
  type SortField,
  type SortDir,
} from "./event-helpers"

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

export function EventTable({
  events,
  tab,
  toggleSort,
  SortIcon,
  formatDate,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  isChangingStatus,
}: EventTableProps) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/50">
              {tab !== "all" && <th className="px-4 py-3 w-10" />}
              {(
                [
                  { field: "name" as SortField, label: "Event" },
                  { field: "start_date" as SortField, label: "Date" },
                  { field: "status" as SortField, label: "Status" },
                  { field: "venue_name" as SortField, label: "Venue" },
                  { field: "budget" as SortField, label: "Budget" },
                ] as const
              ).map((col) => (
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
                      ? "bg-sky-50/50 hover:bg-sky-50"
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
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
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
                    <span
                      className={`px-2.5 py-1 text-xs font-bold uppercase rounded-full border ${
                        STATUS_COLORS[event.status] || "bg-neutral-100 text-neutral-600 border-neutral-200"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 truncate max-w-45">
                    {event.venue_name || event.location || "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 whitespace-nowrap">
                    {event.budget ? (
                      <div>
                        <span>${event.budget.toLocaleString()}</span>
                        {event.actual_expenses !== undefined && (
                          <span
                            className={`text-xs ml-1 ${
                              event.actual_expenses <= event.budget ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            ({Math.round((event.actual_expenses / event.budget) * 100)}%)
                          </span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  {tab === "upcoming" && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {days !== null && (
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded-md ${
                            days <= 7
                              ? "bg-red-100 text-red-700"
                              : days <= 30
                              ? "bg-amber-100 text-amber-700"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {formatCountdown(days)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onView(event)
                        }}
                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(event)
                        }}
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
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(event.id)
                        }}
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
