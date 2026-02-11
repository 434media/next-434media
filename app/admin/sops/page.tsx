"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { upload } from "@vercel/blob/client"
import {
  ChevronLeft,
  Loader2,
  FileText,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  User,
  Tag,
  FolderOpen,
  Save,
  ChevronRight,
  Clock,
  BookOpen,
  Hash,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  Users,
  Shield,
  Briefcase,
  GraduationCap,
  Palette,
  MapPin,
  Target,
  Zap,
  Heart,
  Star,
  Lightbulb,
  Handshake,
  Award,
  Flame,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  GripVertical,
} from "lucide-react"
import type { SOP, SOPAttachment } from "../../types/project-management-types"
import {
  SOP_CATEGORIES,
  SOP_STATUSES,
} from "../../types/project-management-types"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"

type ViewMode = "list" | "detail" | "edit" | "create"

interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

const CORE_VALUES = [
  {
    name: "Integrity",
    icon: Shield,
    description:
      "Do what you say you\u2019re going to do. Trust but verify.",
  },
  {
    name: "Creativity",
    icon: Lightbulb,
    description:
      "Stay curious, challenge the status quo, solve problems, think big.",
  },
  {
    name: "Collaboration",
    icon: Handshake,
    description:
      "We don\u2019t do it alone. You are the company you keep, level up or level down.",
  },
  {
    name: "Excellence",
    icon: Award,
    description:
      "If you\u2019re going to do it, do it right. Be accountable for your work, let it be your best.",
  },
  {
    name: "Impact",
    icon: Flame,
    description:
      "Your time is valuable, so is everyone else\u2019s. Make it matter.",
  },
]

const HUB_SECTIONS = [
  {
    id: "onboarding",
    label: "New Hire Onboarding",
    icon: GraduationCap,
    description: "Welcome guides, first-day checklists, and team orientation",
    categories: ["HR", "Operations"],
  },
  {
    id: "brand",
    label: "Brand Guidelines",
    icon: Palette,
    description: "Logos, colors, typography, and brand voice standards",
    categories: ["Marketing"],
  },
  {
    id: "team",
    label: "434 Media Team",
    icon: Users,
    description: "Roles, responsibilities, and team directory",
    categories: ["HR", "Operations"],
  },
  {
    id: "operations",
    label: "Operations & SOPs",
    icon: Shield,
    description:
      "Standard procedures for events, vendors, and workflows",
    categories: [
      "Event Planning",
      "Vendor Management",
      "Operations",
      "Safety",
      "Quality Control",
    ],
  },
  {
    id: "clients",
    label: "Client Relations",
    icon: Briefcase,
    description:
      "Engagement protocols, proposals, and project workflows",
    categories: ["Client Relations", "Finance"],
  },
  {
    id: "technology",
    label: "Technology & IT",
    icon: Zap,
    description:
      "Tools, accounts, access management, and tech stack docs",
    categories: ["IT"],
  },
] as const

