"use client"

import { useState, useEffect } from "react"
import type { Event } from "../types/event-types"
import { EventCalendar } from "../components/events/EventCalendar"
import { EventListCard } from "../components/events/EventListCard"
import { EventModal } from "../components/events/EventModal"
import { AddEventModal } from "../components/events/AddEventModal"
import { EventCardSkeleton, CalendarSkeleton } from "../components/events/LoadingSkeleton"
import { Toast } from "../components/events/Toast"
import { FadeIn } from "../components/FadeIn"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { getEventsAction } from "@/app/actions/events"
import { Plus, Calendar, Sparkles } from "lucide-react"

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
        setEvents(result.events)
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
    setEvents((prev) => [...prev, newEvent].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
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
        {/* Viewport-Optimized Hero Section */}
        <div className="relative h-screen max-h-[900px] min-h-[600px] pt-16 sm:pt-20 bg-gradient-to-br from-purple-600 via-purple-700 to-blue-600 text-white overflow-hidden">
          {/* Enhanced Background Layers with Depth */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/95 via-blue-600/90 to-purple-600/95"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-800/20 to-blue-900/30"></div>
            <div className="absolute inset-0 bg-radial-gradient from-transparent via-purple-500/10 to-transparent"></div>
          </div>

          {/* Refined 434 Media Logo Pattern */}
          <div className="absolute inset-0 opacity-[0.04] sm:opacity-[0.06] pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0 sm:bg-[length:140px_140px]"
              style={{
                backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
                backgroundSize: "80px 80px",
                backgroundRepeat: "repeat",
                backgroundPosition: "0 0",
                animation: "float 25s ease-in-out infinite",
              }}
            />
          </div>

          {/* Sophisticated Floating Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Primary floating orbs with enhanced gradients */}
            <div className="absolute top-1/4 left-4 w-24 h-24 sm:w-40 sm:h-40 bg-gradient-to-br from-white/15 to-yellow-300/25 rounded-full blur-xl sm:blur-2xl animate-float-slow opacity-80"></div>
            <div className="absolute top-1/3 right-4 w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-br from-purple-300/25 to-blue-300/35 rounded-full blur-lg sm:blur-xl animate-float-slow delay-1000 opacity-70"></div>
            <div className="absolute bottom-1/3 left-1/4 w-16 h-16 sm:w-28 sm:h-28 bg-gradient-to-br from-yellow-300/20 to-white/15 rounded-full blur-md sm:blur-lg animate-float-slow delay-500 opacity-60"></div>
            <div className="absolute bottom-1/4 right-1/3 w-14 h-14 sm:w-24 sm:h-24 bg-gradient-to-br from-blue-300/25 to-purple-300/20 rounded-full blur-sm sm:blur-md animate-float-slow delay-2000 opacity-50"></div>

            {/* Secondary accent elements with staggered animations */}
            <div className="hidden xs:block absolute top-20 right-1/4 w-12 h-12 sm:w-16 sm:h-16 bg-yellow-300/30 rounded-full blur-sm animate-pulse delay-300 opacity-40"></div>
            <div className="hidden xs:block absolute bottom-20 left-1/3 w-8 h-8 sm:w-12 sm:h-12 bg-white/25 rounded-full blur-sm animate-pulse delay-700 opacity-30"></div>

            {/* Additional depth elements */}
            <div className="hidden sm:block absolute top-1/2 left-1/6 w-6 h-6 bg-purple-200/20 rounded-full blur-sm animate-pulse delay-1500 opacity-25"></div>
            <div className="hidden sm:block absolute top-3/4 right-1/6 w-4 h-4 bg-yellow-200/15 rounded-full blur-sm animate-pulse delay-2500 opacity-20"></div>
          </div>

          {/* Perfectly Centered Content Container */}
          <div className="relative z-10 flex items-center justify-center h-full px-4 sm:px-6">
            <div className="max-w-6xl mx-auto text-center">
              {/* Refined Hero Title with Better Spacing */}
              <div className="mt-8 mb-6 sm:mb-8 lg:mb-10 space-y-3 sm:space-y-4 lg:space-y-6">
                <div className="flex items-center justify-center gap-3 sm:gap-6 mb-4 sm:mb-6 lg:mb-8">
                  <Sparkles className="h-8 w-8 sm:h-12 md:h-14 text-yellow-300 animate-spin-slow" />
                  <div className="text-center">
                    <h1 className="text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black leading-[0.9] tracking-tight">
                      <span className="inline-block animate-fade-in-up bg-gradient-to-r from-white via-yellow-100 to-white bg-clip-text text-transparent drop-shadow-sm">
                        Where Networks
                      </span>
                      <br />
                      <span className="inline-block animate-fade-in-up delay-300 bg-gradient-to-r from-yellow-300 via-yellow-100 to-yellow-300 bg-clip-text text-transparent drop-shadow-sm">
                        Meet Action
                      </span>
                    </h1>
                    <div className="mt-2 sm:mt-4 lg:mt-6">
                      <span className="text-lg xs:text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-yellow-300 inline-block animate-fade-in-up delay-600 drop-shadow-lg">
                        Where Events Create Impact
                      </span>
                    </div>
                  </div>
                  <Sparkles className="h-8 w-8 sm:h-12 md:h-14 text-yellow-300 animate-spin-slow delay-1000" />
                </div>
              </div>

              {/* Optimized Story Section */}
              <div className="max-w-4xl mx-auto mb-8 animate-fade-in-up delay-900">
                <p className="text-base xs:text-lg sm:text-xl md:text-2xl lg:text-3xl text-purple-100 leading-relaxed font-light px-2 mb-3 sm:mb-4 lg:mb-6">
                  Discover meaningful events that bring communities together. Import events from your favorite platforms
                  or create your own with our intelligent event parser.
                </p>
                <div className="text-sm xs:text-base sm:text-lg md:text-xl text-yellow-200 font-medium">
                  Build connections that matter.
                </div>
              </div>

              {/* Enhanced CTA Section with Better Proportions */}
              <div className="animate-fade-in-up delay-1200 md:mb-16">
                <button
                  onClick={handleAddEventClick}
                  className="group relative bg-white text-purple-600 px-8 xs:px-10 sm:px-16 py-4 xs:py-5 sm:py-6 lg:py-8 rounded-full font-black text-lg xs:text-xl sm:text-2xl hover:bg-purple-50 transition-all duration-700 hover:scale-105 sm:hover:scale-110 shadow-2xl hover:shadow-purple-500/30 flex items-center gap-3 xs:gap-4 sm:gap-6 mx-auto overflow-hidden transform-gpu"
                >
                  {/* Enhanced Animated Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-purple-600 opacity-0 group-hover:opacity-15 transition-opacity duration-700 rounded-full"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-full scale-110"></div>

                  <Plus className="h-6 w-6 xs:h-7 xs:w-7 sm:h-8 sm:w-8 group-hover:rotate-180 transition-transform duration-700 relative z-10" />
                  <span className="relative z-10">Start Connecting Events</span>
                  <Sparkles className="h-5 w-5 xs:h-6 xs:w-6 sm:h-7 sm:w-7 text-purple-600 group-hover:text-yellow-500 transition-colors duration-700 relative z-10 animate-pulse" />

                  {/* Enhanced Ripple Effect */}
                  <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-30 group-hover:scale-150 transition-all duration-1000"></div>
                  <div className="absolute inset-0 rounded-full bg-yellow-300 opacity-0 group-hover:opacity-20 group-hover:scale-125 transition-all duration-800 delay-100"></div>
                </button>
              </div>
            </div>
          </div>

          {/* Seamless Wave Transition with Enhanced Gradient */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg viewBox="0 0 1440 120" className="w-full h-auto drop-shadow-sm">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(249, 250, 251)" />
                  <stop offset="25%" stopColor="rgb(248, 250, 252)" />
                  <stop offset="50%" stopColor="rgb(249, 250, 251)" />
                  <stop offset="75%" stopColor="rgb(248, 250, 252)" />
                  <stop offset="100%" stopColor="rgb(249, 250, 251)" />
                </linearGradient>
              </defs>
              <path
                fill="url(#waveGradient)"
                d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,64C960,75,1056,85,1152,80C1248,75,1344,53,1392,42.7L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
              ></path>
            </svg>
          </div>
        </div>


        {/* Refined Main Content with Better Flow */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 bg-gray-50 relative">
          {/* Subtle top border for visual separation */}
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
            {/* Enhanced Left Side - Event List */}
            <div className="lg:w-2/3">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in-up">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                    Upcoming Events
                    {!isLoading && (
                      <span className="text-sm font-normal text-gray-500 ml-2 animate-fade-in delay-300">
                        ({events.length} event{events.length !== 1 ? "s" : ""})
                      </span>
                    )}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Discover and join events in your area. Click on any event to see full details.
                  </p>
                </div>

                <button
                  onClick={handleAddEventClick}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 shadow-lg w-full sm:w-auto justify-center transform-gpu"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Event</span>
                </button>
              </div>

              {/* Enhanced Event Cards with Staggered Animation */}
              <div className="space-y-4">
                {isLoading ? (
                  // Loading skeletons with staggered appearance
                  Array.from({ length: 3 }).map((_, i) => (
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
                        />
                      </div>
                    ))
                ) : (
                  // Enhanced empty state
                  <div className="text-center py-12 sm:py-16 animate-fade-in">
                    <div className="text-gray-400 mb-4 animate-bounce-slow">
                      <Calendar className="mx-auto h-12 w-12 sm:h-16 sm:w-16" />
                    </div>
                    <h3 className="text-lg sm:text-xl font-medium text-gray-900 mb-2">No events yet</h3>
                    <p className="text-sm sm:text-base text-gray-500 mb-6 px-4">
                      Start by adding your first event. You can import from Meetup or Eventbrite, or create one
                      manually.
                    </p>
                    <button
                      onClick={handleAddEventClick}
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:scale-105 transform-gpu"
                    >
                      Add Your First Event
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Enhanced Right Side - Calendar */}
            <div className="hidden lg:block lg:w-1/3">
              <div className="sticky top-6 animate-fade-in-up delay-300">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                  {isLoading ? (
                    <CalendarSkeleton />
                  ) : (
                    <EventCalendar events={events} onAddEvent={handleEventAdded} onEventClick={handleEventClick} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Modals */}
        <AdminPasswordModal
          isOpen={showAdminModal}
          onVerified={handleAdminVerified}
          onCancel={handleAdminCancelled}
          action={adminAction === "add" ? "create an event" : "delete this event"}
          itemName={pendingDeleteEvent?.title}
        />

        <AddEventModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onEventAdded={handleEventAdded} />
        <EventModal event={selectedEvent} isOpen={showEventModal} onClose={handleCloseEventModal} />

        {/* Toast Notifications */}
        <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
      </FadeIn>
    </div>
  )
}
