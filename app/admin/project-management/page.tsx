"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Loader2,
  Calendar,
  Building2,
  Mic2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import type { PMEvent, Vendor, Speaker } from "@/types/project-management-types"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import VendorTable from "./components/VendorTable"
import SpeakersSection from "./components/SpeakersSection"
import EventsSection from "./components/EventsSection"

type ViewMode = "events" | "vendors" | "speakers"

interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

export default function ProjectManagementPage() {
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // View state
  const [activeView, setActiveView] = useState<ViewMode>("events")

  // Data state
  const [events, setEvents] = useState<PMEvent[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [speakers, setSpeakers] = useState<Speaker[]>([])

  // Load data on mount
  useEffect(() => {
    loadData()
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type })
  }

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/project-management?type=all")
      if (!response.ok) throw new Error("Failed to fetch data")
      const data = await response.json()
      setEvents(data.events || [])
      setVendors(data.vendors || [])
      setSpeakers(data.speakers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // CRUD Handlers
  // ============================================

  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return
    try {
      const response = await fetch(`/api/admin/project-management?type=${type}&id=${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      showToast("Item deleted successfully", "success")
      // Remove from local state
      if (type === "event") setEvents(prev => prev.filter(e => e.id !== id))
      else if (type === "vendor") setVendors(prev => prev.filter(v => v.id !== id))
      else if (type === "speaker") setSpeakers(prev => prev.filter(s => s.id !== id))
    } catch {
      showToast("Failed to delete item", "error")
    }
  }

  // Generic duplicate — strips id/created_at/updated_at, suffixes the name with
  // "(copy)" so the editor sees a clear stub, then POSTs a new record. Same
  // pattern across event/vendor/speaker since the API shape is uniform.
  const handleDuplicate = async (
    type: "event" | "vendor" | "speaker",
    record: PMEvent | Vendor | Speaker,
  ) => {
    try {
      const { id: _id, created_at: _ca, updated_at: _ua, airtable_id: _aid, ...rest } =
        record as PMEvent & Vendor & Speaker
      void _id; void _ca; void _ua; void _aid
      const baseName = (rest as { name?: string }).name || ""
      const data = {
        ...rest,
        name: baseName ? `${baseName} (copy)` : "Untitled (copy)",
      }
      const response = await fetch("/api/admin/project-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", type, data }),
      })
      if (!response.ok) throw new Error("Duplicate failed")
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} duplicated`, "success")
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to duplicate", "error")
    }
  }

  const handleSaveVendor = async (vendor: Partial<Vendor>, isNew: boolean) => {
    try {
      if (isNew) {
        const response = await fetch("/api/admin/project-management", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", type: "vendor", data: vendor }),
        })
        if (!response.ok) throw new Error("Create failed")
        showToast("Vendor created successfully", "success")
      } else {
        const { id, ...data } = vendor
        const response = await fetch("/api/admin/project-management", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "vendor", id, data }),
        })
        if (!response.ok) throw new Error("Update failed")
        showToast("Vendor updated successfully", "success")
      }
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save vendor", "error")
      throw err
    }
  }

  const handleSaveSpeaker = async (speaker: Partial<Speaker>, isNew: boolean) => {
    try {
      if (isNew) {
        const response = await fetch("/api/admin/project-management", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", type: "speaker", data: speaker }),
        })
        if (!response.ok) throw new Error("Create failed")
        showToast("Speaker created successfully", "success")
      } else {
        const { id, ...data } = speaker
        const response = await fetch("/api/admin/project-management", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "speaker", id, data }),
        })
        if (!response.ok) throw new Error("Update failed")
        showToast("Speaker updated successfully", "success")
      }
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save speaker", "error")
      throw err
    }
  }

  const handleSaveEvent = async (event: Partial<PMEvent>, isNew: boolean) => {
    try {
      // Ensure date is synced with start_date
      const eventData = { ...event }
      if (eventData.start_date && !eventData.date) {
        eventData.date = eventData.start_date
      }

      if (isNew) {
        const response = await fetch("/api/admin/project-management", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create", type: "event", data: eventData }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || "Create failed")
        }
        showToast("Event created successfully", "success")
      } else {
        const { id, ...data } = eventData
        if (!id) throw new Error("Event ID is missing")
        const response = await fetch("/api/admin/project-management", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "event", id, data }),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.error || "Update failed")
        }
        showToast("Event updated successfully", "success")
      }
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save event", "error")
      throw err
    }
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-4 right-4 z-60 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white ring-1 ring-neutral-200 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] text-sm"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-neutral-900">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 py-5 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">
                  Project Management
                </h1>
                <p className="text-sm text-neutral-500 mt-1 tabular-nums">
                  {events.length} {events.length === 1 ? "event" : "events"} ·{" "}
                  {vendors.length} {vendors.length === 1 ? "vendor" : "vendors"} ·{" "}
                  {speakers.length} {speakers.length === 1 ? "speaker" : "speakers"}
                </p>
              </div>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                title="Refresh"
                aria-label="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Tabs">
              {[
                { id: "events" as const, label: "Events", icon: Calendar, count: events.length },
                { id: "vendors" as const, label: "Vendors", icon: Building2, count: vendors.length },
                { id: "speakers" as const, label: "Speakers", icon: Mic2, count: speakers.length },
              ].map((tab) => {
                const isActive = activeView === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id)}
                    className={`relative inline-flex items-center gap-2 px-4 py-3 text-[13px] font-medium tracking-wide whitespace-nowrap transition-colors ${
                      isActive ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    <span
                      className={`tabular-nums text-[10px] ${
                        isActive ? "text-neutral-900" : "text-neutral-400"
                      }`}
                    >
                      {tab.count}
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-400" />
            </div>
          ) : error ? (
            <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
                <AlertCircle className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-neutral-900 mb-1">Couldn't load data</p>
              <p className="text-xs text-neutral-500 mb-3">{error}</p>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeView === "events" && (
                <motion.div
                  key="events"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <EventsSection
                    events={events}
                    onDelete={(id: string) => handleDelete("event", id)}
                    onSave={handleSaveEvent}
                    onDuplicate={(event: PMEvent) => handleDuplicate("event", event)}
                    showToast={showToast}
                  />
                </motion.div>
              )}

              {activeView === "vendors" && (
                <motion.div
                  key="vendors"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <VendorTable
                    vendors={vendors}
                    onDelete={(id) => handleDelete("vendor", id)}
                    onSave={handleSaveVendor}
                    onDuplicate={(vendor) => handleDuplicate("vendor", vendor)}
                    showToast={showToast}
                  />
                </motion.div>
              )}

              {activeView === "speakers" && (
                <motion.div
                  key="speakers"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SpeakersSection
                    speakers={speakers}
                    onDelete={(id) => handleDelete("speaker", id)}
                    onSave={handleSaveSpeaker}
                    onDuplicate={(speaker) => handleDuplicate("speaker", speaker)}
                    showToast={showToast}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
