"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
  MapPin,
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
  ChevronDown,
  Cloud,
} from "lucide-react"
import type { PMEvent, EventLink, EventClientContact, Vendor } from "@/types/project-management-types"
import { PM_EVENT_STATUSES } from "@/types/project-management-types"
import { ImageUpload } from "@/components/ImageUpload"
import { useFeedFormShortcuts, MOD_KEY_LABEL } from "@/components/admin/useFeedFormShortcuts"
import { EventPrePublishChecklist } from "@/components/admin/EventPrePublishChecklist"

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

  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedFormData = useRef<string>("")
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

  const activeCategories = [...new Set(vendors.map((v) => v.category).filter(Boolean))].sort()

  useEffect(() => {
    if (isNew) return
    const currentFormString = JSON.stringify(form)
    if (lastSavedFormData.current && currentFormString !== lastSavedFormData.current) {
      setHasUnsavedChanges(true)
    }
  }, [form, isNew])

  useEffect(() => {
    if (!isNew) {
      lastSavedFormData.current = JSON.stringify(form)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew])

  const autoSaveToBackend = useCallback(async () => {
    if (isNew) return
    if (!form.name?.trim()) return
    if (!hasUnsavedChanges) return

    const currentFormString = JSON.stringify(form)
    if (currentFormString === lastSavedFormData.current) return

    setIsAutoSaving(true)
    try {
      const eventData = { ...form }
      if (eventData.start_date && !eventData.date) eventData.date = eventData.start_date
      if (eventData.links) {
        eventData.links = eventData.links.filter((l) => l.label.trim() || l.url.trim())
      }
      if (eventData.client_contacts) {
        eventData.client_contacts = eventData.client_contacts.filter((c) => c.name.trim())
      }
      await onSave(eventData, false)
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      lastSavedFormData.current = currentFormString
    } catch (err) {
      console.error("Autosave failed:", err)
    } finally {
      setIsAutoSaving(false)
    }
  }, [form, isNew, hasUnsavedChanges, onSave])

  useEffect(() => {
    if (isNew) return
    if (!form.name?.trim()) return
    const interval = setInterval(() => autoSaveToBackend(), 30000)
    return () => clearInterval(interval)
  }, [isNew, form.name, autoSaveToBackend])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && form.name?.trim() && !isNew) {
        autoSaveToBackend()
        e.preventDefault()
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges, form.name, isNew, autoSaveToBackend])

  useFeedFormShortcuts({
    enabled: true,
    onSave: () => {
      if (isSaving) return
      handleSubmit({ preventDefault: () => {} } as React.FormEvent)
    },
    onCancel: () => router.push("/admin/project-management"),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name?.trim()) {
      showToast("Event name is required", "error")
      return
    }
    setIsSaving(true)
    try {
      const eventData = { ...form }
      if (eventData.start_date && !eventData.date) {
        eventData.date = eventData.start_date
      }
      if (eventData.links) {
        eventData.links = eventData.links.filter((l) => l.label.trim() || l.url.trim())
      }
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

  const inputClass =
    "w-full h-9 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
  const textareaClass =
    "w-full px-3 py-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
  const subInputClass =
    "w-full h-8 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
  const labelClass = "block text-xs font-medium text-neutral-700 mb-1.5"
  const subLabelClass = "block text-[11px] font-medium text-neutral-500 mb-1"
  const eyebrowClass = "text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500"

  return (
    <div className="min-h-dvh pt-20 bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-16 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin/project-management"
                className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                title="Back to events"
                aria-label="Back to events"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900 truncate">
                {isNew ? "New event" : `Edit · ${event?.name}`}
              </h1>

              {!isNew && form.name?.trim() && (
                <div className="hidden sm:flex items-center gap-1.5 ml-2 text-[11px]">
                  {isAutoSaving ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
                      <span
                        className="inline-block h-1 w-1 rounded-full bg-neutral-900 animate-pulse"
                        aria-hidden="true"
                      />
                      <Cloud className="h-3 w-3" />
                      Saving
                    </span>
                  ) : lastSavedAt ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
                      <span
                        className="inline-block h-1 w-1 rounded-full bg-emerald-500"
                        aria-hidden="true"
                      />
                      Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                      <span
                        className="inline-block h-1 w-1 rounded-full bg-amber-500"
                        aria-hidden="true"
                      />
                      Unsaved
                    </span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <EventPrePublishChecklist formData={form} />
              <Link
                href="/admin/project-management"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Cancel (Esc)"
              >
                Cancel
              </Link>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                title={`Save (${MOD_KEY_LABEL}S)`}
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {isSaving ? "Saving…" : isNew ? "Create event" : "Update"}
                {!isSaving && (
                  <kbd className="ml-1 px-1 rounded bg-white/15 font-mono text-[10px] tabular-nums">
                    {MOD_KEY_LABEL}S
                  </kbd>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-4">
            <p className={eyebrowClass}>Basic information</p>
            <div>
              <label className={labelClass}>
                Event name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Status</label>
                <select
                  value={form.status || "planning"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className={inputClass}
                >
                  {PM_EVENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Website URL</label>
                <input
                  type="url"
                  value={form.website_url || ""}
                  onChange={(e) => handleChange("website_url", e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
                {form.website_url && (
                  <a
                    href={form.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open link
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                rows={5}
                value={form.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                className={`${textareaClass} min-h-30`}
                placeholder="Describe the event details, purpose, and any important information…"
              />
            </div>
          </section>

          {/* Date & Time */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-4">
            <p className={eyebrowClass}>Date & time</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start date</label>
                <input
                  type="date"
                  value={form.start_date || ""}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End date</label>
                <input
                  type="date"
                  value={form.end_date || ""}
                  onChange={(e) => handleChange("end_date", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Start time</label>
                <input
                  type="time"
                  value={form.start_time || ""}
                  onChange={(e) => handleChange("start_time", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>End time</label>
                <input
                  type="time"
                  value={form.end_time || ""}
                  onChange={(e) => handleChange("end_time", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* Venue */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-4">
            <p className={eyebrowClass}>Venue</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Venue name</label>
                <input
                  type="text"
                  value={form.venue_name || ""}
                  onChange={(e) => handleChange("venue_name", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Location</label>
                <input
                  type="text"
                  value={form.location || ""}
                  onChange={(e) => handleChange("location", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Venue address</label>
              <input
                type="text"
                value={form.venue_address || ""}
                onChange={(e) => handleChange("venue_address", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Map link</label>
              <input
                type="url"
                value={form.venue_map_link || ""}
                onChange={(e) => handleChange("venue_map_link", e.target.value)}
                placeholder="https://maps.google.com/..."
                className={inputClass}
              />
              {form.venue_map_link && (
                <a
                  href={form.venue_map_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-800"
                >
                  <MapPin className="w-3 h-3" />
                  Open in Maps
                </a>
              )}
            </div>
          </section>

          {/* Budget */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-4">
            <p className={eyebrowClass}>Budget</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Budget</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.budget ?? ""}
                  onChange={(e) =>
                    handleChange("budget", e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className={labelClass}>Estimated</label>
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
                  className={`${inputClass} tabular-nums`}
                />
              </div>
              <div>
                <label className={labelClass}>Actual</label>
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
                  className={`${inputClass} tabular-nums`}
                />
              </div>
            </div>
          </section>

          {/* Resource Links */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className={`${eyebrowClass} flex items-center gap-2`}>
                <Link2 className="w-3.5 h-3.5" />
                Resource links
                {links.length > 0 && (
                  <span className="ml-1 text-neutral-400 normal-case tracking-normal">
                    {links.length}
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={addLink}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add link
              </button>
            </div>
            {links.length === 0 ? (
              <div className="text-center py-6 rounded-md ring-1 ring-dashed ring-neutral-200">
                <Link2 className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No links added yet</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Production briefs, budgets, shot lists, and other resources
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-md ring-1 ring-neutral-200"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className={subLabelClass}>Label</label>
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => updateLink(index, "label", e.target.value)}
                          placeholder="e.g., Production brief"
                          className={subInputClass}
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>URL</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="url"
                            value={link.url}
                            onChange={(e) => updateLink(index, "url", e.target.value)}
                            placeholder="https://..."
                            className={`${subInputClass} flex-1`}
                          />
                          {link.url && (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-md text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Open link"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      className="mt-5 inline-flex items-center justify-center h-8 w-8 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remove link"
                      aria-label="Remove link"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Client Contacts */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className={`${eyebrowClass} flex items-center gap-2`}>
                <UserCircle className="w-3.5 h-3.5" />
                Client contacts
                {clientContacts.length > 0 && (
                  <span className="ml-1 text-neutral-400 normal-case tracking-normal">
                    {clientContacts.length}
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={addClientContact}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md ring-1 ring-neutral-200 bg-white text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add contact
              </button>
            </div>
            {clientContacts.length === 0 ? (
              <div className="text-center py-6 rounded-md ring-1 ring-dashed ring-neutral-200">
                <UserCircle className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No client contacts added</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Add the event&apos;s main POC and other client contacts
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {clientContacts.map((contact, index) => (
                  <div key={index} className="rounded-md ring-1 ring-neutral-200 p-3">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.18em]">
                        Contact {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeClientContact(index)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove contact"
                        aria-label="Remove contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={subLabelClass}>
                          Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={contact.name}
                          onChange={(e) => updateClientContact(index, "name", e.target.value)}
                          placeholder="Contact name"
                          className={subInputClass}
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>Title / role</label>
                        <input
                          type="text"
                          value={contact.title || ""}
                          onChange={(e) => updateClientContact(index, "title", e.target.value)}
                          placeholder="e.g., Event Director"
                          className={subInputClass}
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>Email</label>
                        <input
                          type="email"
                          value={contact.email || ""}
                          onChange={(e) => updateClientContact(index, "email", e.target.value)}
                          placeholder="email@example.com"
                          className={subInputClass}
                        />
                      </div>
                      <div>
                        <label className={subLabelClass}>Phone</label>
                        <input
                          type="tel"
                          value={contact.phone || ""}
                          onChange={(e) => updateClientContact(index, "phone", e.target.value)}
                          placeholder="(555) 123-4567"
                          className={subInputClass}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={subLabelClass}>Company / organization</label>
                        <input
                          type="text"
                          value={contact.company || ""}
                          onChange={(e) => updateClientContact(index, "company", e.target.value)}
                          placeholder="Company name"
                          className={subInputClass}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={subLabelClass}>Notes</label>
                        <input
                          type="text"
                          value={contact.notes || ""}
                          onChange={(e) => updateClientContact(index, "notes", e.target.value)}
                          placeholder="Any additional notes about this contact…"
                          className={subInputClass}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Vendors */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className={`${eyebrowClass} flex items-center gap-2`}>
                <Building2 className="w-3.5 h-3.5" />
                Event vendors
              </p>
              {selectedVendorIds.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md ring-1 ring-blue-200 bg-blue-50 text-[11px] font-semibold text-blue-700">
                  <CheckCircle2 className="w-3 h-3" />
                  {selectedVendorIds.length} assigned
                </span>
              ) : (
                <span className="text-[11px] text-neutral-400">None assigned</span>
              )}
            </div>
            {vendors.length === 0 ? (
              <div className="text-center py-6 rounded-md ring-1 ring-dashed ring-neutral-200">
                <Building2 className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No vendors available</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Add vendors in the Vendors tab first
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search vendors by name, company, or email…"
                      value={vendorSearch}
                      onChange={(e) => setVendorSearch(e.target.value)}
                      className="w-full h-9 pl-9 pr-8 rounded-md ring-1 ring-neutral-200 bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                    />
                    {vendorSearch && (
                      <button
                        type="button"
                        onClick={() => setVendorSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        aria-label="Clear search"
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
                        className="h-9 pl-9 pr-8 rounded-md ring-1 ring-neutral-200 bg-white text-sm text-neutral-700 focus:ring-2 focus:ring-neutral-900 focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="all">All categories</option>
                        {activeCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSelectedOnly(!showSelectedOnly)}
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md ring-1 text-[11px] font-semibold transition-all whitespace-nowrap ${
                        showSelectedOnly
                          ? "ring-blue-200 bg-blue-50 text-blue-700"
                          : "ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Selected
                    </button>
                  </div>
                </div>

                {/* Results info */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span>
                    {filteredVendors.length} of {vendors.length} vendor
                    {vendors.length !== 1 ? "s" : ""}
                    {vendorSearch && ` matching "${vendorSearch}"`}
                    {vendorCategoryFilter !== "all" && ` in ${vendorCategoryFilter}`}
                  </span>
                  {selectedVendorIds.length > 0 && !showSelectedOnly && (
                    <span className="text-blue-600 font-medium">Selected shown first</span>
                  )}
                </div>

                {/* Vendor List */}
                {filteredVendors.length === 0 ? (
                  <div className="text-center py-6 rounded-md ring-1 ring-dashed ring-neutral-200">
                    <Search className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">
                      {showSelectedOnly
                        ? "No vendors assigned yet"
                        : "No vendors match your search"}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {showSelectedOnly
                        ? "Select vendors from the full list to assign them"
                        : "Try adjusting your search or filter"}
                    </p>
                    {(vendorSearch || vendorCategoryFilter !== "all" || showSelectedOnly) && (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorSearch("")
                          setVendorCategoryFilter("all")
                          setShowSelectedOnly(false)
                        }}
                        className="mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
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
                          className={`group flex items-center gap-3 p-3 rounded-md ring-1 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-blue-50/50 ring-blue-200"
                              : "bg-white ring-neutral-200 hover:ring-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          <div
                            className={`relative flex items-center justify-center w-4 h-4 rounded-sm ring-2 transition-all shrink-0 ${
                              isSelected
                                ? "bg-blue-600 ring-blue-600"
                                : "bg-white ring-neutral-300 group-hover:ring-neutral-400"
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                viewBox="0 0 12 12"
                                fill="none"
                              >
                                <path
                                  d="M2.5 6L5 8.5L9.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
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
                              <p
                                className={`text-sm font-semibold truncate ${
                                  isSelected ? "text-blue-900" : "text-neutral-900"
                                }`}
                              >
                                {vendor.name}
                              </p>
                              {vendor.category && (
                                <span
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                    isSelected
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-neutral-100 text-neutral-500"
                                  }`}
                                >
                                  {vendor.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-neutral-500">
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
                            <div
                              className={`text-right shrink-0 ${
                                isSelected ? "text-blue-700" : "text-neutral-600"
                              }`}
                            >
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
          </section>

          {/* Additional Details */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-4">
            <p className={eyebrowClass}>Additional details</p>
            <div>
              <label className={labelClass}>Agenda overview</label>
              <textarea
                rows={6}
                value={form.agenda_overview || ""}
                onChange={(e) => handleChange("agenda_overview", e.target.value)}
                className={`${textareaClass} min-h-35`}
                placeholder="Enter the event agenda, schedule, speakers, topics, etc…"
              />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea
                rows={5}
                value={form.notes || ""}
                onChange={(e) => handleChange("notes", e.target.value)}
                className={`${textareaClass} min-h-30`}
                placeholder="Internal notes, reminders, follow-ups…"
              />
            </div>
          </section>

          {/* Banner Image */}
          <section className="bg-white rounded-md ring-1 ring-neutral-200/70 p-5 space-y-3">
            <p className={eyebrowClass}>Banner image</p>
            <ImageUpload
              value={form.photo_banner || ""}
              onChange={(url) => handleChange("photo_banner", url)}
              label="Event banner"
              accept="image/*,.gif"
              maxSize={10}
            />
          </section>
        </form>
      </main>
    </div>
  )
}
