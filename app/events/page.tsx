"use client"

import { useState, useEffect } from "react"
import type { Event } from "../types/event-types"
import { EventCalendar } from "../components/events/EventCalendar"
import { EventModal } from "../components/events/EventModal"
import { EventListCard } from "../components/events/EventListCard"

import { EventCardSkeleton, CalendarSkeleton } from "../components/events/LoadingSkeleton"
import { Toast } from "../components/events/Toast"
import { FadeIn } from "../components/FadeIn"

import { getEventsAction } from "@/app/actions/events-airtable"
import { Plus, Calendar } from "lucide-react"
import { isEventUpcoming } from "../lib/event-utils"
import { Vortex } from "../components/vortex"

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning"; isVisible: boolean }>({
    message: "",
    type: "success",
    isVisible: false,
  })

  // Fix hydration by ensuring component is mounted
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load events on component mount
  useEffect(() => {
    if (mounted) {
      loadEvents()
    }
  }, [mounted])

  // Filter events on client side when allEvents changes or date selection changes
  useEffect(() => {
    if (mounted && allEvents.length > 0) {
      let filteredEvents = allEvents.filter((event) => isEventUpcoming(event))
      
      // If a date is selected, filter to show only events on that date
      if (selectedDate) {
        const selectedDateString = selectedDate.toISOString().split("T")[0] // YYYY-MM-DD
        filteredEvents = filteredEvents.filter((event) => {
          return event.date === selectedDateString
        })
        
        // Show toast with filter info
        showToast(`Showing ${filteredEvents.length} event(s) on ${selectedDate.toLocaleDateString()}`, "success")
      }
      
      setEvents(filteredEvents)
    }
  }, [allEvents, mounted, selectedDate])

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type, isVisible: true })
  }

  const hideToast = () => {
    setToast((prev) => ({ ...prev, isVisible: false }))
  }

  const loadEvents = async () => {
    setIsLoading(true)
    setError("")

    try {
      const result = await getEventsAction()

      if (result.success) {
        // Store all events from server, let client-side filtering handle the rest
        setAllEvents(result.events)
      } else {
        setError(result.error || "Failed to load events")
      }
    } catch (error) {
      setError("An unexpected error occurred")
      console.error("Error loading events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEventAdded = (newEvent: Event) => {
    // Add to allEvents and let useEffect handle filtering
    setAllEvents((prev) => [...prev, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
    showToast("Event added successfully!", "success")
  }

  const handleEventDeleted = () => {
    // Reload events to get fresh data
    loadEvents()
    showToast("Event deleted successfully!", "success")
  }

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  const handleCloseEventModal = () => {
    setShowEventModal(false)
    setSelectedEvent(null)
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    
    // On mobile, also find and show the first event for the selected date in modal
    const selectedDateString = date.toISOString().split("T")[0]
    const dateEvents = allEvents.filter(event => event.date === selectedDateString && isEventUpcoming(event))
    
    // Check if we're on mobile (screen width < 1024px)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024
    
    if (isMobile) {
      // Always scroll to events list on mobile after date selection
      setTimeout(() => {
        const eventsSection = document.getElementById('events-list-section')
        if (eventsSection) {
          eventsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
      
      // If there are events for this date, show the first one in modal
      if (dateEvents.length > 0) {
        setTimeout(() => {
          setSelectedEvent(dateEvents[0])
          setShowEventModal(true)
        }, 500) // Delay to let the scroll animation complete
      }
    }
  }

  const clearDateFilter = () => {
    setSelectedDate(null)
  }



  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      <FadeIn>
        <div className="relative pt-28 pb-16 md:pt-40 md:pb-32 bg-black text-white overflow-hidden">
          {/* Vortex Background */}
          <Vortex
            backgroundColor="black"
            rangeY={800}
            particleCount={500}
            baseHue={240}
            className="flex items-center flex-col justify-center px-4 sm:px-6 md:px-4 py-4 w-full h-full"
          >
            <div className="max-w-4xl mx-auto text-center">
              {/* Hero Title */}
              <div className="mb-6 sm:mb-8">
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-3 sm:mb-4">
                  <span className="text-white">Build Connections</span>
                  <br />
                  <span className="text-white">That Matter</span>
                </h1>
              </div>

              {/* Description */}
              <div className="mb-8 sm:mb-10">
                <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-2 max-w-2xl mx-auto">
                  Discover meaningful events that bring communities together.
                </p>
              </div>
            </div>
          </Vortex>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 bg-white relative">
          {error && (
            <div className="mb-4 p-4 bg-black border border-gray-300 rounded-lg text-white text-sm text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-4 h-4 border-2 border-white rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-white rounded-full"></div>
                </div>
                <span className="font-medium">Connection Error</span>
              </div>
              <p className="text-gray-300">{error}</p>
              <button
                onClick={loadEvents}
                className="mt-3 px-4 py-2 bg-white text-black rounded-md hover:bg-gray-100 transition-colors duration-200 font-medium text-sm"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Mobile Calendar Section - Only visible on mobile */}
          <div className="lg:hidden mb-8 relative">
            <div className="bg-white rounded-lg border-2 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative z-10">
              <div className="bg-black text-white px-4 py-3 border-b-2 border-black">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Select Event Date
                </h3>
                <p className="text-sm text-gray-300 mt-1">
                  Tap a date with events to see details, or scroll down to browse all events
                </p>
              </div>
              <div className="p-1">
                {isLoading ? (
                  <CalendarSkeleton />
                ) : (
                  <EventCalendar 
                    events={allEvents} 
                    onEventClick={handleEventClick} 
                    onDateSelect={handleDateSelect} 
                  />
                )}
              </div>
            </div>
            
            {/* Clear filter button for mobile */}
            {selectedDate && (
              <div className="mt-4 text-center">
                <button
                  onClick={clearDateFilter}
                  className="px-6 py-3 bg-white border-2 border-black text-black rounded-lg hover:bg-black hover:text-white transition-colors duration-200 font-bold text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  Show All Events
                </button>
              </div>
            )}
            
            {/* Visual separator for mobile */}
            <div className="mt-8 flex items-center justify-center">
              <div className="w-16 h-1 bg-black rounded-full"></div>
            </div>
          </div>

          <div className="lg:flex lg:gap-6">
            {/* Left Side - Event List */}
            <div className="lg:w-2/3">
              <div className="mb-6" id="events-list-section">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2 flex items-center gap-2">
                      <Calendar className="h-6 w-6 text-black" />
                      {selectedDate ? `Events on ${selectedDate.toLocaleDateString()}` : 'Upcoming Events'}
                    </h2>
                    <p className="text-base text-gray-600">
                      {selectedDate 
                        ? (
                          <>
                            <span>Showing events for the selected date.</span>
                            <span className="hidden lg:inline"> Click "Show All Events" to see all upcoming events.</span>
                            <span className="lg:hidden"> Scroll up to select a different date or show all events.</span>
                          </>
                        )
                        : 'Curated experiences from our Airtable database. Join events that build meaningful connections.'
                      }
                    </p>
                    {/* Only show this button on desktop when date is selected */}
                    {selectedDate && (
                      <button
                        onClick={clearDateFilter}
                        className="mt-2 text-sm text-gray-600 hover:text-black underline hidden lg:inline"
                      >
                        Show All Events
                      </button>
                    )}
                  </div>


                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i}>
                      <EventCardSkeleton />
                    </div>
                  ))
                ) : events.length > 0 ? (
                  events
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((event) => (
                      <div key={event.id}>
                        <EventListCard
                          event={event}
                          onClick={() => handleEventClick(event)}
                          className="w-full"
                        />
                      </div>
                    ))
                ) : (
                  <div className="text-center py-16">
                    <div className="mb-6">
                      <div className="w-16 h-16 mx-auto border-4 border-black rounded-full flex items-center justify-center mb-4">
                        <Calendar className="h-8 w-8 text-black" />
                      </div>
                      <div className="w-full h-px bg-gradient-to-r from-transparent via-black to-transparent mb-6"></div>
                    </div>
                    <h3 className="text-2xl font-bold text-black mb-3">No Upcoming Events</h3>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      New events will appear here automatically.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Calendar */}
            <div className="hidden lg:block lg:w-1/3">
              <div className="sticky top-6">
                <div className="bg-white rounded-lg border-2 border-black overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <div className="bg-black text-white px-4 py-3 border-b-2 border-black">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Event Calendar
                    </h3>
                  </div>
                  <div className="p-1">
                    {isLoading ? <CalendarSkeleton /> : <EventCalendar events={allEvents} onEventClick={handleEventClick} onDateSelect={handleDateSelect} />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Event Detail Modal */}
        <EventModal
          event={selectedEvent}
          isOpen={showEventModal}
          onClose={handleCloseEventModal}
        />
      </FadeIn>

      {/* Toast Notifications */}
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
    </div>
  )
}
