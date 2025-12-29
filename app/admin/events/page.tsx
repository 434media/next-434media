"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save,
  X,
  Loader2,
  Calendar,
  MapPin,
  Clock,
  Link2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Globe,
  Sparkles,
  Image as ImageIcon,
  Users,
  DollarSign
} from "lucide-react"
import { ImageUpload } from "../../components/ImageUpload"
import DOMPurify from "isomorphic-dompurify"

// Event categories
const EVENT_CATEGORIES = [
  "Networking",
  "Workshop",
  "Conference",
  "Meetup",
  "Webinar",
  "Hackathon",
  "Social",
  "Panel",
  "Launch Party",
  "Other"
]

interface Event {
  id: string
  title: string
  description: string
  start_date: string
  end_date?: string
  start_time?: string
  end_time?: string
  location: string
  venue_name?: string
  venue_address?: string
  image_url?: string
  event_url?: string
  source?: string
  category: string
  organizer?: string
  is_virtual: boolean
  is_free: boolean
  price?: string
  status: "upcoming" | "past" | "cancelled"
  created_at: string
  updated_at: string
}

interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

interface ParsedEventData {
  title?: string
  description?: string
  start_date?: string
  end_date?: string
  start_time?: string
  end_time?: string
  location?: string
  venue_name?: string
  image_url?: string
  event_url?: string
  organizer?: string
  is_virtual?: boolean
  is_free?: boolean
  price?: string
}

