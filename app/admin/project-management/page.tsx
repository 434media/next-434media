"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  Loader2,
  Calendar,
  Building2,
  Mic2,
  CheckCircle2,
  AlertCircle,
  X,
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
      <div className="min-h-dvh pt-20 bg-neutral-50 text-neutral-900">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-60 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg ${
                toast.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : toast.type === "error"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
              <span className="font-medium text-sm tracking-wide">{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link
                  href="/admin"
                  className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-sm font-medium tracking-wide">Back</span>
                </Link>
                <div className="h-6 w-px bg-neutral-200" />
                <h1 className="text-lg font-bold tracking-tight text-neutral-900">
                  Project Management
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs */}
        <div className="border-b border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-1" aria-label="Tabs">
              {[
                { id: "events" as const, label: "Events", icon: Calendar, count: events.length },
                { id: "vendors" as const, label: "Vendors", icon: Building2, count: vendors.length },
                { id: "speakers" as const, label: "Speakers", icon: Mic2, count: speakers.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`relative flex items-center gap-2.5 px-5 py-4 text-sm font-semibold tracking-wide transition-all ${
                    activeView === tab.id
                      ? "text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                      activeView === tab.id
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                  {activeView === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900"
                    />
                  )}
                </button>
              ))}
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
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-lg font-medium text-red-600">{error}</p>
              <button
                onClick={loadData}
                className="mt-4 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors shadow-sm"
              >
                Try Again
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
