"use client"

import { useState, useEffect } from "react"
import type { Event } from "../types/event-types"
import { EventCalendar } from "../components/events/EventCalendar"
import { EventModal } from "../components/events/EventModal"
import { EventListCard } from "../components/events/EventListCard"
import { AddEventModal } from "../components/events/AddEventModal"
import { EventCardSkeleton, CalendarSkeleton } from "../components/events/LoadingSkeleton"
import { Toast } from "../components/events/Toast"
import { FadeIn } from "../components/FadeIn"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { getEventsAction } from "@/app/actions/events"
import { Plus, Calendar, Sparkles } from "lucide-react"
import { isEventUpcoming } from "../lib/event-utils"

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminAction, setAdminAction] = useState<"add" | "delete">("add")
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [mounted, setMounted] = useState(false)
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
        // Double-check client-side filtering for upcoming events only
        const upcomingEvents = result.events.filter((event) => isEventUpcoming(event))
        setEvents(upcomingEvents)

        if (result.events.length !== upcomingEvents.length) {
          showToast(`Filtered out ${result.events.length - upcomingEvents.length} past events`, "warning")
        }
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
    // Only add if it's an upcoming event
    if (isEventUpcoming(newEvent)) {
      setEvents((prev) => [...prev, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
      showToast("Event added successfully!", "success")
    } else {
      showToast("Event date has passed - not added to upcoming events", "warning")
    }
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

  const handleAddEventClick = () => {
    setAdminAction("add")
    setShowAdminModal(true)
  }

  const handleDeleteEventRequest = (event: Event) => {
    setPendingDeleteEvent(event)
    setAdminAction("delete")
    setShowAdminModal(true)
  }

  const handleAdminVerified = async (password: string) => {
    if (adminAction === "add") {
      setShowAdminModal(false)
      setShowAddModal(true)
    } else if (adminAction === "delete" && pendingDeleteEvent) {
      // Import the delete action here to avoid circular imports
      const { deleteEventAction } = await import("@/app/actions/events")

      try {
        const result = await deleteEventAction(pendingDeleteEvent.id, password)

        if (result.success) {
          handleEventDeleted()
        } else {
          showToast(result.error || "Failed to delete event", "error")
        }
      } catch (error) {
        showToast("An error occurred while deleting the event", "error")
      }

      setShowAdminModal(false)
      setPendingDeleteEvent(null)
    }
  }

  const handleAdminCancelled = () => {
    setShowAdminModal(false)
    setPendingDeleteEvent(null)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FadeIn>
        {/* Enhanced Hero Section */}
        <div className="relative min-h-screen pt-20 sm:pt-24 lg:pt-28 xl:pt-32 pb-8 sm:pb-12 lg:pb-16 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
          {/* Enhanced Dark Background Layers with Depth */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/98 via-gray-800/95 to-black/98"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/30 to-black/40"></div>
            <div className="absolute inset-0 bg-gradient-to-tr from-gray-800/20 via-transparent to-gray-900/20"></div>
            <div className="absolute inset-0 bg-radial-gradient from-gray-700/10 via-transparent to-gray-900/20"></div>
          </div>

          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-[0.08] sm:opacity-[0.12] pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0 sm:bg-[length:140px_140px]"
              style={{
                backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
                backgroundSize: "80px 80px",
                backgroundRepeat: "repeat",
                backgroundPosition: "0 0",
                animation: "float 25s ease-in-out infinite",
                filter: "brightness(1.2) contrast(1.1)",
              }}
            />
          </div>

          {/* Enhanced Floating Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-4 w-24 h-24 sm:w-40 sm:h-40 lg:w-48 lg:h-48 bg-gradient-to-br from-amber-400/20 to-orange-500/30 rounded-full blur-xl sm:blur-2xl animate-float-slow opacity-70"></div>
            <div className="absolute top-1/3 right-4 w-20 h-20 sm:w-32 sm:h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-yellow-400/25 to-amber-500/35 rounded-full blur-lg sm:blur-xl animate-float-slow delay-1000 opacity-60"></div>
            <div className="absolute bottom-1/3 left-1/4 w-16 h-16 sm:w-28 sm:h-28 lg:w-36 lg:h-36 bg-gradient-to-br from-orange-400/20 to-red-500/25 rounded-full blur-md sm:blur-lg animate-float-slow delay-500 opacity-50"></div>
            <div className="absolute bottom-1/4 right-1/3 w-14 h-14 sm:w-24 sm:h-24 lg:w-32 lg:h-32 bg-gradient-to-br from-amber-500/25 to-yellow-400/20 rounded-full blur-sm sm:blur-md animate-float-slow delay-2000 opacity-40"></div>
          </div>

          {/* Perfectly Centered Content Container */}
          <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 sm:px-6">
            <div className="max-w-7xl mx-auto text-center w-full">
              {/* Enhanced Hero Title */}
              <div className="mb-8 sm:mb-12 lg:mb-16 space-y-4 sm:space-y-6 lg:space-y-8">
                <div className="flex items-center justify-center gap-3 sm:gap-6 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
                  <Sparkles className="h-10 w-10 sm:h-16 md:h-20 lg:h-24 xl:h-28 text-amber-400 animate-spin-slow drop-shadow-lg flex-shrink-0" />
                  <div className="text-center">
                    <h1 className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl 2xl:text-[10rem] font-black leading-[0.85] tracking-tight">
                      <span className="inline-block animate-fade-in-up bg-gradient-to-r from-white via-gray-100 to-white bg-clip-text text-transparent drop-shadow-lg">
                        Where Networks
                      </span>
                      <br />
                      <span className="inline-block animate-fade-in-up delay-300 bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
                        Meet Action
                      </span>
                    </h1>
                  </div>
                  <Sparkles className="h-10 w-10 sm:h-16 md:h-20 lg:h-24 xl:h-28 text-amber-400 animate-spin-slow delay-1000 drop-shadow-lg flex-shrink-0" />
                </div>
              </div>

              {/* Enhanced Story Section */}
              <div className="max-w-5xl mx-auto mb-12 sm:mb-16 lg:mb-20 animate-fade-in-up delay-900">
                <p className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl text-gray-200 leading-relaxed font-light px-2 mb-3 sm:mb-4 lg:mb-6 drop-shadow-md">
                  Discover meaningful events that bring communities together. Import events from your favorite platforms
                  or create your own with our intelligent event parser.
                </p>
                <div className="text-sm xs:text-base sm:text-lg md:text-xl lg:text-2xl text-amber-300 font-medium drop-shadow-md">
                  Build connections that matter.
                </div>
              </div>

              {/* Enhanced CTA Section */}
              <div className="animate-fade-in-up delay-1200 mb-8 sm:mb-12 lg:mb-16">
                <button
                  onClick={handleAddEventClick}
                  className="group relative bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900 px-8 xs:px-10 sm:px-16 lg:px-20 py-4 xs:py-5 sm:py-6 lg:py-8 xl:py-10 rounded-full font-black text-lg xs:text-xl sm:text-2xl lg:text-3xl transition-all duration-700 hover:scale-105 sm:hover:scale-110 shadow-2xl hover:shadow-amber-500/30 flex items-center gap-3 xs:gap-4 sm:gap-6 lg:gap-8 mx-auto transform-gpu"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-red-500 opacity-0 group-hover:opacity-20 transition-opacity duration-700 rounded-full"></div>
                  <Plus className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 lg:h-10 lg:w-10 group-hover:rotate-180 transition-transform duration-700 relative z-10 drop-shadow-md flex-shrink-0" />
                  <span className="relative z-10 drop-shadow-md whitespace-nowrap">Start Connecting Events</span>
                  <Sparkles className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 lg:h-9 lg:w-9 text-gray-900 group-hover:text-gray-800 transition-colors duration-700 relative z-10 animate-pulse drop-shadow-md flex-shrink-0" />
                </button>
              </div>
            </div>
          </div>

          {/* Enhanced Wave Transition */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 120" className="w-full h-auto">
              <defs>
                <linearGradient id="sophisticatedWaveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(249, 250, 251)" />
                  <stop offset="25%" stopColor="rgb(248, 250, 252)" />
                  <stop offset="50%" stopColor="rgb(249, 250, 251)" />
                  <stop offset="75%" stopColor="rgb(248, 250, 252)" />
                  <stop offset="100%" stopColor="rgb(249, 250, 251)" />
                </linearGradient>
              </defs>
              <path
                fill="url(#sophisticatedWaveGradient)"
                d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
              ></path>
            </svg>
          </div>
        </div>

        {/* Simplified Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 bg-gray-50 relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent"></div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center animate-fade-in">
              {error}
              <button
                onClick={loadEvents}
                className="ml-4 text-red-600 underline hover:text-red-800 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          <div className="lg:flex lg:gap-8">
            {/* Simplified Left Side - Event List */}
            <div className="lg:w-2/3">
              {/* Clean Header with Button */}
              <div className="mb-8 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                  <div className="flex-1">
                    <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-amber-600" />
                      Upcoming Events
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl">
                      Discover and join events in your area. Connect with your community through meaningful experiences.
                    </p>
                  </div>

                  {/* Add Event Button - Full Width on Mobile */}
                  <div className="w-full sm:w-auto">
                    <button
                      onClick={handleAddEventClick}
                      className="w-full sm:w-auto bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg transform-gpu flex items-center justify-center gap-3 whitespace-nowrap"
                    >
                      <Plus className="h-5 w-5" />
                      Add New Event
                    </button>
                  </div>
                </div>
              </div>

              {/* Event Cards in List View */}
              <div className="space-y-4 sm:space-y-6">
                {isLoading ? (
                  // Loading skeletons with staggered appearance
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                      <EventCardSkeleton />
                    </div>
                  ))
                ) : events.length > 0 ? (
                  events
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((event, index) => (
                      <div
                        key={event.id}
                        className="animate-in slide-in-from-bottom duration-500 transform-gpu"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <EventListCard
                          event={event}
                          onClick={() => handleEventClick(event)}
                          onDeleteRequest={() => handleDeleteEventRequest(event)}
                          className="w-full"
                        />
                      </div>
                    ))
                ) : (
                  // Enhanced empty state
                  <div className="text-center py-16 animate-fade-in">
                    <div className="text-gray-400 mb-6 animate-bounce-slow">
                      <Calendar className="mx-auto h-16 w-16" />
                    </div>
                    <h3 className="text-2xl font-medium text-gray-900 mb-3">No upcoming events</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                      Start building your event community! Import from popular platforms or create custom events.
                    </p>
                    <button
                      onClick={handleAddEventClick}
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8 py-4 rounded-xl font-medium transition-all duration-200 hover:scale-105 transform-gpu flex items-center gap-2 mx-auto"
                    >
                      <Sparkles className="h-5 w-5" />
                      Create Your First Event
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Calendar */}
            <div className="hidden lg:block lg:w-1/3">
              <div className="sticky top-6 animate-fade-in-up delay-300">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                  {isLoading ? <CalendarSkeleton /> : <EventCalendar events={events} onEventClick={handleEventClick} />}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <AdminPasswordModal
          isOpen={showAdminModal}
          onVerified={handleAdminVerified}
          onCancel={handleAdminCancelled}
          action={adminAction === "add" ? "create an event" : "delete this event"}
          itemName={pendingDeleteEvent?.title || ""}
        />

        <AddEventModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onEventAdded={handleEventAdded} />
        <EventModal event={selectedEvent} isOpen={showEventModal} onClose={handleCloseEventModal} />
      </FadeIn>

      {/* Toast Notifications */}
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
    </div>
  )
}