export default function EventsAdminPage() {
  // State
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  
  // View state
  const [view, setView] = useState<"list" | "edit" | "create">("list")
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [createMethod, setCreateMethod] = useState<"manual" | "parse">("manual")
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "past">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  
  // Parse URL state
  const [parseUrl, setParseUrl] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    location: "",
    venue_name: "",
    venue_address: "",
    image_url: "",
    event_url: "",
    category: "Networking",
    organizer: "",
    is_virtual: false,
    is_free: true,
    price: "",
    status: "upcoming" as "upcoming" | "past" | "cancelled"
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Load events on mount
  useEffect(() => {
    loadEvents()
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadEvents = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/events")
      if (!response.ok) throw new Error("Failed to fetch events")
      const data = await response.json()
      setEvents(data.events || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      location: "",
      venue_name: "",
      venue_address: "",
      image_url: "",
      event_url: "",
      category: "Networking",
      organizer: "",
      is_virtual: false,
      is_free: true,
      price: "",
      status: "upcoming"
    })
    setParseUrl("")
    setParseError(null)
    setSelectedEvent(null)
    setCreateMethod("manual")
  }

  const handleCreateNew = () => {
    resetForm()
    setView("create")
  }

  const handleEdit = (event: Event) => {
    setSelectedEvent(event)
    setFormData({
      title: event.title,
      description: event.description,
      start_date: event.start_date,
      end_date: event.end_date || "",
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      location: event.location,
      venue_name: event.venue_name || "",
      venue_address: event.venue_address || "",
      image_url: event.image_url || "",
      event_url: event.event_url || "",
      category: event.category,
      organizer: event.organizer || "",
      is_virtual: event.is_virtual,
      is_free: event.is_free,
      price: event.price || "",
      status: event.status
    })
    setView("edit")
  }

  const handleParseUrl = async () => {
    if (!parseUrl.trim()) {
      setParseError("Please enter a URL")
      return
    }

    // Validate URL format
    const urlPattern = /^https?:\/\/(www\.)?(meetup\.com|eventbrite\.com|lu\.ma)/i
    if (!urlPattern.test(parseUrl)) {
      setParseError("Only Meetup, Eventbrite, and Lu.ma URLs are supported")
      return
    }

    setIsParsing(true)
    setParseError(null)
    try {
      const response = await fetch("/api/parse-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: parseUrl })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to parse event URL")
      }

      const parsed: ParsedEventData = await response.json()
      
      // Populate form with parsed data
      setFormData(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        description: parsed.description || prev.description,
        start_date: parsed.start_date || prev.start_date,
        end_date: parsed.end_date || prev.end_date,
        start_time: parsed.start_time || prev.start_time,
        end_time: parsed.end_time || prev.end_time,
        location: parsed.location || prev.location,
        venue_name: parsed.venue_name || prev.venue_name,
        image_url: parsed.image_url || prev.image_url,
        event_url: parsed.event_url || parseUrl,
        organizer: parsed.organizer || prev.organizer,
        is_virtual: parsed.is_virtual ?? prev.is_virtual,
        is_free: parsed.is_free ?? prev.is_free,
        price: parsed.price || prev.price
      }))

      setToast({ message: "Event details parsed successfully! Review and save.", type: "success" })
      setCreateMethod("manual") // Switch to manual editing after parsing
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse URL")
    } finally {
      setIsParsing(false)
    }
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      setToast({ message: "Title is required", type: "error" })
      return
    }
    if (!formData.start_date) {
      setToast({ message: "Start date is required", type: "error" })
      return
    }
    if (!formData.location.trim()) {
      setToast({ message: "Location is required", type: "error" })
      return
    }

    setIsSaving(true)
    try {
      // Sanitize description to prevent XSS
      const sanitizedDescription = DOMPurify.sanitize(formData.description, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
        ALLOWED_ATTR: ['href', 'target', 'rel']
      })

      const payload = {
        ...formData,
        description: sanitizedDescription
      }

      let response: Response
      if (view === "edit" && selectedEvent) {
        response = await fetch(`/api/admin/events/${selectedEvent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } else {
        response = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save event")
      }

      setToast({ 
        message: view === "edit" ? "Event updated successfully" : "Event created successfully", 
        type: "success" 
      })
      await loadEvents()
      setView("list")
      resetForm()
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : "Failed to save event", 
        type: "error" 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete event")

      setToast({ message: "Event deleted successfully", type: "success" })
      await loadEvents()
      setDeleteConfirmId(null)
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : "Failed to delete event", 
        type: "error" 
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter events
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || event.status === statusFilter
    const matchesCategory = categoryFilter === "all" || event.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  // Sort events by date
  const sortedEvents = [...filteredEvents].sort((a, b) => 
    new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )

  // Format date for display
  const formatEventDate = (dateStr: string, timeStr?: string) => {
    const date = new Date(dateStr)
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }
    let formatted = date.toLocaleDateString('en-US', options)
    if (timeStr) {
      formatted += ` at ${timeStr}`
    }
    return formatted
  }

  // Render list view
  const renderListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Events Calendar</h1>
          <p className="text-neutral-400 text-sm mt-1">Create and manage events</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Event
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="all">All Events</option>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
        >
          <option value="all">All Categories</option>
          {EVENT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-neutral-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <button onClick={loadEvents} className="mt-4 text-neutral-400 hover:text-white">
            Try again
          </button>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400">No events found</p>
          <button
            onClick={handleCreateNew}
            className="mt-4 text-emerald-400 hover:text-emerald-300"
          >
            Add your first event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-start gap-4">
                {/* Date Badge */}
                <div className="w-16 h-16 rounded-lg bg-neutral-800 flex-shrink-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-neutral-400 uppercase">
                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="text-2xl font-bold text-white">
                    {new Date(event.start_date).getDate()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-white truncate">{event.title}</h3>
                      <p className="text-sm text-neutral-400 line-clamp-1 mt-1">
                        {event.description}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                      event.status === "upcoming" 
                        ? "bg-emerald-900/50 text-emerald-400" 
                        : event.status === "past"
                        ? "bg-neutral-800 text-neutral-400"
                        : "bg-red-900/50 text-red-400"
                    }`}>
                      {event.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.is_virtual ? "Virtual" : event.location}
                    </span>
                    {event.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.start_time}
                      </span>
                    )}
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-neutral-800 rounded">
                      {event.category}
                    </span>
                    {event.is_free ? (
                      <span className="flex items-center gap-1 text-emerald-500">
                        Free
                      </span>
                    ) : event.price && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {event.price}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {event.event_url && (
                    <a
                      href={event.event_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                      title="View event"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(event)}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                    title="Edit event"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {deleteConfirmId === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={isDeleting}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(event.id)}
                      className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )

  // Render edit/create view
  const renderEditorView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">
              {view === "edit" ? "Edit Event" : "Add New Event"}
            </h1>
            <p className="text-neutral-400 text-sm">
              {view === "edit" ? `Editing: ${selectedEvent?.title}` : "Fill in the event details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-700 text-white rounded-lg transition-colors font-medium"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Event"}
          </button>
        </div>
      </div>

      {/* Import from URL option (only for create) */}
      {view === "create" && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-medium text-white">Import from URL</h3>
          </div>
          <p className="text-sm text-neutral-400 mb-4">
            Paste a URL from Meetup, Eventbrite, or Lu.ma to automatically fill in event details
          </p>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input
                type="url"
                value={parseUrl}
                onChange={(e) => { setParseUrl(e.target.value); setParseError(null) }}
                placeholder="https://meetup.com/... or lu.ma/... or eventbrite.com/..."
                className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <button
              onClick={handleParseUrl}
              disabled={isParsing || !parseUrl.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-neutral-700 text-white rounded-lg transition-colors font-medium"
            >
              {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {isParsing ? "Parsing..." : "Parse URL"}
            </button>
          </div>
          {parseError && (
            <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {parseError}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <span className="text-xs text-neutral-500 px-2 py-1 bg-neutral-800 rounded">Meetup</span>
            <span className="text-xs text-neutral-500 px-2 py-1 bg-neutral-800 rounded">Eventbrite</span>
            <span className="text-xs text-neutral-500 px-2 py-1 bg-neutral-800 rounded">Lu.ma</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Event Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the event..."
              rows={6}
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Location <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State or Online"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Venue Name
              </label>
              <input
                type="text"
                value={formData.venue_name}
                onChange={(e) => setFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                placeholder="e.g., Tech Hub Conference Center"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Venue Address
              </label>
              <input
                type="text"
                value={formData.venue_address}
                onChange={(e) => setFormData(prev => ({ ...prev, venue_address: e.target.value }))}
                placeholder="Full street address"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Status
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "upcoming" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "upcoming"
                    ? "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600"
                }`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "past" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "past"
                    ? "bg-neutral-700 text-neutral-300 border border-neutral-600"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600"
                }`}
              >
                Past
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "cancelled" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "cancelled"
                    ? "bg-red-900/50 text-red-400 border border-red-700"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600"
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>

          {/* Event Image */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Event Image
            </label>
            <ImageUpload
              value={formData.image_url}
              onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
              label="Upload or enter URL"
            />
          </div>

          {/* Category */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
            >
              {EVENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Event Options */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-4">
            <label className="block text-sm font-medium text-neutral-300">
              Event Options
            </label>
            
            {/* Virtual Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_virtual}
                onChange={(e) => setFormData(prev => ({ ...prev, is_virtual: e.target.checked }))}
                className="w-4 h-4 rounded bg-neutral-800 border-neutral-600 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-neutral-300">Virtual Event</span>
            </label>

            {/* Free Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_free}
                onChange={(e) => setFormData(prev => ({ ...prev, is_free: e.target.checked }))}
                className="w-4 h-4 rounded bg-neutral-800 border-neutral-600 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-neutral-300">Free Event</span>
            </label>

            {/* Price (if not free) */}
            {!formData.is_free && (
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Price</label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="e.g., $25"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
                />
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Organizer
            </label>
            <input
              type="text"
              value={formData.organizer}
              onChange={(e) => setFormData(prev => ({ ...prev, organizer: e.target.value }))}
              placeholder="Organization or host name"
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>

          {/* Event URL */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <label className="block text-sm font-medium text-neutral-300 mb-3">
              Event URL
            </label>
            <input
              type="url"
              value={formData.event_url}
              onChange={(e) => setFormData(prev => ({ ...prev, event_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Back to Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
                toast.type === "success" ? "bg-emerald-900 text-emerald-200" :
                toast.type === "error" ? "bg-red-900 text-red-200" :
                "bg-yellow-900 text-yellow-200"
              }`}
            >
              {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {view === "list" ? renderListView() : renderEditorView()}
      </div>
    </div>
  )
}
