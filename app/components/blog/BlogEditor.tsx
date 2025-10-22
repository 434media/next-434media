"use client"

import { useState, useEffect } from "react"
import { Save, Eye, Upload, X, Plus, FileText, Settings } from "lucide-react"
import { createBlogPostAction, updateBlogPostAction, getBlogCategoriesAction } from "@/app/actions/blog"
import AdminPasswordModal from "../../components/AdminPasswordModal"
import ImageSelector from "../../components/blog/ImageSelector"
import type { BlogPost, BlogCategory } from "../../types/blog-types"
import RichTextEditor from "./RichTextEditor"

interface BlogEditorProps {
  post?: BlogPost
  onSave?: (post: BlogPost) => void
  onCancel?: () => void
}

export default function BlogEditor({ post, onSave, onCancel }: BlogEditorProps) {
  const [title, setTitle] = useState(post?.title || "")
  const [content, setContent] = useState(post?.content || "")
  const [excerpt, setExcerpt] = useState(post?.excerpt || "")
  const [featuredImage, setFeaturedImage] = useState(post?.featured_image || "")
  const [metaDescription, setMetaDescription] = useState(post?.meta_description || "")
  const [category, setCategory] = useState(post?.category || "technology")
  const [tags, setTags] = useState<string[]>(post?.tags || [])
  const [status, setStatus] = useState<"draft" | "published">(post?.status || "draft")
  const [author, setAuthor] = useState(post?.author || "434 Media")
  const [newTag, setNewTag] = useState("")
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pendingSaveStatus, setPendingSaveStatus] = useState<"draft" | "published" | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    const result = await getBlogCategoriesAction()
    if (result.success && result.categories) {
      setCategories(result.categories)
    }
  }

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSaveClick = (saveStatus: "draft" | "published") => {
    if (!post) {
      // New post - require password
      setPendingSaveStatus(saveStatus)
      setShowPasswordModal(true)
    } else {
      // Editing existing post - no password needed since user already authenticated
      handleSave(saveStatus)
    }
  }

  const handlePasswordVerified = (password: string) => {
    if (pendingSaveStatus) {
      handleSave(pendingSaveStatus, password)
    }
    setShowPasswordModal(false)
    setPendingSaveStatus(null)
  }

  const handlePasswordCancel = () => {
    setShowPasswordModal(false)
    setPendingSaveStatus(null)
  }

  const handleSave = async (saveStatus: "draft" | "published", adminPassword?: string) => {
    setIsLoading(true)

    try {
      const formData = new FormData()
      if (post?.id) formData.append("id", post.id)
      // Only add admin password for new posts
      if (adminPassword && !post?.id) formData.append("adminPassword", adminPassword)
      formData.append("title", title)
      formData.append("content", content)
      formData.append("excerpt", excerpt)
      formData.append("featured_image", featuredImage)
      formData.append("meta_description", metaDescription)
      formData.append("category", category)
      formData.append("tags", JSON.stringify(tags))
      formData.append("status", saveStatus)
      formData.append("author", author)

      const result = post?.id ? await updateBlogPostAction(formData) : await createBlogPostAction(formData)

      if (result.success && result.post) {
        onSave?.(result.post)
      } else {
        alert(result.error || "Failed to save post")
      }
    } catch (error) {
      console.error("Error saving post:", error)
      alert("Failed to save post")
    } finally {
      setIsLoading(false)
    }
  }

  if (showPreview) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 pt-24 sm:pt-28">
          {/* Preview Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Preview Mode</h1>
              <p className="text-gray-600 mt-1">See how your post will look to readers</p>
            </div>
            <button
              onClick={() => setShowPreview(false)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Close Preview</span>
              <span className="sm:hidden">Close</span>
            </button>
          </div>

          {/* Preview Content */}
          <article className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
            {featuredImage && (
              <img
                src={featuredImage || "/placeholder.svg"}
                alt={title}
                className="w-full h-48 sm:h-64 object-cover rounded-lg mb-6"
              />
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{title}</h1>
            {excerpt && (
              <p className="text-lg sm:text-xl text-gray-600 mb-6 border-l-4 border-gray-900 pl-4">{excerpt}</p>
            )}
            <div
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-gray-900 prose-a:underline"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </article>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 pt-24 sm:pt-28">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                {post ? "Edit Post" : "Create New Post"}
              </h1>
              <p className="text-gray-600 mt-1">
                {post ? "Update your existing post" : "Share insights with the 434 Media community"}
              </p>
            </div>

            {/* Desktop Action Buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={() => handleSaveClick("draft")}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={() => handleSaveClick("published")}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Publish
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Mobile Action Bar */}
          <div className="lg:hidden">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowPreview(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm font-medium">Preview</span>
                </button>
                <button
                  onClick={() => handleSaveClick("draft")}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">Save</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 mt-3">
                <button
                  onClick={() => handleSaveClick("published")}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Publish Post</span>
                </button>
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Title */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-900" />
                <label className="text-lg font-semibold text-gray-900">Post Title</label>
                <span className="text-red-500">*</span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-lg transition-all"
                placeholder="Enter an engaging title..."
                required
              />
            </div>

            {/* Content */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-900" />
                <label className="text-lg font-semibold text-gray-900">Content</label>
                <span className="text-red-500">*</span>
              </div>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write your amazing content here..."
                className="min-h-[500px]"
              />
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700">
                  <strong>Rich Editor Features:</strong> Use the toolbar above for headings, formatting, lists, links,
                  images, videos, and more!
                </p>
              </div>
            </div>

            {/* Excerpt */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-gray-900" />
                <label className="text-lg font-semibold text-gray-900">Excerpt</label>
              </div>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                className="w-full h-24 px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none transition-all"
                placeholder="Brief description that appears in post previews..."
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Category */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-gray-900" />
                <h3 className="text-lg font-semibold text-gray-900">Post Settings</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "draft" | "published")}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  >
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🏷️</span>
                <h3 className="text-lg font-semibold text-gray-900">Tags</h3>
              </div>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  className="flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm transition-all"
                  placeholder="Add tag..."
                />
                <button
                  onClick={handleAddTag}
                  className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium border border-gray-200"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Featured Image */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🖼️</span>
                <h3 className="text-lg font-semibold text-gray-900">Featured Image</h3>
              </div>
              <ImageSelector
                selectedImage={featuredImage}
                onImageSelect={setFeaturedImage}
                onImageClear={() => setFeaturedImage("")}
              />
            </div>

            {/* SEO */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🔍</span>
                <h3 className="text-lg font-semibold text-gray-900">SEO & Author</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm transition-all"
                    placeholder="434 Media Team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                  <textarea
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="w-full h-20 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm resize-none transition-all"
                    placeholder="SEO description for search engines..."
                    maxLength={160}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">{metaDescription.length}/160 characters</p>
                    <div
                      className={`w-16 h-2 rounded-full ${metaDescription.length > 160 ? "bg-red-400" : metaDescription.length > 140 ? "bg-yellow-400" : "bg-green-400"}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Password Modal - Only for new posts */}
      {!post && (
        <AdminPasswordModal
          isOpen={showPasswordModal}
          onVerified={handlePasswordVerified}
          onCancel={handlePasswordCancel}
          action="create article"
        />
      )}
    </div>
  )
}
