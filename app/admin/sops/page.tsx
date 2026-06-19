"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { upload } from "@vercel/blob/client"
import {
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
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  Paperclip,
  ExternalLink,
  Target,
  Palette,
  Globe,
  Megaphone,
  FolderOpen,
  Crosshair,
  ClipboardList,
  Hammer,
  Clapperboard,
  BarChart3,
  Rocket,
  LineChart,
} from "lucide-react"
import type { SOP, SOPAttachment } from "@/types/project-management-types"
import { SOP_STATUSES } from "@/types/project-management-types"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { renderMarkdown } from "@/lib/markdown"
import { VERTICAL_LABELS, type Vertical } from "@/types/crm-types"

const VERTICAL_OPTIONS = Object.keys(VERTICAL_LABELS) as Vertical[]

// ── Spaces & categories ──
// SOPs serve two audiences: 434's evergreen company knowledge base, and the
// Digital Canvas program's playbook/template home. Each gets its own "space".
// Program categories mirror the squads page — "one pipeline, five owners" — in
// flow order; the verb leads the description so the squad name stays the
// scannable label.
type SpaceKey = "company" | "program"

interface CategoryDef {
  key: string
  space: SpaceKey
  label: string
  description: string
  heading: string
  icon: React.ComponentType<{ className?: string }>
}

const SPACES: { key: SpaceKey; label: string }[] = [
  { key: "company", label: "434 Media" },
  { key: "program", label: "Digital Canvas Program" },
]

const CATEGORIES: CategoryDef[] = [
  // 434 Media — evergreen company knowledge base, mirroring the admin's modules + service lines
  { key: "Brand & Design", space: "company", label: "Brand & Design", icon: Palette,
    description: "Brand guidelines, identity, voice & tone, and the design system", heading: "Brand & Design System" },
  { key: "Content & Production", space: "company", label: "Content & Production", icon: Clapperboard,
    description: "Content studio, social, video, broadcast & event production", heading: "Content & Production" },
  { key: "Sales & CRM", space: "company", label: "Sales & CRM", icon: Rocket,
    description: "Pipeline ops: audiences, leads, outreach, consent & compliance", heading: "Sales & CRM" },
  { key: "Analytics & Reporting", space: "company", label: "Analytics & Reporting", icon: LineChart,
    description: "GA4, Instagram & portfolio reporting, and brand goals", heading: "Analytics & Reporting" },
  { key: "Web & Tech", space: "company", label: "Web & Tech", icon: Globe,
    description: "Web standards, CMS guides, deployment, technical docs", heading: "Web & Tech Docs" },
  { key: "Operations", space: "company", label: "Operations", icon: FolderOpen,
    description: "Onboarding, finance, HR, process & general resources", heading: "Operations & Resources" },
  // Digital Canvas Program — the pipeline as VERBS, in flow order (mirrors the
  // squads page tagline). Verb labels are durable past any squad/team name; the
  // squad/function lives in the description.
  { key: "find", space: "program", label: "Find", icon: Crosshair,
    description: "GTM · sponsors & target pipeline", heading: "Find — sponsors & pipeline" },
  { key: "frame", space: "program", label: "Frame", icon: ClipboardList,
    description: "Underwriter onboarding · the intake framework", heading: "Frame — the problem" },
  { key: "ship", space: "program", label: "Ship", icon: Hammer,
    description: "Builders · the build process", heading: "Ship — the prototype" },
  { key: "tell", space: "program", label: "Tell", icon: Megaphone,
    description: "Storytellers · story, brand & cohort media", heading: "Tell — the story" },
  { key: "prove", space: "program", label: "Prove", icon: BarChart3,
    description: "Analytics · cohort health & demo-day metrics", heading: "Prove — the outcome" },
]

const CATEGORY_KEYS = CATEGORIES.map((c) => c.key)

// Legacy categories (pre-spaces) → current keys, so existing docs never orphan.
const CATEGORY_ALIASES: Record<string, string> = {
  Brands: "Brand & Design",
  Design: "Brand & Design",
  Web: "Web & Tech",
  Marketing: "Content & Production",
  Other: "Operations",
  // Program categories were squad-named before the verb switch.
  GTM: "find",
  "Underwriter Onboarding": "frame",
  Builders: "ship",
  Storytellers: "tell",
  Analytics: "prove",
}

