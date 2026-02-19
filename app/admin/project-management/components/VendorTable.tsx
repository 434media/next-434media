"use client"

import { useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Search,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LayoutList,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Building2,
  Trash2,
  Edit2,
  Eye,
  X,
  Filter,
  Star,
  Paperclip,
  FileText,
  Tag,
} from "lucide-react"
import type { Vendor } from "@/types/project-management-types"
import { VENDOR_CATEGORIES } from "@/types/project-management-types"
import VendorFormModal from "./VendorFormModal"
import VendorDetailSlideout from "./VendorDetailSlideout"

interface VendorTableProps {
  vendors: Vendor[]
  onDelete: (id: string) => void
  onSave: (vendor: Partial<Vendor>, isNew: boolean) => Promise<void>
  showToast: (message: string, type: "success" | "error" | "warning") => void
}

type SortField = "name" | "category" | "contract_status" | "rate" | "city" | "rating"
type SortDir = "asc" | "desc"
type ViewLayout = "table" | "grid"

const CONTRACT_STATUSES = ["active", "pending", "inactive", "expired"] as const

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const

export default function VendorTable({ vendors, onDelete, onSave, showToast }: VendorTableProps) {
  // View state
  const [layout, setLayout] = useState<ViewLayout>("table")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showFilters, setShowFilters] = useState(false)

  // Sort state
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(25)

  // Modal/slideout state
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null)

  // Derive unique categories from data
  const categoriesInUse = useMemo(() => {
    const cats = new Set(vendors.map((v) => v.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [vendors])

  // Filter + sort + paginate
  const processedData = useMemo(() => {
    let filtered = vendors

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (v) =>
          v.name?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.city?.toLowerCase().includes(q) ||
          v.specialty?.toLowerCase().includes(q) ||
          v.category?.toLowerCase().includes(q) ||
          v.notes?.toLowerCase().includes(q) ||
          v.research?.toLowerCase().includes(q)
      )
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((v) => v.category === categoryFilter)
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((v) => v.contract_status === statusFilter)
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number = ""
      let bVal: string | number = ""

      switch (sortField) {
        case "name":
          aVal = a.name?.toLowerCase() || ""
          bVal = b.name?.toLowerCase() || ""
          break
        case "category":
          aVal = a.category?.toLowerCase() || ""
          bVal = b.category?.toLowerCase() || ""
          break
        case "contract_status":
          aVal = a.contract_status || ""
          bVal = b.contract_status || ""
          break
        case "rate":
          aVal = a.rate || 0
          bVal = b.rate || 0
          break
        case "city":
          aVal = a.city?.toLowerCase() || ""
          bVal = b.city?.toLowerCase() || ""
          break
        case "rating":
          aVal = a.rating ?? -1
          bVal = b.rating ?? -1
          break
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [vendors, searchQuery, categoryFilter, statusFilter, sortField, sortDir])

  // Pagination derived values
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return processedData.slice(start, start + pageSize)
  }, [processedData, currentPage, pageSize])

  // Reset page on filter change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-300" />
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-neutral-900" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-neutral-900" />
    )
  }

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

  const openAddModal = () => {
    setEditingVendor(null)
    setFormModalOpen(true)
  }

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormModalOpen(true)
  }

  const handleFormSave = async (vendor: Partial<Vendor>) => {
    const isNew = !editingVendor
    await onSave(vendor, isNew)
    setFormModalOpen(false)
    setEditingVendor(null)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="space-y-4">
        {/* Top bar: search + actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search vendors by name, company, specialty, city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); handleFilterChange() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border rounded-lg transition-colors ${
                showFilters || categoryFilter !== "all" || statusFilter !== "all"
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(categoryFilter !== "all" || statusFilter !== "all") && (
                <span className="w-5 h-5 text-xs font-bold rounded-full bg-white text-neutral-900 flex items-center justify-center">
                  {(categoryFilter !== "all" ? 1 : 0) + (statusFilter !== "all" ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Layout toggle */}
            <div className="flex items-center bg-white border border-neutral-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setLayout("table")}
                className={`p-2.5 transition-colors ${
                  layout === "table" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700"
                }`}
                title="Table view"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout("grid")}
                className={`p-2.5 transition-colors ${
                  layout === "grid" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700"
                }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-neutral-200 rounded-xl">
                {/* Category filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); handleFilterChange() }}
                    className="px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:border-neutral-400"
                  >
                    <option value="all">All Categories</option>
                    {categoriesInUse.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="h-6 w-px bg-neutral-200" />

                {/* Status filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange() }}
                    className="px-3 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none focus:border-neutral-400"
                  >
                    <option value="all">All Statuses</option>
                    {CONTRACT_STATUSES.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Clear filters */}
                {(categoryFilter !== "all" || statusFilter !== "all") && (
                  <>
                    <div className="h-6 w-px bg-neutral-200" />
                    <button
                      onClick={() => {
                        setCategoryFilter("all")
                        setStatusFilter("all")
                        handleFilterChange()
                      }}
                      className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      Clear all filters
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results summary */}
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>
            Showing <strong className="text-neutral-900">{paginatedData.length}</strong> of{" "}
            <strong className="text-neutral-900">{processedData.length}</strong> vendors
            {processedData.length !== vendors.length && (
              <span className="text-neutral-400"> (filtered from {vendors.length} total)</span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-400">Per page:</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="px-2 py-1 text-xs bg-white border border-neutral-200 rounded text-neutral-700 focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table View */}
      {layout === "table" ? (
        <div className="mt-4 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  {[
                    { field: "name" as SortField, label: "Vendor" },
                    { field: "category" as SortField, label: "Category" },
                    { field: "contract_status" as SortField, label: "Status" },
                    { field: "city" as SortField, label: "Location" },
                    { field: "rate" as SortField, label: "Rate" },
                  ].map((col) => (
                    <th
                      key={col.field}
                      onClick={() => toggleSort(col.field)}
                      className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-900 select-none"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {col.label}
                        <SortIcon field={col.field} />
                      </span>
                    </th>
                  ))}
                  <th
                    onClick={() => toggleSort("rating")}
                    className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-900 select-none"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      Rating
                      <SortIcon field="rating" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider w-16">
                    Info
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                      <p className="text-neutral-500 font-medium">No vendors match your filters</p>
                      <p className="text-neutral-400 text-xs mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((vendor) => (
                    <tr
                      key={vendor.id}
                      className="hover:bg-neutral-50 transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDetailVendor(vendor)}
                          className="text-left"
                        >
                          <div className="flex items-center gap-3">
                            {vendor.photo ? (
                              <img
                                src={vendor.photo}
                                alt={vendor.name}
                                className="w-8 h-8 rounded-full object-cover border border-neutral-200 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-neutral-400">
                                  {vendor.name?.charAt(0) || "V"}
                                </span>
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-semibold text-neutral-900 hover:underline block truncate">
                                {vendor.name}
                              </span>
                              {(vendor.company || vendor.specialty) && (
                                <span className="text-xs text-neutral-400 truncate block max-w-45">
                                  {[vendor.company, vendor.specialty].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-md">
                          {vendor.category || "—"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {vendor.contract_status ? (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${getContractStatusColor(vendor.contract_status)}`}>
                            {vendor.contract_status}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3 text-neutral-600 truncate max-w-35">
                        {[vendor.city, vendor.state].filter(Boolean).join(", ") || "—"}
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-3">
                        {vendor.rate ? (
                          <span className="font-semibold text-neutral-900">
                            ${vendor.rate}
                            <span className="text-neutral-400 font-normal">/{vendor.rate_type || "hr"}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="px-4 py-3">
                        {vendor.rating !== undefined && vendor.rating !== null ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-medium text-neutral-700">{vendor.rating}</span>
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {vendor.email && (
                            <a href={`mailto:${vendor.email}`} className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors" title={vendor.email}>
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {vendor.phone && (
                            <a href={`tel:${vendor.phone}`} className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors" title={vendor.phone}>
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {vendor.website && (
                            <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors" title={vendor.website}>
                              <Globe className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Info indicators */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {vendor.attachments && vendor.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 p-1 text-neutral-400" title={`${vendor.attachments.length} attachment${vendor.attachments.length > 1 ? "s" : ""}`}>
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-medium">{vendor.attachments.length}</span>
                            </span>
                          )}
                          {(vendor.notes || vendor.research) && (
                            <span className="p-1 text-neutral-400" title={vendor.notes ? "Has notes" : "Has research"}>
                              <FileText className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setDetailVendor(vendor)}
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(vendor)}
                            className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit vendor"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDelete(vendor.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete vendor"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="mt-4">
          {paginatedData.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
              <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No vendors match your filters</p>
              <p className="text-neutral-400 text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedData.map((vendor) => (
                <div
                  key={vendor.id}
                  className="group relative bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl overflow-hidden transition-all shadow-sm"
                >
                  {/* Compact header */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {vendor.photo ? (
                        <img
                          src={vendor.photo}
                          alt={vendor.name}
                          className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-neutral-400">
                            {vendor.name?.charAt(0) || "V"}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setDetailVendor(vendor)}
                          className="text-left"
                        >
                          <h3 className="text-sm font-bold text-neutral-900 leading-tight hover:underline truncate">
                            {vendor.name}
                          </h3>
                        </button>
                      </div>
                    </div>

                    {/* Specialty */}
                    {vendor.specialty && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Tag className="w-3 h-3 text-neutral-300 shrink-0" />
                        <p className="text-xs text-neutral-500 truncate">{vendor.specialty}</p>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 bg-neutral-100 rounded">
                        {vendor.category}
                      </span>
                      {vendor.contract_status && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getContractStatusColor(vendor.contract_status)}`}>
                          {vendor.contract_status}
                        </span>
                      )}
                      {vendor.rating !== undefined && vendor.rating !== null && (
                        <span className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          {vendor.rating}
                        </span>
                      )}
                    </div>

                    {/* Location */}
                    {(vendor.city || vendor.state) && (
                      <p className="text-xs text-neutral-400 mt-2">
                        {[vendor.city, vendor.state].filter(Boolean).join(", ")}
                      </p>
                    )}

                    {/* Rate */}
                    {vendor.rate && (
                      <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center gap-1 text-sm">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-bold text-neutral-900">${vendor.rate}</span>
                        <span className="text-neutral-400 text-xs">/{vendor.rate_type || "hr"}</span>
                      </div>
                    )}

                    {/* Contact row */}
                    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-neutral-100">
                      {vendor.email && (
                        <a href={`mailto:${vendor.email}`} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors" title={vendor.email}>
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {vendor.phone && (
                        <a href={`tel:${vendor.phone}`} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors" title={vendor.phone}>
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {vendor.website && (
                        <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {/* Info indicators */}
                      {vendor.attachments && vendor.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 p-1 text-neutral-300" title={`${vendor.attachments.length} attachment${vendor.attachments.length > 1 ? "s" : ""}`}>
                          <Paperclip className="w-3 h-3" />
                          <span className="text-[10px]">{vendor.attachments.length}</span>
                        </span>
                      )}
                      {(vendor.notes || vendor.research) && (
                        <span className="p-1 text-neutral-300" title="Has notes">
                          <FileText className="w-3 h-3" />
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => openEditModal(vendor)}
                        className="p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDelete(vendor.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page <strong className="text-neutral-900">{currentPage}</strong> of{" "}
            <strong className="text-neutral-900">{totalPages}</strong>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? "bg-neutral-900 text-white"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <VendorFormModal
        isOpen={formModalOpen}
        vendor={editingVendor}
        onClose={() => { setFormModalOpen(false); setEditingVendor(null) }}
        onSave={handleFormSave}
      />

      {/* Detail Slideout */}
      <VendorDetailSlideout
        vendor={detailVendor}
        onClose={() => setDetailVendor(null)}
        onEdit={(v) => { setDetailVendor(null); openEditModal(v) }}
        onDelete={(id) => { setDetailVendor(null); onDelete(id) }}
      />
    </>
  )
}
