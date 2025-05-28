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
  const [imageLoaded, setImageLoaded] = useState(false)

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case "conference":
        return {
          bg: "bg-gradient-to-r from-orange-50 to-red-50",
          text: "text-orange-800",
          border: "border-orange-200",
          accent: "bg-orange-500",
        }
      case "workshop":
        return {
          bg: "bg-gradient-to-r from-amber-50 to-yellow-50",
          text: "text-amber-800",
          border: "border-amber-200",
          accent: "bg-amber-500",
        }
      case "meetup":
        return {
          bg: "bg-gradient-to-r from-yellow-50 to-orange-50",
          text: "text-yellow-800",
          border: "border-yellow-200",
          accent: "bg-yellow-500",
        }
      case "networking":
        return {
          bg: "bg-gradient-to-r from-blue-50 to-indigo-50",
          text: "text-blue-800",
          border: "border-blue-200",
          accent: "bg-blue-500",
        }
      default:
        return {
          bg: "bg-gradient-to-r from-gray-50 to-slate-50",
          text: "text-gray-800",
          border: "border-gray-200",
          accent: "bg-gray-500",
        }
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return "Time TBD"

    if (time.includes("AM") || time.includes("PM")) {
      return time
    }

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

  // Format date in a simple, reliable way
  const formatDate = (dateString: string) => {
    try {
      // Try to create a date object
      const date = new Date(dateString)

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "Date TBD"
      }

      // Format as Month Day, e.g. "May 15" or with year if not current year
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

  const categoryColors = getCategoryColor(event.category)
  const formattedDate = formatDate(event.date)

  return (
    <div
      className={cn(
        "group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-500 ease-out hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 hover:border-amber-200",
        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-amber-500/0 before:via-amber-500/0 before:to-amber-500/5 before:opacity-0 before:transition-opacity before:duration-500 hover:before:opacity-100",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 via-orange-50/0 to-red-50/0 group-hover:from-amber-50/30 group-hover:via-orange-50/20 group-hover:to-red-50/10 transition-all duration-700" />

      {/* Delete Button with Enhanced Animation */}
      <button
        onClick={handleDeleteClick}
        className={cn(
          "absolute top-4 right-4 z-20 p-2.5 text-gray-400 hover:text-red-600 rounded-xl transition-all duration-300 backdrop-blur-sm",
          "transform scale-0 group-hover:scale-100 hover:scale-110 hover:bg-red-50 hover:shadow-lg hover:shadow-red-500/20",
          "opacity-0 group-hover:opacity-100",
        )}
        title="Delete event"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="relative z-10 p-4 sm:p-6">
        {/* Mobile-First Layout */}
        <div className="space-y-4">
          {/* Header Section with Category and Date */}
          <div className="flex items-start justify-between">
            {/* Category Badge */}
            {event.category && (
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300",
                    categoryColors.bg,
                    categoryColors.text,
                    categoryColors.border,
                    "group-hover:scale-105 group-hover:shadow-md",
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full mr-2", categoryColors.accent)} />
                  {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                </div>
              </div>
            )}

            {/* Date Badge - Simple and Reliable */}
            <div className="flex items-center text-gray-700 font-medium">
              <Calendar className="h-4 w-4 mr-1.5 text-amber-600" />
              {formattedDate}
            </div>
          </div>

          {/* Main Content - Mobile Optimized */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Event Image - Mobile Responsive */}
            {event.image && (
              <div className="w-full sm:w-36 h-32 sm:h-28 rounded-xl overflow-hidden relative group/image flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <img
                  src={event.image || "/placeholder.svg?height=112&width=144&query=event"}
                  alt={event.title}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-700 group-hover:scale-110",
                    imageLoaded ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setImageLoaded(true)}
                />
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" />
                )}

                {/* View Indicator on Image */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white/90 rounded-full p-2 transform scale-75 group-hover:scale-100 transition-transform duration-300">
                    <Eye className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Event Content - Mobile Optimized */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Event Title with Inline Arrow */}
              <h3 className="font-bold text-lg sm:text-xl text-gray-900 group-hover:text-amber-600 transition-colors duration-300 leading-tight flex items-center">
                <span className="line-clamp-2 flex-1">{event.title}</span>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 ml-2 flex-shrink-0 text-amber-500 opacity-0 group-hover:opacity-100 transition-all duration-300",
                    isHovered ? "translate-x-1" : "translate-x-0",
                  )}
                />
              </h3>

              {/* Event Description - Mobile Optimized and Truncated */}
              {event.description && (
                <p className="text-gray-600 text-sm line-clamp-2 leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  {event.description}
                </p>
              )}

              {/* Event Details Grid - Mobile Responsive and Consistent Height */}
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 text-sm">
                <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-colors duration-300">
                  <div className="p-1.5 rounded-lg bg-amber-100 mr-3 group-hover:bg-amber-200 transition-colors duration-300 flex-shrink-0">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="font-medium truncate">{formatTime(event.time)}</span>
                </div>

                {event.location && (
                  <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-colors duration-300">
                    <div className="p-1.5 rounded-lg bg-blue-100 mr-3 group-hover:bg-blue-200 transition-colors duration-300 flex-shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="truncate font-medium">{event.location}</span>
                  </div>
                )}

                {event.attendees && (
                  <div className="flex items-center text-gray-600 group-hover:text-gray-700 transition-colors duration-300">
                    <div className="p-1.5 rounded-lg bg-green-100 mr-3 group-hover:bg-green-200 transition-colors duration-300 flex-shrink-0">
                      <Users className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <span className="font-medium truncate">{event.attendees} attendees</span>
                  </div>
                )}

                {event.price && (
                  <div className="flex items-center">
                    <div className="p-1.5 rounded-lg bg-purple-100 mr-3 group-hover:bg-purple-200 transition-colors duration-300 flex-shrink-0">
                      <div className="h-3.5 w-3.5 text-purple-600 flex items-center justify-center">
                        <span className="text-xs font-bold">$</span>
                      </div>
                    </div>
                    <span className="font-bold text-purple-600 truncate">{event.price}</span>
                  </div>
                )}
              </div>

              {/* Simplified Organizer Section - No Circle */}
              {event.organizer && (
                <div className="pt-3 border-t border-gray-100 group-hover:border-gray-200 transition-colors duration-300">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs text-gray-500 block">Organized by</span>
                      <div className="font-semibold text-gray-700 group-hover:text-amber-600 transition-colors duration-300 truncate">
                        {event.organizer}
                      </div>
                    </div>

                    {/* View Details Button - Clear Visual Indicator */}
                    <button
                      className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-300 group-hover:shadow-md"
                      onClick={(e) => {
                        e.stopPropagation()
                        onClick()
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hover Effect Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>
    </div>
  )
}
