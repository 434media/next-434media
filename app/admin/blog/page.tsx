"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  ChevronLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  FileText,
  Calendar,
  Tag,
  User,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react"
import { RichTextEditor } from "@/components/RichTextEditor"
import { ImageUpload } from "@/components/ImageUpload"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
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
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    featured_image: "",
    meta_description: "",
    category: "Technology",
    tags: [] as string[],
    status: "draft" as "draft" | "published",
    author: "434 Media"
  })
  const [tagInput, setTagInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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
      content: "",
      excerpt: "",
      featured_image: "",
      meta_description: "",
      category: "Technology",
      tags: [],
      status: "draft",
      author: "434 Media"
    })
    setTagInput("")
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
      content: post.content,
      excerpt: post.excerpt || "",
      featured_image: post.featured_image || "",
      meta_description: post.meta_description || "",
      category: post.category,
      tags: post.tags || [],
      status: post.status,
      author: post.author
    })
    setView("edit")
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

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }))
      setTagInput("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: prev.tags.filter(tag => tag !== tagToRemove) 
    }))
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || post.status === statusFilter
    const matchesCategory = categoryFilter === "all" || post.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
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
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search posts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-700 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          aria-label="Status filter"
        >
          <option value="all">All status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
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
        <div className="space-y-2">
          {filteredPosts.map((post) => {
            const statusDot = post.status === "published" ? "bg-emerald-500" : "bg-amber-500"
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-md ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] transition-[box-shadow,outline-color] p-3"
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-md bg-neutral-100 shrink-0 overflow-hidden ring-1 ring-neutral-200/70">
                    {post.featured_image ? (
                      <img
                        src={post.featured_image}
                        alt={post.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-neutral-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-neutral-900 truncate">{post.title}</h3>
                        <p className="text-xs text-neutral-500 line-clamp-1 mt-0.5">
                          {post.excerpt || post.content.substring(0, 120)}…
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] font-medium uppercase tracking-[0.16em] shrink-0">
                        <span className={`inline-block h-1 w-1 rounded-full ${statusDot}`} aria-hidden="true" />
                        {post.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-500 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Tag className="h-3 w-3 text-neutral-400" />
                        {post.category}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3 text-neutral-400" />
                        {post.author}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-neutral-400" />
                        {new Date(post.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {post.status === "published" && (
                      <a
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                        title="View post"
                        aria-label="View post"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      onClick={() => handleEdit(post)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                      title="Edit post"
                      aria-label="Edit post"
                    >
                      <Edit className="h-3 w-3" />
                    </button>
                    {deleteConfirmId === post.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(post.id)}
                          disabled={isDeleting}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md ring-1 ring-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                          aria-label="Confirm delete"
                        >
                          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                          aria-label="Cancel delete"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(post.id)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-400 hover:bg-red-50 hover:text-red-600 hover:ring-red-200 transition-colors"
                        title="Delete post"
                        aria-label="Delete post"
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? "Saving…" : view === "edit" ? "Update" : "Save post"}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Enter post title"
              className="w-full h-10 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-base text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData((prev) => ({ ...prev, content: value }))}
              placeholder="Write your blog post content here..."
              minRows={12}
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Excerpt
              <span className="ml-1.5 text-[11px] font-normal text-neutral-400">· brief summary used in previews</span>
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
              placeholder="A brief summary of the post"
              rows={3}
              className="w-full px-3 py-2 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span
                className={`inline-block h-1 w-1 rounded-full ${
                  formData.status === "published" ? "bg-emerald-500" : "bg-amber-500"
                }`}
                aria-hidden="true"
              />
              Status
            </p>
            <div className="inline-flex h-8 w-full rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: "draft" }))}
                className={`flex-1 inline-flex items-center justify-center px-3 text-xs font-medium transition-colors ${
                  formData.status === "draft"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, status: "published" }))}
                className={`flex-1 inline-flex items-center justify-center px-3 text-xs font-medium transition-colors ${
                  formData.status === "published"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                Published
              </button>
            </div>
          </div>

          {/* Featured Image */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
              Featured image
            </p>
            <ImageUpload
              value={formData.featured_image}
              onChange={(url) => setFormData((prev) => ({ ...prev, featured_image: url }))}
              label="Cover image"
            />
          </div>

          {/* Category */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
              Category
            </p>
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              aria-label="Category"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
              Tags
            </p>
            <div className="flex gap-1.5 mb-2.5">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag"
                className="flex-1 h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={addTag}
                disabled={!tagInput.trim()}
                className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                aria-label="Add tag"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 p-0.5 -mr-0.5 rounded text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200 transition-colors"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Author */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
              Author
            </p>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData((prev) => ({ ...prev, author: e.target.value }))}
              placeholder="Author name"
              className="w-full h-9 px-3 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            />
          </div>

          {/* Meta Description */}
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
              <span className="inline-block h-1 w-1 rounded-full bg-neutral-400" aria-hidden="true" />
              SEO description
            </p>
            <textarea
              value={formData.meta_description}
              onChange={(e) => setFormData((prev) => ({ ...prev, meta_description: e.target.value }))}
              placeholder="Description for search engines"
              rows={3}
              maxLength={160}
              className="w-full px-3 py-2 ring-1 ring-neutral-200 rounded-md bg-white text-sm text-neutral-900 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-900 focus:outline-none resize-y"
            />
            <p className="text-[11px] text-neutral-400 mt-1 text-right tabular-nums">
              {formData.meta_description.length}/160
            </p>
          </div>
        </div>
      </div>
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

        {/* Content */}
        {view === "list" ? renderListView() : renderEditorView()}
      </div>
    </div>
    </AdminRoleGuard>
  )
}
