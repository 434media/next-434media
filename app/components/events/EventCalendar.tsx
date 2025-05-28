"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarIcon, Sparkles, Clock, MapPin, X } from "lucide-react"
import type { Event, CalendarDay } from "../../types/event-types"
import { generateCalendarDays, isEventUpcoming, safeParseDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventCalendarProps {
  events: Event[]
  onEventClick: (event: Event) => void
}

export function EventCalendar({ events, onEventClick }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [showModal, setShowModal] = useState(false)
  const [modalEvents, setModalEvents] = useState<Event[]>([])
  const [modalDate, setModalDate] = useState<Date | null>(null)

  useEffect(() => {
    const days = generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth())

    // Populate each day with its events
    const daysWithEvents = days.map((day) => {
      const dayString = day.date.toISOString().split("T")[0]

      // Filter events for this specific day that are upcoming
      const dayEvents = events.filter((event) => {
        if (!event.date) return false

        // Normalize the event date to compare with day
        const eventDate = safeParseDate(event.date)
        if (!eventDate) return false

        const eventDateString = eventDate.toISOString().split("T")[0]
        return eventDateString === dayString && isEventUpcoming(event)
      })

      return {
        ...day,
        events: dayEvents,
      }
    })

    setCalendarDays(daysWithEvents)
  }, [currentDate, events])

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev)
      if (direction === "prev") {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Format time to 12-hour format
  const formatTime12Hour = (timeStr?: string): string => {
    if (!timeStr) return ""

    try {
      // If already in 12-hour format, return as is
      if (timeStr.includes("AM") || timeStr.includes("PM")) {
        return timeStr
      }

      // Convert 24-hour to 12-hour format
      const [hours, minutes] = timeStr.split(":")
      const hour = Number.parseInt(hours)
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch (e) {
      return timeStr
    }
  }

  const handleEventIndicatorClick = (day: CalendarDay) => {
    if (day.events.length > 0) {
      setModalEvents(day.events)
      setModalDate(day.date)
      setShowModal(true)
    }
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Count events for current month
  const currentMonthEvents = calendarDays.reduce((count, day) => {
    return count + (day.isCurrentMonth ? day.events.length : 0)
  }, 0)

  const getCategoryBadgeColor = (category?: string) => {
    switch (category) {
      case "conference":
        return "bg-red-100 text-red-800 border-red-200"
      case "workshop":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "meetup":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "networking":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-blue-100 text-blue-800 border-blue-200"
    }
  }

  return (
    <div className="w-full relative">
      {/* Calendar Header with 434 Logo Background */}
      <div
        className="flex items-center justify-between mb-6 p-6 rounded-2xl border border-amber-200 shadow-lg relative overflow-hidden"
        style={{
          background: `
            linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(249, 115, 22, 0.1) 100%),
            url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')
          `,
          backgroundSize: "auto, 60px 60px",
          backgroundRepeat: "no-repeat, repeat",
          backgroundPosition: "center, 0 0",
        }}
      >
        {/* Overlay for readability */}
        <div className="absolute inset-0 bg-white/90"></div>

        <div className="flex-1 relative z-10">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-2">
            <CalendarIcon className="h-6 w-6 text-amber-600" />
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <p className="text-sm text-gray-600 flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            {currentMonthEvents} event{currentMonthEvents !== 1 ? "s" : ""} this month
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={goToToday}
              className="text-sm px-4 py-2 bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-all duration-200 font-medium"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth("prev")}
              className="h-10 w-10 border border-gray-300 rounded-xl hover:bg-amber-50 hover:border-amber-300 flex items-center justify-center transition-all duration-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigateMonth("next")}
              className="h-10 w-10 border border-gray-300 rounded-xl hover:bg-amber-50 hover:border-amber-300 flex items-center justify-center transition-all duration-200"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 434 Logo */}
        <div className="relative z-10">
          <img
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
            alt="434 Media Logo"
            className="h-28 w-auto invert scale-160 drop-shadow-lg drop-shadow-amber-300"
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
          {dayNames.map((day, index) => (
            <div key={day} className="p-4 text-center text-sm font-bold text-gray-700">
              <span className={cn(index === 0 || index === 6 ? "text-amber-600" : "text-gray-700")}>{day}</span>
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const hasEvents = day.events.length > 0
            const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString()

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[100px] p-3 border-r border-b border-gray-100 cursor-pointer transition-all duration-200 relative",
                  !day.isCurrentMonth && "bg-gray-50/50",
                  day.isToday && "bg-amber-50 border-amber-200",
                  isSelected && "bg-orange-50 border-orange-200",
                  hasEvents && day.isCurrentMonth && "hover:bg-blue-50",
                  !hasEvents && day.isCurrentMonth && "hover:bg-amber-50",
                )}
                onClick={() => setSelectedDate(day.date)}
              >
                {/* Day Number */}
                <div className="flex justify-start mb-2">
                  <span
                    className={cn(
                      "text-lg font-medium",
                      day.isToday && "text-amber-600 font-bold",
                      !day.isCurrentMonth && "text-gray-400",
                      hasEvents && day.isCurrentMonth && "text-blue-600",
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                </div>

                {/* Centered Event Indicator */}
                {hasEvents && (
                  <div className="flex justify-center mb-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventIndicatorClick(day)
                      }}
                      className="group relative"
                    >
                      {day.events.length === 1 ? (
                        // Single event - glowing dot
                        <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg group-hover:shadow-blue-500/50 transition-all duration-200 group-hover:scale-125">
                          <div className="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
                        </div>
                      ) : (
                        // Multiple events - small number badge
                        <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg group-hover:shadow-blue-500/50 transition-all duration-200 group-hover:scale-110">
                          {day.events.length}
                        </div>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Centered Modal for Event Summary */}
      {showModal && modalEvents.length > 0 && modalDate && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[70vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg">
                    <CalendarIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">
                      {modalEvents.length} Event{modalEvents.length !== 1 ? "s" : ""}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {modalDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-96">
              <div className="space-y-3">
                {modalEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md",
                      getCategoryBadgeColor(event.category),
                    )}
                    onClick={() => {
                      onEventClick(event)
                      setShowModal(false)
                    }}
                  >
                    <h4 className="font-bold text-sm text-gray-800 mb-2">{event.title}</h4>

                    {/* Event Details */}
                    <div className="space-y-2">
                      {event.time && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime12Hour(event.time)}</span>
                        </div>
                      )}

                      {event.location && (
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </div>
                      )}

                      {event.description && (
                        <div className="text-xs text-gray-600 mt-2">
                          {event.description.length > 100
                            ? `${event.description.substring(0, 100)}...`
                            : event.description}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-blue-600 font-medium">Click to view full details →</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
