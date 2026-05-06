"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Calendar,
  MapPin,
  DollarSign,
  Globe,
  Trash2,
  Edit2,
  Copy,
  CheckCircle2,
  ChevronDown,
} from "lucide-react"
import type { PMEvent } from "@/types/project-management-types"
import { PM_EVENT_STATUSES } from "@/types/project-management-types"
import { formatRelative } from "@/components/admin/FeedCardStatusMenu"
import {
  STATUS_DOT,
  STATUS_BADGE_SOLID,
  getDaysUntil,
  getBudgetHealth,
  categorizeEvent,
  type EventTab,
} from "./event-helpers"

interface EventCardProps {
  event: PMEvent
  tab: EventTab
  index: number
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate?: () => void
  onStatusChange: (event: PMEvent, status: PMEvent["status"]) => void
  isChangingStatus: boolean
  formatDate: (dateStr?: string) => string
}

export function EventCard({
  event,
  tab,
  index,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  onStatusChange,
  isChangingStatus,
  formatDate,
}: EventCardProps) {
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
          ? "border-2 border-sky-300 shadow-md shadow-sky-100/50 hover:border-sky-400"
          : tab === "completed"
          ? "border border-neutral-200 opacity-75 hover:opacity-100 hover:border-neutral-300"
          : "border border-neutral-200 hover:border-neutral-400 hover:shadow-sm"
      }`}
      onClick={onView}
    >
      {/* Live top accent */}
      {isLive && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-sky-500 via-sky-400 to-sky-500 animate-pulse" />
      )}

      <div className="flex items-stretch">
        {/* Left: Thumbnail */}
        <div
          className={`relative w-28 sm:w-36 shrink-0 overflow-hidden ${
            isLive ? "bg-sky-50" : "bg-neutral-50"
          }`}
        >
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
              <Calendar className={`w-8 h-8 ${isLive ? "text-sky-300" : "text-neutral-300"}`} />
            </div>
          )}
          {isLive && (
            <div className="absolute top-2 left-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
              </span>
            </div>
          )}
        </div>

        {/* Center: Event info */}
        <div className="flex-1 min-w-0 px-4 sm:px-5 py-3.5 flex flex-col justify-center gap-1.5">
          {/* Row 1: Name + Status */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3
              className={`text-base font-bold tracking-tight leading-snug truncate ${
                tab === "completed" ? "text-neutral-500" : "text-neutral-900"
              }`}
            >
              {event.name}
            </h3>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowStatusMenu(!showStatusMenu)
                }}
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
                        {status === event.status && (
                          <CheckCircle2 className="w-3 h-3 ml-auto text-neutral-400" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Row 2: Key details */}
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
            {event.updated_at && (
              <span
                className="inline-flex items-center gap-1.5 text-[11px] text-neutral-400 tabular-nums ml-auto"
                title={`Updated ${event.updated_at}`}
              >
                Updated {formatRelative(event.updated_at)}
              </span>
            )}
          </div>

          {/* Row 3: Budget */}
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
                    budgetHealth.percent <= 80
                      ? "bg-emerald-500"
                      : budgetHealth.percent <= 100
                      ? "bg-blue-500"
                      : budgetHealth.percent <= 120
                      ? "bg-amber-500"
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

        {/* Right: Countdown + actions */}
        <div className="flex items-center gap-3 px-4 sm:px-5 shrink-0 border-l border-neutral-100">
          {days !== null && tab !== "completed" && (
            <div
              className={`text-center px-3 py-1.5 rounded-lg ${
                days <= 0
                  ? "bg-sky-50 text-sky-700"
                  : days <= 7
                  ? "bg-red-50 text-red-700"
                  : days <= 30
                  ? "bg-amber-50 text-amber-700"
                  : "bg-neutral-50 text-neutral-600"
              }`}
            >
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
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {onDuplicate && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
                className="p-2 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
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
