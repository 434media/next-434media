"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  Loader2,
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  Calendar,
  User,
  Tag,
  FolderOpen,
  Save,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
} from "lucide-react"
import type { SOP } from "../../types/project-management-types"
import { SOP_CATEGORIES, SOP_STATUSES } from "../../types/project-management-types"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"

type ViewMode = "list" | "detail" | "edit" | "create"

interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

export default function SOPsPage() {
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Data state
  const [sops, setSOPs] = useState<SOP[]>([])
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<SOP>>({
    title: "",
    category: "Other",
    department: "",
    description: "",
    content: "",
    version: "1.0",
    status: "draft",
    owner: "",
    tags: [],
  })

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

  const loadData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/sops")
      if (!response.ok) throw new Error("Failed to fetch SOPs")
      const data = await response.json()
      setSOPs(data.sops || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SOPs")
    } finally {
      setIsLoading(false)
    }
  }

  const syncFromAirtable = async () => {
    setIsSyncing(true)
    try {
      const response = await fetch("/api/admin/sops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Sync failed")
      }
      const result = await response.json()
      setToast({
        message: `Synced ${result.synced} SOPs from Airtable`,
        type: "success",
      })
      await loadData()
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to sync from Airtable",
        type: "error",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title || !formData.content) {
      setToast({ message: "Title and content are required", type: "error" })
      return
    }

    setIsSaving(true)
    try {
      const isUpdate = viewMode === "edit" && selectedSOP?.id
      const url = "/api/admin/sops"
      const method = isUpdate ? "PUT" : "POST"
      const body = isUpdate
        ? { id: selectedSOP.id, data: formData }
        : { data: formData }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save SOP")

      setToast({
        message: isUpdate ? "SOP updated successfully" : "SOP created successfully",
        type: "success",
      })
      setViewMode("list")
      setSelectedSOP(null)
      resetForm()
      await loadData()
    } catch (err) {
      setToast({ message: "Failed to save SOP", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this SOP?")) return

    try {
      const response = await fetch(`/api/admin/sops?id=${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      setToast({ message: "SOP deleted successfully", type: "success" })
      if (selectedSOP?.id === id) {
        setViewMode("list")
        setSelectedSOP(null)
      }
      await loadData()
    } catch (err) {
      setToast({ message: "Failed to delete SOP", type: "error" })
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      category: "Other",
      department: "",
      description: "",
      content: "",
      version: "1.0",
      status: "draft",
      owner: "",
      tags: [],
    })
  }

  const openCreate = () => {
    resetForm()
    setViewMode("create")
  }

  const openEdit = (sop: SOP) => {
    setSelectedSOP(sop)
    setFormData({
      title: sop.title,
      category: sop.category,
      department: sop.department,
      description: sop.description,
      content: sop.content,
      version: sop.version,
      status: sop.status,
      owner: sop.owner,
      tags: sop.tags,
    })
    setViewMode("edit")
  }

  const openDetail = (sop: SOP) => {
    setSelectedSOP(sop)
    setViewMode("detail")
  }

  // Filtered SOPs
  const filteredSOPs = useMemo(() => {
    return sops.filter((sop) => {
      const matchesSearch =
        !searchQuery ||
        sop.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sop.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sop.content?.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesCategory = categoryFilter === "all" || sop.category === categoryFilter
      const matchesStatus = statusFilter === "all" || sop.status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [sops, searchQuery, categoryFilter, statusFilter])

  // Group SOPs by category for list view
  const groupedSOPs = useMemo(() => {
    const groups: Record<string, SOP[]> = {}
    filteredSOPs.forEach((sop) => {
      const category = sop.category || "Other"
      if (!groups[category]) groups[category] = []
      groups[category].push(sop)
    })
    return groups
  }, [filteredSOPs])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "active":
        return "bg-emerald-50 text-emerald-700 border-emerald-200"
      case "under-review":
        return "bg-blue-50 text-blue-700 border-blue-200"
      case "archived":
        return "bg-neutral-100 text-neutral-600 border-neutral-200"
      default:
        return "bg-neutral-100 text-neutral-600 border-neutral-200"
    }
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 pt-20 md:pt-16">
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg ${
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
                {viewMode !== "list" ? (
                  <button
                    onClick={() => {
                      setViewMode("list")
                      setSelectedSOP(null)
                    }}
                    className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wide">Back to SOPs</span>
                  </button>
                ) : (
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-medium tracking-wide">Back</span>
                  </Link>
                )}
                <div className="h-6 w-px bg-neutral-200" />
                <h1 className="text-lg font-bold tracking-tight text-neutral-900">
                  {viewMode === "create"
                    ? "Create SOP"
                    : viewMode === "edit"
                    ? "Edit SOP"
                    : viewMode === "detail"
                    ? "SOP Details"
                    : "Standard Operating Procedures"}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {viewMode === "list" && (
                  <>
                    <button
                      onClick={syncFromAirtable}
                      disabled={isSyncing}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-all disabled:opacity-50 shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                      {isSyncing ? "Syncing..." : "Sync"}
                    </button>
                    <button
                      onClick={openCreate}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create SOP
                    </button>
                  </>
                )}
                {(viewMode === "create" || viewMode === "edit") && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 shadow-sm"
                  >
                    <Save className={`w-4 h-4 ${isSaving ? "animate-pulse" : ""}`} />
                    {isSaving ? "Saving..." : "Save SOP"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

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
              {/* List View */}
              {viewMode === "list" && (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div className="relative flex-1 min-w-50 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search SOPs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 appearance-none cursor-pointer shadow-sm"
                    >
                      <option value="all">All Categories</option>
                      {SOP_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-4 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 appearance-none cursor-pointer shadow-sm"
                    >
                      <option value="all">All Statuses</option>
                      {SOP_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SOPs List */}
                  {filteredSOPs.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200">
                      <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                      <p className="text-neutral-600 font-medium">No SOPs found</p>
                      <p className="text-neutral-400 text-sm mt-1">
                        Create a new SOP or sync from Airtable
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      {Object.entries(groupedSOPs).map(([category, categorySops]) => (
                        <div key={category}>
                          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-500 mb-4">
                            <FolderOpen className="w-4 h-4" />
                            {category}
                            <span className="px-2 py-0.5 text-xs font-bold bg-neutral-100 text-neutral-600 rounded-full">
                              {categorySops.length}
                            </span>
                          </h2>
                          <div className="grid gap-3">
                            {categorySops.map((sop) => (
                              <motion.div
                                key={sop.id}
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="group relative bg-white hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl p-5 transition-all cursor-pointer shadow-sm"
                                onClick={() => openDetail(sop)}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 min-w-0">
                                    {/* Title */}
                                    <div className="flex items-center gap-3 mb-2">
                                      <h3 className="text-base font-bold tracking-tight text-neutral-900 leading-tight">
                                        {sop.title}
                                      </h3>
                                      <span
                                        className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-full border ${getStatusColor(
                                          sop.status
                                        )}`}
                                      >
                                        {sop.status}
                                      </span>
                                    </div>

                                    {/* Description */}
                                    {sop.description && (
                                      <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2 mb-3">
                                        {sop.description}
                                      </p>
                                    )}

                                    {/* Meta */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-400">
                                      {sop.version && (
                                        <span className="flex items-center gap-1">
                                          <Tag className="w-3 h-3" />v{sop.version}
                                        </span>
                                      )}
                                      {sop.owner && (
                                        <span className="flex items-center gap-1">
                                          <User className="w-3 h-3" />
                                          {sop.owner}
                                        </span>
                                      )}
                                      {sop.last_reviewed && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          Reviewed:{" "}
                                          {new Date(sop.last_reviewed).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openEdit(sop)
                                      }}
                                      className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(sop.id)
                                      }}
                                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                    <ChevronRight className="w-5 h-5 text-neutral-400" />
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Detail View */}
              {viewMode === "detail" && selectedSOP && (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-4xl mx-auto"
                >
                  <article className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <header className="p-8 border-b border-neutral-200">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2 block">
                            {selectedSOP.category}
                          </span>
                          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-tight mb-4">
                            {selectedSOP.title}
                          </h1>
                          {selectedSOP.description && (
                            <p className="text-lg text-neutral-500 leading-relaxed">
                              {selectedSOP.description}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${getStatusColor(
                            selectedSOP.status
                          )}`}
                        >
                          {selectedSOP.status}
                        </span>
                      </div>

                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-neutral-500">
                        {selectedSOP.version && (
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4" />
                            <span>Version {selectedSOP.version}</span>
                          </div>
                        )}
                        {selectedSOP.owner && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Owner: {selectedSOP.owner}</span>
                          </div>
                        )}
                        {selectedSOP.department && (
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-4 h-4" />
                            <span>{selectedSOP.department}</span>
                          </div>
                        )}
                        {selectedSOP.last_reviewed && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Last reviewed:{" "}
                              {new Date(selectedSOP.last_reviewed).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </header>

                    {/* Content */}
                    <div className="p-8">
                      <div
                        className="prose prose-neutral prose-lg max-w-none
                          prose-headings:font-bold prose-headings:tracking-tight
                          prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                          prose-p:text-neutral-600 prose-p:leading-relaxed prose-p:mb-4
                          prose-li:text-neutral-600 prose-li:leading-relaxed
                          prose-strong:text-neutral-900 prose-strong:font-semibold
                          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                          prose-code:text-pink-600 prose-code:bg-pink-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                          prose-pre:bg-neutral-100 prose-pre:border prose-pre:border-neutral-200"
                      >
                        <div className="whitespace-pre-wrap">{selectedSOP.content}</div>
                      </div>
                    </div>

                    {/* Tags */}
                    {selectedSOP.tags && selectedSOP.tags.length > 0 && (
                      <footer className="px-8 py-6 border-t border-neutral-200">
                        <div className="flex flex-wrap gap-2">
                          {selectedSOP.tags.map((tag, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 text-xs font-medium text-neutral-600 bg-neutral-100 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </footer>
                    )}
                  </article>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                      onClick={() => openEdit(selectedSOP)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-300 rounded-lg transition-colors shadow-sm"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit SOP
                    </button>
                    <button
                      onClick={() => handleDelete(selectedSOP.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Create/Edit Form */}
              {(viewMode === "create" || viewMode === "edit") && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="max-w-4xl mx-auto"
                >
                  <div className="bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm">
                    <div className="space-y-6">
                      {/* Title */}
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                          Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, title: e.target.value }))
                          }
                          placeholder="Enter SOP title..."
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 text-lg font-medium"
                        />
                      </div>

                      {/* Category & Status */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Category
                          </label>
                          <select
                            value={formData.category}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, category: e.target.value }))
                            }
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-400 appearance-none cursor-pointer"
                          >
                            {SOP_CATEGORIES.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Status
                          </label>
                          <select
                            value={formData.status}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                status: e.target.value as SOP["status"],
                              }))
                            }
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:outline-none focus:border-neutral-400 appearance-none cursor-pointer"
                          >
                            {SOP_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Department & Owner */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Department
                          </label>
                          <input
                            type="text"
                            value={formData.department}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, department: e.target.value }))
                            }
                            placeholder="e.g., Marketing, Operations..."
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-2">
                            Owner
                          </label>
                          <input
                            type="text"
                            value={formData.owner}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, owner: e.target.value }))
                            }
                            placeholder="SOP owner name..."
                            className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                          />
                        </div>
                      </div>

                      {/* Version */}
                      <div className="max-w-50">
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                          Version
                        </label>
                        <input
                          type="text"
                          value={formData.version}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, version: e.target.value }))
                          }
                          placeholder="1.0"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, description: e.target.value }))
                          }
                          placeholder="Brief description of this SOP..."
                          rows={2}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 resize-none"
                        />
                      </div>

                      {/* Content */}
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                          Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={formData.content}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, content: e.target.value }))
                          }
                          placeholder="Enter the full SOP content here. You can use markdown formatting..."
                          rows={16}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 resize-none font-mono text-sm leading-relaxed"
                        />
                      </div>

                      {/* Tags */}
                      <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                          Tags
                        </label>
                        <input
                          type="text"
                          value={formData.tags?.join(", ") || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                            }))
                          }
                          placeholder="Enter tags separated by commas..."
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                        />
                        <p className="text-xs text-neutral-500 mt-1.5">
                          Separate multiple tags with commas
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
