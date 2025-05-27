"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, Shield, CheckCircle } from "lucide-react"
import { deleteEventAction } from "@/app/actions/events"
import type { Event } from "../../types/event-types"

interface DeleteEventModalProps {
  event: Event
  isOpen: boolean
  onClose: () => void
  onDeleted: () => void
}

export function DeleteEventModal({ event, isOpen, onClose, onDeleted }: DeleteEventModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [adminKey, setAdminKey] = useState("")
  const [turnstileToken, setTurnstileToken] = useState("")
  const [step, setStep] = useState<"confirm" | "security" | "success">("confirm")
  const [error, setError] = useState("")

  const handleDelete = async () => {
    if (step === "confirm") {
      setStep("security")
      return
    }

    if (!adminKey.trim()) {
      setError("Please enter the admin key")
      return
    }

    setIsDeleting(true)
    setError("")

    try {
      const result = await deleteEventAction(event.id, adminKey, turnstileToken)

      if (result.success) {
        setStep("success")
        // Wait for success animation, then close and update
        setTimeout(() => {
          onDeleted()
          onClose()
          resetModal()
        }, 2000)
      } else {
        setError(result.error || "Failed to delete event")
      }
    } catch (error) {
      setError("Error deleting event. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  const resetModal = () => {
    setStep("confirm")
    setAdminKey("")
    setError("")
    setIsDeleting(false)
  }

  const handleClose = () => {
    if (step !== "success") {
      resetModal()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        {step === "confirm" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Event</h3>
            </div>

            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>"{event.title}"</strong>? This action cannot be undone.
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-800 text-sm">
                <strong>Warning:</strong> This will permanently remove the event from your database.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "security" && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-full">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Security Verification</h3>
            </div>

            <p className="text-gray-600 mb-4">Please enter the admin key to confirm deletion:</p>

            <div className="mb-4">
              <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Key
              </label>
              <input
                type="password"
                id="adminKey"
                value={adminKey}
                onChange={(e) => {
                  setAdminKey(e.target.value)
                  setError("") // Clear error when typing
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adminKey.trim()) {
                    handleDelete()
                  }
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                  error ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
                placeholder="Enter admin key..."
                autoFocus
              />
              {error && <p className="text-red-600 text-sm mt-1 animate-fade-in">{error}</p>}
            </div>

            {/* Turnstile Widget Placeholder */}
            <div className="mb-4">
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">Security verification would appear here</p>
                <p className="text-xs text-gray-500 mt-1">(Turnstile widget in production)</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep("confirm")
                  setError("")
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Back
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting || !adminKey.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Event
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="text-center py-4">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full animate-bounce-in">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Event Deleted Successfully!</h3>
            <p className="text-gray-600 mb-4">
              <strong>"{event.title}"</strong> has been permanently removed from your events.
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-green-600 h-2 rounded-full animate-progress-bar"></div>
            </div>
            <p className="text-sm text-gray-500">Updating your events list...</p>
          </div>
        )}
      </div>
    </div>
  )
}
