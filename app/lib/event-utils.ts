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
      isToday: isSameDay(currentDate, today),
      events: [],
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return days
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function formatEventDate(date: string, time?: string): string {
  const eventDate = new Date(date)
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }

  let formatted = eventDate.toLocaleDateString("en-US", options)

  if (time) {
    const [hours, minutes] = time.split(":")
    const timeDate = new Date()
    timeDate.setHours(Number.parseInt(hours), Number.parseInt(minutes))
    formatted += ` at ${timeDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`
  }

  return formatted
}

export function getEventsForDate(events: Event[], date: Date): Event[] {
  return events.filter((event) => isSameDay(new Date(event.date), date))
}
