"use client"

import { useState, useEffect, use } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import type { PMEvent, Vendor } from "@/types/project-management-types"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import EventForm from "../../../components/EventForm"

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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

      if (!eventRes.ok) {
        throw new Error("Event not found")
      }

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

  const showToast = (message: string, type: "success" | "error" | "warning") => {
    setToast({ message, type })
  }

  const handleSave = async (eventData: Partial<PMEvent>) => {
    const data = { ...eventData }
    if (data.start_date && !data.date) {
      data.date = data.start_date
    }

    const { id: eventId, ...updateData } = data
    const response = await fetch("/api/admin/project-management", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "event", id, data: updateData }),
    })
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.error || "Update failed")
    }
    showToast("Event updated successfully", "success")
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
        event={event}
        vendors={vendors}
        onSave={handleSave}
        showToast={showToast}
      />
    </AdminRoleGuard>
  )
}