function normalizeCategory(raw?: string): string {
  if (raw && CATEGORY_KEYS.includes(raw)) return raw
  return (raw && CATEGORY_ALIASES[raw]) || "Operations"
}

function catDef(key?: string): CategoryDef {
  const norm = normalizeCategory(key)
  return CATEGORIES.find((c) => c.key === norm) ?? CATEGORIES[0]
}

const categoriesInSpace = (space: SpaceKey) => CATEGORIES.filter((c) => c.space === space)

type ViewMode = "docs" | "detail" | "edit" | "create"

interface Toast {
  message: string
  type: "success" | "error"
}

// Category headings now come from catDef().heading

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
  // No pre-selected category — with 434 Media collapsed by default, the open
  // Digital Canvas section is the focus and the intern picks their lane.
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeVertical, setActiveVertical] = useState<Vertical | "all">("all")
  const [showWelcome, setShowWelcome] = useState(false)
  // Collapsible space groups in the rail. 434 Media (company) starts collapsed so
  // interns focus on the Digital Canvas program section.
  const [collapsedSpaces, setCollapsedSpaces] = useState<Record<string, boolean>>({ company: true })
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
  // One-time welcome banner — dismissal persists in localStorage.
  useEffect(() => {
    try { if (localStorage.getItem("sop-welcome-dismissed") !== "1") setShowWelcome(true) } catch { /* no-op */ }
  }, [])

  const dismissWelcome = () => {
    setShowWelcome(false)
    try { localStorage.setItem("sop-welcome-dismissed", "1") } catch { /* no-op */ }
  }

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
    setFormData({ title: "", category: activeCategory || "Brand & Design", department: "", description: "", content: "", version: "1.0", status: "draft", owner: "", tags: [], attachments: [] })
    setLinkInput(""); setShowLinkInput(false)
  }

  const openCreate = (category?: string) => {
    resetForm()
    if (category) setFormData((p) => ({ ...p, category }))
    setViewMode("create")
  }

  const openEdit = (sop: SOP) => {
    setSelectedSOP(sop)
    setFormData({ title: sop.title, category: normalizeCategory(sop.category), vertical: sop.vertical, department: sop.department, description: sop.description, content: sop.content, version: sop.version, status: sop.status, owner: sop.owner, tags: sop.tags, attachments: sop.attachments || [] })
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
      return !searchQuery || s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q) || s.content?.toLowerCase().includes(q) || s.tags?.some((t) => t.toLowerCase().includes(q)) || (!!s.vertical && VERTICAL_LABELS[s.vertical].toLowerCase().includes(q))
    })
  }, [sops, searchQuery])

  const sopsByCategory = useMemo(() => {
    const map: Record<string, SOP[]> = {}
    for (const key of CATEGORY_KEYS) map[key] = []
    for (const sop of filteredSOPs) {
      map[normalizeCategory(sop.category)].push(sop)
    }
    return map
  }, [filteredSOPs])

  // Active category docs for center panel
  const activeDocs = activeCategory ? (sopsByCategory[activeCategory] || []) : []

  // Verticals actually in use — drives the filter control (and reconciles the
  // category nav with the cohort vertical taxonomy).
  const availableVerticals = useMemo(() => {
    const set = new Set<Vertical>()
    for (const s of sops) if (s.vertical) set.add(s.vertical)
    return VERTICAL_OPTIONS.filter((v) => set.has(v))
  }, [sops])

  // When a vertical is selected, browse flattens to that vertical across all
  // categories — the "obvious home" for cohort intake templates.
  const verticalDocs = useMemo(() => {
    if (activeVertical === "all") return []
    return filteredSOPs.filter((s) => s.vertical === activeVertical)
  }, [filteredSOPs, activeVertical])

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

  // Shared document list row — used by both category browse and vertical filter.
  const docRow = (sop: SOP) => (
    <div key={sop.id} onClick={() => openDetail(sop)} className="group flex items-start gap-4 p-4 rounded-xl bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-sm cursor-pointer transition-all">
      <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-neutral-200 transition-colors">
        <FileText className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <h3 className="text-[15px] font-semibold text-neutral-900 tracking-tight truncate">{sop.title}</h3>
          {getStatusBadge(sop.status)}
        </div>
        {sop.description && <p className="text-[13px] text-neutral-500 leading-relaxed line-clamp-2 mb-1.5">{sop.description}</p>}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 font-medium">
          {sop.owner && <span className="flex items-center gap-1"><User className="w-3 h-3" />{sop.owner}</span>}
          {sop.vertical && <span className="flex items-center gap-1 text-indigo-500"><Target className="w-3 h-3" />{VERTICAL_LABELS[sop.vertical]}</span>}
          {sop.version && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />v{sop.version}</span>}
          {sop.attachments && sop.attachments.length > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{sop.attachments.length}</span>}
          {sop.updated_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(sop.updated_at)}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(sop) }} className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(sop.id) }} className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )

  // ════════════════════════════════════
  // Render
  // ════════════════════════════════════
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
      <div className="min-h-full bg-neutral-50">
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

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500 text-[13px]">Loading...</p>
            </div>
          </div>
        ) : viewMode === "docs" ? (
          /* ════════ DOCS ════════ */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* Standard admin header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-lg font-semibold text-neutral-900">Knowledge Base</h1>
                <p className="text-[12px] text-neutral-500">SOPs, brand guidelines, playbooks &amp; cohort intake templates.</p>
              </div>
              <div className="flex items-center gap-2">
                {availableVerticals.length > 0 && (
                  <select
                    value={activeVertical}
                    onChange={(e) => setActiveVertical(e.target.value as Vertical | "all")}
                    className="px-2.5 py-2 bg-white border border-neutral-200 rounded-lg text-[12px] font-medium text-neutral-600 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                    title="Filter by vertical"
                  >
                    <option value="all">All verticals</option>
                    {availableVerticals.map((v) => <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>)}
                  </select>
                )}
                <div className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-300" />
                  <input type="text" placeholder="Search docs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-56 pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-300 transition-all" />
                </div>
                <button onClick={() => openCreate(activeCategory || "Brand & Design")} className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all shadow-sm shrink-0">
                  <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">New Document</span>
                </button>
              </div>
            </div>

            {/* Dismissible welcome banner (replaces the old full hero) */}
            {showWelcome && (
              <div className="relative mb-5 rounded-xl border border-neutral-200 bg-white px-4 py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-900">Welcome to the 434 Media Hub</p>
                  <p className="text-[12px] text-neutral-500 leading-relaxed">Your central knowledge base — onboarding, brand & design systems, web docs, marketing playbooks, and cohort intake templates. Browse by category, or filter by vertical.</p>
                </div>
                <button onClick={dismissWelcome} className="p-1 text-neutral-300 hover:text-neutral-600 transition-colors shrink-0" title="Dismiss"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {activeVertical !== "all" ? (
              /* ── Vertical filter: flat list across categories ── */
              <div className="max-w-3xl">
                <div className="mb-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-500 mb-1">{VERTICAL_LABELS[activeVertical]}</p>
                  <h2 className="text-[22px] font-bold text-neutral-900 tracking-tight leading-tight mb-2">{VERTICAL_LABELS[activeVertical]} documents</h2>
                  <p className="text-[14px] text-neutral-500 leading-relaxed">All documents tagged {VERTICAL_LABELS[activeVertical]}, across every category — e.g. cohort intake templates.</p>
                </div>
                {verticalDocs.length === 0 ? (
                  <div className="text-center py-20 bg-white border border-neutral-200 rounded-xl">
                    <BookOpen className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                    <p className="text-[14px] font-medium text-neutral-600 mb-1">No {VERTICAL_LABELS[activeVertical]} documents yet</p>
                    <p className="text-[13px] text-neutral-500 mb-6 max-w-sm mx-auto leading-relaxed">Create a document and set its vertical to {VERTICAL_LABELS[activeVertical]} to see it here.</p>
                    <button onClick={() => openCreate("Operations")} className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors"><Plus className="w-4 h-4" />Create Document</button>
                  </div>
                ) : (
                  <div className="space-y-2">{verticalDocs.map(docRow)}</div>
                )}
              </div>
            ) : (
              /* ── Category browse: left rail + center list ── */
              <div className="flex gap-6">
                {/* Left rail: categories — hairline divider marks it as section-level
                    navigation, a tier below the global admin sidebar. */}
                <aside className="hidden md:block w-56 lg:w-60 shrink-0 border-r border-neutral-200 pr-4">
                  <nav className="sticky top-6 select-none space-y-4">
                    {SPACES.map((space) => {
                      const spaceCollapsed = collapsedSpaces[space.key]
                      return (
                      <div key={space.key}>
                        <button
                          type="button"
                          onClick={() => setCollapsedSpaces((s) => ({ ...s, [space.key]: !s[space.key] }))}
                          className="w-full flex items-center justify-between gap-2 px-3 pb-1 pt-0.5 group"
                        >
                          <span className="font-geist-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 group-hover:text-neutral-700">{space.label}</span>
                          <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${spaceCollapsed ? "-rotate-90" : ""}`} />
                        </button>
                        {!spaceCollapsed && categoriesInSpace(space.key).map((def) => {
                          const Icon = def.icon
                          const docs = sopsByCategory[def.key] || []
                          const isOpen = activeCategory === def.key
                          return (
                            <div key={def.key} className="mb-0.5">
                              <button
                                onClick={() => setActiveCategory(isOpen ? null : def.key)}
                                title={def.description}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors group ${isOpen ? "bg-white border border-neutral-200 text-neutral-900 shadow-sm" : "text-neutral-500 hover:bg-white hover:text-neutral-700"}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
                                  <span className="text-[13px] font-semibold tracking-tight truncate">{def.label}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {docs.length > 0 && <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full">{docs.length}</span>}
                                  <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                </div>
                              </button>
                              {isOpen && (
                                <div className="mt-0.5 ml-3 pl-3 border-l border-neutral-200">
                                  {docs.length === 0 ? (
                                    <p className="text-[11px] text-neutral-500 italic px-2 py-1">No documents yet</p>
                                  ) : docs.map((sop) => (
                                    <button key={sop.id} onClick={() => openDetail(sop)}
                                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${selectedSOP?.id === sop.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-white hover:text-neutral-800"}`}>
                                      <FileText className="w-3 h-3 shrink-0 opacity-50" />
                                      <span className="text-[13px] font-medium truncate leading-snug">{sop.title}</span>
                                    </button>
                                  ))}
                                  <button onClick={() => openCreate(def.key)} className="w-full flex items-center gap-2 px-2 py-1.5 mt-0.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-white transition-colors">
                                    <Plus className="w-3 h-3 shrink-0" /><span className="text-[12px] font-medium">Add document</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      )
                    })}
                  </nav>
                </aside>

                {/* Center: document list */}
                <div className="flex-1 min-w-0 max-w-3xl">
                  {/* Mobile category selector */}
                  <div className="md:hidden mb-5">
                    <select value={activeCategory || ""} onChange={(e) => setActiveCategory(e.target.value || null)}
                      className="w-full px-3 py-2.5 bg-white border border-neutral-200 rounded-xl text-[13px] font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      <option value="">All Categories</option>
                      {SPACES.map((space) => (
                        <optgroup key={space.key} label={space.label}>
                          {categoriesInSpace(space.key).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  {activeCategory ? (
                    <>
                      <div className="mb-6">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-1">{catDef(activeCategory).space === "program" ? "Digital Canvas Program" : "434 Media"}</p>
                        <h2 className="text-[22px] font-bold text-neutral-900 tracking-tight leading-tight mb-2">{catDef(activeCategory).heading}</h2>
                        <p className="text-[14px] text-neutral-500 leading-relaxed">{catDef(activeCategory).description}</p>
                      </div>

                      {activeDocs.length === 0 ? (
                        <div className="text-center py-20 bg-white border border-neutral-200 rounded-xl">
                          <BookOpen className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                          <p className="text-[14px] font-medium text-neutral-600 mb-1">No documents yet</p>
                          <p className="text-[13px] text-neutral-500 mb-6 max-w-sm mx-auto leading-relaxed">Create the first document for {activeCategory} to start building the knowledge base.</p>
                          <button onClick={() => openCreate(activeCategory)} className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors">
                            <Plus className="w-4 h-4" />Create Document
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">{activeDocs.map(docRow)}</div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-20">
                      <BookOpen className="w-8 h-8 text-neutral-200 mx-auto mb-3" />
                      <p className="text-[14px] font-medium text-neutral-600 mb-1">Select a category</p>
                      <p className="text-[13px] text-neutral-500">Choose a category from the sidebar to browse documents.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : viewMode === "detail" && selectedSOP ? (
          /* ════════ DETAIL — three-column reader ════════ */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
            {/* Back + actions header */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <button onClick={() => { setViewMode("docs"); setSelectedSOP(null) }} className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /><span>Back</span>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(selectedSOP)} className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"><Edit2 className="w-3.5 h-3.5" />Edit</button>
                <button onClick={() => handleDelete(selectedSOP.id)} className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" />Delete</button>
              </div>
            </div>

            <div className="flex gap-6">
              {/* Left: sibling docs in category */}
              <aside className="hidden lg:block w-56 shrink-0">
                <div className="sticky top-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-3">{catDef(selectedSOP.category).label}</p>
                  {(sopsByCategory[normalizeCategory(selectedSOP.category)] || []).map((sop) => (
                    <button key={sop.id} onClick={() => openDetail(sop)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md text-left transition-colors ${sop.id === selectedSOP.id ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-white hover:text-neutral-700"}`}>
                      <FileText className="w-3 h-3 shrink-0 opacity-50" />
                      <span className="text-[13px] font-medium truncate">{sop.title}</span>
                    </button>
                  ))}
                </div>
              </aside>

              {/* Center: document */}
              <article className="flex-1 min-w-0 max-w-3xl bg-white border border-neutral-200 rounded-2xl px-6 sm:px-8 py-8">
                <header className="mb-8 pb-6 border-b border-neutral-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{catDef(selectedSOP.category).label}</span>
                    {selectedSOP.vertical && (
                      <>
                        <span className="text-neutral-300">&middot;</span>
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-500">{VERTICAL_LABELS[selectedSOP.vertical]}</span>
                      </>
                    )}
                    <span className="text-neutral-300">&middot;</span>
                    {getStatusBadge(selectedSOP.status)}
                  </div>
                  <h1 className="text-[28px] sm:text-[34px] font-bold text-neutral-900 tracking-tight leading-[1.12] mb-3">{selectedSOP.title}</h1>
                  {selectedSOP.description && <p className="text-[16px] text-neutral-500 leading-relaxed">{selectedSOP.description}</p>}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5 text-[12px] text-neutral-500 font-medium">
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.url} alt={att.filename || "Image"} className="w-full h-auto object-cover" />
                        {att.filename && <p className="px-3 py-2 text-[12px] text-neutral-500 bg-neutral-50 truncate">{att.filename}</p>}
                      </a>
                    ))}
                  </div>
                ) : null}

                {/* Content — rendered markdown (same renderer as the editor preview) */}
                <div
                  className="prose-434 text-[15px] text-neutral-700 leading-[1.85]"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedSOP.content || "") }}
                />

                {/* Tags */}
                {selectedSOP.tags && selectedSOP.tags.length > 0 && (
                  <div className="pt-6 mt-8 border-t border-neutral-100">
                    <div className="flex flex-wrap gap-2">
                      {selectedSOP.tags.map((tag, i) => <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-500 bg-neutral-100 rounded-lg"><Hash className="w-3 h-3 text-neutral-500" />{tag}</span>)}
                    </div>
                  </div>
                )}

                {/* File/link attachments */}
                {selectedSOP.attachments?.filter((a) => a.type !== "image").length ? (
                  <div className="pt-6 mt-6 border-t border-neutral-100">
                    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 mb-3">Attachments</h4>
                    <div className="space-y-2">
                      {selectedSOP.attachments.filter((a) => a.type !== "image").map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 rounded-xl transition-colors group">
                          <span className="text-neutral-500 group-hover:text-neutral-600">{getAttachmentIcon(att.type)}</span>
                          <span className="text-[13px] font-medium text-neutral-600 truncate flex-1">{att.filename || att.url}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>

              {/* Right: "On this page" TOC */}
              {tocAnchors.length > 0 && (
                <aside className="hidden xl:block w-52 shrink-0">
                  <div className="sticky top-6">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500 mb-3">On this page</p>
                    <nav className="space-y-1">
                      {tocAnchors.map((a, i) => (
                        <p key={i} className={`text-[13px] font-medium text-neutral-500 hover:text-neutral-800 cursor-pointer transition-colors leading-snug ${a.level === 2 ? "pl-3" : a.level === 3 ? "pl-6" : ""}`}>{a.text}</p>
                      ))}
                    </nav>
                  </div>
                </aside>
              )}
            </div>
          </div>
        ) : (
          /* ════════ FORM (Create / Edit) ════════ */
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
            {/* Back + Save header */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <button onClick={() => { setViewMode("docs"); setSelectedSOP(null); resetForm() }} className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-700 transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /><span>Back</span>
              </button>
              <button onClick={handleSave} disabled={isSaving || isUploading} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 shadow-sm">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSaving ? "Saving..." : "Save Document"}
              </button>
            </div>

            <div className="flex gap-6">
              {/* Main form */}
              <div className="flex-1 min-w-0 max-w-3xl">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-neutral-900">{viewMode === "create" ? "Create New Document" : "Edit Document"}</h2>
                  <p className="text-[13px] text-neutral-500 mt-0.5 leading-relaxed">{viewMode === "create" ? "Add a new guide, SOP, or reference document for the team." : "Update the document details and content below."}</p>
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
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                          <input type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink() }}} placeholder="https://..." autoFocus
                            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all" />
                        </div>
                        <button type="button" onClick={addLink} className="px-3 py-2 text-[12px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg">Add</button>
                        <button type="button" onClick={() => { setShowLinkInput(false); setLinkInput("") }} className="p-2 text-neutral-500 hover:text-neutral-600 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}

                    <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md" onChange={(e) => { if (e.target.files?.length) handleFileUpload(e.target.files); e.target.value = "" }} className="hidden" />

                    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${isDragging ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white hover:border-neutral-300"}`}>
                      {isUploading ? (
                        <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin text-neutral-500" /><p className="text-[13px] text-neutral-500 font-medium">Uploading...</p></div>
                      ) : (
                        <><Upload className="w-5 h-5 text-neutral-300 mx-auto mb-1.5" /><p className="text-[13px] text-neutral-500 font-medium">Drag & drop files</p><p className="text-[11px] text-neutral-500 mt-0.5">PDFs, documents, images up to 50MB</p></>
                      )}
                    </div>

                    {(formData.attachments || []).filter((a) => a.type !== "image").length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(formData.attachments || []).filter((a) => a.type !== "image").map((att, i) => {
                          const realIdx = (formData.attachments || []).indexOf(att)
                          return (
                            <div key={i} className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-xl">
                              <span className="text-neutral-500">{getAttachmentIcon(att.type)}</span>
                              <span className="text-[13px] font-medium text-neutral-600 truncate flex-1">{att.filename || att.url}</span>
                              <a href={att.url} target="_blank" rel="noopener noreferrer" className="p-1 text-neutral-500 hover:text-neutral-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                              <button type="button" onClick={() => removeAttachment(realIdx)} className="p-1 text-neutral-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Bottom save */}
                  <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                    <button type="button" onClick={() => { setViewMode("docs"); setSelectedSOP(null); resetForm() }} className="px-4 py-2 text-[13px] font-medium text-neutral-500 hover:text-neutral-800 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving || isUploading} className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm disabled:opacity-50 transition-all">
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? "Saving..." : viewMode === "create" ? "Create Document" : "Update Document"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: metadata */}
              <aside className="hidden lg:block w-64 shrink-0">
                <div className="sticky top-6 bg-white border border-neutral-200 rounded-xl px-5 py-5 space-y-5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Category</label>
                    <select value={formData.category} onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      {SPACES.map((space) => (
                        <optgroup key={space.key} label={space.label}>
                          {categoriesInSpace(space.key).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Vertical</label>
                    <select value={formData.vertical ?? ""} onChange={(e) => setFormData((p) => ({ ...p, vertical: (e.target.value || undefined) as Vertical | undefined }))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      <option value="">— None —</option>
                      {VERTICAL_OPTIONS.map((v) => <option key={v} value={v}>{VERTICAL_LABELS[v]}</option>)}
                    </select>
                    <p className="text-[10px] text-neutral-500 mt-1">For cohort intake templates (Cyber, Health/Science, Aerospace…)</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Status</label>
                    <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value as SOP["status"] }))}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 appearance-none">
                      {SOP_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("-", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Owner</label>
                    <input type="text" value={formData.owner} onChange={(e) => setFormData((p) => ({ ...p, owner: e.target.value }))} placeholder="Auto-filled with your name"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Department</label>
                    <input type="text" value={formData.department} onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))} placeholder="e.g. Creative"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Version</label>
                    <input type="text" value={formData.version} onChange={(e) => setFormData((p) => ({ ...p, version: e.target.value }))} placeholder="1.0"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Tags</label>
                    <input type="text" value={formData.tags?.join(", ") || ""} onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))} placeholder="onboarding, brand..."
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10" />
                    <p className="text-[10px] text-neutral-500 mt-1">Comma-separated</p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}
      </div>
    </AdminRoleGuard>
  )
}
