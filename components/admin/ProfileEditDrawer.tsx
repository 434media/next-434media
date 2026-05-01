"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Loader2, Save, CheckCircle2, AlertCircle } from "lucide-react"
import { upload } from "@vercel/blob/client"
import { DetailDrawer } from "./DetailDrawer"

interface AdminUser {
  email: string
  name: string
  picture?: string
}

interface ProfileEditDrawerProps {
  open: boolean
  user: AdminUser
  onClose: () => void
  onProfileUpdate?: (user: AdminUser) => void
}

export function ProfileEditDrawer({ open, user, onClose, onProfileUpdate }: ProfileEditDrawerProps) {
  const [editName, setEditName] = useState(user.name)
  const [editPicture, setEditPicture] = useState(user.picture || "")
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setEditName(user.name)
      setEditPicture(user.picture || "")
      setError(null)
      setSuccess(false)
    }
  }, [open, user])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB")
      return
    }
    setIsUploading(true)
    setError(null)
    try {
      const filename = `profile-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const blob = await upload(filename, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      })
      setEditPicture(blob.url)
    } catch (err) {
      console.error("Photo upload error:", err)
      setError("Failed to upload photo")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!editName.trim() || editName.trim().length < 2) {
      setError("Name must be at least 2 characters")
      return
    }
    setIsSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          picture: editPicture || null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to update profile")
      setSuccess(true)
      if (onProfileUpdate && data.profile) onProfileUpdate(data.profile)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1200)
    } catch (err) {
      console.error("Profile save error:", err)
      setError(err instanceof Error ? err.message : "Failed to save profile")
    } finally {
      setIsSaving(false)
    }
  }

  const dirty = editName !== user.name || editPicture !== (user.picture || "")

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Edit profile"
      subtitle={user.email}
      width="md"
      footer={
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-white">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:text-neutral-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || isUploading || !dirty}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save changes
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative group shrink-0">
            {editPicture ? (
              <img
                src={editPicture}
                alt={editName}
                className="w-20 h-20 rounded-full border border-neutral-200 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-500 text-2xl font-semibold">
                {editName.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Upload profile photo"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900">Profile photo</p>
            <p className="text-xs text-neutral-500 mt-0.5">PNG or JPG, up to 5MB</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mt-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 underline disabled:opacity-50"
            >
              Upload new photo
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Display name
          </label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3 py-2 text-sm border border-neutral-100 rounded-lg bg-neutral-50 text-neutral-500 cursor-not-allowed"
          />
          <p className="text-[11px] text-neutral-400 mt-1">Email is managed by your sign-in provider</p>
        </div>

        {/* Status */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-700">Profile updated</p>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
