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
  DollarSign,
  Building2
} from "lucide-react"
import { ImageUpload } from "../../components/ImageUpload"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"
import DOMPurify from "isomorphic-dompurify"

// Website options
type Website = "434media" | "aimsatx"

const WEBSITES: { id: Website; name: string; description: string; color: string }[] = [
  { id: "434media", name: "434 Media", description: "434media.com events", color: "emerald" },
  { id: "aimsatx", name: "AIM SATX", description: "aimsatx.com events", color: "black" }
]

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
  // Website selection state
  const [activeWebsite, setActiveWebsite] = useState<Website>("434media")
  
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

  // Load events on mount and when website changes
  useEffect(() => {
    loadEvents()
  }, [activeWebsite])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Get API endpoint based on active website
  const getApiEndpoint = (path: string = "") => {
    const base = activeWebsite === "434media" ? "/api/admin/events" : "/api/admin/events-aims"
    return path ? `${base}/${path}` : base
  }

  const loadEvents = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(getApiEndpoint())
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
        response = await fetch(getApiEndpoint(selectedEvent.id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } else {
        response = await fetch(getApiEndpoint(), {
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
      const response = await fetch(getApiEndpoint(id), {
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

  // Sort events: upcoming events first (nearest dates first), then past events (most recent first)
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = new Date(a.start_date).getTime()
    const dateB = new Date(b.start_date).getTime()
    const today = new Date().setHours(0, 0, 0, 0)
    
    const aIsUpcoming = dateA >= today
    const bIsUpcoming = dateB >= today
    
    // If both are upcoming, sort by nearest date first
    if (aIsUpcoming && bIsUpcoming) {
      return dateA - dateB
    }
    // If both are past, sort by most recent first
    if (!aIsUpcoming && !bIsUpcoming) {
      return dateB - dateA
    }
    // Upcoming events come before past events
    return aIsUpcoming ? -1 : 1
  })

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
      {/* Header with Website Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight leading-tight">
              Events Manager
            </h1>
            <span className="text-neutral-300 hidden sm:inline">|</span>
            <div className="relative hidden sm:block">
              <select
                value={activeWebsite}
                onChange={(e) => setActiveWebsite(e.target.value as Website)}
                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-sm font-medium cursor-pointer focus:outline-none transition-all border ${
                  activeWebsite === "434media"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300"
                    : "bg-neutral-100 text-neutral-900 border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {WEBSITES.map((site) => (
                  <option key={site.id} value={site.id} className="bg-white text-neutral-900">
                    {site.name}
                  </option>
                ))}
              </select>
              <ChevronLeft className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none -rotate-90 ${
                activeWebsite === "434media" ? "text-emerald-500" : "text-neutral-500"
              }`} />
            </div>
          </div>
          <p className="text-neutral-500 text-sm font-medium mt-1 leading-relaxed">
            {activeWebsite === "434media" ? "434media.com" : "aimsatx.com"} events
          </p>
        </div>
        {/* Mobile Website Switcher */}
        <div className="relative sm:hidden">
          <select
            value={activeWebsite}
            onChange={(e) => setActiveWebsite(e.target.value as Website)}
            className={`appearance-none w-full pl-10 pr-10 py-2.5 rounded-xl text-sm font-semibold cursor-pointer focus:outline-none transition-all border ${
              activeWebsite === "434media"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-neutral-100 text-neutral-900 border-neutral-200"
            }`}
          >
            {WEBSITES.map((site) => (
              <option key={site.id} value={site.id} className="bg-white text-neutral-900">
                {site.name}
              </option>
            ))}
          </select>
          <Building2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
            activeWebsite === "434media" ? "text-emerald-600" : "text-neutral-600"
          }`} />
          <ChevronLeft className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none -rotate-90 ${
            activeWebsite === "434media" ? "text-emerald-500" : "text-neutral-500"
          }`} />
        </div>
      </div>

      {/* Filters and Add Event */}
      <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-3 sm:py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 font-medium focus:outline-none focus:border-neutral-400 cursor-pointer shadow-sm"
          >
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-3 sm:py-2.5 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 font-medium focus:outline-none focus:border-neutral-400 cursor-pointer shadow-sm"
          >
            <option value="all">All Types</option>
            {EVENT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            onClick={handleCreateNew}
            className={`inline-flex items-center gap-2 px-4 py-3 sm:py-2.5 text-white rounded-xl transition-colors font-semibold text-sm shadow-md whitespace-nowrap ${
              activeWebsite === "434media"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                : "bg-neutral-900 hover:bg-black shadow-neutral-300"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Event</span>
          </button>
        </div>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className={`w-8 h-8 animate-spin ${activeWebsite === "434media" ? "text-emerald-500" : "text-neutral-500"}`} />
          <p className="text-sm font-medium text-neutral-500 mt-3">Loading events...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-white border border-neutral-200 rounded-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
          <button onClick={loadEvents} className="mt-4 text-sm text-neutral-500 hover:text-neutral-900 font-medium">
            Try again
          </button>
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-white border border-neutral-200 rounded-xl shadow-sm">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            activeWebsite === "434media" ? "bg-emerald-50" : "bg-neutral-100"
          }`}>
            <Calendar className={`w-8 h-8 ${
              activeWebsite === "434media" ? "text-emerald-400" : "text-neutral-400"
            }`} />
          </div>
          <p className="text-neutral-800 font-semibold text-lg">No events found</p>
          <p className="text-neutral-500 text-sm mt-1 px-4">
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' 
              ? "Try adjusting your filters"
              : "Create your first event to get started"}
          </p>
          <button
            onClick={handleCreateNew}
            className={`mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              activeWebsite === "434media" 
                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                : "bg-neutral-900 text-white hover:bg-neutral-950"
            }`}
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`bg-white border rounded-xl p-4 sm:p-5 hover:shadow-md transition-all ${
                event.status === "upcoming" 
                  ? activeWebsite === "434media"
                    ? "border-emerald-200 hover:border-emerald-300" 
                    : "border-neutral-200 hover:border-neutral-300"
                  : event.status === "cancelled"
                  ? "border-red-200 opacity-60"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Date Badge */}
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl shrink-0 flex flex-col items-center justify-center ${
                  event.status === "upcoming"
                    ? activeWebsite === "434media"
                      ? "bg-emerald-50 border border-emerald-200"
                      : "bg-neutral-50 border border-neutral-200"
                    : "bg-neutral-100"
                }`}>
                  <span className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${
                    event.status === "upcoming" 
                      ? activeWebsite === "434media" ? "text-emerald-600" : "text-neutral-600"
                      : "text-neutral-500"
                  }`}>
                    {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className={`text-xl sm:text-2xl font-bold ${
                    event.status === "upcoming" 
                      ? activeWebsite === "434media" ? "text-emerald-700" : "text-neutral-900"
                      : "text-neutral-900"
                  }`}>
                    {new Date(event.start_date).getDate()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-neutral-900 truncate text-sm sm:text-base">{event.title}</h3>
                      <p className="text-xs sm:text-sm text-neutral-500 line-clamp-1 mt-0.5 sm:mt-1">
                        {event.description}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded-full shrink-0 ${
                      event.status === "upcoming" 
                        ? activeWebsite === "434media"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                          : "bg-neutral-100 text-neutral-900 border border-neutral-200"
                        : event.status === "past"
                        ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                        : "bg-red-100 text-red-700 border border-red-200"
                    }`}>
                      {event.status === "upcoming" ? "Upcoming" : event.status === "past" ? "Past" : "Cancelled"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 sm:mt-3 text-[10px] sm:text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate max-w-30 sm:max-w-none">
                        {event.is_virtual ? "Virtual" : event.location}
                      </span>
                    </span>
                    {event.start_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.start_time}
                      </span>
                    )}
                    <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-neutral-100 rounded-full">
                      {event.category}
                    </span>
                    {event.is_free ? (
                      <span className={`flex items-center gap-1 font-medium ${
                        activeWebsite === "434media" ? "text-emerald-600" : "text-neutral-600"
                      }`}>
                        Free
                      </span>
                    ) : event.price && (
                      <span className="flex items-center gap-1 font-medium">
                        <DollarSign className="w-3 h-3" />
                        {event.price}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {event.event_url && (
                    <a
                      href={event.event_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="View event"
                    >
                      <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(event)}
                    className={`p-1.5 sm:p-2 text-neutral-400 rounded-lg transition-colors ${
                      activeWebsite === "434media"
                        ? "hover:text-emerald-600 hover:bg-emerald-50"
                        : "hover:text-neutral-600 hover:bg-neutral-50"
                    }`}
                    title="Edit event"
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  {deleteConfirmId === event.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={isDeleting}
                        className="p-1.5 sm:p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {isDeleting ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-1.5 sm:p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(event.id)}
                      className="p-1.5 sm:p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-neutral-900">
                {view === "edit" ? "Edit Event" : "Add New Event"}
              </h1>
              <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                activeWebsite === "434media" 
                  ? "bg-emerald-100 text-emerald-700" 
                  : "bg-neutral-100 text-neutral-900"
              }`}>
                {activeWebsite === "434media" ? "434 Media" : "AIM SATX"}
              </span>
            </div>
            <p className="text-neutral-500 text-xs sm:text-sm truncate max-w-50 sm:max-w-none">
              {view === "edit" ? `Editing: ${selectedEvent?.title}` : "Fill in the event details"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-auto sm:ml-0">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="px-3 sm:px-4 py-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 disabled:bg-neutral-300 text-white text-sm rounded-xl transition-colors font-medium ${
              activeWebsite === "434media"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-neutral-600 hover:bg-neutral-900"
            }`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">{isSaving ? "Saving..." : "Save Event"}</span>
            <span className="sm:hidden">{isSaving ? "..." : "Save"}</span>
          </button>
        </div>
      </div>

      {/* Import from URL option (only for create) */}
      {view === "create" && (
        <div className="bg-linear-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-semibold text-neutral-900">Quick Import</h3>
          </div>
          <p className="text-sm text-neutral-600 mb-4">
            Paste a URL to auto-fill event details
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="url"
                value={parseUrl}
                onChange={(e) => { setParseUrl(e.target.value); setParseError(null) }}
                placeholder="https://meetup.com/..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
            <button
              onClick={handleParseUrl}
              disabled={isParsing || !parseUrl.trim()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-300 text-white rounded-xl transition-colors font-semibold text-sm shadow-sm"
            >
              {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {isParsing ? "Parsing..." : "Parse"}
            </button>
          </div>
          {parseError && (
            <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5 bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="line-clamp-2">{parseError}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-amber-700 px-2.5 py-1 bg-amber-100 rounded-full font-medium">Meetup</span>
            <span className="text-xs text-amber-700 px-2.5 py-1 bg-amber-100 rounded-full font-medium">Eventbrite</span>
            <span className="text-xs text-amber-700 px-2.5 py-1 bg-amber-100 rounded-full font-medium">Lu.ma</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Title */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter event title"
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 focus:bg-white transition-all"
            />
          </div>

          {/* Description */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-neutral-900 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the event..."
              rows={5}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 focus:bg-white resize-none transition-all"
            />
          </div>

          {/* Date and Time */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-neutral-900 mb-3">
              Date & Time
            </label>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Start Time</label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-semibold text-neutral-900 mb-3">
              Location
            </label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1.5">Location <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="City, State or Online"
                  className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">Venue Name</label>
                  <input
                    type="text"
                    value={formData.venue_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue_name: e.target.value }))}
                    placeholder="e.g., Tech Hub Center"
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1.5">Venue Address</label>
                  <input
                    type="text"
                    value={formData.venue_address}
                    onChange={(e) => setFormData(prev => ({ ...prev, venue_address: e.target.value }))}
                    placeholder="Full street address"
                    className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Status
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "upcoming" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "upcoming"
                    ? activeWebsite === "434media"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                      : "bg-neutral-100 text-neutral-900 border border-neutral-300"
                    : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                Upcoming
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "past" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "past"
                    ? "bg-neutral-200 text-neutral-900 border border-neutral-300"
                    : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                Past
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "cancelled" }))}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                  formData.status === "cancelled"
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                Cancelled
              </button>
            </div>
          </div>

          {/* Event Image */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Event Image
            </label>
            <ImageUpload
              value={formData.image_url}
              onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
              label="Upload or enter URL"
            />
          </div>

          {/* Category */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:border-neutral-400"
            >
              {EVENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Event Options */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm space-y-4">
            <label className="block text-sm font-medium text-neutral-900">
              Event Options
            </label>
            
            {/* Virtual Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_virtual}
                onChange={(e) => setFormData(prev => ({ ...prev, is_virtual: e.target.checked }))}
                className="w-4 h-4 rounded bg-neutral-50 border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-neutral-900">Virtual Event</span>
            </label>

            {/* Free Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_free}
                onChange={(e) => setFormData(prev => ({ ...prev, is_free: e.target.checked }))}
                className="w-4 h-4 rounded bg-neutral-50 border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-neutral-900">Free Event</span>
            </label>

            {/* Price (if not free) */}
            {!formData.is_free && (
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Price</label>
                <input
                  type="text"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="e.g., $25"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                />
              </div>
            )}
          </div>

          {/* Organizer */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Organizer
            </label>
            <input
              type="text"
              value={formData.organizer}
              onChange={(e) => setFormData(prev => ({ ...prev, organizer: e.target.value }))}
              placeholder="Organization or host name"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
            />
          </div>

          {/* Event URL */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-900 mb-3">
              Event URL
            </label>
            <input
              type="url"
              value={formData.event_url}
              onChange={(e) => setFormData(prev => ({ ...prev, event_url: e.target.value }))}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Back to Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors mb-6"
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
                toast.type === "success" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                toast.type === "error" ? "bg-red-100 text-red-800 border border-red-200" :
                "bg-yellow-100 text-yellow-800 border border-yellow-200"
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
    </AdminRoleGuard>
  )
}
