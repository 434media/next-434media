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
  User,
  Tag,
  Save,
  Clock,
  BookOpen,
  Hash,
  ArrowLeft,
  ChevronDown,
  Shield,
  Lightbulb,
  Handshake,
  Award,
  Flame,
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Target,
  Star,
  Heart,
  MapPin,
  Palette,
  PenTool,
  Globe,
  Megaphone,
  FolderOpen,
} from "lucide-react"
import type { SOP, SOPAttachment } from "../../types/project-management-types"
import { SOP_STATUSES } from "../../types/project-management-types"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"
import { RichTextEditor } from "../../components/RichTextEditor"
import { ImageUpload } from "../../components/ImageUpload"

// ── Local categories (page-scoped, not from types) ──
const DOC_CATEGORIES = ["Brands", "Design", "Web", "Marketing", "Other"] as const
type DocCategory = (typeof DOC_CATEGORIES)[number]

const CATEGORY_META: Record<
  DocCategory,
  { icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  Brands: {
    icon: Palette,
    description: "Brand guidelines, identity systems, voice & tone, logo usage",
  },
  Design: {
    icon: PenTool,
    description: "Design systems, templates, creative workflows, visual standards",
  },
  Web: {
    icon: Globe,
    description: "Web development standards, CMS guides, deployment, tech docs",
  },
  Marketing: {
    icon: Megaphone,
    description: "Campaign playbooks, social media SOPs, content calendars",
  },
  Other: {
    icon: FolderOpen,
    description: "General documentation, onboarding checklists, resources",
  },
}

const CORE_VALUES = [
  { name: "Integrity", icon: Shield, text: "Do what you say you\u2019re going to do. Trust but verify." },
  { name: "Creativity", icon: Lightbulb, text: "Stay curious, challenge the status quo, solve problems, think big." },
  { name: "Collaboration", icon: Handshake, text: "We don\u2019t do it alone. You are the company you keep." },
  { name: "Excellence", icon: Award, text: "If you\u2019re going to do it, do it right. Be accountable." },
  { name: "Impact", icon: Flame, text: "Your time is valuable, so is everyone else\u2019s. Make it matter." },
]

type ViewMode = "docs" | "detail" | "edit" | "create"

