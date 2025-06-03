"use client"
import { useState, useEffect } from "react"
import {
  X,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Save,
  Link,
  ImageIcon,
} from "lucide-react"
import type { Event } from "../../types/event-types"

interface EditEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventUpdated: (event: Event) => void
  event: Event | null
  isAdminVerified?: boolean
}

interface EventFormData {
  title: string
  description: string
  date: string
  time: string
  location: string
  organizer: string
  category: Event["category"]
  url: string
  price: string
  image: string
  attendees: number | undefined
}

export function EditEventModal({
  isOpen,
  onClose,
  onEventUpdated,
  event,
  isAdminVerified = false,
}: EditEventModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [submitProgress, setSubmitProgress] = useState(0)

  const [eventData, setEventData] = useState<EventFormData>({
    title: "",
    description: "",
    date: "",
    time: "",
    location: "",
    organizer: "",
    category: "other",
    url: "",
    price: "",
    image: "",
    attendees: undefined,
  })

  // Populate form when event changes
  useEffect(() => {
    if (event) {
      setEventData({
        title: event.title || "",
        description: event.description || "",
        date: event.date || "",
        time: event.time || "",
        location: event.location || "",
        organizer: event.organizer || "",
        category: event.category || "other",
        url: event.url || "",
        price: event.price || "",
        image: event.image || "",
        attendees: event.attendees,
      })
    }
  }, [event])

  const handleSubmit = async (): Promise<void> => {
    if (!isFormValid || !isAdminVerified || !event) return

    setIsSubmitting(true)
    setError("")
    setSubmitProgress(0)

    const progressInterval = setInterval(() => {
      setSubmitProgress((prev) => Math.min(prev + 12, 90))
    }, 100)

    try {
      const adminPassword = sessionStorage.getItem("adminPassword")
      if (!adminPassword) {
        throw new Error("Admin session expired. Please try again.")
      }

      const updatedEvent: Event = {
        ...event,
        title: eventData.title,
        description: eventData.description || undefined,
        date: eventData.date,
        time: eventData.time || undefined,
        location: eventData.location || undefined,
        organizer: eventData.organizer || undefined,
        category: eventData.category,
        url: eventData.url || undefined,
        price: eventData.price || undefined,
        image: eventData.image || undefined,
        attendees: eventData.attendees,
        updated_at: new Date().toISOString(),
      }

      const { updateEventAction } = await import("@/app/actions/events")

      // Fix: Pass the event ID as string and the updated event data separately
      const result = await updateEventAction(event.id, updatedEvent)

      setSubmitProgress(100)

      if (!result.success) {
        throw new Error(result.error || "Failed to update event")
      }

      setSuccess("🎉 Event updated successfully!")
      onEventUpdated(result.event!)

      setTimeout(() => {
        resetForm()
        onClose()
      }, 2000)
    } catch (error) {
      console.error("Error updating event:", error)
      setError(error instanceof Error ? error.message : "Failed to update event")
    } finally {
      clearInterval(progressInterval)
      setIsSubmitting(false)
      setSubmitProgress(0)
    }
  }

  const resetForm = (): void => {
    setError("")
    setSuccess("")
    setSubmitProgress(0)
  }

  const handleClose = (): void => {
    resetForm()
    onClose()
  }

  if (!isOpen || !event) return null

  const isFormValid = eventData.title.trim() !== "" && eventData.date !== ""

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-500 scale-100 animate-in slide-in-from-bottom">
        {/* Enhanced Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="h-7 w-7 text-blue-600 animate-pulse" />
              <div className="absolute inset-0 h-7 w-7 text-blue-400 animate-ping opacity-20">
                <Sparkles className="h-7 w-7" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Edit Event</h2>
              <p className="text-sm text-blue-700 font-medium">
                {isAdminVerified ? "✅ Admin verified - Ready to edit!" : "Admin verification required"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-10 w-10 hover:bg-gray-100 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
              <div className="relative">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <div className="absolute inset-0 h-6 w-6 text-green-300 animate-ping opacity-30">
                  <CheckCircle className="h-6 w-6" />
                </div>
              </div>
              <span className="text-green-800 font-medium">{success}</span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
              <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          )}

          {/* Edit Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="event-title" className="block text-sm font-semibold text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  id="event-title"
                  required
                  value={eventData.title}
                  onChange={(e) => setEventData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter an amazing event title"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="event-description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="event-description"
                  value={eventData.description}
                  onChange={(e) => setEventData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Tell people what makes this event special..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200"
                />
              </div>

              <div>
                <label htmlFor="event-date" className="block text-sm font-semibold text-gray-700 mb-2">
                  Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-date"
                    type="date"
                    required
                    value={eventData.date}
                    onChange={(e) => setEventData((prev) => ({ ...prev, date: e.target.value }))}
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="event-time" className="block text-sm font-semibold text-gray-700 mb-2">
                  Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-time"
                    type="time"
                    value={eventData.time}
                    onChange={(e) => setEventData((prev) => ({ ...prev, time: e.target.value }))}
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="event-location" className="block text-sm font-semibold text-gray-700 mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-location"
                    value={eventData.location}
                    onChange={(e) => setEventData((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Where will this happen?"
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="event-organizer" className="block text-sm font-semibold text-gray-700 mb-2">
                  Organizer
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-organizer"
                    value={eventData.organizer}
                    onChange={(e) => setEventData((prev) => ({ ...prev, organizer: e.target.value }))}
                    placeholder="Who's organizing this?"
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="event-category" className="block text-sm font-semibold text-gray-700 mb-2">
                  Category
                </label>
                <select
                  id="event-category"
                  value={eventData.category}
                  onChange={(e) => setEventData((prev) => ({ ...prev, category: e.target.value as Event["category"] }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="other">Other</option>
                  <option value="conference">Conference</option>
                  <option value="workshop">Workshop</option>
                  <option value="meetup">Meetup</option>
                  <option value="networking">Networking</option>
                </select>
              </div>

              <div>
                <label htmlFor="event-price" className="block text-sm font-semibold text-gray-700 mb-2">
                  Price
                </label>
                <input
                  id="event-price"
                  value={eventData.price}
                  onChange={(e) => setEventData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="Free, $25, etc."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="event-url" className="block text-sm font-semibold text-gray-700 mb-2">
                  Event URL
                </label>
                <div className="relative">
                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-url"
                    type="url"
                    value={eventData.url}
                    onChange={(e) => setEventData((prev) => ({ ...prev, url: e.target.value }))}
                    placeholder="https://example.com/event"
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="event-image" className="block text-sm font-semibold text-gray-700 mb-2">
                  Event Image URL
                </label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="event-image"
                    type="url"
                    value={eventData.image}
                    onChange={(e) => setEventData((prev) => ({ ...prev, image: e.target.value }))}
                    placeholder="https://example.com/image.jpg"
                    className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t-2 border-gray-100">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-gray-700 hover:border-gray-400"
              >
                Cancel
              </button>

              <button
                onClick={handleSubmit}
                disabled={!isFormValid || !isAdminVerified || isSubmitting}
                className="flex-1 relative bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3 rounded-xl font-bold transition-all duration-200 hover:scale-105 transform-gpu shadow-lg disabled:cursor-not-allowed disabled:scale-100 overflow-hidden"
              >
                {isSubmitting && (
                  <div
                    className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-300"
                    style={{ width: `${submitProgress}%` }}
                  />
                )}

                <div className="relative flex items-center justify-center gap-3">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Updating... {submitProgress}%</span>
                    </>
                  ) : isFormValid && isAdminVerified ? (
                    <>
                      <Save className="h-5 w-5" />
                      <span>Update Event</span>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5" />
                      <span>{!isFormValid ? "Complete Required Fields" : "Admin Verification Required"}</span>
                    </>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
