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

// Parse YYYY-MM-DD string as local date - this is now the primary path
export function safeParseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  try {
    // Since we configured pg to return DATE as strings, we should always get "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Split the date and create a local date object
      const [year, month, day] = dateStr.split("-").map(Number)
      const date = new Date(year, month - 1, day) // month is 0-indexed, creates local date

      // Validate the date components
      if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
        return date
      }
    }

    // Fallback for any other format (shouldn't happen with our setup)
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date
    }

    return null
  } catch (e) {
    console.error("Error parsing date:", dateStr, e)
    return null
  }
}

// Format event date with robust error handling - CLIENT-SIDE ONLY
export function formatEventDate(dateStr: string, timeStr?: string): string {
  if (!dateStr) return "Date TBD"

  // Parse the date safely in local timezone
  const eventDate = safeParseDate(dateStr)
  if (!eventDate) return "Invalid Date"

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  // Format the date part using local timezone
  let dateDisplay = ""

  if (eventDate.toDateString() === today.toDateString()) {
    dateDisplay = "Today"
  } else if (eventDate.toDateString() === tomorrow.toDateString()) {
    dateDisplay = "Tomorrow"
  } else if (eventDate.toDateString() === yesterday.toDateString()) {
    dateDisplay = "Yesterday"
  } else {
    // Use local date formatting
    dateDisplay = eventDate.toLocaleDateString("en-US", {
      year: eventDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      month: "short",
      day: "numeric",
    })
  }

  // Format the time part if provided
  if (timeStr) {
    let formattedTime = ""

    try {
      if (!timeStr.includes("AM") && !timeStr.includes("PM")) {
        const [hours, minutes] = timeStr.split(":")
        const hour = Number.parseInt(hours)
        if (!isNaN(hour)) {
          const ampm = hour >= 12 ? "PM" : "AM"
          const displayHour = hour % 12 || 12
          formattedTime = `${displayHour}:${minutes} ${ampm}`
        } else {
          formattedTime = timeStr
        }
      } else {
        formattedTime = timeStr
      }
    } catch (e) {
      formattedTime = timeStr
    }

    return `${dateDisplay} at ${formattedTime}`
  }

  return dateDisplay
}

export function generateEventId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// CLIENT-SIDE date comparison functions - now work with YYYY-MM-DD strings
export function isEventUpcoming(event: Event): boolean {
  // If explicitly marked as past, it's not upcoming
  if (event.isPast === true) return false
  
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  // Compare using local timezone
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Set event date to start of day for comparison
  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)

  return eventDateStart >= today
}

export function isEventPast(event: Event): boolean {
  if (!event.date) return true

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return true

  // Compare using local timezone
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Set event date to start of day for comparison
  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)

  return eventDateStart < today
}

export function isEventWithin30Days(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  const today = new Date()
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  today.setHours(0, 0, 0, 0)

  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)

  return eventDateStart >= today && eventDateStart <= thirtyDaysFromNow
}

export function isEventThisWeek(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  const today = new Date()

  // Get the start of this week (Sunday) in local timezone
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  // Get the end of this week (Saturday) in local timezone
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)

  return eventDateStart >= startOfWeek && eventDateStart <= endOfWeek
}

export function isEventToday(event: Event): boolean {
  if (!event.date) return false

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return false

  const today = new Date()
  return eventDate.toDateString() === today.toDateString()
}

export function getDaysUntilEvent(event: Event): number {
  if (!event.date) return 999

  const eventDate = safeParseDate(event.date)
  if (!eventDate) return 999

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const eventDateStart = new Date(eventDate)
  eventDateStart.setHours(0, 0, 0, 0)

  const diffTime = eventDateStart.getTime() - today.getTime()
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

// Format relative time with natural language - CLIENT-SIDE ONLY
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ""

  const eventDate = safeParseDate(dateStr)
  if (!eventDate) return ""

  const now = new Date()
  const diffTime = eventDate.getTime() - now.getTime()
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

// Simple date formatter for consistent display - CLIENT-SIDE ONLY
export function formatSimpleDate(dateStr: string): string {
  if (!dateStr) return "Date TBD"

  const eventDate = safeParseDate(dateStr)
  if (!eventDate) return "Date TBD"

  try {
    const today = new Date()
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
    }

    if (eventDate.getFullYear() !== today.getFullYear()) {
      options.year = "numeric"
    }

    return eventDate.toLocaleDateString("en-US", options)
  } catch {
    return "Date TBD"
  }
}
