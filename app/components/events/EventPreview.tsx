"use client"

import { Calendar, MapPin, ExternalLink, Zap, AlertCircle, Clock } from "lucide-react"
import type { Event } from "../../types/event-types"
import {
  formatEventDate,
  getEventUrgency,
  getDaysUntilEvent,
  formatRelativeTime,
  safeParseDate,
} from "../../lib/event-utils"
import { cn } from "../../lib/utils"
import { useEffect, useState } from "react"

interface EventPreviewProps {
  event: Event
  onViewDetails: () => void
  className?: string
}

export function EventPreview({ event, onViewDetails, className }: EventPreviewProps) {
  const [isValidDate, setIsValidDate] = useState<boolean>(true)
  const [relativeTime, setRelativeTime] = useState<string>("")

  // Validate date on component mount
  useEffect(() => {
    const date = safeParseDate(event.date)
    setIsValidDate(!!date && !isNaN(date.getTime()))

    // Set initial relative time
    if (date && !isNaN(date.getTime())) {
      setRelativeTime(formatRelativeTime(event.date))
    }

    // Update relative time every minute
    const interval = setInterval(() => {
      if (date && !isNaN(date.getTime())) {
        setRelativeTime(formatRelativeTime(event.date))
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [event.date])

  // If date is invalid, show a fallback UI
  if (!isValidDate) {
    return (
      <div
        className="bg-white rounded-xl shadow-md border border-gray-200 p-6 transition-all duration-300 hover:shadow-xl hover:scale-105 cursor-pointer group h-[350px]"
        onClick={onViewDetails}
      >
        <div className="flex items-center gap-3 text-amber-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">Date needs confirmation</span>
        </div>

        <h3 className="font-bold text-lg text-gray-900 mb-3 group-hover:text-amber-600 transition-colors line-clamp-2">
          {event.title}
        </h3>

        {event.description && <p className="text-sm text-gray-600 line-clamp-2 mb-4">{event.description}</p>}

        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            {event.organizer ? `By ${event.organizer}` : "Details available"}
          </span>
          <span className="text-xs font-medium text-amber-600">View details</span>
        </div>
      </div>
    )
  }

  const urgency = getEventUrgency(event)
  const daysUntil = getDaysUntilEvent(event)

  const getUrgencyConfig = (urgency: string) => {
    switch (urgency) {
      case "today":
        return {
          badge: "TODAY",
          badgeColor: "bg-red-500 text-white animate-pulse",
          borderColor: "border-red-200 ring-2 ring-red-100",
          icon: Zap,
          iconColor: "text-red-500",
        }
      case "tomorrow":
        return {
          badge: "TOMORROW",
          badgeColor: "bg-orange-500 text-white",
          borderColor: "border-orange-200 ring-1 ring-orange-100",
          icon: Clock,
          iconColor: "text-orange-500",
        }
      case "this-week":
        return {
          badge: "THIS WEEK",
          badgeColor: "bg-amber-500 text-white",
          borderColor: "border-amber-200",
          icon: Calendar,
          iconColor: "text-amber-500",
        }
      case "soon":
        return {
          badge: `${daysUntil} DAYS`,
          badgeColor: "bg-blue-500 text-white",
          borderColor: "border-blue-200",
          icon: Calendar,
          iconColor: "text-blue-500",
        }
      default:
        return {
          badge: `${daysUntil} DAYS`,
          badgeColor: "bg-gray-500 text-white",
          borderColor: "border-gray-200",
          icon: Calendar,
          iconColor: "text-gray-500",
        }
    }
  }

  const urgencyConfig = getUrgencyConfig(urgency)

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return "from-orange-500 to-red-500"
      case "workshop":
        return "from-amber-500 to-orange-500"
      case "meetup":
        return "from-yellow-500 to-amber-500"
      case "networking":
        return "from-green-500 to-emerald-500"
      default:
        return "from-blue-500 to-indigo-500"
    }
  }

  const getSourceIndicator = (source?: string) => {
    switch (source) {
      case "meetup":
        return { color: "bg-red-500", name: "Meetup" }
      case "eventbrite":
        return { color: "bg-orange-500", name: "Eventbrite" }
      case "luma":
        return { color: "bg-purple-500", name: "Luma" }
      default:
        return { color: "bg-gray-500", name: "Manual" }
    }
  }

  const sourceInfo = getSourceIndicator(event.source)

  return (
    <div
      className={cn(
        "mt-6 bg-white rounded-2xl shadow-md border border-gray-200 p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 group relative h-[350px]",
        urgencyConfig.borderColor,
        className,
      )}
      onClick={onViewDetails}
    >
      {/* Enhanced Header with Gradient */}
      <div className={`bg-gradient-to-r ${getCategoryColor(event.category)} p-4 text-white relative overflow-hidden`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width%3D%2260%22 height%3D%2260%22 viewBox%3D%220 0 60 60%22 xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg fill%3D%22none%22 fillRule%3D%22evenodd%22%3E%3Cg fill%3D%22%23ffffff%22 fillOpacity%3D%220.1%22%3E%3Ccircle cx%3D%2230%22 cy%3D%2230%22 r%3D%222%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"></div>
        </div>

        <div className="relative z-10 flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <urgencyConfig.icon className={`h-4 w-4 ${urgencyConfig.iconColor}`} />
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${urgencyConfig.badgeColor}`}>
                {urgencyConfig.badge}
              </span>
              <div className={`w-2 h-2 rounded-full ${sourceInfo.color}`} title={sourceInfo.name}></div>
            </div>
            <h3 className="font-bold text-lg leading-tight mb-1 group-hover:text-yellow-100 transition-colors line-clamp-2">
              {event.title}
            </h3>
            {event.category && (
              <span className="text-xs bg-white/20 px-2 py-1 rounded-md font-medium capitalize">{event.category}</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Date and Time with Live Countdown */}
        <div className="flex items-center text-gray-600">
          <Calendar className="h-4 w-4 mr-2 text-amber-500" />
          <span className="text-sm font-medium">{formatEventDate(event.date, event.time)}</span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-amber-500" />
            <span className="text-sm truncate">{event.location}</span>
          </div>
        )}

        {/* Description Preview */}
        {event.description && <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{event.description}</p>}

        {/* Footer */}
        <div className="flex md:flex-col md:items-start md:gap-1 items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {event.organizer && <span className="md:hidden truncate max-w-[120px]">by {event.organizer}</span>}
            {event.price && <span className="font-medium text-green-600">{event.price}</span>}
          </div>

          <div className="flex items-center gap-2">
            {event.url && (
              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            )}
            <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">View Details</span>
          </div>
        </div>
      </div>
    </div>
  )
}
