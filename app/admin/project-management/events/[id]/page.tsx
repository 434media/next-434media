"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  ChevronDown,
  Loader2,
  AlertCircle,
  Calendar,
  MapPin,
  Building2,
  Globe,
  ExternalLink,
  DollarSign,
  Edit2,
  Trash2,
  CheckCircle2,
  Link2,
  UserCircle,
  Phone,
  Mail,
  Clock,
} from "lucide-react"
import type { PMEvent, Vendor } from "@/types/project-management-types"
import { PM_EVENT_STATUSES } from "@/types/project-management-types"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import {
  STATUS_DOT,
  getDaysUntil,
  formatCountdown,
  categorizeEvent,
} from "../../components/event-helpers"

function renderLinkedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (/(https?:\/\/[^\s]+)/.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-600 break-all transition-colors"
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<PMEvent | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<
    { message: string; type: "success" | "error" | "warning" } | null
  >(null)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [isChangingStatus, setIsChangingStatus] = useState(false)

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [eventRes, vendorRes] = await Promise.all([
        fetch(`/api/admin/project-management?type=event&id=${id}`),
        fetch("/api/admin/project-management?type=vendors"),
      ])

      if (!eventRes.ok) throw new Error("Event not found")

      const eventData = await eventRes.json()
      setEvent(eventData.event)

      if (vendorRes.ok) {
        const vendorData = await vendorRes.json()
        setVendors(vendorData.vendors || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event?")) return
    try {
      const response = await fetch(`/api/admin/project-management?type=event&id=${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      router.push("/admin/project-management")
    } catch {
      setToast({ message: "Failed to delete event", type: "error" })
    }
  }

  const handleStatusChange = async (newStatus: PMEvent["status"]) => {
    if (!event) return
    setIsChangingStatus(true)
    try {
      const response = await fetch("/api/admin/project-management", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "event", id, data: { ...event, status: newStatus } }),
      })
      if (!response.ok) throw new Error("Update failed")
      setEvent({ ...event, status: newStatus })
      setToast({ message: `Status updated to ${newStatus}`, type: "success" })
    } catch {
      setToast({ message: "Failed to update status", type: "error" })
    } finally {
      setIsChangingStatus(false)
    }
  }

  const formatDateLong = (dateStr?: string) => {
    if (!dateStr) return "Date TBD"
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatDateShort = (dateStr?: string) => {
    if (!dateStr) return ""
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const eventVendors = vendors.filter((v) => event?.vendor_ids?.includes(v.id))

  if (isLoading) {
    return (
      <AdminRoleGuard allowedRoles={["full_admin"]}>
        <div className="min-h-dvh pt-20 bg-neutral-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
        </div>
      </AdminRoleGuard>
    )
  }

  if (error || !event) {
    return (
      <AdminRoleGuard allowedRoles={["full_admin"]}>
        <div className="min-h-dvh pt-20 bg-neutral-50 flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <p className="text-lg font-medium text-red-600">{error || "Event not found"}</p>
          <Link
            href="/admin/project-management"
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Back to events
          </Link>
        </div>
      </AdminRoleGuard>
    )
  }

  const days = getDaysUntil(event.start_date || event.date)
  const isLive = categorizeEvent(event) === "in-progress"
  const isCompleted = event.status === "completed" || event.status === "cancelled"
  const budgetPercent =
    event.budget && event.actual_expenses !== undefined && event.budget > 0
      ? Math.round((event.actual_expenses / event.budget) * 100)
      : null

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-60 flex items-center gap-3 px-5 py-3.5 rounded-md border shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : toast.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-amber-50 border-amber-200 text-amber-700"
          }`}
        >
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}

      <div className="min-h-dvh pt-20 bg-neutral-50 text-neutral-900">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 h-14">
              <Link
                href="/admin/project-management"
                className="inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs font-medium">Back</span>
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/project-management/events/${id}/edit`}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete event"
                  aria-label="Delete event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Banner */}
        {(event.photo_banner || event.img_ai) && (
          <div className="relative aspect-3/1 max-h-64 bg-neutral-100 overflow-hidden">
            <img
              src={event.photo_banner || event.img_ai}
              alt={event.name}
              className={`w-full h-full object-cover ${isCompleted ? "grayscale-20" : ""}`}
            />
          </div>
        )}

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Title + status */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              Event
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 leading-tight tracking-tight">
                {event.name}
              </h1>
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={isChangingStatus}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-neutral-900 text-white hover:ring-2 hover:ring-offset-1 hover:ring-neutral-300 transition-all"
                >
                  {isLive && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                    </span>
                  )}
                  {event.status}
                  <ChevronDown className="w-2.5 h-2.5 opacity-70" />
                </button>
                <AnimatePresence>
                  {showStatusMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl py-1 min-w-35 z-30"
                    >
                      {PM_EVENT_STATUSES.map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            setShowStatusMenu(false)
                            if (status !== event.status) handleStatusChange(status)
                          }}
                          disabled={isChangingStatus}
                          className={`w-full text-left px-3 py-2 text-xs font-semibold capitalize flex items-center gap-2 transition-colors ${
                            status === event.status
                              ? "bg-neutral-50 text-neutral-900"
                              : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                          {status}
                          {status === event.status && (
                            <CheckCircle2 className="w-3 h-3 ml-auto text-neutral-400" />
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Sub-row: date / time / countdown */}
            <div className="flex items-center gap-3 mt-2 text-sm text-neutral-500 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-neutral-600 font-medium">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                {formatDateLong(event.start_date || event.date)}
                {event.end_date && event.end_date !== (event.start_date || event.date) && (
                  <span className="text-neutral-400 font-normal">
                    {" "}– {formatDateShort(event.end_date)}
                  </span>
                )}
              </span>
              {(event.start_time || event.end_time) && (
                <span className="inline-flex items-center gap-1.5 text-neutral-600">
                  <Clock className="w-3.5 h-3.5 text-neutral-400" />
                  {event.start_time}
                  {event.end_time ? ` – ${event.end_time}` : ""}
                </span>
              )}
              {days !== null && !isCompleted && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md ring-1 ring-neutral-200 bg-white text-[11px] font-semibold text-neutral-700 tabular-nums">
                  {formatCountdown(days)}
                </span>
              )}
              {event.month && (
                <span className="text-[11px] text-neutral-400 uppercase tracking-wider">
                  {event.month}
                </span>
              )}
            </div>
          </div>

          {/* Venue */}
          {(event.venue_name ||
            event.location ||
            event.venue_address ||
            event.venue_map_link ||
            event.website_url) && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                Venue
              </p>
              <div className="space-y-1.5">
                {event.venue_name && (
                  <p className="text-sm font-semibold text-neutral-900">{event.venue_name}</p>
                )}
                {(event.venue_location || event.location) && (
                  <p className="text-sm text-neutral-600 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    {event.venue_location || event.location}
                  </p>
                )}
                {event.venue_address && (
                  <p className="text-xs text-neutral-500">{event.venue_address}</p>
                )}
              </div>
              {(event.venue_map_link || event.website_url) && (
                <div className="flex items-center gap-2 mt-3">
                  {event.venue_map_link && (
                    <a
                      href={event.venue_map_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <MapPin className="w-3 h-3" />
                      Map
                      <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                    </a>
                  )}
                  {event.website_url && (
                    <a
                      href={event.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      Website
                      <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                    </a>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Resource Links */}
          {event.links && event.links.length > 0 && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" />
                Resource links
                <span className="ml-auto text-neutral-400 normal-case tracking-normal">
                  {event.links.length}
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 transition-colors group"
                  >
                    <Link2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">
                        {link.label || "Untitled link"}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">{link.url}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-neutral-300 group-hover:text-neutral-500 transition-colors shrink-0" />
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Client Contacts */}
          {event.client_contacts && event.client_contacts.length > 0 && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3 flex items-center gap-2">
                <UserCircle className="w-3.5 h-3.5" />
                Client contacts
                <span className="ml-auto text-neutral-400 normal-case tracking-normal">
                  {event.client_contacts.length}
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {event.client_contacts.map((contact, index) => (
                  <div key={index} className="rounded-md ring-1 ring-neutral-200 p-3">
                    <p className="text-sm font-semibold text-neutral-900">{contact.name}</p>
                    {(contact.title || contact.company) && (
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {contact.title}
                        {contact.title && contact.company ? " · " : ""}
                        {contact.company}
                      </p>
                    )}
                    <div className="flex flex-col gap-1 mt-2">
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </a>
                      )}
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </a>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-[11px] text-neutral-500 mt-2 italic">{contact.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Vendors */}
          {eventVendors.length > 0 && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                Event vendors
                <span className="ml-auto text-neutral-400 normal-case tracking-normal">
                  {eventVendors.length}
                </span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {eventVendors.map((vendor) => (
                  <div key={vendor.id} className="rounded-md ring-1 ring-neutral-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">{vendor.name}</p>
                        {vendor.company && (
                          <p className="text-xs text-neutral-500">{vendor.company}</p>
                        )}
                      </div>
                      {vendor.category && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
                          {vendor.category}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 mt-2">
                      {vendor.email && (
                        <a
                          href={`mailto:${vendor.email}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Mail className="w-3 h-3" />
                          {vendor.email}
                        </a>
                      )}
                      {vendor.phone && (
                        <a
                          href={`tel:${vendor.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Phone className="w-3 h-3" />
                          {vendor.phone}
                        </a>
                      )}
                      {vendor.rate !== undefined && vendor.rate !== null && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                          <DollarSign className="w-3 h-3" />${vendor.rate.toLocaleString()}
                          {vendor.rate_type ? ` / ${vendor.rate_type}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Budget */}
          {(event.budget !== undefined ||
            event.estimated_expenses !== undefined ||
            event.actual_expenses !== undefined) && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" />
                Budget
              </p>
              <div className="flex items-baseline gap-8 flex-wrap">
                {event.budget !== undefined && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                      Budget
                    </p>
                    <p className="text-xl font-bold text-neutral-900 tabular-nums">
                      ${event.budget.toLocaleString()}
                    </p>
                  </div>
                )}
                {event.estimated_expenses !== undefined && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                      Estimated
                    </p>
                    <p className="text-xl font-bold text-neutral-900 tabular-nums">
                      ${event.estimated_expenses.toLocaleString()}
                    </p>
                  </div>
                )}
                {event.actual_expenses !== undefined && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">
                      Actual
                    </p>
                    <p className="text-xl font-bold text-neutral-900 tabular-nums">
                      ${event.actual_expenses.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              {budgetPercent !== null && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-neutral-500">Budget utilization</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        budgetPercent <= 80
                          ? "text-emerald-600"
                          : budgetPercent <= 100
                          ? "text-blue-600"
                          : budgetPercent <= 120
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {budgetPercent}%
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        budgetPercent <= 80
                          ? "bg-emerald-500"
                          : budgetPercent <= 100
                          ? "bg-blue-500"
                          : budgetPercent <= 120
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${Math.min(100, budgetPercent)}%` }}
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Agenda Overview */}
          {event.agenda_overview && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                Agenda overview
              </p>
              <div className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {renderLinkedText(event.agenda_overview)}
              </div>
            </section>
          )}

          {/* Description */}
          {event.description && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                Description
              </p>
              <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {renderLinkedText(event.description)}
              </div>
            </section>
          )}

          {/* Notes */}
          {event.notes && (
            <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                Notes
              </p>
              <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                {renderLinkedText(event.notes)}
              </div>
            </section>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
