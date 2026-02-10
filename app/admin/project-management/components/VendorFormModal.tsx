"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Loader2, Trash2, Paperclip, Upload } from "lucide-react"
import { upload } from "@vercel/blob/client"
import type { Vendor, VendorAttachment } from "../../../types/project-management-types"
import { VENDOR_CATEGORIES } from "../../../types/project-management-types"
import { ImageUpload } from "../../../components/ImageUpload"

interface VendorFormModalProps {
  isOpen: boolean
  vendor: Vendor | null // null = create mode
  onClose: () => void
  onSave: (data: Partial<Vendor>) => Promise<void>
}

const RATE_TYPES = ["hourly", "daily", "project", "flat"] as const
const CONTRACT_STATUSES = ["active", "pending", "inactive", "expired"] as const

const emptyForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  category: "Other",
  specialty: "",
  website: "",
  link_url: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  photo: "",
  social_media: "",
  research: "",
  rate: "",
  rate_type: "hourly" as typeof RATE_TYPES[number],
  contract_status: "" as string,
  notes: "",
  rating: "",
}

export default function VendorFormModal({ isOpen, vendor, onClose, onSave }: VendorFormModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [attachments, setAttachments] = useState<VendorAttachment[]>([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const isEditing = !!vendor

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name || "",
        company: vendor.company || "",
        email: vendor.email || "",
        phone: vendor.phone || "",
        category: vendor.category || "Other",
        specialty: vendor.specialty || "",
        website: vendor.website || "",
        link_url: vendor.link_url || "",
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
        zip: vendor.zip || "",
        photo: vendor.photo || "",
        social_media: vendor.social_media || "",
        research: vendor.research || "",
        rate: vendor.rate?.toString() || "",
        rate_type: (vendor.rate_type || "hourly") as typeof RATE_TYPES[number],
        contract_status: vendor.contract_status || "",
        notes: vendor.notes || "",
        rating: vendor.rating?.toString() || "",
      })
      setAttachments(vendor.attachments || [])
    } else {
      setForm(emptyForm)
      setAttachments([])
    }
    setErrors({})
  }, [vendor, isOpen])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = "Name is required"
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Invalid email"
    if (form.rate && isNaN(Number(form.rate))) errs.rate = "Rate must be a number"
    if (form.rating && (isNaN(Number(form.rating)) || Number(form.rating) < 0 || Number(form.rating) > 5)) errs.rating = "Rating must be 0-5"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    try {
      const data: Partial<Vendor> = {
        ...(isEditing && vendor ? { id: vendor.id } : {}),
        name: form.name.trim(),
        company: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        category: form.category,
        specialty: form.specialty.trim() || undefined,
        website: form.website.trim() || undefined,
        link_url: form.link_url.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zip: form.zip.trim() || undefined,
        photo: form.photo.trim() || undefined,
        social_media: form.social_media.trim() || undefined,
        research: form.research.trim() || undefined,
        rate: form.rate ? Number(form.rate) : undefined,
        rate_type: form.rate ? (form.rate_type as Vendor["rate_type"]) : undefined,
        contract_status: form.contract_status ? (form.contract_status as Vendor["contract_status"]) : undefined,
        notes: form.notes.trim() || undefined,
        rating: form.rating ? Number(form.rating) : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      }
      await onSave(data)
    } catch {
      // error handled by parent
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const inputClass = (field: string) =>
    `w-full px-3 py-2.5 text-sm bg-white border rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-400 transition-colors ${
      errors[field] ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-neutral-200"
    }`

  const labelClass = "block text-sm font-medium text-neutral-700 mb-1.5"

  const handleAttachmentUpload = useCallback(
    async (file: File) => {
      if (file.size > 25 * 1024 * 1024) {
        alert("File size must be less than 25MB")
        return
      }
      setUploadingAttachment(true)
      try {
        const timestamp = Date.now()
        const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
        const filename = `vendor-attachments/${timestamp}-${originalName}`
        const blob = await upload(filename, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
        })
        setAttachments((prev) => [
          ...prev,
          { url: blob.url, filename: file.name, type: file.type || "application/octet-stream" },
        ])
      } catch (error) {
        console.error("Attachment upload error:", error)
        alert("Failed to upload attachment")
      } finally {
        setUploadingAttachment(false)
        if (attachmentInputRef.current) attachmentInputRef.current.value = ""
      }
    },
    []
  )

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <div className="w-8 h-1 bg-yellow-400 mb-2" />
                  <h2 className="text-xl font-bold text-neutral-900">
                    {isEditing ? "Edit Vendor" : "Add New Vendor"}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {isEditing ? `Editing ${vendor?.name}` : "Fill in vendor details below"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              {/* Vendor Photo */}
              <ImageUpload
                value={form.photo}
                onChange={(url) => updateField("photo", url)}
                label="Vendor Photo"
                accept="image/*,.gif"
                maxSize={10}
              />

              {/* Basic Info */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Basic Information
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>
                      Company / Vendor Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="Company or vendor name"
                      className={inputClass("name")}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select
                      value={form.category}
                      onChange={(e) => updateField("category", e.target.value)}
                      className={inputClass("category")}
                    >
                      {VENDOR_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Specialty</label>
                    <input
                      type="text"
                      value={form.specialty}
                      onChange={(e) => updateField("specialty", e.target.value)}
                      placeholder="e.g. Wedding photography"
                      className={inputClass("specialty")}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Contact */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Contact Information
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      placeholder="vendor@example.com"
                      className={inputClass("email")}
                    />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputClass("phone")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      placeholder="https://example.com"
                      className={inputClass("website")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Link URL</label>
                    <input
                      type="url"
                      value={form.link_url}
                      onChange={(e) => updateField("link_url", e.target.value)}
                      placeholder="https://portfolio.com"
                      className={inputClass("link_url")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Social Media</label>
                    <input
                      type="text"
                      value={form.social_media}
                      onChange={(e) => updateField("social_media", e.target.value)}
                      placeholder="@handle or URL"
                      className={inputClass("social_media")}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Location */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Location
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="Street address"
                      className={inputClass("address")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="City"
                      className={inputClass("city")}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        placeholder="TX"
                        className={inputClass("state")}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>ZIP</label>
                      <input
                        type="text"
                        value={form.zip}
                        onChange={(e) => updateField("zip", e.target.value)}
                        placeholder="78201"
                        className={inputClass("zip")}
                      />
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Rate & Status */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Rate & Status
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Rate ($)</label>
                    <input
                      type="text"
                      value={form.rate}
                      onChange={(e) => updateField("rate", e.target.value)}
                      placeholder="0.00"
                      className={inputClass("rate")}
                    />
                    {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Rate Type</label>
                    <select
                      value={form.rate_type}
                      onChange={(e) => updateField("rate_type", e.target.value)}
                      className={inputClass("rate_type")}
                    >
                      {RATE_TYPES.map((rt) => (
                        <option key={rt} value={rt}>{rt.charAt(0).toUpperCase() + rt.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select
                      value={form.contract_status}
                      onChange={(e) => updateField("contract_status", e.target.value)}
                      className={inputClass("contract_status")}
                    >
                      <option value="">No status</option>
                      {CONTRACT_STATUSES.map((s) => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>
                      Rating <span className="text-neutral-400 font-normal">(0-5)</span>
                    </label>
                    <input
                      type="text"
                      value={form.rating}
                      onChange={(e) => updateField("rating", e.target.value)}
                      placeholder="4.5"
                      className={inputClass("rating")}
                    />
                    {errors.rating && <p className="text-xs text-red-500 mt-1">{errors.rating}</p>}
                  </div>
                </div>
              </fieldset>

              {/* Research & Notes */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Additional Details
                </legend>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Research</label>
                    <textarea
                      value={form.research}
                      onChange={(e) => updateField("research", e.target.value)}
                      placeholder="Research notes, background info, references..."
                      rows={3}
                      className={inputClass("research") + " resize-none"}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => updateField("notes", e.target.value)}
                      placeholder="Internal notes about this vendor..."
                      rows={3}
                      className={inputClass("notes") + " resize-none"}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Attachments */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  Attachments
                </legend>
                <div className="space-y-3">
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg group"
                        >
                          <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-neutral-700 hover:text-blue-600 truncate block"
                            >
                              {att.filename || "Attachment"}
                            </a>
                            {att.type && (
                              <span className="text-xs text-neutral-400">{att.type}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(idx)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input
                    ref={attachmentInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (file) await handleAttachmentUpload(file)
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingAttachment}
                    onClick={() => attachmentInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-600 bg-white border-2 border-dashed border-neutral-300 rounded-lg hover:border-neutral-400 hover:bg-neutral-50 transition-colors w-full justify-center"
                  >
                    {uploadingAttachment ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Add Attachment
                        <span className="text-xs text-neutral-400 ml-1">(PDF, DOC, images, up to 25MB)</span>
                      </>
                    )}
                  </button>
                </div>
              </fieldset>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEditing ? "Save Changes" : "Create Vendor"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
