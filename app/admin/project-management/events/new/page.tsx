"use client"

import { useState, useEffect } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import type { PMEvent, Vendor } from "../../../../types/project-management-types"
import { AdminRoleGuard } from "../../../../components/AdminRoleGuard"
import EventForm from "../../components/EventForm"

export default function NewEventPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "warning" } | null>(null)

  useEffect(() => {
    loadVendors()
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadVendors = async () => {
    try {
      const response = await fetch("/api/admin/project-management?type=vendors")
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
      }
    } catch {
      // Non-critical: vendors just won't be available to assign
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type })
  }

  const handleSave = async (event: Partial<PMEvent>, isNew: boolean) => {
    const eventData = { ...event }
    if (eventData.start_date && !eventData.date) {
      eventData.date = eventData.start_date
    }

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
      <EventForm
        event={null}
        vendors={vendors}
        onSave={handleSave}
        showToast={showToast}
      />
    </AdminRoleGuard>
  )
}
