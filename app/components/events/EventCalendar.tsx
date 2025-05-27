"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import type { Event, CalendarDay } from "../../types/event-types"
import { generateCalendarDays, getEventsForDate } from "../../lib/event-utils"
import { AddEventModal } from "./AddEventModal"
import { cn } from "../../lib/utils"

interface EventCalendarProps {
  events: Event[]
  onAddEvent: (event: Event) => void
  onEventClick: (event: Event) => void
}

export function EventCalendar({ events, onAddEvent, onEventClick }: EventCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([])

  useEffect(() => {
    const days = generateCalendarDays(currentDate.getFullYear(), currentDate.getMonth())
    const daysWithEvents = days.map((day) => ({
      ...day,
      events: getEventsForDate(events, day.date),
    }))
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

  return (
    <div className="w-full p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex items-center space-x-2 mt-2">
            <button
              onClick={() => navigateMonth("prev")}
              className="h-7 w-7 p-0 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => navigateMonth("next")}
              className="h-7 w-7 p-0 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center justify-center"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-3 py-2 rounded-lg flex items-center transition-all duration-200 text-sm"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {dayNames.map((day) => (
            <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={cn(
                "min-h-[80px] p-2 border-r border-b border-gray-100 cursor-pointer transition-all duration-200 hover:bg-gray-50",
                !day.isCurrentMonth && "bg-gray-50/50 text-gray-400",
                day.isToday && "bg-blue-50 border-blue-200",
                selectedDate &&
                  day.date.toDateString() === selectedDate.toDateString() &&
                  "bg-purple-50 border-purple-200",
              )}
              onClick={() => setSelectedDate(day.date)}
            >
              <div
                className={cn(
                  "text-sm font-medium mb-1",
                  day.isToday && "text-blue-600",
                  !day.isCurrentMonth && "text-gray-400",
                )}
              >
                {day.date.getDate()}
              </div>

              {/* Event indicators */}
              <div className="space-y-1">
                {day.events.slice(0, 2).map((event, eventIndex) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className={cn(
                      "text-xs p-1 rounded truncate cursor-pointer transition-all duration-200 hover:scale-105",
                      event.category === "conference" && "bg-purple-100 text-purple-800 hover:bg-purple-200",
                      event.category === "workshop" && "bg-green-100 text-green-800 hover:bg-green-200",
                      event.category === "meetup" && "bg-blue-100 text-blue-800 hover:bg-blue-200",
                      event.category === "networking" && "bg-orange-100 text-orange-800 hover:bg-orange-200",
                      (!event.category || event.category === "other") && "bg-gray-100 text-gray-800 hover:bg-gray-200",
                    )}
                  >
                    {event.title}
                  </div>
                ))}
                {day.events.length > 2 && (
                  <div className="text-xs text-gray-500 font-medium">+{day.events.length - 2} more</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddEvent={onAddEvent}
        selectedDate={selectedDate}
      />
    </div>
  )
}