export default function SOPsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sops, setSOPs] = useState<SOP[]>([])
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(HUB_SECTIONS.map((s) => s.id))
  )
  const [isDragging, setIsDragging] = useState(false)
  const [linkInput, setLinkInput] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

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
    attachments: [],
  })

  useEffect(() => {
    loadData()
  }, [])

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
      if (!response.ok) throw new Error("Failed to fetch documents")
      const data = await response.json()
      setSOPs(data.sops || [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load documents"
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title) {
      setToast({ message: "Title is required", type: "error" })
      return
    }
    setIsSaving(true)
    try {
      const isUpdate = viewMode === "edit" && selectedSOP?.id
      const method = isUpdate ? "PUT" : "POST"
      const saveData = {
        ...formData,
        content: formData.content || "",
      }
      const body = isUpdate
        ? { id: selectedSOP.id, data: saveData }
        : { data: saveData }

      const response = await fetch("/api/admin/sops", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || "Failed to save")
      }
      setToast({
        message: isUpdate ? "Document updated" : "Document created",
        type: "success",
      })
      setViewMode("list")
      setSelectedSOP(null)
      resetForm()
      await loadData()
    } catch (err) {
      setToast({
        message:
          err instanceof Error ? err.message : "Failed to save document",
        type: "error",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return
    try {
      const response = await fetch(`/api/admin/sops?id=${id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      setToast({ message: "Document deleted", type: "success" })
      if (selectedSOP?.id === id) {
        setViewMode("list")
        setSelectedSOP(null)
      }
      await loadData()
    } catch {
      setToast({ message: "Failed to delete document", type: "error" })
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
      attachments: [],
    })
    setLinkInput("")
    setShowLinkInput(false)
  }

  const openCreate = (category?: string) => {
    resetForm()
    if (category) setFormData((prev) => ({ ...prev, category }))
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
      attachments: sop.attachments || [],
    })
    setViewMode("edit")
  }

  const openDetail = (sop: SOP) => {
    setSelectedSOP(sop)
    setViewMode("detail")
  }

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── File upload via Vercel Blob ──
  const handleFileUpload = useCallback(
    async (files: FileList | File[]) => {
      setIsUploading(true)
      const newAttachments: SOPAttachment[] = [
        ...(formData.attachments || []),
      ]

      try {
        for (const file of Array.from(files)) {
          if (file.size > 50 * 1024 * 1024) {
            setToast({
              message: `${file.name} exceeds 50MB limit`,
              type: "error",
            })
            continue
          }

          const timestamp = Date.now()
          const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
          const filename = `sops/${timestamp}-${safeName}`

          const blob = await upload(filename, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
          })

          const isImage = file.type.startsWith("image/")
          newAttachments.push({
            url: blob.url,
            filename: file.name,
            type: isImage ? "image" : file.type || "file",
          })
        }

        setFormData((prev) => ({ ...prev, attachments: newAttachments }))
        setToast({
          message: `${files.length === 1 ? "File" : "Files"} uploaded`,
          type: "success",
        })
      } catch (err) {
        console.error("Upload error:", err)
        setToast({
          message:
            err instanceof Error
              ? err.message
              : "Failed to upload file",
          type: "error",
        })
      } finally {
        setIsUploading(false)
      }
    },
    [formData.attachments]
  )

  const addLinkAttachment = () => {
    if (!linkInput.trim()) return
    const url = linkInput.trim().startsWith("http")
      ? linkInput.trim()
      : `https://${linkInput.trim()}`

    let hostname = ""
    try {
      hostname = new URL(url).hostname
    } catch {
      hostname = url
    }

    setFormData((prev) => ({
      ...prev,
      attachments: [
        ...(prev.attachments || []),
        { url, filename: hostname, type: "link" },
      ],
    }))
    setLinkInput("")
    setShowLinkInput(false)
  }

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, i) => i !== index),
    }))
  }

  // Drag handlers
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (viewMode === "create" || viewMode === "edit") setIsDragging(true)
    },
    [viewMode]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (e.dataTransfer.files?.length) {
        handleFileUpload(e.dataTransfer.files)
      }
    },
    [handleFileUpload]
  )

  const filteredSOPs = useMemo(() => {
    return sops.filter((sop) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        sop.title?.toLowerCase().includes(q) ||
        sop.description?.toLowerCase().includes(q) ||
        sop.content?.toLowerCase().includes(q) ||
        sop.owner?.toLowerCase().includes(q) ||
        sop.department?.toLowerCase().includes(q)
      const matchesCategory =
        categoryFilter === "all" || sop.category === categoryFilter
      const matchesStatus =
        statusFilter === "all" || sop.status === statusFilter
      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [sops, searchQuery, categoryFilter, statusFilter])

  const sectionedSOPs = useMemo(() => {
    const result: Record<string, SOP[]> = {}
    const assigned = new Set<string>()

    for (const section of HUB_SECTIONS) {
      result[section.id] = filteredSOPs.filter((sop) => {
        if (assigned.has(sop.id)) return false
        const match = (section.categories as readonly string[]).includes(
          sop.category
        )
        if (match) assigned.add(sop.id)
        return match
      })
    }

    const unassigned = filteredSOPs.filter((sop) => !assigned.has(sop.id))
    result["operations"] = [...(result["operations"] || []), ...unassigned]

    return result
  }, [filteredSOPs])

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-amber-500/10 text-amber-700 ring-amber-500/20",
      active: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
      "under-review": "bg-blue-500/10 text-blue-700 ring-blue-500/20",
      archived: "bg-neutral-500/10 text-neutral-500 ring-neutral-500/20",
    }
    const labels: Record<string, string> = {
      draft: "Draft",
      active: "Active",
      "under-review": "In Review",
      archived: "Archived",
    }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest rounded-full ring-1 ring-inset ${styles[status] || styles.draft}`}
      >
        {labels[status] || status}
      </span>
    )
  }

  const getAttachmentIcon = (type?: string) => {
    if (type === "image") return <ImageIcon className="w-4 h-4" />
    if (type === "link") return <ExternalLink className="w-4 h-4" />
    if (type?.includes("pdf")) return <FileText className="w-4 h-4" />
    return <Paperclip className="w-4 h-4" />
  }

  const formatDate = (d?: string) => {
    if (!d) return null
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // ── Render ──
  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-dvh bg-[#fafafa]">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${
                toast.type === "success"
                  ? "bg-emerald-600 text-white"
                  : toast.type === "error"
                    ? "bg-red-600 text-white"
                    : "bg-amber-600 text-white"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-1 hover:opacity-70"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200/80">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 md:pt-16">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                {viewMode !== "list" ? (
                  <button
                    onClick={() => {
                      setViewMode("list")
                      setSelectedSOP(null)
                    }}
                    className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 transition-colors text-sm font-medium"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                ) : (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 transition-colors text-sm font-medium"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <div className="h-5 w-px bg-neutral-200 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-neutral-600" />
                  <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                    {viewMode === "create"
                      ? "NEW DOCUMENT"
                      : viewMode === "edit"
                        ? "EDIT DOCUMENT"
                        : viewMode === "detail"
                          ? "DOCUMENT"
                          : "434 MEDIA HUB"}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {viewMode === "list" && (
                  <button
                    onClick={() => openCreate()}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">New Document</span>
                  </button>
                )}
                {(viewMode === "create" || viewMode === "edit") && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isUploading}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {isSaving ? "Saving..." : "Save Document"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-400 text-[13px]">
                  Loading documentation...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
              <p className="text-[15px] font-medium text-neutral-700 mb-1">
                {error}
              </p>
              <p className="text-[13px] text-neutral-400 mb-4">
                Check your connection and try again
              </p>
              <button
                onClick={loadData}
                className="px-4 py-2 text-[13px] font-medium text-neutral-700 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-lg shadow-sm"
              >
                Try Again
              </button>
            </div>
          ) : viewMode === "list" ? (
            <>
              {/* \u2500\u2500 Welcome / Company Overview \u2500\u2500 */}
              <section className="mb-10">
                <div className="relative overflow-hidden bg-neutral-900 rounded-2xl p-6 sm:p-10">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle, #fff 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  <div className="relative z-10 max-w-3xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400 mb-3">
                      Welcome to
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-[1.1] mb-3">
                      434 Media Hub
                    </h2>
                    <p className="text-[15px] sm:text-base text-neutral-400 leading-relaxed max-w-2xl">
                      Your central knowledge base for onboarding, standard
                      operating procedures, brand guidelines, and internal
                      documentation.
                    </p>

                    <div className="mt-8 pt-6 border-t border-white/10">
                      <div className="flex items-start gap-3 mb-1">
                        <Target className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">
                            Our Mission
                          </p>
                          <p className="text-[20px] sm:text-[22px] font-bold text-white leading-snug tracking-tight">
                            Bold ideas, excellence in execution
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10">
                      <div className="flex items-start gap-3">
                        <Star className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-2">
                            What We Do
                          </p>
                          <p className="text-[14px] text-neutral-300 leading-[1.75]">
                            Leveraging networks to connect people, places,
                            and things through creative media and smart
                            marketing. At 434 Media, we connect enterprises
                            through high-impact, ROI-driven brand media
                            strategies that move audiences and deliver
                            measurable results.
                          </p>
                          <p className="text-[14px] text-neutral-400 leading-[1.75] mt-3">
                            As a full-service media and marketing agency, we
                            specialize in brand storytelling, broadcast and
                            digital media strategy, video production, web
                            development, and event production\u2014all
                            designed to elevate visibility, engagement, and
                            impact.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-start gap-6">
                      <div className="flex items-start gap-3 flex-1">
                        <Heart className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">
                            Our Attitude
                          </p>
                          <p className="text-[15px] font-semibold text-white leading-snug">
                            Actions Speak Louder
                          </p>
                          <p className="text-[13px] text-neutral-400 leading-relaxed mt-1">
                            This attitude\u2014Vision to Action\u2014drives
                            everything we do, from creative ideation to
                            final execution.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 flex-1">
                        <MapPin className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">
                            Office Location
                          </p>
                          <p className="text-[14px] font-medium text-white leading-snug">
                            Fine Silver
                          </p>
                          <p className="text-[13px] text-neutral-400 leading-relaxed mt-0.5">
                            816 Camaron St., Suite 1.11
                            <br />
                            San Antonio, TX 78212
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* \u2500\u2500 Core Values \u2500\u2500 */}
              <section className="mb-10">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.15em] text-neutral-400 mb-4 px-1">
                  Core Values
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {CORE_VALUES.map((value) => {
                    const Icon = value.icon
                    return (
                      <div
                        key={value.name}
                        className="bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow group"
                      >
                        <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h4 className="text-[13px] font-bold text-neutral-900 tracking-tight leading-tight mb-1">
                          {value.name}
                        </h4>
                        <p className="text-[12px] text-neutral-500 leading-relaxed">
                          {value.description}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* \u2500\u2500 Stats bar \u2500\u2500 */}
              <div className="flex items-center gap-4 mb-6 text-[13px] text-neutral-400 font-medium px-1">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  {sops.length} document{sops.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {sops.filter((s) => s.status === "active").length} active
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {
                    new Set(sops.map((s) => s.department).filter(Boolean))
                      .size
                  }{" "}
                  teams
                </span>
              </div>

              {/* \u2500\u2500 Search & Filters \u2500\u2500 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                  <input
                    type="text"
                    placeholder="Search all documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all shadow-sm"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer shadow-sm"
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
                  className="px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer shadow-sm"
                >
                  <option value="all">All Statuses</option>
                  {SOP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() +
                        s.slice(1).replace("-", " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* \u2500\u2500 Hub sections \u2500\u2500 */}
              {sops.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                  <BookOpen className="w-10 h-10 text-neutral-200 mx-auto mb-4" />
                  <h3 className="text-[15px] font-semibold text-neutral-700 mb-1">
                    No documents yet
                  </h3>
                  <p className="text-[13px] text-neutral-400 leading-relaxed max-w-sm mx-auto mb-6">
                    Create your first document to start building the 434
                    Media knowledge base for your team.
                  </p>
                  <button
                    onClick={() => openCreate()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Document
                  </button>
                </div>
              ) : filteredSOPs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-neutral-200 shadow-sm">
                  <Search className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                  <p className="text-[14px] font-medium text-neutral-600">
                    No matching documents
                  </p>
                  <p className="text-[13px] text-neutral-400 mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {HUB_SECTIONS.map((section) => {
                    const docs = sectionedSOPs[section.id] || []
                    if (
                      docs.length === 0 &&
                      (searchQuery ||
                        categoryFilter !== "all" ||
                        statusFilter !== "all")
                    )
                      return null
                    const isExpanded = expandedSections.has(section.id)
                    const Icon = section.icon

                    return (
                      <div
                        key={section.id}
                        className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm"
                      >
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                              <h3 className="text-[14px] font-semibold text-neutral-900 tracking-tight leading-tight">
                                {section.label}
                              </h3>
                              <p className="text-[12px] text-neutral-400 mt-0.5 leading-relaxed">
                                {section.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                              {docs.length}
                            </span>
                            <ChevronDown
                              className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-neutral-100">
                            {docs.length === 0 ? (
                              <div className="px-5 sm:px-6 py-6 text-center">
                                <p className="text-[13px] text-neutral-400 mb-3">
                                  No documents in this section yet
                                </p>
                                <button
                                  onClick={() =>
                                    openCreate(section.categories[0])
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  Add document
                                </button>
                              </div>
                            ) : (
                              docs.map((sop, index) => (
                                <div
                                  key={sop.id}
                                  className={`group flex items-center gap-4 px-5 sm:px-6 py-4 hover:bg-neutral-50 cursor-pointer transition-colors ${
                                    index !== docs.length - 1
                                      ? "border-b border-neutral-100"
                                      : ""
                                  }`}
                                  onClick={() => openDetail(sop)}
                                >
                                  <div className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0 group-hover:bg-neutral-200/70 transition-colors">
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2.5 mb-0.5">
                                      <h4 className="text-[14px] font-semibold text-neutral-900 tracking-tight leading-snug truncate">
                                        {sop.title}
                                      </h4>
                                      {getStatusBadge(sop.status)}
                                    </div>
                                    {sop.description && (
                                      <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-1">
                                        {sop.description}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 mt-1.5">
                                      {sop.owner && (
                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                                          <User className="w-3 h-3" />
                                          {sop.owner}
                                        </span>
                                      )}
                                      {sop.department && (
                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                                          <FolderOpen className="w-3 h-3" />
                                          {sop.department}
                                        </span>
                                      )}
                                      {sop.version && (
                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                                          <Tag className="w-3 h-3" />v
                                          {sop.version}
                                        </span>
                                      )}
                                      {sop.attachments &&
                                        sop.attachments.length > 0 && (
                                          <span className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                                            <Paperclip className="w-3 h-3" />
                                            {sop.attachments.length}
                                          </span>
                                        )}
                                      {sop.updated_at && (
                                        <span className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
                                          <Clock className="w-3 h-3" />
                                          {formatDate(sop.updated_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openEdit(sop)
                                      }}
                                      className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                                      title="Edit"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDelete(sop.id)
                                      }}
                                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0" />
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : viewMode === "detail" && selectedSOP ? (
            /* \u2500\u2500 Detail View \u2500\u2500 */
            <div className="max-w-3xl mx-auto">
              <article>
                <header className="mb-8 pb-8 border-b border-neutral-200">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                      {selectedSOP.category}
                    </span>
                    <span className="text-neutral-300">&middot;</span>
                    {getStatusBadge(selectedSOP.status)}
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight leading-[1.15] mb-4">
                    {selectedSOP.title}
                  </h1>
                  {selectedSOP.description && (
                    <p className="text-lg text-neutral-500 leading-relaxed">
                      {selectedSOP.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-6 text-[13px] text-neutral-400 font-medium">
                    {selectedSOP.owner && (
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {selectedSOP.owner}
                      </span>
                    )}
                    {selectedSOP.department && (
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5" />
                        {selectedSOP.department}
                      </span>
                    )}
                    {selectedSOP.version && (
                      <span className="flex items-center gap-1.5">
                        <Hash className="w-3.5 h-3.5" />
                        Version {selectedSOP.version}
                      </span>
                    )}
                    {selectedSOP.last_reviewed && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Reviewed{" "}
                        {formatDate(selectedSOP.last_reviewed)}
                      </span>
                    )}
                    {selectedSOP.updated_at && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Updated {formatDate(selectedSOP.updated_at)}
                      </span>
                    )}
                  </div>
                </header>

                {/* Inline images from attachments */}
                {selectedSOP.attachments &&
                  selectedSOP.attachments.filter(
                    (a) => a.type === "image"
                  ).length > 0 && (
                    <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedSOP.attachments
                        .filter((a) => a.type === "image")
                        .map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-xl border border-neutral-200 hover:shadow-md transition-shadow"
                          >
                            <img
                              src={att.url}
                              alt={att.filename || "Image"}
                              className="w-full h-auto object-cover"
                            />
                            {att.filename && (
                              <p className="px-3 py-2 text-[12px] text-neutral-500 bg-neutral-50 truncate">
                                {att.filename}
                              </p>
                            )}
                          </a>
                        ))}
                    </div>
                  )}

                <div className="mb-8">
                  <div className="whitespace-pre-wrap text-[15px] text-neutral-600 leading-[1.8] font-normal">
                    {selectedSOP.content}
                  </div>
                </div>

                {selectedSOP.tags && selectedSOP.tags.length > 0 && (
                  <div className="pt-6 border-t border-neutral-200 mb-8">
                    <div className="flex flex-wrap gap-2">
                      {selectedSOP.tags.map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-600 bg-neutral-100 rounded-lg"
                        >
                          <Hash className="w-3 h-3 text-neutral-400" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Non-image attachments (files & links) */}
                {selectedSOP.attachments &&
                  selectedSOP.attachments.filter(
                    (a) => a.type !== "image"
                  ).length > 0 && (
                    <div className="pt-6 border-t border-neutral-200 mb-8">
                      <h4 className="text-[12px] font-semibold uppercase tracking-widest text-neutral-400 mb-3">
                        Attachments & Links
                      </h4>
                      <div className="space-y-2">
                        {selectedSOP.attachments
                          .filter((a) => a.type !== "image")
                          .map((att, i) => (
                            <a
                              key={i}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl transition-colors group"
                            >
                              <span className="text-neutral-400 group-hover:text-neutral-600">
                                {getAttachmentIcon(att.type)}
                              </span>
                              <span className="text-[13px] font-medium text-neutral-700 truncate flex-1">
                                {att.filename || att.url}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
                  <button
                    onClick={() => handleDelete(selectedSOP.id)}
                    className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  <button
                    onClick={() => openEdit(selectedSOP)}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Document
                  </button>
                </div>
              </article>
            </div>
          ) : (
            /* \u2500\u2500 Form View (Create / Edit) \u2500\u2500 */
            <div className="max-w-3xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-neutral-900 tracking-tight leading-tight">
                  {viewMode === "create"
                    ? "Create New Document"
                    : "Edit Document"}
                </h2>
                <p className="text-[14px] text-neutral-500 mt-1.5 leading-relaxed">
                  {viewMode === "create"
                    ? "Add a new procedure, guide, or knowledge base article for the team."
                    : "Update the document details and content below."}
                </p>
              </div>

              <div className="space-y-5">
                {/* \u2500\u2500 Title & Summary \u2500\u2500 */}
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Title{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Enter document title..."
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-lg font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Summary
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Brief description of what this document covers..."
                      rows={2}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all resize-none"
                    />
                  </div>
                </div>

                {/* \u2500\u2500 Metadata \u2500\u2500 */}
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8">
                  <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                    Document Details
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer"
                      >
                        {SOP_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
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
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none cursor-pointer"
                      >
                        {SOP_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() +
                              s.slice(1).replace("-", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Department / Team
                      </label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            department: e.target.value,
                          }))
                        }
                        placeholder="e.g. Marketing"
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Owner
                      </label>
                      <input
                        type="text"
                        value={formData.owner}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            owner: e.target.value,
                          }))
                        }
                        placeholder="Document owner"
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Version
                      </label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            version: e.target.value,
                          }))
                        }
                        placeholder="1.0"
                        className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={formData.tags?.join(", ") || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tags: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="onboarding, brand, sop..."
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Separate multiple tags with commas
                    </p>
                  </div>
                </div>

                {/* \u2500\u2500 Content \u2500\u2500 */}
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8">
                  <label className="block text-[12px] font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                    Content
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        content: e.target.value,
                      }))
                    }
                    placeholder="Write the full document content here...\n\nYou can include step-by-step instructions, procedures, guidelines, or any other documentation your team needs."
                    rows={16}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-[14px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:bg-white transition-all leading-[1.75] resize-y"
                    style={{ minHeight: "260px" }}
                  />
                </div>

                {/* \u2500\u2500 Attachments (files, images, links) \u2500\u2500 */}
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 sm:p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[12px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Attachments & Media
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setShowLinkInput(!showLinkInput)
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                      >
                        <LinkIcon className="w-3 h-3" />
                        Add Link
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isUploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Upload className="w-3 h-3" />
                        )}
                        Upload File
                      </button>
                    </div>
                  </div>

                  {/* Link input */}
                  {showLinkInput && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                        <input
                          type="url"
                          value={linkInput}
                          onChange={(e) =>
                            setLinkInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addLinkAttachment()
                            }
                          }}
                          placeholder="https://example.com/resource"
                          className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all"
                          autoFocus
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addLinkAttachment}
                        className="px-3 py-2 text-[12px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinkInput(false)
                          setLinkInput("")
                        }}
                        className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                    onChange={(e) => {
                      if (e.target.files?.length)
                        handleFileUpload(e.target.files)
                      e.target.value = ""
                    }}
                    className="hidden"
                  />

                  {/* Drop zone */}
                  <div
                    ref={dropZoneRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      isDragging
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    {isUploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                        <p className="text-[13px] text-neutral-500 font-medium">
                          Uploading...
                        </p>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-neutral-300 mx-auto mb-2" />
                        <p className="text-[13px] text-neutral-500 font-medium">
                          Drag & drop files here
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Images, PDFs, documents up to 50MB
                        </p>
                      </>
                    )}
                  </div>

                  {/* Attached items list */}
                  {formData.attachments &&
                    formData.attachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {formData.attachments.map((att, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl group"
                          >
                            {att.type === "image" ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-200 shrink-0">
                                <img
                                  src={att.url}
                                  alt={att.filename || ""}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-500 shrink-0">
                                {getAttachmentIcon(att.type)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-neutral-700 truncate">
                                {att.filename || att.url}
                              </p>
                              <p className="text-[11px] text-neutral-400 capitalize">
                                {att.type || "file"}
                              </p>
                            </div>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded transition-colors"
                              title="Open"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => removeAttachment(i)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                </div>

                {/* \u2500\u2500 Save bar (sticky at bottom on mobile) \u2500\u2500 */}
                <div className="flex items-center justify-between py-4">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("list")
                      setSelectedSOP(null)
                      resetForm()
                    }}
                    className="px-4 py-2 text-[13px] font-medium text-neutral-600 hover:text-neutral-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || isUploading}
                    className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-all disabled:opacity-50 shadow-sm"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving
                      ? "Saving..."
                      : viewMode === "create"
                        ? "Create Document"
                        : "Update Document"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
