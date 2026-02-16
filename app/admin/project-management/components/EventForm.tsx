"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  MapPin,
  GripVertical,
  Link2,
  UserCircle,
  Building2,
  Save,
  X,
  Search,
  Filter,
  CheckCircle2,
  Mail,
  Phone,
  DollarSign,
  ChevronDown,
} from "lucide-react"
import type { PMEvent, EventLink, EventClientContact, Vendor } from "../../../types/project-management-types"
import { PM_EVENT_STATUSES, VENDOR_CATEGORIES } from "../../../types/project-management-types"
import { ImageUpload } from "../../../components/ImageUpload"

interface EventFormProps {
  event?: PMEvent | null
  vendors?: Vendor[]
  onSave: (event: Partial<PMEvent>, isNew: boolean) => Promise<void>
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

export default function EventForm({ event, vendors = [], onSave, showToast }: EventFormProps) {
  const router = useRouter()
  const isNew = !event
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState<Partial<PMEvent>>(
    event || {
      name: "",
      date: "",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      location: "",
      venue_name: "",
      venue_location: "",
      venue_address: "",
      venue_map_link: "",
      description: "",
      agenda_overview: "",
      status: "planning",
      budget: undefined,
      estimated_expenses: undefined,
      actual_expenses: undefined,
      website_url: "",
      notes: "",
      photo_banner: "",
      links: [],
      client_contacts: [],
      vendor_ids: [],
    }
  )

  const handleChange = (field: keyof PMEvent, value: string | number | string[] | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ============================================
  // Links Management
  // ============================================
  const links: EventLink[] = form.links || []

  const addLink = () => {
    setForm((prev) => ({
      ...prev,
      links: [...(prev.links || []), { label: "", url: "" }],
    }))
  }

  const updateLink = (index: number, field: keyof EventLink, value: string) => {
    setForm((prev) => {
      const updated = [...(prev.links || [])]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, links: updated }
    })
  }

  const removeLink = (index: number) => {
    setForm((prev) => ({
      ...prev,
      links: (prev.links || []).filter((_, i) => i !== index),
    }))
  }

  // ============================================
  // Client Contacts Management
  // ============================================
  const clientContacts: EventClientContact[] = form.client_contacts || []

  const addClientContact = () => {
    setForm((prev) => ({
      ...prev,
      client_contacts: [
        ...(prev.client_contacts || []),
        { name: "", email: "", phone: "", company: "", title: "", notes: "" },
      ],
    }))
  }

  const updateClientContact = (index: number, field: keyof EventClientContact, value: string) => {
    setForm((prev) => {
      const updated = [...(prev.client_contacts || [])]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, client_contacts: updated }
    })
  }

  const removeClientContact = (index: number) => {
    setForm((prev) => ({
      ...prev,
      client_contacts: (prev.client_contacts || []).filter((_, i) => i !== index),
    }))
  }

  // ============================================
  // Vendor Association
  // ============================================
  const selectedVendorIds: string[] = form.vendor_ids || []
  const [vendorSearch, setVendorSearch] = useState("")
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState<string>("all")
  const [showSelectedOnly, setShowSelectedOnly] = useState(false)

  const toggleVendor = (vendorId: string) => {
    setForm((prev) => {
      const current = prev.vendor_ids || []
      const updated = current.includes(vendorId)
        ? current.filter((id) => id !== vendorId)
        : [...current, vendorId]
      return { ...prev, vendor_ids: updated }
    })
  }

  const filteredVendors = vendors
    .filter((v) => {
      if (showSelectedOnly && !selectedVendorIds.includes(v.id)) return false
      if (vendorCategoryFilter !== "all" && v.category !== vendorCategoryFilter) return false
      if (vendorSearch.trim()) {
        const q = vendorSearch.toLowerCase()
        return (
          v.name?.toLowerCase().includes(q) ||
          v.company?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      const aSelected = selectedVendorIds.includes(a.id) ? 0 : 1
      const bSelected = selectedVendorIds.includes(b.id) ? 0 : 1
      if (aSelected !== bSelected) return aSelected - bSelected
      return (a.name || "").localeCompare(b.name || "")
    })

  // Unique categories actually present in vendors
  const activeCategories = [...new Set(vendors.map((v) => v.category).filter(Boolean))].sort()

  // ============================================
  // Submit
  // ============================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) {
      showToast("Event name is required", "error")
      return
    }
    setIsSaving(true)
    try {
      // Ensure date is synced with start_date
      const eventData = { ...form }
      if (eventData.start_date && !eventData.date) {
        eventData.date = eventData.start_date
      }
      // Clean up empty links
      if (eventData.links) {
        eventData.links = eventData.links.filter((l) => l.label.trim() || l.url.trim())
      }
      // Clean up empty client contacts
      if (eventData.client_contacts) {
        eventData.client_contacts = eventData.client_contacts.filter((c) => c.name.trim())
      }

      await onSave(eventData, isNew)
      router.push("/admin/project-management")
    } catch {
      // error handled by parent
    } finally {
      setIsSaving(false)
    }
  }

