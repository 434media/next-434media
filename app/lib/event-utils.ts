import type { Event, CalendarDay } from "../types/event-types"

export function generateCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  const endDate = new Date(lastDay)

  // Start from the beginning of the week
  startDate.setDate(startDate.getDate() - startDate.getDay())

  // End at the end of the week
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

  const days: CalendarDay[] = []
  const currentDate = new Date(startDate)
  const today = new Date()

  while (currentDate <= endDate) {
    days.push({
      date: new Date(currentDate),
      isCurrentMonth: currentDate.getMonth() === month,
      isToday: currentDate.toDateString() === today.toDateString(),
      events: [],
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return days
}

export function getEventsForDate(events: Event[], date: Date): Event[] {
  const dateString = date.toISOString().split("T")[0]
  return events.filter((event) => event.date === dateString)
}

// Safely parse a date string with robust error handling
export function safeParseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  try {
    // Try ISO format first (YYYY-MM-DD)
    const date = new Date(dateStr)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      // If not valid, try with explicit timezone
      const dateWithTZ = new Date(`${dateStr}T00:00:00`)
      if (isNaN(dateWithTZ.getTime())) {
        return null
      }
      return dateWithTZ
    }
    return date
  } catch (e) {
    console.error("Error parsing date:", dateStr, e)
    return null
  }
}

// Format event date with robust error handling and enhanced display
export function formatEventDate(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "Date TBD"

  // Parse the date safely
  const eventDate = safeParseDate(dateStr)
  if (!eventDate) return "Invalid Date"

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))
  localToday.setHours(0, 0, 0, 0)

  // Get tomorrow's date in the user's local time zone
  const tomorrow = new Date(localToday)
  tomorrow.setDate(localToday.getDate() + 1)

  // Get yesterday's date in the user's local time zone
  const yesterday = new Date(localToday)
  yesterday.setDate(localToday.getDate() - 1)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  // Calculate days difference
  const diffTime = localEventDate.getTime() - localToday.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  // Format the date part
  let dateDisplay = ""

  if (localEventDate.toDateString() === localToday.toDateString()) {
    dateDisplay = "Today"
  } else if (localEventDate.toDateString() === tomorrow.toDateString()) {
    dateDisplay = "Tomorrow"
  } else if (localEventDate.toDateString() === yesterday.toDateString()) {
    dateDisplay = "Yesterday"
  } else if (diffDays > 0 && diffDays <= 7) {
    // Within a week - show day name
    dateDisplay = localEventDate.toLocaleDateString("en-US", { weekday: "long", timeZone: userTimeZone })
  } else if (diffDays > 0 && diffDays <= 30) {
    // Within a month - show month and day
    dateDisplay = localEventDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: userTimeZone,
    })
  } else {
    // More than a month away or in the past
    dateDisplay = localEventDate.toLocaleDateString("en-US", {
      year: localEventDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      month: "short",
      day: "numeric",
      timeZone: userTimeZone,
    })
  }

  // Format the time part if provided
  if (timeStr) {
    let formattedTime = ""

    // Try to convert to 12-hour format if needed
    try {
      if (!timeStr.includes("AM") && !timeStr.includes("PM")) {
        const [hours, minutes] = timeStr.split(":")
        const hour = Number.parseInt(hours)
        if (!isNaN(hour)) {
          const ampm = hour >= 12 ? "PM" : "AM"
          const displayHour = hour % 12 || 12
          formattedTime = `${displayHour}:${minutes} ${ampm}`
        } else {
          formattedTime = timeStr // Fallback to original
        }
      } else {
        formattedTime = timeStr
      }
    } catch (e) {
      formattedTime = timeStr // Fallback to original
    }

    return `${dateDisplay} at ${formattedTime}`
  }

  return dateDisplay
}

export function generateEventId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// New utility functions for better event filtering and stats
export function isEventUpcoming(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))
  localToday.setHours(0, 0, 0, 0)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  return localEventDate >= localToday
}

export function isEventPast(event: Event): boolean {
  if (!event.date) return true

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return true

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))
  localToday.setHours(0, 0, 0, 0)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  return localEventDate < localToday
}

export function isEventWithin30Days(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))
  localToday.setHours(0, 0, 0, 0)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  const thirtyDaysFromNow = new Date(localToday.getTime() + 30 * 24 * 60 * 60 * 1000)

  return localEventDate >= localToday && localEventDate <= thirtyDaysFromNow
}

export function isEventThisWeek(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))

  // Get the start of this week (Sunday)
  const startOfWeek = new Date(localToday)
  startOfWeek.setDate(localToday.getDate() - localToday.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  // Get the end of this week (Saturday)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  return localEventDate >= startOfWeek && localEventDate <= endOfWeek
}

export function isEventToday(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  return localEventDate.toDateString() === localToday.toDateString()
}

export function getDaysUntilEvent(event: Event): number {
  if (!event.date) return 999

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return 999

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))
  localToday.setHours(0, 0, 0, 0)

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  const diffTime = localEventDate.getTime() - localToday.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getEventUrgency(event: Event): "today" | "tomorrow" | "this-week" | "soon" | "later" {
  const daysUntil = getDaysUntilEvent(event)

  if (daysUntil === 0) return "today"
  if (daysUntil === 1) return "tomorrow"
  if (daysUntil <= 7) return "this-week"
  if (daysUntil <= 30) return "soon"
  return "later"
}

// Format relative time with natural language
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ""

  const eventDate = safeParseDate(dateStr)
  if (!eventDate) return ""

  // Get the user's local time zone
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Get today's date in the user's local time zone
  const today = new Date()
  const localToday = new Date(today.toLocaleString("en-US", { timeZone: userTimeZone }))

  // Convert eventDate to user's local time zone
  const localEventDate = new Date(eventDate.toLocaleString("en-US", { timeZone: userTimeZone }))

  const now = localToday
  const diffTime = localEventDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
  const diffMinutes = Math.ceil(diffTime / (1000 * 60))

  if (diffDays === 0) {
    if (diffHours <= 0) {
      if (diffMinutes <= 0) {
        return "Just now"
      }
      return `In ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`
    }
    return `In ${diffHours} hour${diffHours !== 1 ? "s" : ""}`
  }

  if (diffDays === 1) return "Tomorrow"
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays > 7 && diffDays <= 30) return `In ${Math.ceil(diffDays / 7)} weeks`
  if (diffDays > 30 && diffDays <= 365) return `In ${Math.ceil(diffDays / 30)} months`
  return `In ${Math.ceil(diffDays / 365)} years`
}

// Get a human-readable time range
export function getTimeRange(startTime?: string, endTime?: string): string {
  if (!startTime) return ""
  if (!endTime) return startTime

  // Format for display
  let formattedStart = startTime
  let formattedEnd = endTime

  // Try to convert to 12-hour format if needed
  try {
    if (!startTime.includes("AM") && !startTime.includes("PM")) {
      const [hours, minutes] = startTime.split(":")
      const hour = Number.parseInt(hours)
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 || 12
      formattedStart = `${displayHour}:${minutes} ${ampm}`
    }

    if (!endTime.includes("AM") && !endTime.includes("PM")) {
      const [hours, minutes] = endTime.split(":")
      const hour = Number.parseInt(hours)
      const ampm = hour >= 12 ? "PM" : "AM"
      const displayHour = hour % 12 || 12
      formattedEnd = `${displayHour}:${minutes} ${ampm}`
    }
  } catch (e) {
    // Fallback to original format
  }

  return `${formattedStart} - ${formattedEnd}`
}
