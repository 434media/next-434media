export interface Event {
  id: string
  title: string
  description?: string
  date: string // YYYY-MM-DD format
  time?: string // HH:MM format
  location?: string
  organizer?: string
  category?: "conference" | "workshop" | "meetup" | "networking" | "other"
  attendees?: number
  price?: string
  url?: string
  source?: "meetup" | "eventbrite" | "manual"
  image?: string
  created_at?: string
  updated_at?: string
}

export interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  events: Event[]
}

export interface ParsedEventData {
  title: string
  description: string
  date: string
  time: string
  location: string
  organizer: string
  attendees?: number
  image: string
  url: string
  source: "meetup" | "eventbrite" | "manual"
}
