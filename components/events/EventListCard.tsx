"use client"

import type React from "react"
import { MapPin, Users, Clock, ArrowRight, Calendar, Eye } from "lucide-react"
import type { Event } from "../../types/event-types"
import { cn } from "../../lib/utils"
import { useState, useEffect } from "react"
import { formatSimpleDate } from "../../lib/event-utils"

interface EventListCardProps {
  event: Event
  onClick: () => void
  className?: string
  onDeleteRequest?: () => void
  onEditRequest?: () => void
}

export function EventListCard({ event, onClick, className, onDeleteRequest, onEditRequest }: EventListCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const getCategoryColor = (category?: string) => {
    // Unified black and white theme for all categories
    return {
      bg: "bg-white",
      text: "text-black",
      border: "border-black",
      accent: "bg-black",
      shadow: "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
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





  const categoryColors = getCategoryColor(event.category)

  // Use client-side date formatting to avoid hydration issues
  const formattedDate = isClient ? formatSimpleDate(event.date) : "Loading..."

  return (
    <article
      className={cn(
        "group relative bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all duration-700 ease-out",
        "hover:shadow-2xl hover:shadow-neutral-500/15 hover:-translate-y-2 hover:border-neutral-200",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-neutral-50/0 before:via-neutral-50/0 before:to-yellow-50/0",
        "before:opacity-0 before:transition-all before:duration-700 hover:before:opacity-100",
        "hover:before:from-neutral-50/40 hover:before:via-neutral-50/30 hover:before:to-yellow-50/20",
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
      <div className="relative z-20 p-5 sm:p-6">
        {/* Header Section - Organizer and Date */}
        <div className="flex items-start justify-between mb-6">
          {/* Organizer Badge - Enhanced */}
          {event.organizer && (
            <div
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium tracking-wide border transition-all duration-500",
                categoryColors.bg,
                categoryColors.text,
                categoryColors.border,
                "group-hover:scale-105 group-hover:shadow-md",
                categoryColors.shadow,
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full mr-2 transition-all duration-500 group-hover:scale-125",
                  categoryColors.accent,
                )}
              />
              {event.organizer}
            </div>
          )}
          {/* Date Badge - Black and White */}
          <div className="flex items-center text-black font-medium bg-white px-3 py-1.5 rounded-md border border-gray-200">
            <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
            <span className="text-sm font-medium tracking-wide">{formattedDate}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
          {/* Event Content */}
          <div className="flex-1 min-w-0 space-y-4 order-2 sm:order-1">
            {/* Event Title - Black and White */}
            <h3 className="font-semibold text-lg sm:text-xl text-gray-900 transition-colors duration-200 leading-snug line-clamp-2 tracking-tight">
              {event.title}
            </h3>

            {/* Event Description */}
            {event.description && (
              <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed font-normal">
                {event.description}
              </p>
            )}

            {/* Event Details Grid - Black and White */}
            <div className="grid grid-cols-1 gap-2.5 text-sm">
              <div className="flex items-center text-gray-600">
                <div className="p-1.5 rounded-md bg-gray-50 border border-gray-200 mr-3 flex-shrink-0">
                  <Clock className="h-4 w-4 text-gray-500" />
                </div>
                <span className="font-normal truncate">{formatTime(event.time)}</span>
              </div>

              {event.location && (
                <div className="flex items-center text-gray-600">
                  <div className="p-1.5 rounded-md bg-gray-50 border border-gray-200 mr-3 flex-shrink-0">
                    <MapPin className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="truncate font-normal">{event.location}</span>
                </div>
              )}

              {event.attendees && (
                <div className="flex items-center text-gray-600">
                  <div className="p-1.5 rounded-md bg-gray-50 border border-gray-200 mr-3 flex-shrink-0">
                    <Users className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className="font-normal truncate">{event.attendees} attendees</span>
                </div>
              )}

              {event.price && (
                <div className="flex items-center text-gray-600">
                  <div className="p-1.5 rounded-md bg-gray-50 border border-gray-200 mr-3 flex-shrink-0">
                    <div className="h-4 w-4 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-500">$</span>
                    </div>
                  </div>
                  <span className="font-medium truncate">{event.price}</span>
                </div>
              )}
            </div>

            {/* Tags Section - New Airtable Feature */}
            {event.tags && (
              <div className="flex flex-wrap gap-1.5 pt-4 border-t border-gray-100">
                {event.tags.split(',').map((tag, index) => (
                  <span
                    key={index}
                    className="px-2.5 py-1 bg-gray-50 border border-gray-200 text-gray-600 text-xs font-normal rounded-full tracking-wide"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}

          </div>

          {/* Event Image - Enhanced */}
          {event.image && (
            <div className="w-full md:w-[470px] h-48 md:h-80 rounded-xl overflow-hidden relative group/image flex-shrink-0 order-1 sm:order-2">
              {/* Image Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent z-10 opacity-0 group-hover:opacity-100 transition-all duration-500" />

              <img
                src={event.image}
                alt={event.title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                loading="lazy"
              />

              {/* View Indicator - Black and White */}
              <div className="absolute inset-0 flex items-center justify-center z-20 opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="bg-white border-2 border-black rounded-md p-2 transform scale-75 group-hover:scale-100 transition-all duration-300">
                  <Eye className="h-4 w-4 text-black" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Border Effect */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </article>
  )
}
