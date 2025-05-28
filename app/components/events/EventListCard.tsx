"use client"

import type React from "react"
import { MapPin, Users, ExternalLink, Clock, Trash2 } from "lucide-react"
import type { Event } from "../../types/event-types"
import { cn } from "../../lib/utils"

interface EventListCardProps {
  event: Event
  onClick: () => void
  className?: string
  onDeleteRequest?: () => void
}

export function EventListCard({ event, onClick, className, onDeleteRequest }: EventListCardProps) {
  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "workshop":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "meetup":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "networking":
        return "bg-orange-100 text-orange-800 border-orange-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return ""

    // If time already includes AM/PM, return as is
    if (time.includes("AM") || time.includes("PM")) {
      return time
    }

    // Otherwise, convert from 24-hour format
    const [hours, minutes] = time.split(":")
    const hour = Number.parseInt(hours)
    const ampm = hour >= 12 ? "PM" : "AM"
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const formatEventDate = (dateString: string) => {
    const eventDate = new Date(dateString + "T00:00:00") // Force local timezone
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (eventDate.toDateString() === today.toDateString()) {
      return "Today"
    } else if (eventDate.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow"
    } else {
      return eventDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: eventDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      })
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    onDeleteRequest?.()
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl shadow-md border border-gray-200 p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:border-amber-300 group relative",
        className,
      )}
    >
      {/* Delete Button */}
      <button
        onClick={handleDeleteClick}
        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 hover:scale-110"
        title="Delete event"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex gap-6" onClick={onClick}>
        {/* Event Image */}
        {event.image && (
          <div className="flex-shrink-0 w-32 h-24 rounded-lg overflow-hidden">
            <img
              src={event.image || "/placeholder.svg?height=96&width=128&query=event"}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </div>
        )}

        {/* Event Content */}
        <div className="flex-1 min-w-0">
          {/* Category Badge and Date */}
          <div className="flex items-center justify-between mb-3">
            {event.category && (
              <div
                className={cn(
                  "inline-block px-2 py-1 rounded-full text-xs font-medium border",
                  getCategoryColor(event.category),
                )}
              >
                {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
              </div>
            )}
            <div className="text-sm text-gray-500 font-medium">{formatEventDate(event.date)}</div>
          </div>

          {/* Event Title */}
          <h3 className="font-bold text-xl text-gray-900 mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">
            {event.title}
          </h3>

          {/* Event Description */}
          {event.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">{event.description}</p>
          )}

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center text-gray-600">
              <Clock className="h-4 w-4 mr-2 text-amber-500 flex-shrink-0" />
              <span className="truncate">{formatTime(event.time)}</span>
            </div>

            {event.location && (
              <div className="flex items-center text-gray-600">
                <MapPin className="h-4 w-4 mr-2 text-amber-500 flex-shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {event.attendees && (
              <div className="flex items-center text-gray-600">
                <Users className="h-4 w-4 mr-2 text-amber-500 flex-shrink-0" />
                <span className="truncate">{event.attendees} attendees</span>
              </div>
            )}

            {event.price && (
              <div className="flex items-center">
                <div className="h-4 w-4 mr-2 text-amber-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold">$</span>
                </div>
                <span className="font-semibold text-amber-600 truncate">{event.price}</span>
              </div>
            )}
          </div>

          {/* Organizer */}
          {event.organizer && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">
                Organized by <span className="font-medium text-gray-700">{event.organizer}</span>
              </span>
            </div>
          )}
        </div>

        {/* Action Indicator */}
        <div className="flex-shrink-0 flex items-center">
          <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-amber-500 transition-colors" />
        </div>
      </div>
    </div>
  )
}
