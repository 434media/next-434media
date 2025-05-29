"use client"
import { useState } from "react"
import {
  X,
  Link,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Send,
  Zap,
} from "lucide-react"
import type { Event } from "../../types/event-types"

interface AddEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventAdded: (event: Event) => void
  selectedDate?: Date | null
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

export function AddEventModal({
  isOpen,
  onClose,
  onEventAdded,
  selectedDate,
  isAdminVerified = false,
}: AddEventModalProps) {
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [eventUrl, setEventUrl] = useState("")
  const [manualEntry, setManualEntry] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [parseProgress, setParseProgress] = useState(0)
  const [submitProgress, setSubmitProgress] = useState(0)

  const [eventData, setEventData] = useState<EventFormData>({
    title: "",
    description: "",
    date: selectedDate
      ? new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().split("T")[0]
      : "",
    time: "",
    location: "",
    organizer: "",
    category: "other",
    url: "",
    price: "",
    image: "",
    attendees: undefined,
  })

  const handleUrlParse = async (): Promise<void> => {
    if (!eventUrl.trim()) return

    setIsParsingUrl(true)
    setError("")
    setParseProgress(0)

    // Enhanced progress simulation for better UX
    const progressInterval = setInterval(() => {
      setParseProgress((prev) => Math.min(prev + 8, 90))
    }, 150)

    try {
      const response = await fetch("/api/parse-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: eventUrl }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to parse event")
      }

      setParseProgress(100)

      // Update form with parsed data
      setEventData((prev) => ({
        ...prev,
        title: result.title || prev.title,
        description: result.description || prev.description,
        date: result.date || prev.date,
        time: result.time || prev.time,
        location: result.location || prev.location,
        organizer: result.organizer || prev.organizer,
        url: eventUrl,
        image: result.image || prev.image,
        attendees: result.attendees || prev.attendees,
        category: result.source === "meetup" ? "meetup" : result.source === "luma" ? "networking" : "other",
      }))

      setSuccess("✨ Event details parsed successfully! Review and submit below.")
      setManualEntry(true)

      // Clear success message after 4 seconds
      setTimeout(() => setSuccess(""), 4000)
    } catch (error) {
      console.error("Error parsing event:", error)
      setError(error instanceof Error ? error.message : "Failed to parse event URL")
    } finally {
      clearInterval(progressInterval)
      setIsParsingUrl(false)
      setParseProgress(0)
    }
  }

  const handleSubmit = async (): Promise<void> => {
    if (!isFormValid || !isAdminVerified) return

    setIsSubmitting(true)
    setError("")
    setSubmitProgress(0)

    // Enhanced progress for submission
    const progressInterval = setInterval(() => {
      setSubmitProgress((prev) => Math.min(prev + 12, 90))
    }, 100)

    try {
      // Get admin password from session storage (set during admin verification)
      const adminPassword = sessionStorage.getItem("adminPassword")
      if (!adminPassword) {
        throw new Error("Admin session expired. Please try again.")
      }

      const eventToSubmit: Omit<Event, "id"> = {
        title: eventData.title,
        description: eventData.description || undefined,
        date: eventData.date,
        time: eventData.time || undefined,
        location: eventData.location || undefined,
        organizer: eventData.organizer || undefined,
        category: eventData.category,
        url: eventData.url || eventUrl || undefined,
        price: eventData.price || undefined,
        image: eventData.image || undefined,
        attendees: eventData.attendees,
        source: eventUrl
          ? eventUrl.includes("meetup")
            ? "meetup"
            : eventUrl.includes("eventbrite")
              ? "eventbrite"
              : eventUrl.includes("lu.ma")
                ? "luma"
                : "manual"
          : "manual",
      }

      const { addEventAction } = await import("@/app/actions/events")
      const result = await addEventAction(eventToSubmit, adminPassword)

      setSubmitProgress(100)

      if (!result.success) {
        throw new Error(result.error || "Failed to add event")
      }

      // Success! 🎉
      setSuccess("🎉 Event created successfully! Welcome to the community!")
      onEventAdded(result.event!)

      // Auto-close after celebration
      setTimeout(() => {
        resetForm()
        onClose()
      }, 2000)
    } catch (error) {
      console.error("Error submitting event:", error)
      setError(error instanceof Error ? error.message : "Failed to create event")
    } finally {
      clearInterval(progressInterval)
      setIsSubmitting(false)
      setSubmitProgress(0)
    }
  }

  const resetForm = (): void => {
    setEventUrl("")
    setEventData({
      title: "",
      description: "",
      date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
      time: "",
      location: "",
      organizer: "",
      category: "other",
      url: "",
      price: "",
      image: "",
      attendees: undefined,
    })
    setManualEntry(false)
    setError("")
    setSuccess("")
    setSubmitProgress(0)
    setParseProgress(0)
  }

  const handleClose = (): void => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  const isFormValid = eventData.title.trim() !== "" && eventData.date !== ""

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-500 scale-100 animate-in slide-in-from-bottom">
        {/* Enhanced Header with Gradient */}
        <div className="relative flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="h-7 w-7 text-amber-600 animate-pulse" />
              <div className="absolute inset-0 h-7 w-7 text-amber-400 animate-ping opacity-20">
                <Sparkles className="h-7 w-7" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Where Events Create Impact</h2>
              <p className="text-sm text-amber-700 font-medium">
                {isAdminVerified ? "✅ Admin verified - Ready to create!" : "Import or create manually"}
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
          {/* Enhanced Success Message */}
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

          {/* Enhanced Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
              <AlertCircle className="h-5 w-5 text-red-500 animate-pulse" />
              <span className="text-red-800 font-medium">{error}</span>
            </div>
          )}

          {!manualEntry ? (
            /* Enhanced URL Input Section */
            <div className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-2 rounded-full mb-4">
                  <Zap className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Smart Event Import</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Import from Event Platform</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-md mx-auto">
                  Paste a link from Meetup, Eventbrite, or Lu.ma and we'll automatically extract all the event details
                  for you
                </p>
              </div>

              <div className="space-y-4">
                <label htmlFor="event-url" className="block text-sm font-semibold text-gray-700">
                  Event URL
                </label>
                <div className="flex space-x-3">
                  <div className="relative flex-1">
                    <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="event-url"
                      type="url"
                      placeholder="https://www.meetup.com/your-event..."
                      value={eventUrl}
                      onChange={(e) => setEventUrl(e.target.value)}
                      className="pl-12 w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleUrlParse}
                    disabled={isParsingUrl || !eventUrl.trim()}
                    className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 px-8 py-4 rounded-xl text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] transition-all duration-200 hover:scale-105 transform-gpu shadow-lg"
                  >
                    {isParsingUrl ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Parsing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        <span>Parse</span>
                      </div>
                    )}
                  </button>
                </div>

                {/* Enhanced Progress Bar */}
                {isParsingUrl && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium text-gray-600">
                      <span>🔍 Extracting event details...</span>
                      <span>{parseProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-3 rounded-full transition-all duration-300 relative"
                        style={{ width: `${parseProgress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Enhanced Platform Indicators */}
                <div className="flex items-center justify-center gap-6 text-xs text-gray-500 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">Meetup.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-red-500 rounded-full animate-pulse delay-200"></div>
                    <span className="font-medium">Eventbrite.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full animate-pulse delay-400"></div>
                    <span className="font-medium">Lu.ma</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-6 bg-white text-gray-500 font-medium">or</span>
                </div>
              </div>

              {/* Enhanced Manual Entry Button */}
              <button
                onClick={() => setManualEntry(true)}
                className="w-full px-6 py-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-amber-400 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 transition-all duration-300 text-gray-600 hover:text-amber-700 group"
              >
                <div className="flex items-center justify-center gap-3">
                  <Calendar className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
                  <span className="font-semibold">Create Event Manually</span>
                  <Sparkles className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </button>
            </div>
          ) : (
            /* Enhanced Manual Entry Form */
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all duration-200"
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
                      className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="event-time" className="block text-sm font-semibold text-gray-700 mb-2">
                    Time <span className="text-xs text-gray-500 font-normal">(Central Time)</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="event-time"
                      type="time"
                      value={eventData.time}
                      onChange={(e) => setEventData((prev) => ({ ...prev, time: e.target.value }))}
                      className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>

                  {/* Quick Time Buttons */}
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {["09:00", "12:00", "17:00", "18:00", "19:00"].map((timeOption) => (
                      <button
                        key={timeOption}
                        type="button"
                        onClick={() => setEventData((prev) => ({ ...prev, time: timeOption }))}
                        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-amber-100 text-gray-600 hover:text-amber-700 rounded-lg transition-all duration-200 font-medium hover:scale-105"
                      >
                        {(() => {
                          const [hours, minutes] = timeOption.split(":")
                          const hour = Number.parseInt(hours)
                          const ampm = hour >= 12 ? "PM" : "AM"
                          const displayHour = hour % 12 || 12
                          return `${displayHour}:${minutes} ${ampm}`
                        })()}
                      </button>
                    ))}
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
                      className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
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
                      className="pl-12 w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
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
                    onChange={(e) =>
                      setEventData((prev) => ({ ...prev, category: e.target.value as Event["category"] }))
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t-2 border-gray-100">
                <button
                  type="button"
                  onClick={() => setManualEntry(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold text-gray-700 hover:border-gray-400"
                >
                  ← Back to URL Import
                </button>

                {/* Enhanced Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={!isFormValid || !isAdminVerified || isSubmitting}
                  className="flex-1 relative bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-3 rounded-xl font-bold transition-all duration-200 hover:scale-105 transform-gpu shadow-lg disabled:cursor-not-allowed disabled:scale-100 overflow-hidden"
                >
                  {/* Submit Progress Bar */}
                  {isSubmitting && (
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${submitProgress}%` }}
                    />
                  )}

                  <div className="relative flex items-center justify-center gap-3">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Creating Event... {submitProgress}%</span>
                      </>
                    ) : isFormValid && isAdminVerified ? (
                      <>
                        <Send className="h-5 w-5" />
                        <span>Create Event</span>
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
          )}
        </div>
      </div>
    </div>
  )
}
