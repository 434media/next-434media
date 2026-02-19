"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
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
  Zap,
  Link2,
  UserCircle,
  Phone,
  Mail,
  Clock,
} from "lucide-react"
import type { PMEvent, Vendor } from "@/types/project-management-types"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-blue-100 text-blue-700 border-blue-200",
  "in-progress": "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
}

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null)

  useEffect(() => {
    loadData()
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

  const eventVendors = vendors.filter((v) => event?.vendor_ids?.includes(v.id))

  const getBudgetHealth = () => {
    if (!event) return null
    const budget = event.budget || event.estimated_expenses
    const actual = event.actual_expenses
    if (!budget || actual === undefined) return null
    const percent = Math.round((actual / budget) * 100)
    if (percent <= 80) return { label: "Under budget", color: "text-emerald-600", percent }
    if (percent <= 100) return { label: "On track", color: "text-blue-600", percent }
    if (percent <= 120) return { label: "Over budget", color: "text-amber-600", percent }
    return { label: "Over budget", color: "text-red-600", percent }
  }

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
            className="mt-4 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg"
          >
            Back to Events
          </Link>
        </div>
      </AdminRoleGuard>
    )
  }

  const budgetHealth = getBudgetHealth()
  const isLive = event.status === "in-progress"
  const isCompleted = event.status === "completed" || event.status === "cancelled"

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-60 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg ${
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
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link
                  href="/admin/project-management"
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium tracking-wide">Back to Events</span>
                </Link>
              </div>
              <div className="flex items-center gap-2">
                {!isCompleted && event.status !== "completed" && (
                  <button
                    onClick={() => handleStatusChange("completed")}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mark Complete
                  </button>
                )}
                {!isLive && event.status !== "in-progress" && !isCompleted && (
                  <button
                    onClick={() => handleStatusChange("in-progress")}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Mark Live
                  </button>
                )}
                <Link
                  href={`/admin/project-management/events/${id}/edit`}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Link>
                <button
                  onClick={handleDelete}
                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete event"
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
            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent" />
          </div>
        )}

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Title & Status */}
          <div>
            <div className={`w-12 h-1.5 mb-4 rounded-full ${isLive ? "bg-purple-400" : "bg-yellow-400"}`} />
            <h1 className="text-3xl font-bold text-neutral-900 leading-tight">{event.name}</h1>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <span
                className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full border flex items-center gap-1.5 ${
                  STATUS_COLORS[event.status] || "bg-neutral-100 text-neutral-600 border-neutral-200"
                }`}
              >
                {isLive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                  </span>
                )}
                {event.status}
              </span>
              {event.month && (
                <span className="px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">
                  {event.month}
                </span>
              )}
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-neutral-200">
              <div className="w-10 h-10 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-600" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">Date</p>
                <p className="text-sm font-semibold text-neutral-900">
                  {formatDateLong(event.start_date || event.date)}
                </p>
                {event.end_date && event.end_date !== event.start_date && (
                  <p className="text-xs text-neutral-500">to {formatDateLong(event.end_date)}</p>
                )}
                {(event.start_time || event.end_time) && (
                  <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {event.start_time}
                    {event.end_time ? ` – ${event.end_time}` : ""}
                  </p>
                )}
              </div>
            </div>

            {(event.venue_name || event.location) && (
              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-neutral-200">
                <div className="w-10 h-10 rounded-lg bg-neutral-50 border border-neutral-200 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-neutral-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide font-semibold">Venue</p>
                  <p className="text-sm font-semibold text-neutral-900 truncate">{event.venue_name || ""}</p>
                  {event.venue_location && (
                    <p className="text-xs text-neutral-500 truncate">{event.venue_location}</p>
                  )}
                  {event.venue_address && (
                    <p className="text-xs text-neutral-400 truncate">{event.venue_address}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-3 flex-wrap">
            {event.venue_map_link && (
              <a
                href={event.venue_map_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
              >
                <MapPin className="w-4 h-4" />
                View Map
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {event.website_url && (
              <a
                href={event.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
              >
                <Globe className="w-4 h-4" />
                Website
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Resource Links */}
          {event.links && event.links.length > 0 && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Resource Links
                </h2>
                <span className="ml-auto text-xs font-medium text-neutral-400">
                  {event.links.length} link{event.links.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {event.links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-neutral-50 hover:bg-blue-50 rounded-xl border border-neutral-100 hover:border-blue-200 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200 group-hover:border-blue-200 flex items-center justify-center transition-colors">
                        <Link2 className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-700 truncate transition-colors">
                          {link.label || "Untitled Link"}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">{link.url}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-neutral-300 group-hover:text-blue-500 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Client Contacts */}
          {event.client_contacts && event.client_contacts.length > 0 && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Client Contacts
                </h2>
                <span className="ml-auto text-xs font-medium text-neutral-400">
                  {event.client_contacts.length} contact{event.client_contacts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {event.client_contacts.map((contact, index) => (
                    <div
                      key={index}
                      className="p-4 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 font-bold text-sm shrink-0">
                          {contact.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-neutral-900">{contact.name}</p>
                          {contact.title && (
                            <p className="text-xs text-neutral-500">{contact.title}</p>
                          )}
                          {contact.company && (
                            <p className="text-xs text-neutral-400">{contact.company}</p>
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
                            <p className="text-xs text-neutral-400 mt-2 italic">{contact.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Event Vendors */}
          {eventVendors.length > 0 && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Event Vendors
                </h2>
                <span className="ml-auto text-xs font-medium text-neutral-400">
                  {eventVendors.length} vendor{eventVendors.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {eventVendors.map((vendor) => (
                    <div
                      key={vendor.id}
                      className="flex items-start gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div className="w-10 h-10 rounded-lg bg-neutral-200 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-neutral-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-neutral-900">{vendor.name}</p>
                        {vendor.company && (
                          <p className="text-xs text-neutral-500">{vendor.company}</p>
                        )}
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold uppercase bg-neutral-200/60 rounded text-neutral-600">
                          {vendor.category}
                        </span>
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
                          {vendor.rate && (
                            <span className="text-xs text-neutral-500 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              ${vendor.rate.toLocaleString()}
                              {vendor.rate_type ? ` / ${vendor.rate_type}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Budget */}
          {(event.actual_expenses !== undefined ||
            event.estimated_expenses !== undefined ||
            event.budget !== undefined) && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Budget
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {event.budget !== undefined && (
                    <div className="p-4 bg-neutral-50 rounded-xl text-center border border-neutral-100">
                      <p className="text-xs text-neutral-400 mb-1 uppercase font-semibold">Budget</p>
                      <p className="text-xl font-bold text-neutral-900">
                        ${event.budget.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {event.estimated_expenses !== undefined && (
                    <div className="p-4 bg-neutral-50 rounded-xl text-center border border-neutral-100">
                      <p className="text-xs text-neutral-400 mb-1 uppercase font-semibold">Estimated</p>
                      <p className="text-xl font-bold text-neutral-900">
                        ${event.estimated_expenses.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {event.actual_expenses !== undefined && (
                    <div className="p-4 bg-neutral-50 rounded-xl text-center border border-neutral-100">
                      <p className="text-xs text-neutral-400 mb-1 uppercase font-semibold">Actual</p>
                      <p className="text-xl font-bold text-neutral-900">
                        ${event.actual_expenses.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                {budgetHealth && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-neutral-500">Budget utilization</span>
                      <span className={`font-semibold ${budgetHealth.color}`}>
                        {budgetHealth.percent}% – {budgetHealth.label}
                      </span>
                    </div>
                    <div className="w-full bg-neutral-100 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all ${
                          budgetHealth.percent <= 80
                            ? "bg-emerald-500"
                            : budgetHealth.percent <= 100
                            ? "bg-blue-500"
                            : budgetHealth.percent <= 120
                            ? "bg-amber-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min(100, budgetHealth.percent)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Agenda Overview */}
          {event.agenda_overview && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Agenda Overview
                </h2>
              </div>
              <div className="p-6">
                <div className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                  {renderLinkedText(event.agenda_overview)}
                </div>
              </div>
            </section>
          )}

          {/* Description */}
          {event.description && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Description
                </h2>
              </div>
              <div className="p-6">
                <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                  {renderLinkedText(event.description)}
                </div>
              </div>
            </section>
          )}

          {/* Notes */}
          {event.notes && (
            <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Notes
                </h2>
              </div>
              <div className="p-6">
                <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                  {renderLinkedText(event.notes)}
                </div>
              </div>
            </section>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-between py-6 border-t border-neutral-200">
            <Link
              href="/admin/project-management"
              className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Events
            </Link>
            <Link
              href={`/admin/project-management/events/${id}/edit`}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Edit2 className="w-4 h-4" />
              Edit Event
            </Link>
          </div>
        </main>
      </div>
    </AdminRoleGuard>
  )
}
