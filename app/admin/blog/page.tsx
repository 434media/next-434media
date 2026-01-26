"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import Link from "next/link"
import { 
  ChevronLeft, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Save,
  X,
  Loader2,
  FileText,
  Calendar,
  Tag,
  User,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Filter,
  MoreVertical,
  ExternalLink
} from "lucide-react"
import { RichTextEditor } from "../../components/RichTextEditor"
import { ImageUpload } from "../../components/ImageUpload"
import type { BlogPost, BlogFilters } from "../../types/blog-types"

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

  // Load posts on mount with a small delay to ensure session is ready
  useEffect(() => {
    // Small delay to allow session to be established after auth
    const timer = setTimeout(() => {
      loadPosts()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const loadPosts = async (retryCount = 0) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/blog?includeAll=true")
      
      // If unauthorized and first attempt, wait a bit and retry (session may still be propagating)
      if (response.status === 401 && retryCount < 2) {
        console.log("Session not ready, retrying in 500ms...")
        await new Promise(resolve => setTimeout(resolve, 500))
        return loadPosts(retryCount + 1)
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch posts (${response.status})`)
      }
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

  // Render list view
  const renderListView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Blog Management</h1>
          <p className="text-neutral-500 text-sm mt-1">Create, edit, and manage blog posts</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          New Post
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:border-neutral-400"
        >
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:border-neutral-400"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-neutral-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600">{error}</p>
          <button onClick={() => loadPosts()} className="mt-4 text-neutral-500 hover:text-neutral-900">
            Try again
          </button>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-500">No posts found</p>
          <button
            onClick={handleCreateNew}
            className="mt-4 text-emerald-600 hover:text-emerald-700"
          >
            Create your first post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-neutral-200 rounded-xl p-4 hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="w-20 h-20 rounded-lg bg-neutral-100 flex-shrink-0 overflow-hidden">
                  {post.featured_image ? (
                    <img 
                      src={post.featured_image} 
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-neutral-400" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-neutral-900 truncate">{post.title}</h3>
                      <p className="text-sm text-neutral-500 line-clamp-1 mt-1">
                        {post.excerpt || post.content.substring(0, 100)}...
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
                      post.status === "published" 
                        ? "bg-emerald-100 text-emerald-700" 
                        : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {post.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {post.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {post.author}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {post.status === "published" && (
                    <a
                      href={`/blog/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="View post"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(post)}
                    className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                    title="Edit post"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  {deleteConfirmId === post.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(post.id)}
                        disabled={isDeleting}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(post.id)}
                      className="p-2 text-neutral-500 hover:text-red-600 hover:bg-neutral-100 rounded-lg transition-colors"
                      title="Delete post"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )

  // Render edit/create view
  const renderEditorView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">
              {view === "edit" ? "Edit Post" : "Create New Post"}
            </h1>
            <p className="text-neutral-500 text-sm">
              {view === "edit" ? `Editing: ${selectedPost?.title}` : "Fill in the details below"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView("list"); resetForm() }}
            className="px-4 py-2 text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-lg transition-colors font-medium"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving..." : "Save Post"}
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter post title"
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Content <span className="text-red-500">*</span>
            </label>
            <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden">
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                placeholder="Write your blog post content here..."
                minRows={12}
              />
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Excerpt
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              placeholder="A brief summary of the post (used in previews)"
              rows={3}
              className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 resize-none"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Status
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "draft" }))}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  formData.status === "draft"
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                    : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                Draft
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: "published" }))}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  formData.status === "published"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                    : "bg-neutral-50 text-neutral-600 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                Published
              </button>
            </div>
          </div>

          {/* Featured Image */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Featured Image
            </label>
            <ImageUpload
              value={formData.featured_image}
              onChange={(url) => setFormData(prev => ({ ...prev, featured_image: url }))}
              label="Upload or enter URL"
            />
          </div>

          {/* Category */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:border-neutral-400"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Tags
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add a tag"
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 text-neutral-700 rounded-md text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-neutral-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Author */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Author
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
              placeholder="Author name"
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
            />
          </div>

          {/* Meta Description */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm">
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Meta Description (SEO)
            </label>
            <textarea
              value={formData.meta_description}
              onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
              placeholder="Description for search engines"
              rows={3}
              maxLength={160}
              className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 text-sm placeholder-neutral-400 focus:outline-none focus:border-neutral-400 resize-none"
            />
            <p className="text-xs text-neutral-500 mt-1">
              {formData.meta_description.length}/160 characters
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20">
        {/* Back to Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
                toast.type === "success" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                toast.type === "error" ? "bg-red-100 text-red-800 border border-red-200" :
                "bg-yellow-100 text-yellow-800 border border-yellow-200"
              }`}
            >
              {toast.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {view === "list" ? renderListView() : renderEditorView()}
      </div>
    </div>
  )
}
