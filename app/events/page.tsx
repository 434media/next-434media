"use client"

import { useState, useEffect } from "react"
import type { Event } from "../types/event-types"
import { EventCalendar } from "../components/events/EventCalendar"
import { EventModal } from "../components/events/EventModal"
import { EventListCard } from "../components/events/EventListCard"
import { AddEventModal } from "../components/events/AddEventModal"
import { EditEventModal } from "../components/events/EditEventModal"
import { EventCardSkeleton, CalendarSkeleton } from "../components/events/LoadingSkeleton"
import { Toast } from "../components/events/Toast"
import { FadeIn } from "../components/FadeIn"
import AdminPasswordModal from "../components/AdminPasswordModal"
import { getEventsAction } from "@/app/actions/events"
import { Plus, Calendar } from "lucide-react"
import { isEventUpcoming } from "../lib/event-utils"

export default function EventsPage() {
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminAction, setAdminAction] = useState<"add" | "delete" | "edit">("add")
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

  // Filter events on client side when allEvents changes
  useEffect(() => {
    if (mounted && allEvents.length > 0) {
      // Client-side filtering using local timezone
      const upcomingEvents = allEvents.filter((event) => isEventUpcoming(event))
      setEvents(upcomingEvents)

      // Remove this entire block that shows the toast message:
      // if (allEvents.length !== upcomingEvents.length) {
      //   const pastCount = allEvents.length - upcomingEvents.length
      //   if (pastCount > 0) {
      //     showToast(`Filtered out ${pastCount} past events`, "warning")
      //   }
      // }
    }
  }, [allEvents, mounted])

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

  const handleAddEventClick = () => {
    setAdminAction("add")
    setShowAdminModal(true)
  }

  const handleDeleteEventRequest = (event: Event) => {
    setPendingDeleteEvent(event)
    setAdminAction("delete")
    setShowAdminModal(true)
  }

  const handleEditEventRequest = (event: Event) => {
    setEditingEvent(event)
    setAdminAction("edit")
    setShowAdminModal(true)
  }

  const handleEventUpdated = (updatedEvent: Event) => {
    setAllEvents((prev) => prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event)))
    showToast("Event updated successfully!", "success")
  }

  const handleAdminVerified = async (password: string) => {
    // Store admin password in session storage for the modal to use
    sessionStorage.setItem("adminPassword", password)

    if (adminAction === "add") {
      setShowAdminModal(false)
      setShowAddModal(true)
    } else if (adminAction === "edit" && editingEvent) {
      setShowAdminModal(false)
      setShowEditModal(true)
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
    setEditingEvent(null)
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      <FadeIn>
        <div className="relative pt-28 pb-16 md:pt-40 md:pb-32 bg-black text-white overflow-hidden">
          {/* Subtle Background Pattern */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" aria-hidden="true">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('https://ampd-asset.s3.us-east-2.amazonaws.com/434MediaICONWHITE.png')`,
                backgroundSize: "60px 60px",
                backgroundRepeat: "repeat",
                backgroundPosition: "0 0",
              }}
            />
          </div>

          {/* Content Container */}
          <div className="relative z-10 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="mb-6 sm:mb-8">
                <h4
                  className="text-white font-medium text-sm inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Build connections that matter</span>
                </h4>
              </div>

              {/* Hero Title */}
              <div className="mb-6 sm:mb-8">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight mb-3 sm:mb-4">
                  <span className="text-white">Where Networks</span>
                  <br />
                  <span className="text-white">Meet Action</span>
                </h1>
              </div>

              {/* Description */}
              <div className="mb-8 sm:mb-10">
                <p className="text-xl text-gray-300 leading-relaxed mb-2">
                  Discover meaningful events that bring communities together.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 bg-white relative">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm text-center">
              {error}
              <button
                onClick={loadEvents}
                className="ml-3 text-red-600 underline hover:text-red-800 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          <div className="lg:flex lg:gap-6">
            {/* Left Side - Event List */}
            <div className="lg:w-2/3">
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                  <div className="flex-1">
                    <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Calendar className="h-6 w-6 text-gray-900" />
                      Upcoming Events
                    </h2>
                    <p className="text-base text-gray-600">
                      Discover and join events in your area. Connect with your community through meaningful experiences.
                    </p>
                  </div>

                  <div className="w-full sm:w-auto">
                    <button
                      onClick={handleAddEventClick}
                      className="w-full sm:w-auto bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Event
                    </button>
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
                          onDeleteRequest={() => handleDeleteEventRequest(event)}
                          onEditRequest={() => handleEditEventRequest(event)}
                          className="w-full"
                        />
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-4">
                      <Calendar className="mx-auto h-12 w-12" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No upcoming events</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto text-sm">
                      Start building your event community! Import from popular platforms or create custom events.
                    </p>
                    <button
                      onClick={handleAddEventClick}
                      className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg font-medium transition-colors duration-200 inline-flex items-center gap-2 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      Create Your First Event
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Calendar */}
            <div className="hidden lg:block lg:w-1/3">
              <div className="sticky top-6">
                <div className="bg-white rounded-xl overflow-hidden">
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
          action={
            adminAction === "add" ? "create an event" : adminAction === "edit" ? "edit this event" : "delete this event"
          }
          itemName={pendingDeleteEvent?.title || editingEvent?.title || ""}
        />

        <AddEventModal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false)
            sessionStorage.removeItem("adminPassword")
          }}
          onEventAdded={handleEventAdded}
          isAdminVerified={true}
        />

        <EventModal
          event={selectedEvent}
          isOpen={showEventModal}
          onClose={handleCloseEventModal}
          onEditRequest={handleEditEventRequest}
          onDeleteRequest={handleDeleteEventRequest}
        />

        <EditEventModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setEditingEvent(null)
            sessionStorage.removeItem("adminPassword")
          }}
          onEventUpdated={handleEventUpdated}
          event={editingEvent}
          isAdminVerified={true}
        />
      </FadeIn>

      {/* Toast Notifications */}
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />
    </div>
  )
}