interface Toast {
  message: string
  type: "success" | "error"
}

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export default function SOPsPage() {
  // ── State ──
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("docs")
  const [searchQuery, setSearchQuery] = useState("")
  const [sops, setSOPs] = useState<SOP[]>([])
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>("Brands")
  const [isDragging, setIsDragging] = useState(false)
  const [linkInput, setLinkInput] = useState("")
  const [showLinkInput, setShowLinkInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<Partial<SOP>>({
    title: "",
    category: "Brands",
    department: "",
    description: "",
    content: "",
    version: "1.0",
    status: "draft",
    owner: "",
    tags: [],
    attachments: [],
  })

  // ── Effects ──
  useEffect(() => { loadData() }, [])
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }
  }, [toast])

  // ── Data ──
  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/sops")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setSOPs(data.sops || [])
    } catch { /* empty */ } finally { setIsLoading(false) }
  }

  const handleSave = async () => {
    if (!formData.title) { setToast({ message: "Title is required", type: "error" }); return }
    setIsSaving(true)
    try {
      const isUpdate = viewMode === "edit" && selectedSOP?.id
      const method = isUpdate ? "PUT" : "POST"
      const saveData = { ...formData, content: formData.content || "" }
      const body = isUpdate ? { id: selectedSOP.id, data: saveData } : { data: saveData }
      const res = await fetch("/api/admin/sops", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to save") }
      setToast({ message: isUpdate ? "Document updated" : "Document created", type: "success" })
      setViewMode("docs")
      setSelectedSOP(null)
      resetForm()
      await loadData()
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to save", type: "error" })
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return
    try {
      const res = await fetch(`/api/admin/sops?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setToast({ message: "Deleted", type: "success" })
      if (selectedSOP?.id === id) { setViewMode("docs"); setSelectedSOP(null) }
      await loadData()
    } catch { setToast({ message: "Failed to delete", type: "error" }) }
  }

  const resetForm = () => {
    setFormData({ title: "", category: activeCategory || "Brands", department: "", description: "", content: "", version: "1.0", status: "draft", owner: "", tags: [], attachments: [] })
    setLinkInput(""); setShowLinkInput(false)
  }

  const openCreate = (category?: string) => {
    resetForm()
    if (category) setFormData((p) => ({ ...p, category }))
    setViewMode("create")
  }

  const openEdit = (sop: SOP) => {
    setSelectedSOP(sop)
    setFormData({ title: sop.title, category: sop.category, department: sop.department, description: sop.description, content: sop.content, version: sop.version, status: sop.status, owner: sop.owner, tags: sop.tags, attachments: sop.attachments || [] })
    setViewMode("edit")
  }

  const openDetail = (sop: SOP) => { setSelectedSOP(sop); setViewMode("detail") }

  // ── File uploads ──
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    setIsUploading(true)
    const next: SOPAttachment[] = [...(formData.attachments || [])]
    try {
      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) { setToast({ message: `${file.name} exceeds 50MB`, type: "error" }); continue }
        const blob = await upload(`sops/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`, file, { access: "public", handleUploadUrl: "/api/upload" })
        next.push({ url: blob.url, filename: file.name, type: file.type.startsWith("image/") ? "image" : file.type || "file" })
      }
      setFormData((p) => ({ ...p, attachments: next }))
      setToast({ message: "Uploaded", type: "success" })
    } catch (err) { setToast({ message: err instanceof Error ? err.message : "Upload failed", type: "error" }) }
    finally { setIsUploading(false) }
  }, [formData.attachments])

  const addLink = () => {
    if (!linkInput.trim()) return
    const url = linkInput.trim().startsWith("http") ? linkInput.trim() : `https://${linkInput.trim()}`
    let hostname = url; try { hostname = new URL(url).hostname } catch { /* keep raw */ }
    setFormData((p) => ({ ...p, attachments: [...(p.attachments || []), { url, filename: hostname, type: "link" }] }))
    setLinkInput(""); setShowLinkInput(false)
  }

  const removeAttachment = (i: number) => {
    setFormData((p) => ({ ...p, attachments: (p.attachments || []).filter((_, idx) => idx !== i) }))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files?.length) handleFileUpload(e.dataTransfer.files) }, [handleFileUpload])

  // ── Derived ──
  const filteredSOPs = useMemo(() => {
    return sops.filter((s) => {
      const q = searchQuery.toLowerCase()
      return !searchQuery || s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.content?.toLowerCase().includes(q) || s.tags?.some((t) => t.toLowerCase().includes(q))
    })
  }, [sops, searchQuery])

  const sopsByCategory = useMemo(() => {
    const map: Record<string, SOP[]> = {}
    for (const cat of DOC_CATEGORIES) map[cat] = []
    for (const sop of filteredSOPs) {
      const cat = DOC_CATEGORIES.includes(sop.category as DocCategory) ? sop.category : "Other"
      map[cat].push(sop)
    }
    return map
  }, [filteredSOPs])

  // Active category docs for center panel
  const activeDocs = activeCategory ? (sopsByCategory[activeCategory] || []) : []

  // "On this page" anchors for detail view
  const tocAnchors = useMemo(() => {
    if (!selectedSOP?.content) return []
    const lines = selectedSOP.content.split("\n")
    return lines.filter((l) => l.startsWith("# ") || l.startsWith("## ") || l.startsWith("### ")).map((l) => {
      const level = l.startsWith("### ") ? 3 : l.startsWith("## ") ? 2 : 1
      const text = l.replace(/^#{1,3}\s+/, "")
      return { level, text, id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-") }
    })
  }, [selectedSOP?.content])

  const getStatusBadge = (status: string) => {
    const s: Record<string, string> = {
      draft: "bg-amber-50 text-amber-700 ring-amber-200",
      active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      "under-review": "bg-blue-50 text-blue-700 ring-blue-200",
      archived: "bg-neutral-100 text-neutral-500 ring-neutral-200",
    }
    return <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full ring-1 ring-inset ${s[status] || s.draft}`}>{status.replace("-", " ")}</span>
  }

  const getAttachmentIcon = (type?: string) => {
    if (type === "image") return <ImageIcon className="w-4 h-4" />
    if (type === "link") return <ExternalLink className="w-4 h-4" />
    return <Paperclip className="w-4 h-4" />
  }

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : null

  // ════════════════════════════════════
  // Render
  // ════════════════════════════════════
  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-dvh bg-white">
        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50">
            <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-[13px] font-medium ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
              {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{toast.message}</span>
              <button onClick={() => setToast(null)} className="ml-1 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}

        {/* ── Sticky top bar ── */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-neutral-200">
          <div className="max-w-360 mx-auto px-4 sm:px-6 pt-20 md:pt-16">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                {viewMode !== "docs" ? (
                  <button onClick={() => { setViewMode("docs"); setSelectedSOP(null) }} className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 transition-colors text-sm font-medium">
                    <ArrowLeft className="w-4 h-4" /><span className="hidden sm:inline">Back</span>
                  </button>
                ) : (
                  <Link href="/admin" className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-700 transition-colors text-sm font-medium">
                    <ChevronLeft className="w-4 h-4" /><span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <div className="h-5 w-px bg-neutral-200 hidden sm:block" />
                <div className="hidden sm:flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-neutral-600" />
                  <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                    {viewMode === "create" ? "NEW DOCUMENT" : viewMode === "edit" ? "EDIT DOCUMENT" : viewMode === "detail" ? "DOCUMENT" : "434 MEDIA HUB"}
                  </h1>
                </div>
              </div>

              {/* Search (docs view only) */}
              <div className="flex items-center gap-3">
                {viewMode === "docs" && (
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-300" />
                    <input type="text" placeholder="Search docs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-56 pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all" />
                  </div>
                )}
                {viewMode === "docs" && (
                  <button onClick={() => openCreate(activeCategory || "Brands")} className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all shadow-sm">
                    <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New Document</span>
                  </button>
                )}
                {(viewMode === "create" || viewMode === "edit") && (
                  <button onClick={handleSave} disabled={isSaving || isUploading} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 shadow-sm">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {isSaving ? "Saving..." : "Save Document"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-360 mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-32">
              <div className="text-center">
                <Loader2 className="w-5 h-5 animate-spin text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-400 text-[13px]">Loading...</p>
              </div>
            </div>
          ) : viewMode === "docs" ? (
            <>
              {/* ════════ HERO ════════ */}
              <section className="border-b border-neutral-200">
                <div className="px-4 sm:px-6 py-8 sm:py-10">
                  <div className="relative overflow-hidden bg-neutral-900 rounded-2xl">
                    <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
                    <div className="relative z-10 p-6 sm:p-8">
                      {/* Row 1: Title + Mission */}
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 mb-5">
                        <div className="max-w-md">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-1.5">Welcome to</p>
                          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-[1.1] mb-1.5">434 Media Hub</h2>
                          <p className="text-[13px] text-neutral-400 leading-relaxed">Your central knowledge base for onboarding, brand guidelines, design systems, web documentation, and marketing playbooks.</p>
                        </div>
                        <div className="flex items-start gap-2.5 lg:pt-1">
                          <Target className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-0.5">Our Mission</p>
                            <p className="text-[16px] sm:text-[17px] font-bold text-white leading-snug tracking-tight">Bold ideas, excellence in execution</p>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: What We Do · Attitude · Location */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 border-t border-white/10 mb-5">
                        <div className="flex items-start gap-2.5">
                          <Star className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">What We Do</p>
                            <p className="text-[12px] text-neutral-300 leading-[1.7]">Full-service brand storytelling, broadcast & digital media strategy, video production, web development, and event production.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Heart className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">Our Attitude</p>
                            <p className="text-[13px] font-semibold text-white leading-snug mb-0.5">Actions Speak Louder</p>
                            <p className="text-[11px] text-neutral-400 leading-relaxed">Vision to Action{"\u2014"}drives everything from creative ideation to final execution.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">Office</p>
                            <p className="text-[12px] font-medium text-white leading-snug">Fine Silver</p>
                            <p className="text-[11px] text-neutral-400 leading-relaxed">816 Camaron St., Suite 1.11<br />San Antonio, TX 78212</p>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Core Values */}
                      <div className="pt-5 border-t border-white/10">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-2.5">Core Values</p>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          {CORE_VALUES.map((v) => { const Icon = v.icon; return (
                            <div key={v.name} className="bg-white/5 border border-white/10 rounded-xl p-2.5 hover:bg-white/8 transition-colors group">
                              <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center"><Icon className="w-2.5 h-2.5 text-neutral-300" /></div>
                                <h4 className="text-[11px] font-bold text-white tracking-tight">{v.name}</h4>
                              </div>
                              <p className="text-[10px] text-neutral-400 leading-relaxed">{v.text}</p>
                            </div>
                          )})}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* ════════ DOCS THREE-COLUMN LAYOUT ════════ */}
              <div className="flex min-h-[calc(100dvh-280px)]">
                {/* ── Left Sidebar: Categories ── */}
                <aside className="hidden md:block w-60 lg:w-64 border-r border-neutral-200 shrink-0">
                  <div className="sticky top-30 px-4 py-6 overflow-y-auto max-h-[calc(100dvh-120px)]">
                    <nav className="select-none">
                      {DOC_CATEGORIES.map((cat) => {
                        const meta = CATEGORY_META[cat]
                        const Icon = meta.icon
                        const docs = sopsByCategory[cat] || []
                        const isOpen = activeCategory === cat

                        return (
                          <div key={cat} className="mb-0.5">
                            <button
                              onClick={() => setActiveCategory(isOpen ? null : cat)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors group ${isOpen ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                <span className="text-[13px] font-semibold tracking-tight truncate">{cat}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {docs.length > 0 && <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">{docs.length}</span>}
                                <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </div>
                            </button>

                            {isOpen && (
                              <div className="mt-0.5 ml-3 pl-3 border-l border-neutral-200">
                                <p className="text-[11px] text-neutral-400 leading-relaxed px-2 py-1.5 mb-0.5">{meta.description}</p>
                                {docs.length === 0 ? (
                                  <p className="text-[11px] text-neutral-400 italic px-2 py-1">No documents yet</p>
                                ) : docs.map((sop) => (
                                  <button key={sop.id} onClick={() => openDetail(sop)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${selectedSOP?.id === sop.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"}`}>
                                    <FileText className="w-3 h-3 shrink-0 opacity-50" />
                                    <span className="text-[13px] font-medium truncate leading-snug">{sop.title}</span>
                                  </button>
                                ))}
                                <button onClick={() => openCreate(cat)} className="w-full flex items-center gap-2 px-2 py-1.5 mt-0.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
                                  <Plus className="w-3 h-3 shrink-0" /><span className="text-[12px] font-medium">Add document</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </nav>
                  </div>
                </aside>

                {/* ── Center: Document list / empty ── */}
                <div className="flex-1 min-w-0">
                  <div className="px-6 sm:px-8 lg:px-12 py-8 max-w-3xl mx-auto">
                    {/* Mobile category selector */}
                    <div className="md:hidden mb-6">
                      <select value={activeCategory || ""} onChange={(e) => setActiveCategory(e.target.value || null)}
                        className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                        <option value="">All Categories</option>
                        {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {activeCategory ? (
                      <>
                        {/* Category header */}
                        <div className="mb-8">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-400 mb-1">{activeCategory}</p>
                          <h2 className="text-[22px] sm:text-[26px] font-bold text-neutral-900 tracking-tight leading-tight mb-2">
                            {activeCategory === "Brands" && "Brand Guidelines & Identity"}
                            {activeCategory === "Design" && "Design Systems & Standards"}
                            {activeCategory === "Web" && "Web Development Docs"}
                            {activeCategory === "Marketing" && "Marketing Playbooks"}
                            {activeCategory === "Other" && "General Resources"}
                          </h2>
                          <p className="text-[14px] text-neutral-500 leading-relaxed">{CATEGORY_META[activeCategory as DocCategory]?.description}</p>
                        </div>

                        {activeDocs.length === 0 ? (
                          <div className="text-center py-20">
                            <BookOpen className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                            <p className="text-[14px] font-medium text-neutral-600 mb-1">No documents yet</p>
                            <p className="text-[13px] text-neutral-400 mb-6 max-w-sm mx-auto leading-relaxed">Create the first document for {activeCategory} to start building the knowledge base.</p>
                            <button onClick={() => openCreate(activeCategory)} className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors">
                              <Plus className="w-4 h-4" />Create Document
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {activeDocs.map((sop) => (
                              <div key={sop.id} onClick={() => openDetail(sop)} className="group flex items-start gap-4 px-4 py-4 -mx-4 rounded-xl hover:bg-neutral-50 cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-neutral-200 transition-colors">
                                  <FileText className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <h3 className="text-[15px] font-semibold text-neutral-900 tracking-tight truncate">{sop.title}</h3>
                                    {getStatusBadge(sop.status)}
                                  </div>
                                  {sop.description && <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 mb-1.5">{sop.description}</p>}
                                  <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-medium">
                                    {sop.owner && <span className="flex items-center gap-1"><User className="w-3 h-3" />{sop.owner}</span>}
                                    {sop.version && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />v{sop.version}</span>}
                                    {sop.attachments && sop.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{sop.attachments.length}</span>}
                                    {sop.updated_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(sop.updated_at)}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                                  <button onClick={(e) => { e.stopPropagation(); openEdit(sop) }} className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(sop.id) }} className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-20">
                        <BookOpen className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                        <p className="text-[14px] font-medium text-neutral-600 mb-1">Select a category</p>
                        <p className="text-[13px] text-neutral-400">Choose a category from the sidebar to browse documents.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : viewMode === "detail" && selectedSOP ? (
            /* ════════ DETAIL VIEW — three-column with TOC ════════ */
            <div className="flex min-h-[calc(100dvh-120px)]">
              {/* Left: back link + category context */}
              <aside className="hidden lg:block w-60 border-r border-neutral-200 shrink-0">
                <div className="sticky top-30 px-4 py-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400 mb-3">{selectedSOP.category}</p>
                  {(sopsByCategory[selectedSOP.category] || []).map((sop) => (
                    <button key={sop.id} onClick={() => openDetail(sop)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md text-left transition-colors ${sop.id === selectedSOP.id ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"}`}>
                      <FileText className="w-3 h-3 shrink-0 opacity-50" />
                      <span className="text-[13px] font-medium truncate">{sop.title}</span>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Center: document content */}
              <article className="flex-1 min-w-0 px-6 sm:px-8 lg:px-12 py-8 max-w-3xl mx-auto">
                <header className="mb-8 pb-6 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">{selectedSOP.category}</span>
                    <span className="text-neutral-300">&middot;</span>
                    {getStatusBadge(selectedSOP.status)}
                  </div>
                  <h1 className="text-[28px] sm:text-[34px] font-bold text-neutral-900 tracking-tight leading-[1.12] mb-3">{selectedSOP.title}</h1>
                  {selectedSOP.description && <p className="text-[16px] text-neutral-500 leading-relaxed">{selectedSOP.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-[12px] text-neutral-400 font-medium">
                    {selectedSOP.owner && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{selectedSOP.owner}</span>}
                    {selectedSOP.version && <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />Version {selectedSOP.version}</span>}
                    {selectedSOP.updated_at && <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Updated {formatDate(selectedSOP.updated_at)}</span>}
                  </div>
                </header>

                {/* Inline images */}
                {selectedSOP.attachments?.filter((a) => a.type === "image").length ? (
                  <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedSOP.attachments.filter((a) => a.type === "image").map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-neutral-200 hover:shadow-md transition-shadow">
                        <img src={att.url} alt={att.filename || "Image"} className="w-full h-auto object-cover" />
                        {att.filename && <p className="px-3 py-2 text-[12px] text-neutral-500 bg-neutral-50 truncate">{att.filename}</p>}
                      </a>
                    ))}
                  </div>
                ) : null}

                {/* Content (rendered as rich text if contains markdown) */}
                <div className="prose-434">
                  <div className="whitespace-pre-wrap text-[15px] text-neutral-700 leading-[1.85] font-normal tracking-[0.01em]">{selectedSOP.content}</div>
                </div>

                {/* Tags */}
                {selectedSOP.tags && selectedSOP.tags.length > 0 && (
                  <div className="pt-6 mt-8 border-t border-neutral-100">
                    <div className="flex flex-wrap gap-2">
                      {selectedSOP.tags.map((tag, i) => <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-500 bg-neutral-100 rounded-lg"><Hash className="w-3 h-3 text-neutral-400" />{tag}</span>)}
                    </div>
                  </div>
                )}

                {/* File/link attachments */}
                {selectedSOP.attachments?.filter((a) => a.type !== "image").length ? (
                  <div className="pt-6 mt-6 border-t border-neutral-100">
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400 mb-3">Attachments</h4>
                    <div className="space-y-2">
                      {selectedSOP.attachments.filter((a) => a.type !== "image").map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 rounded-xl transition-colors group">
                          <span className="text-neutral-400 group-hover:text-neutral-600">{getAttachmentIcon(att.type)}</span>
                          <span className="text-[13px] font-medium text-neutral-600 truncate flex-1">{att.filename || att.url}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 mt-8 border-t border-neutral-100">
                  <button onClick={() => handleDelete(selectedSOP.id)} className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" />Delete</button>
                  <button onClick={() => openEdit(selectedSOP)} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"><Edit2 className="w-3.5 h-3.5" />Edit Document</button>
                </div>
              </article>

              {/* Right: "On this page" TOC */}
              {tocAnchors.length > 0 && (
                <aside className="hidden xl:block w-56 shrink-0">
                  <div className="sticky top-30 px-4 py-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-400 mb-3">On this page</p>
                    <nav className="space-y-1">
                      {tocAnchors.map((a, i) => (
                        <p key={i} className={`text-[13px] font-medium text-neutral-500 hover:text-neutral-800 cursor-pointer transition-colors leading-snug ${a.level === 2 ? "pl-3" : a.level === 3 ? "pl-6" : ""}`}>{a.text}</p>
                      ))}
                    </nav>
                  </div>
                </aside>
              )}
            </div>
          ) : (
            /* ════════ FORM VIEW (Create / Edit) ════════ */
            <div className="flex min-h-[calc(100dvh-120px)]">
              {/* Main form area */}
              <div className="flex-1 min-w-0 px-6 sm:px-8 lg:px-12 py-8 max-w-3xl mx-auto">
                <div className="mb-6">
                  <h2 className="text-[22px] sm:text-[26px] font-bold text-neutral-900 tracking-tight leading-tight">{viewMode === "create" ? "Create New Document" : "Edit Document"}</h2>
                  <p className="text-[14px] text-neutral-500 mt-1 leading-relaxed">{viewMode === "create" ? "Add a new guide, SOP, or reference document for the team." : "Update the document details and content below."}</p>
                </div>

                <div className="space-y-6">
                  {/* Title */}
                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Title <span className="text-red-500">*</span></label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))} placeholder="Document title..."
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-[17px] font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all" />
                  </div>

                  {/* Summary */}
                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Summary</label>
                    <textarea value={formData.description} onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))} placeholder="Brief description..." rows={2}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-[14px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all resize-none leading-relaxed" />
                  </div>

                  {/* Rich text content */}
                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Content</label>
                    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                      <RichTextEditor value={formData.content || ""} onChange={(v) => setFormData((p) => ({ ...p, content: v }))} placeholder="Write your document content here... Supports markdown formatting." minRows={16} />
                    </div>
                  </div>

                  {/* Featured image via ImageUpload */}
                  <div>
                    <label className="block text-[12px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Cover Image</label>
                    <ImageUpload
                      value={(formData.attachments || []).find((a) => a.type === "image")?.url || ""}
                      onChange={(url) => {
                        if (!url) {
                          setFormData((p) => ({ ...p, attachments: (p.attachments || []).filter((a) => a.type !== "image") }))
                        } else {
                          const existing = (formData.attachments || []).filter((a) => a.type !== "image")
                          setFormData((p) => ({ ...p, attachments: [...existing, { url, filename: "Cover Image", type: "image" }] }))
                        }
                      }}
                      label="Upload or paste image URL"
                    />
                  </div>

                  {/* File attachments */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[12px] font-semibold text-neutral-500 uppercase tracking-wider">Attachments</label>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowLinkInput(!showLinkInput)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"><LinkIcon className="w-3 h-3" />Link</button>
                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-neutral-600 hover:text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50">
                          {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}File
                        </button>
                      </div>
                    </div>

                    {showLinkInput && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="relative flex-1">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                          <input type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink() }}} placeholder="https://..." autoFocus
                            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all" />
                        </div>
                        <button type="button" onClick={addLink} className="px-3 py-2 text-[12px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg">Add</button>
                        <button type="button" onClick={() => { setShowLinkInput(false); setLinkInput("") }} className="p-2 text-neutral-400 hover:text-neutral-600 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}

                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md" onChange={(e) => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = "" }} className="hidden" />

                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${isDragging ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300"}`}>
                      {isUploading ? (
                        <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /><p className="text-[13px] text-neutral-500 font-medium">Uploading...</p></div>
                      ) : (
                        <><Upload className="w-5 h-5 text-neutral-300 mx-auto mb-1.5" /><p className="text-[13px] text-neutral-500 font-medium">Drag & drop files</p><p className="text-[11px] text-neutral-400 mt-0.5">PDFs, documents, images up to 50MB</p></>
                      )}
                    </div>

                    {/* Attached list (non-cover-image) */}
                    {(formData.attachments || []).filter((a) => a.type !== "image").length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(formData.attachments || []).filter((a) => a.type !== "image").map((att, i) => {
                          const realIdx = (formData.attachments || []).indexOf(att)
                          return (
                            <div key={i} className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded-xl">
                              <span className="text-neutral-400">{getAttachmentIcon(att.type)}</span>
                              <span className="text-[13px] font-medium text-neutral-600 truncate flex-1">{att.filename || att.url}</span>
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-400 hover:text-neutral-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                              <button type="button" onClick={() => removeAttachment(realIdx)} className="p-1 text-neutral-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom save */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                    <button type="button" onClick={() => { setViewMode("docs"); setSelectedSOP(null); resetForm() }} className="px-4 py-2 text-[13px] font-medium text-neutral-500 hover:text-neutral-800 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || isUploading} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm disabled:opacity-50 transition-all">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? "Saving..." : viewMode === "create" ? "Create Document" : "Update Document"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right sidebar: metadata */}
              <aside className="hidden lg:block w-64 border-l border-neutral-200 shrink-0">
                <div className="sticky top-30 px-5 py-6 space-y-5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select value={formData.category} onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as SOP["status"] }))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      {SOP_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Owner</label>
                    <input type="text" value={formData.owner} onChange={(e) => setFormData((p) => ({ ...p, owner: e.target.value }))} placeholder="Author name"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Department</label>
                    <input type="text" value={formData.department} onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))} placeholder="e.g. Creative"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Version</label>
                    <input type="text" value={formData.version} onChange={(e) => setFormData((p) => ({ ...p, version: e.target.value }))} placeholder="1.0"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">Tags</label>
                    <input type="text" value={formData.tags?.join(", ") || ""} onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))} placeholder="onboarding, brand..."
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                    <p className="text-[10px] text-neutral-400 mt-1">Comma-separated</p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
