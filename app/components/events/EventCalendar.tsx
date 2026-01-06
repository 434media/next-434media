"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react"
import type { Event, CalendarDay } from "../../types/event-types"
import { generateCalendarDays, isEventUpcoming, safeParseDate } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventCalendarProps {
  events: Event[]
  onEventClick: (event: Event) => void
  onDateSelect?: (date: Date) => void
}

export function EventCalendar({ events, onEventClick, onDateSelect }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | null>(null)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    const days = generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth())

    // Populate each day with its events using client-side timezone
    const daysWithEvents = days.map((day) => {
      const dayString = day.date.toISOString().split("T")[0]

      // Filter events for this specific day that are upcoming (client-side check)
      const dayEvents = events.filter((event) => {
        if (!event.date) return false

        // Normalize the event date to compare with day (client-side)
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
  }, [currentDate, events, isClient])

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
    if (day.events.length > 0 && onDateSelect) {
      onDateSelect(day.date)
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

  // Count events for current month (client-side)
  const currentMonthEvents = isClient
    ? calendarDays.reduce((count, day) => {
        return count + (day.isCurrentMonth ? day.events.length : 0)
      }, 0)
    : 0

  const getCategoryBadgeColor = (category?: string) => {
    // Unified black and white theme
    return "bg-white text-black border-black"
  }

  // Don't render until client-side to avoid hydration issues
  if (!isClient) {
    return (
      <div className="w-full animate-pulse">
        <div className="h-64 bg-neutral-200 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="w-full relative">
      {/* Calendar Header - Black and White */}
      <div className="flex items-center justify-between mb-4 md:mb-6 p-3 md:p-4 bg-white border border-gray-200 rounded-xl relative">
        <div className="flex-1">
          <h2 className="text-base md:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-2 tracking-tight">
            <CalendarIcon className="h-4 w-4 md:h-5 md:w-5 text-gray-500" />
            <span>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          </h2>
          <div className="text-xs md:text-sm text-gray-500 flex items-center gap-2 mb-3 font-normal">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
            {currentMonthEvents} event{currentMonthEvents !== 1 ? "s" : ""} this month
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={goToToday}
              className="text-xs px-2.5 md:px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 transition-all duration-200 font-medium touch-manipulation"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth("prev")}
              className="h-8 w-8 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 flex items-center justify-center transition-all duration-200 touch-manipulation text-gray-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigateMonth("next")}
              className="h-8 w-8 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100 flex items-center justify-center transition-all duration-200 touch-manipulation text-gray-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 434 Logo - Smaller on mobile */}
        <div className="relative z-10">
          <img
            src="https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png"
            alt="434 Media Logo"
            className="h-20 md:h-32 w-auto invert scale-125 down-shadow-lg drop-shadow-lg drop-shadow-neutral-200/40"
          />
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Day Names Header - Black and White */}
        <div className="grid grid-cols-7 bg-gray-900 text-white">
          {dayNames.map((day) => (
            <div key={day} className="p-2 md:p-3 text-center text-xs md:text-sm font-medium tracking-wide">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days - Black and White */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const hasEvents = day.events.length > 0
            const isSelected = calendarSelectedDate && day.date.toDateString() === calendarSelectedDate.toDateString()

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[80px] md:min-h-[80px] p-2 border-r border-b border-gray-100 cursor-pointer transition-all duration-200 relative",
                  "active:scale-95 active:bg-gray-100", // Mobile touch feedback
                  !day.isCurrentMonth && "bg-gray-50 text-gray-400",
                  day.isToday && "bg-gray-900 text-white",
                  isSelected && "bg-gray-800 text-white",
                  hasEvents && day.isCurrentMonth && "hover:bg-gray-50 active:bg-gray-100",
                  !hasEvents && day.isCurrentMonth && "hover:bg-gray-50/50 active:bg-gray-50",
                )}
                onClick={() => {
                  setCalendarSelectedDate(day.date)
                  if (onDateSelect) {
                    onDateSelect(day.date)
                  }
                }}
              >
                {/* Day Number */}
                <div className="flex justify-start mb-1">
                  <span
                    className={cn(
                      "text-sm font-normal",
                      day.isToday && "text-white font-medium",
                      !day.isCurrentMonth && "text-gray-400",
                      hasEvents && day.isCurrentMonth && !day.isToday && !isSelected && "text-gray-900 font-medium",
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                </div>

                {/* Event Indicator - Black and White */}
                {hasEvents && (
                  <div className="flex justify-center mb-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEventIndicatorClick(day)
                      }}
                      className="group relative touch-manipulation" // Better touch handling
                    >
                      {day.events.length === 1 ? (
                        // Single event - black dot (larger on mobile)
                        <div className="w-2.5 h-2.5 md:w-2 md:h-2 bg-gray-800 rounded-full transition-all duration-200 group-hover:scale-125 group-active:scale-110">
                        </div>
                      ) : (
                        // Multiple events - black number badge (larger on mobile)
                        <div className="bg-gray-800 text-white text-xs md:text-xs px-1.5 py-0.5 rounded-md transition-all duration-200 group-hover:scale-110 group-active:scale-95 font-medium min-w-[18px] md:min-w-[16px] text-center">
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


    </div>
  )
}
