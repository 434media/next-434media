"use client"

import { motion, AnimatePresence } from "motion/react"
import {
  X,
  Mail,
  Phone,
  Globe,
  MapPin,
  DollarSign,
  Building2,
  Star,
  Edit2,
  Trash2,
  ExternalLink,
  Tag,
  FileText,
  Paperclip,
  Link,
} from "lucide-react"
import type { Vendor } from "../../../types/project-management-types"

interface VendorDetailSlideoutProps {
  vendor: Vendor | null
  onClose: () => void
  onEdit: (vendor: Vendor) => void
  onDelete: (id: string) => void
}

export default function VendorDetailSlideout({
  vendor,
  onClose,
  onEdit,
  onDelete,
}: VendorDetailSlideoutProps) {
  const getContractStatusColor = (status: string | undefined) => {
    switch (status) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "inactive":
        return "bg-neutral-100 text-neutral-500 border-neutral-200"
      case "expired":
        return "bg-red-50 text-red-700 border-red-200"
      default:
        return "bg-neutral-100 text-neutral-500 border-neutral-200"
    }
  }

  return (
    <AnimatePresence>
      {vendor && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Slideout panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl overflow-y-auto"
          >
            {/* Header with photo */}
            <div className="relative">
              {vendor.photo ? (
                <div className="relative h-48 bg-neutral-100 overflow-hidden">
                  <img
                    src={vendor.photo}
                    alt={vendor.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                </div>
              ) : (
                <div className="h-32 bg-linear-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
                  <Building2 className="w-16 h-16 text-neutral-300" />
                </div>
              )}

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-neutral-700 hover:bg-white rounded-lg transition-colors shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Vendor name */}
              <div>
                <div className="w-10 h-1 bg-yellow-400 mb-3" />
                <h2 className="text-2xl font-bold text-neutral-900 leading-tight">{vendor.name}</h2>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-neutral-600 bg-neutral-100 rounded-lg">
                  {vendor.category}
                </span>
                {vendor.contract_status && (
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getContractStatusColor(vendor.contract_status)}`}>
                    {vendor.contract_status}
                  </span>
                )}
                {vendor.rating !== undefined && vendor.rating !== null && (
                  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    {vendor.rating}
                  </span>
                )}
              </div>

              {/* Rate */}
              {vendor.rate && (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    <span className="text-2xl font-bold text-emerald-700">${vendor.rate}</span>
                    <span className="text-sm text-emerald-600">/ {vendor.rate_type || "hour"}</span>
                  </div>
                </div>
              )}

              {/* Specialty */}
              {vendor.specialty && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Specialty</h4>
                  <div className="flex items-center gap-2 text-sm text-neutral-700">
                    <Tag className="w-4 h-4 text-neutral-400" />
                    {vendor.specialty}
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Contact</h4>
                <div className="space-y-3">
                  {vendor.email && (
                    <a
                      href={`mailto:${vendor.email}`}
                      className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                        <Mail className="w-4 h-4 text-neutral-500" />
                      </div>
                      <span>{vendor.email}</span>
                    </a>
                  )}
                  {vendor.phone && (
                    <a
                      href={`tel:${vendor.phone}`}
                      className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                        <Phone className="w-4 h-4 text-neutral-500" />
                      </div>
                      <span>{vendor.phone}</span>
                    </a>
                  )}
                  {vendor.website && (
                    <a
                      href={vendor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                        <Globe className="w-4 h-4 text-neutral-500" />
                      </div>
                      <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
                      <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                    </a>
                  )}
                </div>
              </div>

              {/* Address */}
              {(vendor.address || vendor.city) && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Location</h4>
                  <div className="flex items-start gap-3 text-sm text-neutral-700">
                    <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="leading-relaxed">
                      {vendor.address && <p>{vendor.address}</p>}
                      <p>{[vendor.city, vendor.state, vendor.zip].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Link URL */}
              {vendor.link_url && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Link</h4>
                  <a
                    href={vendor.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-200 transition-colors">
                      <Link className="w-4 h-4 text-neutral-500" />
                    </div>
                    <span className="truncate">{vendor.link_url.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                  </a>
                </div>
              )}

              {/* Social Media */}
              {vendor.social_media && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Social Media</h4>
                  <p className="text-sm text-neutral-600 whitespace-pre-wrap">{vendor.social_media}</p>
                </div>
              )}

              {/* Research */}
              {vendor.research && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Research</h4>
                  <div className="p-4 bg-blue-50 rounded-xl text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap border border-blue-100">
                    {vendor.research}
                  </div>
                </div>
              )}

              {/* Notes */}
              {vendor.notes && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Notes</h4>
                  <div className="p-4 bg-neutral-50 rounded-xl text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap border border-neutral-100">
                    <FileText className="w-4 h-4 text-neutral-400 mb-2" />
                    {vendor.notes}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {vendor.attachments && vendor.attachments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Attachments</h4>
                  <div className="space-y-2">
                    {vendor.attachments.map((att, idx) => (
                      <a
                        key={idx}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors group"
                      >
                        <Paperclip className="w-4 h-4 text-neutral-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 truncate block">
                            {att.filename || "Attachment"}
                          </span>
                          {att.type && (
                            <span className="text-xs text-neutral-400">{att.type}</span>
                          )}
                        </div>
                        <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
                <button
                  onClick={() => onEdit(vendor)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Vendor
                </button>
                <button
                  onClick={() => onDelete(vendor.id)}
                  className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
