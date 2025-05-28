"use client"

import { useEffect, useState } from "react"
import { Calendar, Clock, BarChart3, Zap } from "lucide-react"
import type { Event } from "../../types/event-types"
import { safeParseDate, isEventUpcoming } from "../../lib/event-utils"
import { cn } from "../../lib/utils"

interface EventStatsProps {
  events: Event[]
  className?: string
}

export function EventStats({ events, className }: EventStatsProps) {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    upcoming30Days: 0,
    totalUpcoming: 0,
    categories: {} as Record<string, number>,
    mostPopularCategory: "",
    mostPopularCategoryCount: 0,
  })

  // Calculate stats on client-side to ensure accurate date calculations
  useEffect(() => {
    setMounted(true)

    // Filter out any events with invalid dates
    const validEvents = events.filter((event) => {
      try {
        const date = safeParseDate(event.date)
        return !!date && !isNaN(date.getTime())
      } catch (e) {
        return false
      }
    })

    // Filter for upcoming events based on the user's local time
    const upcomingEvents = validEvents.filter((event) => isEventUpcoming(event))

    // Count events by timeframe
    const todayEvents = upcomingEvents.filter((event) => {
      if (!event.date) return false
      const eventDate = safeParseDate(event.date)
      if (!eventDate) return false

      const today = new Date()
      return eventDate.toDateString() === today.toDateString()
    })

    const thisWeekEvents = upcomingEvents.filter((event) => {
      if (!event.date) return false
      const eventDate = safeParseDate(event.date)
      if (!eventDate) return false

      const today = new Date()

      // Get the start of this week (Sunday)
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      startOfWeek.setHours(0, 0, 0, 0)

      // Get the end of this week (Saturday)
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      endOfWeek.setHours(23, 59, 59, 999)

      return eventDate >= startOfWeek && eventDate <= endOfWeek
    })

    const upcoming30DaysEvents = upcomingEvents.filter((event) => {
      if (!event.date) return false
      const eventDate = safeParseDate(event.date)
      if (!eventDate) return false

      const today = new Date()
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
      today.setHours(0, 0, 0, 0)

      return eventDate >= today && eventDate <= thirtyDaysFromNow
    })

    // Count events by category
    const categories: Record<string, number> = {}
    upcomingEvents.forEach((event) => {
      const category = event.category || "other"
      categories[category] = (categories[category] || 0) + 1
    })

    // Find most popular category
    let mostPopularCategory = ""
    let mostPopularCategoryCount = 0

    Object.entries(categories).forEach(([category, count]) => {
      if (count > mostPopularCategoryCount) {
        mostPopularCategory = category
        mostPopularCategoryCount = count
      }
    })

    setStats({
      today: todayEvents.length,
      thisWeek: thisWeekEvents.length,
      upcoming30Days: upcoming30DaysEvents.length,
      totalUpcoming: upcomingEvents.length,
      categories,
      mostPopularCategory,
      mostPopularCategoryCount,
    })
  }, [events])

  if (!mounted) return null

  return (
    <div className={cn("bg-white rounded-xl shadow-md p-6", className)}>
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Event Insights</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Events */}
        <div
          className={cn(
            "rounded-lg p-4 border flex items-center gap-3",
            stats.today > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200",
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              stats.today > 0 ? "bg-red-100" : "bg-gray-100",
            )}
          >
            {stats.today > 0 ? (
              <Zap className="h-5 w-5 text-red-600" />
            ) : (
              <Calendar className="h-5 w-5 text-gray-500" />
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500">Today</div>
            <div className={cn("text-xl font-bold", stats.today > 0 ? "text-red-600 animate-pulse" : "text-gray-700")}>
              {stats.today} {stats.today === 1 ? "Event" : "Events"}
            </div>
          </div>
        </div>

        {/* This Week's Events */}
        <div className="rounded-lg p-4 bg-amber-50 border border-amber-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">This Week</div>
            <div className="text-xl font-bold text-amber-600">
              {stats.thisWeek} {stats.thisWeek === 1 ? "Event" : "Events"}
            </div>
          </div>
        </div>

        {/* Next 30 Days */}
        <div className="rounded-lg p-4 bg-blue-50 border border-blue-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Next 30 Days</div>
            <div className="text-xl font-bold text-blue-600">
              {stats.upcoming30Days} {stats.upcoming30Days === 1 ? "Event" : "Events"}
            </div>
          </div>
        </div>

        {/* Most Popular Category */}
        <div className="rounded-lg p-4 bg-purple-50 border border-purple-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Popular Category</div>
            <div className="text-xl font-bold text-purple-600 capitalize">{stats.mostPopularCategory || "None"}</div>
          </div>
        </div>
      </div>

      {/* Additional insights */}
      <div className="mt-6 text-sm text-gray-600">
        {stats.totalUpcoming === 0 ? (
          <p>No upcoming events. Add some events to see insights!</p>
        ) : (
          <p>
            {stats.today > 0 ? (
              <span className="font-medium text-red-600">
                {stats.today} event{stats.today !== 1 ? "s" : ""} happening today!{" "}
              </span>
            ) : (
              <span>No events today. </span>
            )}

            {stats.thisWeek > stats.today ? (
              <span className="block">
                {stats.thisWeek - stats.today} more event{stats.thisWeek - stats.today !== 1 ? "s" : ""} coming up this
                week.
              </span>
            ) : null}

            {/* {stats.mostPopularCategory ? (
              <span>
                <span className="inline-flex font-medium capitalize">{stats.mostPopularCategory}</span> is the most popular category
                with {stats.mostPopularCategoryCount} event{stats.mostPopularCategoryCount !== 1 ? "s" : ""}.
              </span>
            ) : null} */}
          </p>
        )}
      </div>
    </div>
  )
}