  return (
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
              <div className="h-6 w-px bg-neutral-200" />
              <h1 className="text-lg font-bold tracking-tight text-neutral-900">
                {isNew ? "New Event" : `Edit: ${event?.name}`}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/project-management"
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isNew ? "Create Event" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Basic Information
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Event Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    value={form.status || "planning"}
                    onChange={(e) => handleChange("status", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  >
                    {PM_EVENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={form.website_url || ""}
                    onChange={(e) => handleChange("website_url", e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                  {form.website_url && (
                    <a
                      href={form.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open link
                    </a>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={5}
                  value={form.description || ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-y min-h-30"
                  placeholder="Describe the event details, purpose, and any important information..."
                />
              </div>
            </div>
          </section>

          {/* Date & Time */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Date & Time
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.start_date || ""}
                    onChange={(e) => handleChange("start_date", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.end_date || ""}
                    onChange={(e) => handleChange("end_date", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={form.start_time || ""}
                    onChange={(e) => handleChange("start_time", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={form.end_time || ""}
                    onChange={(e) => handleChange("end_time", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Venue */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Venue
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Venue Name
                  </label>
                  <input
                    type="text"
                    value={form.venue_name || ""}
                    onChange={(e) => handleChange("venue_name", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={form.location || ""}
                    onChange={(e) => handleChange("location", e.target.value)}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Venue Address
                </label>
                <input
                  type="text"
                  value={form.venue_address || ""}
                  onChange={(e) => handleChange("venue_address", e.target.value)}
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Map Link</label>
                <input
                  type="url"
                  value={form.venue_map_link || ""}
                  onChange={(e) => handleChange("venue_map_link", e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                />
                {form.venue_map_link && (
                  <a
                    href={form.venue_map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
                  >
                    <MapPin className="w-3 h-3" />
                    Open in Maps
                  </a>
                )}
              </div>
            </div>
          </section>

          {/* Budget */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Budget
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Budget</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.budget ?? ""}
                    onChange={(e) =>
                      handleChange("budget", e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Estimated
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.estimated_expenses ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "estimated_expenses",
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Actual</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.actual_expenses ?? ""}
                    onChange={(e) =>
                      handleChange(
                        "actual_expenses",
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Links Section (NEW) */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Resource Links
                </h2>
              </div>
              <button
                type="button"
                onClick={addLink}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Link
              </button>
            </div>
            <div className="p-6">
              {links.length === 0 ? (
                <div className="text-center py-8">
                  <Link2 className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 font-medium">No links added yet</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Add links to production briefs, budgets, shot lists, and other resources
                  </p>
                  <button
                    type="button"
                    onClick={addLink}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Link
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Label
                          </label>
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateLink(index, "label", e.target.value)}
                            placeholder="e.g., Production Brief"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            URL
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => updateLink(index, "url", e.target.value)}
                              placeholder="https://..."
                              className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                            />
                            {link.url && (
                              <a
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Open link"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLink(index)}
                        className="mt-6 p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Client Contacts Section (NEW) */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Client Contacts
                </h2>
              </div>
              <button
                type="button"
                onClick={addClientContact}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </button>
            </div>
            <div className="p-6">
              {clientContacts.length === 0 ? (
                <div className="text-center py-8">
                  <UserCircle className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 font-medium">No client contacts added</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Add the event&apos;s main POC and other client contacts
                  </p>
                  <button
                    type="button"
                    onClick={addClientContact}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add First Contact
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {clientContacts.map((contact, index) => (
                    <div
                      key={index}
                      className="p-4 bg-neutral-50 rounded-xl border border-neutral-100"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Contact {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeClientContact(index)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Name <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={contact.name}
                            onChange={(e) => updateClientContact(index, "name", e.target.value)}
                            placeholder="Contact name"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Title / Role
                          </label>
                          <input
                            type="text"
                            value={contact.title || ""}
                            onChange={(e) => updateClientContact(index, "title", e.target.value)}
                            placeholder="e.g., Event Director"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            value={contact.email || ""}
                            onChange={(e) => updateClientContact(index, "email", e.target.value)}
                            placeholder="email@example.com"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={contact.phone || ""}
                            onChange={(e) => updateClientContact(index, "phone", e.target.value)}
                            placeholder="(555) 123-4567"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Company / Organization
                          </label>
                          <input
                            type="text"
                            value={contact.company || ""}
                            onChange={(e) => updateClientContact(index, "company", e.target.value)}
                            placeholder="Company name"
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-neutral-500 mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={contact.notes || ""}
                            onChange={(e) => updateClientContact(index, "notes", e.target.value)}
                            placeholder="Any additional notes about this contact..."
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Event Vendors Section */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Event Vendors
                </h2>
              </div>
              {selectedVendorIds.length > 0 ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-100 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  {selectedVendorIds.length} assigned
                </span>
              ) : (
                <span className="text-xs font-medium text-neutral-400">
                  None assigned
                </span>
              )}
            </div>
            <div className="p-6">
              {vendors.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500 font-medium">No vendors available</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Add vendors in the Vendors tab first, then assign them to events
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search & Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search vendors by name, company, or email..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                      />
                      {vendorSearch && (
                        <button
                          type="button"
                          onClick={() => setVendorSearch("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                        <select
                          value={vendorCategoryFilter}
                          onChange={(e) => setVendorCategoryFilter(e.target.value)}
                          className="pl-9 pr-8 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-700 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 appearance-none cursor-pointer"
                        >
                          <option value="all">All Categories</option>
                          {activeCategories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg border transition-all whitespace-nowrap ${
                          showSelectedOnly
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Selected
                      </button>
                    </div>
                  </div>

                  {/* Results info */}
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span>
                      {filteredVendors.length} of {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
                      {vendorSearch && ` matching "${vendorSearch}"`}
                      {vendorCategoryFilter !== "all" && ` in ${vendorCategoryFilter}`}
                    </span>
                    {selectedVendorIds.length > 0 && !showSelectedOnly && (
                      <span className="text-blue-600 font-medium">
                        Selected vendors shown first
                      </span>
                    )}
                  </div>

                  {/* Vendor List */}
                  {filteredVendors.length === 0 ? (
                    <div className="text-center py-8 bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
                      <Search className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500 font-medium">
                        {showSelectedOnly ? "No vendors assigned yet" : "No vendors match your search"}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {showSelectedOnly
                          ? "Select vendors from the full list to assign them"
                          : "Try adjusting your search or filter"}
                      </p>
                      {(vendorSearch || vendorCategoryFilter !== "all" || showSelectedOnly) && (
                        <button
                          type="button"
                          onClick={() => { setVendorSearch(""); setVendorCategoryFilter("all"); setShowSelectedOnly(false) }}
                          className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1 -mr-1">
                      {filteredVendors.map((vendor) => {
                        const isSelected = selectedVendorIds.includes(vendor.id)
                        return (
                          <label
                            key={vendor.id}
                            className={`group flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? "bg-blue-50/80 border-blue-200 ring-1 ring-blue-100"
                                : "bg-white border-neutral-150 hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <div className={`relative flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all shrink-0 ${
                              isSelected
                                ? "bg-blue-600 border-blue-600"
                                : "border-neutral-300 group-hover:border-neutral-400"
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleVendor(vendor.id)}
                                className="sr-only"
                              />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-semibold truncate ${
                                  isSelected ? "text-blue-900" : "text-neutral-900"
                                }`}>{vendor.name}</p>
                                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                                  isSelected
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-neutral-100 text-neutral-500"
                                }`}>
                                  {vendor.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                                {vendor.company && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3 text-neutral-400" />
                                    <span className="truncate max-w-28">{vendor.company}</span>
                                  </span>
                                )}
                                {vendor.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3 text-neutral-400" />
                                    <span className="truncate max-w-36">{vendor.email}</span>
                                  </span>
                                )}
                                {vendor.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-neutral-400" />
                                    <span>{vendor.phone}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {vendor.rate ? (
                              <div className={`text-right shrink-0 ${
                                isSelected ? "text-blue-700" : "text-neutral-500"
                              }`}>
                                <p className="text-sm font-bold tabular-nums">
                                  ${vendor.rate.toLocaleString()}
                                </p>
                                {vendor.rate_type && (
                                  <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                                    per {vendor.rate_type}
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Additional Details */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Additional Details
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Agenda Overview
                </label>
                <textarea
                  rows={6}
                  value={form.agenda_overview || ""}
                  onChange={(e) => handleChange("agenda_overview", e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-y min-h-35"
                  placeholder="Enter the event agenda, schedule, speakers, topics, etc..."
                />
                <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" />
                  Drag the bottom-right corner to expand
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea
                  rows={5}
                  value={form.notes || ""}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 resize-y min-h-30"
                  placeholder="Internal notes, reminders, follow-ups..."
                />
                <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                  <GripVertical className="w-3 h-3" />
                  Drag the bottom-right corner to expand
                </p>
              </div>
            </div>
          </section>

          {/* Banner Image */}
          <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                Banner Image
              </h2>
            </div>
            <div className="p-6">
              <ImageUpload
                value={form.photo_banner || ""}
                onChange={(url) => handleChange("photo_banner", url)}
                label="Event Banner"
                accept="image/*,.gif"
                maxSize={10}
              />
            </div>
          </section>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between py-6">
            <Link
              href="/admin/project-management"
              className="px-5 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-8 py-3 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isNew ? "Create Event" : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
