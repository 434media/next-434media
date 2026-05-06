"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  Plus,
  Search,
  Edit,
  Eye,
  Trash2,
  Save,
  X,
  Loader2,
  FileText,
  Calendar,
  User,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { TaxonomyChipInput } from "@/components/feed/TaxonomyChipInput"
import { formatRelative } from "@/components/admin/FeedCardStatusMenu"
import { useFeedFormShortcuts, MOD_KEY_LABEL } from "@/components/admin/useFeedFormShortcuts"
import { BlogPrePublishChecklist } from "@/components/admin/BlogPrePublishChecklist"
import { BlogFormBody } from "@/components/admin/BlogFormBody"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { BlogPost } from "@/types/blog-types"

// Blog categories
const CATEGORIES = [
  "Technology",
  "Design",
  "Marketing",
  "Business",
  "Culture",
  "Events",
  "News",
  "Tutorial",
  "Case Study",
  "Other"
]

interface Toast {
  message: string
  type: "success" | "error" | "warning"
}

export default function BlogAdminPage() {
  // State
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  
  // View state
  const [view, setView] = useState<"list" | "edit" | "create">("list")
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null)
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"updated_desc" | "created_desc" | "created_asc" | "title_asc">(
    "updated_desc",
  )
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    featured_image: "",
    meta_description: "",
    category: "Technology",
    tags: [] as string[],
    status: "draft" as "draft" | "published",
    author: "434 Media"
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Autosave state — fires every 30s while editing an existing post (any
  // status) or while drafting a new one. Mirrors the feed-form pattern.
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedFormData = useRef<string>("")

  // Team-member-backed author picker — fetched once on mount; deduped with
  // historical authors-from-posts so the editor sees both staffers and any
  // legacy author strings. Falls back gracefully if the API is unreachable.
  const [teamMemberNames, setTeamMemberNames] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/admin/team-members")
        if (!res.ok) return
        const data = await res.json()
        const names: string[] = (data.data ?? data.members ?? [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((m: any) => m?.isActive !== false && typeof m?.name === "string")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m: any) => m.name as string)
        if (!cancelled) setTeamMemberNames(names)
      } catch {
        // silent — picker just falls back to historical post authors
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Load posts on mount
  useEffect(() => {
    loadPosts()
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadPosts = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/blog?includeAll=true")
      if (!response.ok) throw new Error("Failed to fetch posts")
      const data = await response.json()
      setPosts(data.posts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts")
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      featured_image: "",
      meta_description: "",
      category: "Technology",
      tags: [],
      status: "draft",
      author: "434 Media"
    })
    setSelectedPost(null)
  }



  const handleCreateNew = () => {
    resetForm()
    setView("create")
  }

  const handleEdit = (post: BlogPost) => {
    setSelectedPost(post)
    setFormData({
      title: post.title,
      slug: post.slug || "",
      content: post.content,
      excerpt: post.excerpt || "",
      featured_image: post.featured_image || "",
      meta_description: post.meta_description || "",
      category: post.category,
      tags: post.tags || [],
      status: post.status,
      author: post.author
    })
    // Edit-mode renders inside a drawer overlay — keep the list visible behind it.
    setView("edit")
  }

  const handleCloseDrawer = () => {
    setView("list")
    resetForm()
  }

  const handleSave = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      setToast({ message: "Title is required", type: "error" })
      return
    }
    if (!formData.content.trim()) {
      setToast({ message: "Content is required", type: "error" })
      return
    }

    setIsSaving(true)
    try {
      // Note: Content is stored as markdown and sanitized when converted to HTML on display
      // Do NOT sanitize markdown content here as it strips markdown syntax like **bold**
      const payload = {
        ...formData,
        tags: formData.tags
      }

      let response: Response
      if (view === "edit" && selectedPost) {
        response = await fetch(`/api/blog/${selectedPost.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } else {
        response = await fetch("/api/blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save post")
      }

      setToast({ 
        message: view === "edit" ? "Post updated successfully" : "Post created successfully", 
        type: "success" 
      })
      await loadPosts()
      setView("list")
      resetForm()
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : "Failed to save post", 
        type: "error" 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/blog/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) throw new Error("Failed to delete post")

      setToast({ message: "Post deleted successfully", type: "success" })
      await loadPosts()
      setDeleteConfirmId(null)
    } catch (err) {
      setToast({ 
        message: err instanceof Error ? err.message : "Failed to delete post", 
        type: "error" 
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Track unsaved changes — set whenever form drifts from the last saved snapshot
  useEffect(() => {
    if (view !== "edit" && view !== "create") return
    const currentFormString = JSON.stringify(formData)
    if (lastSavedFormData.current && currentFormString !== lastSavedFormData.current) {
      setHasUnsavedChanges(true)
    }
  }, [formData, view])

  // Reset autosave bookkeeping when leaving the editor
  useEffect(() => {
    if (view === "list") {
      setLastSavedAt(null)
      setHasUnsavedChanges(false)
      lastSavedFormData.current = ""
    } else if (view === "edit" || view === "create") {
      lastSavedFormData.current = JSON.stringify(formData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, selectedPost?.id])

  // Autosave handler — PATCHes existing post (preserves status), or POSTs a
  // new draft. Mirrors feed-form's pattern. Skipped if no meaningful content
  // or no unsaved changes.
  const autoSaveToBackend = useCallback(async () => {
    const isEditingExisting = !!selectedPost?.id
    if (!isEditingExisting && formData.status !== "draft") return
    if (!formData.title?.trim() || !formData.content?.trim()) return
    if (!hasUnsavedChanges) return

    const currentFormString = JSON.stringify(formData)
    if (currentFormString === lastSavedFormData.current) return

    setIsAutoSaving(true)
    try {
      const res = isEditingExisting
        ? await fetch(`/api/blog/${selectedPost!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          })
        : await fetch("/api/blog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...formData, status: "draft" }),
          })

      if (!res.ok) return
      const json = await res.json()

      // For new drafts, latch onto the resulting id so subsequent autosaves PATCH
      if (!isEditingExisting && json.post?.id) {
        setSelectedPost(json.post as BlogPost)
      }
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      lastSavedFormData.current = currentFormString
      // Refresh the underlying list so timestamps stay current
      loadPosts()
    } catch (err) {
      console.error("Autosave failed:", err)
    } finally {
      setIsAutoSaving(false)
    }
  }, [formData, selectedPost, hasUnsavedChanges])

  // Run autosave every 30s while editing
  useEffect(() => {
    if (view !== "edit" && view !== "create") return
    if (!formData.title?.trim() || !formData.content?.trim()) return
    if (!selectedPost?.id && formData.status !== "draft") return

    const interval = setInterval(() => {
      autoSaveToBackend()
    }, 30000)
    return () => clearInterval(interval)
  }, [view, selectedPost?.id, formData.title, formData.content, formData.status, autoSaveToBackend])

  // beforeunload — try to flush + warn the user when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const eligible =
        formData.title?.trim() &&
        formData.content?.trim() &&
        (!!selectedPost?.id || formData.status === "draft")
      if (hasUnsavedChanges && eligible) {
        autoSaveToBackend()
        e.preventDefault()
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges, formData, selectedPost?.id, autoSaveToBackend])

  // Editor keyboard shortcuts: ⌘S save, ⌘↩ publish (sets status then submits),
  // ⌘P open preview in new tab, Esc cancel back to list. Only fires when in
  // an editor view; the hook ignores keystrokes inside inputs/textareas for Esc.
  useFeedFormShortcuts({
    enabled: view === "edit" || view === "create",
    onSave: () => {
      if (isSaving) return
      handleSave()
    },
    onPublish: () => {
      if (isSaving) return
      setFormData((prev) => ({ ...prev, status: "published" }))
      setTimeout(() => handleSave(), 0)
    },
    onPreview: () => {
      if (view === "edit" && selectedPost?.id) {
        window.open(`/admin/blog/preview/${selectedPost.id}`, "_blank", "noopener,noreferrer")
      } else {
        setToast({ message: "Save the post first to preview it", type: "error" })
      }
    },
    onCancel: () => {
      setView("list")
      resetForm()
    },
  })

  // Filter + sort posts
  const filteredPosts = posts
    .filter((post) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.excerpt?.toLowerCase().includes(q) ||
        post.author?.toLowerCase().includes(q) ||
        post.tags?.some((t) => t.toLowerCase().includes(q))
      const matchesStatus = statusFilter === "all" || post.status === statusFilter
      const matchesCategory = categoryFilter === "all" || post.category === categoryFilter
      return matchesSearch && matchesStatus && matchesCategory
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "title_asc":
          return a.title.localeCompare(b.title)
        case "created_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        case "created_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case "updated_desc":
        default:
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      }
    })

  // Compute stat counts for the header subtitle
  const draftCount = posts.filter((p) => p.status === "draft").length
  const publishedCount = posts.filter((p) => p.status === "published").length

  // Render list view
  const renderListView = () => (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">Blog</h1>
          <p className="text-sm text-neutral-500 mt-1 tabular-nums">
            {posts.length} {posts.length === 1 ? "post" : "posts"}
            {posts.length > 0 && (
              <>
                {" "}· <span className="text-neutral-700">{publishedCount} published</span>
                {" "}· <span className="text-neutral-700">{draftCount} draft</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPosts}
            disabled={isLoading}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New post
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search posts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>

        {/* Status segmented control */}
        <div className="inline-flex h-9 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
          {(["all", "published", "draft"] as const).map((status) => {
            const isActive = statusFilter === status
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`inline-flex items-center px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-neutral-900 text-white" : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          })}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-700 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          aria-label="Category filter"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-700 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          aria-label="Sort"
        >
          <option value="updated_desc">Recently edited</option>
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-neutral-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Loading posts…</span>
        </div>
      ) : error ? (
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">Couldn't load posts</p>
          <p className="text-xs text-neutral-500 mb-3">{error}</p>
          <button
            onClick={loadPosts}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-8 text-center">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 mx-auto mb-3">
            <FileText className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-neutral-900 mb-1">
            {posts.length === 0 ? "No posts yet" : "No posts match your filters"}
          </p>
          <p className="text-xs text-neutral-500">
            {posts.length === 0
              ? 'Click "New post" in the page header to get started.'
              : "Try adjusting search or filters above."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPosts.map((post) => {
            const statusDot = post.status === "published" ? "bg-emerald-500" : "bg-amber-500"
            const lastEdited = formatRelative(post.updated_at)
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[box-shadow,outline-color] flex flex-col overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-neutral-100 overflow-hidden relative">
                  {post.featured_image ? (
                    <img
                      src={post.featured_image}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="h-8 w-8 text-neutral-300" />
                    </div>
                  )}
                  <span
                    className={`absolute top-2 right-2 inline-block h-1.5 w-1.5 rounded-full ${statusDot}`}
                    title={post.status}
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="p-3 flex-1 flex flex-col">
                  <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 mb-1.5">
                    <span className={`inline-block h-1 w-1 rounded-full ${statusDot}`} aria-hidden="true" />
                    {post.status}
                    <span className="text-neutral-300">·</span>
                    <span className="normal-case tracking-normal text-neutral-400">{post.category}</span>
                  </p>

                  <h3 className="text-sm font-medium text-neutral-900 leading-snug line-clamp-2 mb-1.5">
                    {post.title}
                  </h3>

                  <p className="text-xs text-neutral-500 line-clamp-2 mb-2">
                    {post.excerpt || post.content.substring(0, 140)}…
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 tabular-nums mt-auto pt-2">
                    <span className="inline-flex items-center gap-1 truncate">
                      <User className="h-3 w-3 text-neutral-400" />
                      <span className="truncate">{post.author}</span>
                    </span>
                    {lastEdited ? (
                      <span className="text-neutral-400" title={`Updated ${post.updated_at}`}>
                        Updated {lastEdited}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-neutral-400" />
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 mt-3">
                    <button
                      onClick={() => handleEdit(post)}
                      className="flex-1 h-7 px-2 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 rounded-md transition-colors"
                    >
                      Edit
                    </button>
                    <a
                      href={`/admin/blog/preview/${post.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                      title="Preview"
                      aria-label="Preview"
                    >
                      <Eye className="h-3 w-3" />
                    </a>
                    {post.status === "published" && (
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                        title="View live"
                        aria-label="View live"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {deleteConfirmId === post.id ? (
                      <>
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                          aria-label="Confirm delete"
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                          aria-label="Cancel delete"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(post.id)}
                        className="inline-flex items-center justify-center h-7 w-7 ring-1 ring-neutral-200 bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 rounded-md transition-colors"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )

  // Author suggestions — team members + historical authors from existing posts.
  const authorSuggestions = (() => {
    const set = new Set<string>()
    for (const n of teamMemberNames) if (n) set.add(n)
    for (const p of posts) if (p.author) set.add(p.author)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })()

  // Tag taxonomy — deduped existing tags across all posts. Powers the chip
  // input's autocomplete so editors don't recreate "tutorial" / "Tutorial" /
  // "tutorials" as three separate tags.
  const tagSuggestions = (() => {
    const set = new Set<string>()
    for (const p of posts) for (const t of p.tags ?? []) if (t) set.add(t)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })()

  // Slug collision check — finds an existing post using the same slug,
  // excluding the post being edited. Used for inline feedback under the slug input.
  const slugCollision = (() => {
    const slug = formData.slug.trim().toLowerCase()
    if (!slug) return null
    return (
      posts.find(
        (p) => p.slug?.trim().toLowerCase() === slug && p.id !== selectedPost?.id,
      ) ?? null
    )
  })()

  // Render edit/create view
  const renderEditorView = () => (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
            title="Back to posts"
            aria-label="Back to posts"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
              {view === "edit" ? "Edit post" : "New post"}
            </h1>
            {view === "edit" && selectedPost && (
              <p className="text-xs text-neutral-500 truncate max-w-md">
                Editing: <span className="text-neutral-700">{selectedPost.title}</span>
              </p>
            )}
          </div>

          {/* Autosave indicator */}
          {(selectedPost?.id || formData.status === "draft") &&
            formData.title?.trim() &&
            formData.content?.trim() && (
              <div className="hidden sm:flex items-center gap-1.5 ml-2 text-[11px]">
                {isAutoSaving ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
                    <span className="inline-block h-1 w-1 rounded-full bg-neutral-900 animate-pulse" aria-hidden="true" />
                    Saving
                  </span>
                ) : lastSavedAt ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 tabular-nums">
                    <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
                    Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200">
                    <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                    Unsaved
                  </span>
                ) : null}
              </div>
            )}
        </div>
        <div className="flex items-center gap-2">
          {view === "edit" && selectedPost?.id && (
            <a
              href={`/admin/blog/preview/${selectedPost.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              title={`Preview (${MOD_KEY_LABEL}P)`}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </a>
          )}
          <BlogPrePublishChecklist
            formData={formData}
            posts={posts}
            editingId={selectedPost?.id ?? null}
          />
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            title="Cancel (Esc)"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
            title={`Save (${MOD_KEY_LABEL}S)`}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? "Saving…" : view === "edit" ? "Update" : "Save post"}
            {!isSaving && (
              <kbd className="ml-1 px-1 rounded bg-white/15 font-mono text-[10px] tabular-nums">
                {MOD_KEY_LABEL}S
              </kbd>
            )}
          </button>
        </div>
      </div>

      <BlogFormBody
        formData={formData}
        setFormData={setFormData}
        slugCollision={slugCollision}
        tagSuggestions={tagSuggestions}
        authorSuggestions={authorSuggestions}
        variant="page"
      />
    </div>
  )

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-4 right-4 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-white ring-1 ring-neutral-200 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)] text-sm"
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  toast.type === "success"
                    ? "bg-emerald-500"
                    : toast.type === "error"
                    ? "bg-red-500"
                    : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              <span className="text-neutral-900">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content — list is always rendered for edit-mode (drawer overlays it).
            For new-post creation, the inline full-page editor replaces the list. */}
        {view === "create" ? renderEditorView() : renderListView()}
      </div>

      {/* Edit drawer — opens whenever an existing post is being edited. List
          stays visible behind it. Form renders without the inline header
          (drawer provides one) and without the inline action bar (drawer
          footer provides Save/Cancel). */}
      <DetailDrawer
        open={view === "edit" && !!selectedPost}
        onClose={handleCloseDrawer}
        title={formData.title || "Edit post"}
        subtitle={
          (() => {
            const lastEdited = formatRelative(selectedPost?.updated_at)
            return (
              <span className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                <span className="capitalize">{formData.status}</span>
                <span className="text-neutral-300">·</span>
                <span>{formData.category}</span>
                {lastEdited && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span title={selectedPost?.updated_at}>Updated {lastEdited}</span>
                  </>
                )}
              </span>
            )
          })()
        }
        width="xl"
        closeOnEscape
        footer={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {selectedPost?.id && (
                <a
                  href={`/admin/blog/preview/${selectedPost.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  title={`Preview (${MOD_KEY_LABEL}P)`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
              )}
              {/* Autosave indicator inline in drawer footer */}
              {formData.title?.trim() && formData.content?.trim() && (
                <>
                  {isAutoSaving ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px] tabular-nums">
                      <span className="inline-block h-1 w-1 rounded-full bg-neutral-900 animate-pulse" aria-hidden="true" />
                      Saving
                    </span>
                  ) : lastSavedAt ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px] tabular-nums">
                      <span className="inline-block h-1 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
                      Saved {lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[11px]">
                      <span className="inline-block h-1 w-1 rounded-full bg-amber-500" aria-hidden="true" />
                      Unsaved
                    </span>
                  ) : null}
                </>
              )}
              <BlogPrePublishChecklist
                formData={formData}
                posts={posts}
                editingId={selectedPost?.id ?? null}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseDrawer}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                title={`Update (${MOD_KEY_LABEL}S)`}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    Update
                    <kbd className="ml-1 px-1 rounded bg-white/15 font-mono text-[10px] tabular-nums">
                      {MOD_KEY_LABEL}S
                    </kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        {view === "edit" && selectedPost && (
          <div className="px-4 sm:px-6 py-5">
            <BlogFormBody
              formData={formData}
              setFormData={setFormData}
              slugCollision={slugCollision}
              tagSuggestions={tagSuggestions}
              authorSuggestions={authorSuggestions}
              variant="drawer"
            />
          </div>
        )}
      </DetailDrawer>
    </div>
    </AdminRoleGuard>
  )
}
