"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { X, Link, Loader2, Calendar, MapPin, Clock, User, AlertCircle, CheckCircle, Sparkles } from "lucide-react"
import type { Event } from "../../types/event-types"
import { addEventAction } from "@/app/actions/events"

interface AddEventModalProps {
  isOpen: boolean
  onClose: () => void
  onEventAdded: (event: Event) => void
  selectedDate?: Date | null
}

export function AddEventModal({ isOpen, onClose, onEventAdded, selectedDate }: AddEventModalProps) {
  const [isPending, startTransition] = useTransition()
  const [isParsingUrl, setIsParsingUrl] = useState(false)
  const [eventUrl, setEventUrl] = useState("")
  const [manualEntry, setManualEntry] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [parseProgress, setParseProgress] = useState(0)

  const [eventData, setEventData] = useState({
    title: "",
    description: "",
    date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
    time: "",
    location: "",
    organizer: "",
    category: "other" as Event["category"],
    url: "",
    price: "",
    image: "",
    attendees: undefined as number | undefined,
  })

  const handleUrlParse = async () => {
    if (!eventUrl.trim()) return

    setIsParsingUrl(true)
    setError("")
    setParseProgress(0)

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setParseProgress((prev) => Math.min(prev + 10, 90))
    }, 200)

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
        category: result.source === "meetup" ? "meetup" : "other",
      }))

      setSuccess("Event details parsed successfully! ✨")
      setManualEntry(true)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000)
    } catch (error) {
      console.error("Error parsing event:", error)
      setError(error instanceof Error ? error.message : "Failed to parse event URL")
    } finally {
      clearInterval(progressInterval)
      setIsParsingUrl(false)
      setParseProgress(0)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const newEventData: Omit<Event, "id"> = {
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
      source: eventUrl ? (eventUrl.includes("meetup") ? "meetup" : "eventbrite") : "manual",
    }

    startTransition(async () => {
      try {
        const result = await addEventAction(newEventData)

        if (!result.success) {
          throw new Error(result.error)
        }

        onEventAdded(result.event!)
        setSuccess("Event added successfully! 🎉")

        // Reset form after short delay
        setTimeout(() => {
          resetForm()
          onClose()
        }, 1500)
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to add event")
      }
    })
  }

  const resetForm = () => {
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
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">Add New Event</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-gray-100 rounded-md flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center gap-2 animate-in slide-in-from-top duration-300">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-700 text-sm">{success}</span>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 animate-in slide-in-from-top duration-300">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {!manualEntry ? (
            /* URL Input Section */
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Import from Event Platform</h3>
                <p className="text-gray-600 text-sm">
                  Paste a link from Meetup or Eventbrite and we'll automatically extract the event details
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Event URL</label>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="url"
                      placeholder="https://www.meetup.com/your-event or https://www.eventbrite.com/e/your-event"
                      value={eventUrl}
                      onChange={(e) => setEventUrl(e.target.value)}
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    onClick={handleUrlParse}
                    disabled={isParsingUrl || !eventUrl.trim()}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 px-6 py-3 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px] transition-all duration-200 hover:scale-105"
                  >
                    {isParsingUrl ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Parsing...</span>
                      </div>
                    ) : (
                      "Parse Event"
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                {isParsingUrl && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Extracting event details...</span>
                      <span>{parseProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${parseProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Meetup.com</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Eventbrite.com</span>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">or</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setManualEntry(true)}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 text-gray-600 hover:text-purple-600"
              >
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Create Event Manually</span>
                </div>
              </button>
            </div>
          ) : (
            /* Manual Entry Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Title *</label>
                  <input
                    required
                    value={eventData.title}
                    onChange={(e) => setEventData((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter event title"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={eventData.description}
                    onChange={(e) => setEventData((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Event description"
                    rows={3}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      required
                      value={eventData.date}
                      onChange={(e) => setEventData((prev) => ({ ...prev, date: e.target.value }))}
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="time"
                      value={eventData.time}
                      onChange={(e) => setEventData((prev) => ({ ...prev, time: e.target.value }))}
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={eventData.location}
                      onChange={(e) => setEventData((prev) => ({ ...prev, location: e.target.value }))}
                      placeholder="Event location"
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organizer</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      value={eventData.organizer}
                      onChange={(e) => setEventData((prev) => ({ ...prev, organizer: e.target.value }))}
                      placeholder="Event organizer"
                      className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={eventData.category}
                    onChange={(e) =>
                      setEventData((prev) => ({ ...prev, category: e.target.value as Event["category"] }))
                    }
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="other">Other</option>
                    <option value="conference">Conference</option>
                    <option value="workshop">Workshop</option>
                    <option value="meetup">Meetup</option>
                    <option value="networking">Networking</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                  <input
                    value={eventData.price}
                    onChange={(e) => setEventData((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="Free, $25, etc."
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setManualEntry(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  ← Back to URL Import
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg px-4 py-3 disabled:opacity-50 transition-all duration-200 hover:scale-105"
                >
                  {isPending ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Adding Event...</span>
                    </div>
                  ) : (
                    "Add Event"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
