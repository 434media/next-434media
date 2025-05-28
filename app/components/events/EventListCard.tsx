"use client"

import type React from "react"
import { MapPin, Users, Clock, Trash2, ArrowRight, Calendar, Eye } from "lucide-react"
import type { Event } from "../../types/event-types"
import { cn } from "../../lib/utils"
import { useState } from "react"

interface EventListCardProps {
  event: Event
  onClick: () => void
  className?: string
  onDeleteRequest?: () => void
}

export function EventListCard({ event, onClick, className, onDeleteRequest }: EventListCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return {
          bg: "bg-gradient-to-r from-orange-50 to-red-50",
          text: "text-orange-800",
          border: "border-orange-200",
          accent: "bg-orange-500",
          shadow: "shadow-orange-500/20",
        }
      case "workshop":
        return {
          bg: "bg-gradient-to-r from-amber-50 to-yellow-50",
          text: "text-amber-800",
          border: "border-amber-200",
          accent: "bg-amber-500",
          shadow: "shadow-amber-500/20",
        }
      case "meetup":
        return {
          bg: "bg-gradient-to-r from-yellow-50 to-orange-50",
          text: "text-yellow-800",
          border: "border-yellow-200",
          accent: "bg-yellow-500",
          shadow: "shadow-yellow-500/20",
        }
      case "networking":
        return {
          bg: "bg-gradient-to-r from-blue-50 to-indigo-50",
          text: "text-blue-800",
          border: "border-blue-200",
          accent: "bg-blue-500",
          shadow: "shadow-blue-500/20",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-gray-50 to-slate-50",
          text: "text-gray-800",
          border: "border-gray-200",
          accent: "bg-gray-500",
          shadow: "shadow-gray-500/20",
        }
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return "Time TBD"
    if (time.includes("AM") || time.includes("PM")) return time

    try {
      const [hours, minutes] = time.split(":")
      const hour = Number.parseInt(hours)
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return "Time TBD"
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Date TBD"

      const today = new Date()
      const options: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
      }

      if (date.getFullYear() !== today.getFullYear()) {
        options.year = "numeric"
      }

      return date.toLocaleDateString("en-US", options)
    } catch {
      return "Date TBD"
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDeleteRequest?.()
  }

  const handleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick()
  }

  const categoryColors = getCategoryColor(event.category)
  const formattedDate = formatDate(event.date)

  return (
    <article
      className={cn(
        "group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-700 ease-out",
        "hover:shadow-2xl hover:shadow-amber-500/15 hover:-translate-y-2 hover:border-amber-200",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-amber-50/0 before:via-orange-50/0 before:to-yellow-50/0",
        "before:opacity-0 before:transition-all before:duration-700 hover:before:opacity-100",
        "hover:before:from-amber-50/40 hover:before:via-orange-50/30 hover:before:to-yellow-50/20",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`View details for ${event.title}`}
    >
      {/* Animated Glow Effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700 blur-sm" />

      {/* Delete Button - Enhanced */}
      {onDeleteRequest && (
        <button
          onClick={handleDeleteClick}
          className={cn(
            "absolute top-4 right-4 z-30 p-2.5 text-gray-400 hover:text-red-600 rounded-xl transition-all duration-500 backdrop-blur-sm",
            "transform scale-0 group-hover:scale-100 hover:scale-110 hover:bg-red-50/90 hover:shadow-lg hover:shadow-red-500/25",
            "opacity-0 group-hover:opacity-100 hover:rotate-90",
          )}
          title="Delete event"
          aria-label="Delete event"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <div className="relative z-20 p-5 sm:p-6">
        {/* Header Section - Category and Date */}
        <div className="flex items-start justify-between mb-5">
          {/* Category Badge - Enhanced */}
          {event.category && (
            <div
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-500",
                categoryColors.bg,
                categoryColors.text,
                categoryColors.border,
                "group-hover:scale-105 group-hover:shadow-md",
                categoryColors.shadow,
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full mr-2 transition-all duration-500 group-hover:scale-125",
                  categoryColors.accent,
                )}
              />
              {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
            </div>
          )}

          {/* Date Badge - Enhanced */}
          <div className="flex items-center text-gray-700 font-medium bg-amber-50/50 px-3 py-1.5 rounded-full border border-amber-100 transition-all duration-500 group-hover:bg-amber-100/80 group-hover:border-amber-200">
            <Calendar className="h-4 w-4 mr-1.5 text-amber-600 transition-transform duration-500 group-hover:scale-110" />
            <span className="text-sm">{formattedDate}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          {/* Event Image - Enhanced */}
          {event.image && (
            <div className="w-full sm:w-40 h-32 sm:h-32 rounded-xl overflow-hidden relative group/image flex-shrink-0">
              {/* Image Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-all duration-500" />

              <img
                src={event.image || "/placeholder.svg?height=128&width=160&query=event"}
                alt={event.title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                loading="lazy"
              />

              {/* View Indicator - Enhanced */}
              <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all duration-500">
                <div className="bg-white/95 backdrop-blur-sm rounded-full p-3 transform scale-75 group-hover:scale-100 transition-all duration-500 shadow-lg">
                  <Eye className="h-5 w-5 text-amber-600" />
                </div>
              </div>

              {/* Shimmer Effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}

          {/* Event Content */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Event Title - Enhanced with Inline Arrow */}
            <h3 className="font-bold text-lg sm:text-xl text-gray-900 group-hover:text-amber-700 transition-colors duration-500 leading-tight line-clamp-2 inline-flex items-center gap-2">
              <span className="flex-1">{event.title}</span>
              <ArrowRight
                className={cn(
                  "h-5 w-5 flex-shrink-0 text-amber-500 opacity-0 group-hover:opacity-100 transition-all duration-500",
                  isHovered ? "translate-x-1 rotate-12" : "translate-x-0 rotate-0",
                )}
              />
            </h3>

            {/* Event Description */}
            {event.description && (
              <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed group-hover:text-gray-700 transition-colors duration-500">
                {event.description}
              </p>
            )}

            {/* Event Details Grid - Enhanced */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-all duration-500">
                <div className="p-2 rounded-lg bg-amber-100 mr-3 group-hover:bg-amber-200 group-hover:scale-110 transition-all duration-500 flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <span className="font-medium truncate">{formatTime(event.time)}</span>
              </div>

              {event.location && (
                <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-all duration-500">
                  <div className="p-2 rounded-lg bg-blue-100 mr-3 group-hover:bg-blue-200 group-hover:scale-110 transition-all duration-500 flex-shrink-0">
                    <MapPin className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="truncate font-medium">{event.location}</span>
                </div>
              )}

              {event.attendees && (
                <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-all duration-500">
                  <div className="p-2 rounded-lg bg-green-100 mr-3 group-hover:bg-green-200 group-hover:scale-110 transition-all duration-500 flex-shrink-0">
                    <Users className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="font-medium truncate">{event.attendees} attendees</span>
                </div>
              )}

              {event.price && (
                <div className="flex items-center">
                  <div className="p-2 rounded-lg bg-purple-100 mr-3 group-hover:bg-purple-200 group-hover:scale-110 transition-all duration-500 flex-shrink-0">
                    <div className="h-4 w-4 text-purple-600 flex items-center justify-center">
                      <span className="text-xs font-bold">$</span>
                    </div>
                  </div>
                  <span className="font-bold text-purple-600 truncate">{event.price}</span>
                </div>
              )}
            </div>

            {/* Organizer Section - Enhanced */}
            {event.organizer && (
              <div className="pt-4 border-t border-gray-100 group-hover:border-amber-200 transition-colors duration-500">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-gray-500 block mb-1">Organized by</span>
                    <div className="font-semibold text-gray-700 group-hover:text-amber-700 transition-colors duration-500 truncate">
                      {event.organizer}
                    </div>
                  </div>

                  {/* View Details Button - Enhanced */}
                  <button
                    className={cn(
                      "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 hover:from-amber-200 hover:to-yellow-200",
                      "px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-500",
                      "group-hover:shadow-lg group-hover:shadow-amber-500/25 hover:scale-105 hover:-translate-y-0.5",
                      "border border-amber-200 hover:border-amber-300",
                    )}
                    onClick={handleViewClick}
                    aria-label={`View details for ${event.title}`}
                  >
                    <Eye className="h-4 w-4" />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Glow Effect */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
    </article>
  )
}
