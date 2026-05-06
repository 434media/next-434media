"use client"

import {
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
  Link as LinkIcon,
} from "lucide-react"
import type { Vendor } from "@/types/project-management-types"
import { DetailDrawer } from "@/components/admin/DetailDrawer"

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
  // Status pill chrome stays neutral; the dot below carries the visual signal
  const getStatusDot = (status: string | undefined) => {
    switch (status) {
      case "active":
        return "bg-emerald-500"
      case "pending":
        return "bg-amber-500"
      case "expired":
        return "bg-red-500"
      case "inactive":
      default:
        return "bg-neutral-400"
    }
  }

  return (
    <DetailDrawer
      open={!!vendor}
      onClose={onClose}
      title={vendor?.name || ""}
      subtitle={
        vendor ? (
          <span className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
            <span>{vendor.category}</span>
            {vendor.contract_status && (
              <>
                <span className="text-neutral-300">·</span>
                <span className="capitalize">{vendor.contract_status}</span>
              </>
            )}
          </span>
        ) : null
      }
      width="md"
      closeOnEscape
      footer={
        vendor ? (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onDelete(vendor.id)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-colors"
              title="Delete vendor"
              aria-label="Delete vendor"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onEdit(vendor)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit vendor
            </button>
          </div>
        ) : null
      }
    >
      {vendor && (
        <div className="space-y-5">
          {/* Photo banner */}
          {vendor.photo ? (
            <figure className="relative rounded-md overflow-hidden ring-1 ring-neutral-200/70 bg-neutral-100">
              <img src={vendor.photo} alt={vendor.name} className="w-full h-44 object-cover" />
            </figure>
          ) : (
            <div className="grid h-32 place-items-center rounded-md ring-1 ring-neutral-200/70 bg-neutral-50">
              <Building2 className="h-12 w-12 text-neutral-300" />
            </div>
          )}

          {/* Top metadata row */}
          <div className="flex items-center gap-2 flex-wrap">
            {vendor.contract_status && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] font-medium uppercase tracking-[0.16em]">
                <span
                  className={`inline-block h-1 w-1 rounded-full ${getStatusDot(vendor.contract_status)}`}
                  aria-hidden="true"
                />
                {vendor.contract_status}
              </span>
            )}
            {vendor.rating !== undefined && vendor.rating !== null && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px] font-medium tabular-nums">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {vendor.rating}
              </span>
            )}
          </div>

          {/* Rate */}
          {vendor.rate && (
            <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-1">
                <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
                Rate
              </p>
              <div className="flex items-baseline gap-1">
                <DollarSign className="w-4 h-4 text-neutral-400 self-center" />
                <span className="text-2xl font-semibold tabular-nums text-neutral-900">${vendor.rate}</span>
                <span className="text-sm text-neutral-500">/ {vendor.rate_type || "hour"}</span>
              </div>
            </div>
          )}

          {/* Specialty */}
          {vendor.specialty && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Specialty
              </p>
              <div className="flex items-center gap-2 text-sm text-neutral-700">
                <Tag className="w-3.5 h-3.5 text-neutral-400" />
                {vendor.specialty}
              </div>
            </div>
          )}

          {/* Contact */}
          {(vendor.email || vendor.phone || vendor.website) && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Contact
              </p>
              <div className="space-y-2">
                {vendor.email && (
                  <a
                    href={`mailto:${vendor.email}`}
                    className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <span>{vendor.email}</span>
                  </a>
                )}
                {vendor.phone && (
                  <a
                    href={`tel:${vendor.phone}`}
                    className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
                  >
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
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
                    <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 transition-colors">
                      <Globe className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{vendor.website.replace(/^https?:\/\//, "")}</span>
                    <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Location */}
          {(vendor.address || vendor.city) && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Location
              </p>
              <div className="flex items-start gap-3 text-sm text-neutral-700">
                <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
                  <MapPin className="w-3.5 h-3.5" />
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
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Link
              </p>
              <a
                href={vendor.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors group"
              >
                <div className="grid h-8 w-8 place-items-center rounded-md bg-neutral-100 text-neutral-700 group-hover:bg-neutral-200 transition-colors">
                  <LinkIcon className="w-3.5 h-3.5" />
                </div>
                <span className="truncate">{vendor.link_url.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
              </a>
            </div>
          )}

          {/* Social Media */}
          {vendor.social_media && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Social media
              </p>
              <p className="text-sm text-neutral-600 whitespace-pre-wrap">{vendor.social_media}</p>
            </div>
          )}

          {/* Research */}
          {vendor.research && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Research
              </p>
              <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                {vendor.research}
              </div>
            </div>
          )}

          {/* Notes */}
          {vendor.notes && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Notes
              </p>
              <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4 text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">
                <FileText className="w-3.5 h-3.5 text-neutral-400 mb-2" />
                {vendor.notes}
              </div>
            </div>
          )}

          {/* Attachments */}
          {vendor.attachments && vendor.attachments.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-3">
                <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
                Attachments
              </p>
              <div className="space-y-2">
                {vendor.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-white rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:bg-neutral-50 transition-colors group"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900 truncate block">
                        {att.filename || "Attachment"}
                      </span>
                      {att.type && (
                        <span className="text-[11px] text-neutral-400">{att.type}</span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  )
}
