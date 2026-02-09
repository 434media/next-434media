"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Loader2 } from "lucide-react"
import type { Vendor } from "../../../types/project-management-types"
import { VENDOR_CATEGORIES } from "../../../types/project-management-types"

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
  address: "",
  city: "",
  state: "",
  zip: "",
  photo: "",
  social_media: "",
  rate: "",
  rate_type: "hourly" as typeof RATE_TYPES[number],
  contract_status: "" as string,
  notes: "",
  rating: "",
}

export default function VendorFormModal({ isOpen, vendor, onClose, onSave }: VendorFormModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
        address: vendor.address || "",
        city: vendor.city || "",
        state: vendor.state || "",
        zip: vendor.zip || "",
        photo: vendor.photo || "",
        social_media: vendor.social_media || "",
        rate: vendor.rate?.toString() || "",
        rate_type: (vendor.rate_type || "hourly") as typeof RATE_TYPES[number],
        contract_status: vendor.contract_status || "",
        notes: vendor.notes || "",
        rating: vendor.rating?.toString() || "",
      })
    } else {
      setForm(emptyForm)
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
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        category: form.category,
        specialty: form.specialty.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zip: form.zip.trim() || undefined,
        photo: form.photo.trim() || undefined,
        social_media: form.social_media.trim() || undefined,
        rate: form.rate ? Number(form.rate) : undefined,
        rate_type: form.rate ? (form.rate_type as Vendor["rate_type"]) : undefined,
        contract_status: form.contract_status ? (form.contract_status as Vendor["contract_status"]) : undefined,
        notes: form.notes.trim() || undefined,
        rating: form.rating ? Number(form.rating) : undefined,
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
    `w-full px-3 py-2 text-sm bg-neutral-50 border rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:border-neutral-400 ${
      errors[field] ? "border-red-300 focus:ring-red-100 focus:border-red-400" : "border-neutral-200"
    }`

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
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-200">
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Basic Information
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="Vendor name"
                      className={inputClass("name")}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Company</label>
                    <input
                      type="text"
                      value={form.company}
                      onChange={(e) => updateField("company", e.target.value)}
                      placeholder="Company name"
                      className={inputClass("company")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
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
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Specialty</label>
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
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Contact Information
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
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
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="(555) 123-4567"
                      className={inputClass("phone")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Website</label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      placeholder="https://example.com"
                      className={inputClass("website")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Social Media</label>
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
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Location
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => updateField("address", e.target.value)}
                      placeholder="Street address"
                      className={inputClass("address")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">City</label>
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
                      <label className="block text-sm font-medium text-neutral-700 mb-1">State</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => updateField("state", e.target.value)}
                        placeholder="TX"
                        className={inputClass("state")}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">ZIP</label>
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
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Rate & Status
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Rate ($)</label>
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
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Rate Type</label>
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
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Contract Status</label>
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
                </div>
              </fieldset>

              {/* Additional */}
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                  Additional
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Photo URL</label>
                    <input
                      type="url"
                      value={form.photo}
                      onChange={(e) => updateField("photo", e.target.value)}
                      placeholder="https://..."
                      className={inputClass("photo")}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Rating <span className="text-neutral-400">(0-5)</span>
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
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
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

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
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
