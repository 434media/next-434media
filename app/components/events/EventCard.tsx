"use client"

import { Calendar, MapPin, Users, ExternalLink } from "lucide-react"
import type { Event } from "../../types/event-types"
import { formatEventDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventCardProps {
  event: Event
  onClick: () => void
  className?: string
}

export function EventCard({ event, onClick, className }: EventCardProps) {
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

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl shadow-md border border-gray-200 p-6 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 hover:border-amber-300",
        className,
      )}
    >
      {/* Event Image */}
      {event.image && (
        <div className="mb-4 rounded-lg overflow-hidden">
          <img src={event.image || "/placeholder.svg"} alt={event.title} className="w-full h-32 object-cover" />
        </div>
      )}

      {/* Category Badge */}
      {event.category && (
        <div
          className={cn(
            "inline-block px-2 py-1 rounded-full text-xs font-medium mb-3 border",
            getCategoryColor(event.category),
          )}
        >
          {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
        </div>
      )}

      {/* Event Title */}
      <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">{event.title}</h3>

      {/* Event Description */}
      {event.description && <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>}

      {/* Event Details */}
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="h-4 w-4 mr-2 text-amber-500" />
          {formatEventDate(event.date, event.time)}
        </div>

        {event.location && (
          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-amber-500" />
            {event.location}
          </div>
        )}

        {event.attendees && (
          <div className="flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-2 text-amber-500" />
            {event.attendees} attendees
          </div>
        )}

        {event.organizer && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">Organized by:</span> {event.organizer}
          </div>
        )}
      </div>

      {/* Event URL */}
      {event.url && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Source: {event.source || "Manual"}</span>
            <ExternalLink className="h-4 w-4 text-gray-400" />
          </div>
        </div>
      )}

      {/* Price */}
      {event.price && (
        <div className="mt-2">
          <span className="text-sm font-semibold text-amber-600">{event.price}</span>
        </div>
      )}
    </div>
  )
}
