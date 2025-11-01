"use client"

import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Eye, Search, Filter, FileText, TrendingUp, Users, ImageIcon } from "lucide-react"
import { getBlogPostsAction, deleteBlogPostAction } from "@/app/actions/blog"
import BlogEditor from "../../components/blog/BlogEditor"
import type { BlogPost } from "../../types/blog-types"

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [filteredPosts, setFilteredPosts] = useState<BlogPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all")

  useEffect(() => {
    loadPosts()
  }, [])

  useEffect(() => {
    filterPosts()
  }, [posts, searchTerm, statusFilter])

  const loadPosts = async () => {
    setIsLoading(true)
    const result = await getBlogPostsAction()
    if (result.success && result.posts) {
      setPosts(result.posts)
    } else {
      setPosts([])
    }
    setIsLoading(false)
  }

  const filterPosts = () => {
    let filtered = posts

    if (statusFilter !== "all") {
      filtered = filtered.filter((post) => post.status === statusFilter)
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          post.content.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    setFilteredPosts(filtered)
  }

  const handleCreateClick = () => {
    setShowEditor(true)
  }

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post)
    setShowEditor(true)
  }

  const handleDelete = async (post: BlogPost) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"? This cannot be undone.`)) {
      return
    }

    // Get admin password from session
    const adminPassword = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
    if (!adminPassword) return

    const result = await deleteBlogPostAction(post.id, adminPassword)
    if (result.success) {
      setPosts(posts.filter((p) => p.id !== post.id))
    } else {
      alert(result.error || "Failed to delete post")
    }
  }

  const handleSave = (post: BlogPost) => {
    if (editingPost) {
      setPosts(posts.map((p) => (p.id === post.id ? post : p)))
    } else {
      setPosts([post, ...posts])
    }
    setShowEditor(false)
    setEditingPost(undefined)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Calculate stats with safe fallbacks
  const publishedPosts = (posts || []).filter((p) => p.status === "published")
  const draftPosts = (posts || []).filter((p) => p.status === "draft")

  if (showEditor) {
    return (
      <BlogEditor
        post={editingPost}
        onSave={handleSave}
        onCancel={() => {
          setShowEditor(false)
          setEditingPost(undefined)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white pt-16 sm:pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-black rounded-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black">News & Insights Management</h1>
            </div>
            <p className="text-gray-600 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Manage your 434 Media news articles, team insights, and ecosystem updates across medical, science,
              robotics, military, TXMX boxing, and community sectors.
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            <Plus className="w-4 h-4" />
            <span className="font-medium text-sm">Create Article</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Published</p>
                <p className="text-lg font-bold text-black">{publishedPosts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <Edit className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Drafts</p>
                <p className="text-lg font-bold text-black">{draftPosts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <Users className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Total Articles</p>
                <p className="text-lg font-bold text-black">{posts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <ImageIcon className="w-4 h-4 text-gray-700" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium">Media Library</p>
                <p className="text-lg font-bold text-black">
                  <a href="/admin/blog/media" className="hover:text-gray-600">
                    Manage
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search articles, insights, and news..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "draft" | "published")}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent bg-white min-w-[120px]"
              >
                <option value="all">All Status</option>
                <option value="draft">Drafts</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="relative mx-auto w-10 h-10 mb-3">
                <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-black border-t-transparent"></div>
              </div>
              <p className="text-gray-600 text-sm font-medium">Loading your content...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6 text-gray-700" />
              </div>
              <h3 className="text-base font-semibold text-black mb-1">No articles found</h3>
              <p className="text-sm text-gray-600 mb-4">Start creating amazing content for your ecosystem</p>
              <button
                onClick={handleCreateClick}
                className="px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-gray-800"
              >
                Create Your First Article
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Article
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Category
                    </th>

                    <th className="px-3 sm:px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredPosts.map((post, index) => (
                    <tr key={post.id} className="hover:bg-gray-50 group">
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex items-start gap-2">
                          {post.featured_image && (
                            <div className="hidden sm:block flex-shrink-0 w-10 h-10 rounded-md overflow-hidden">
                              <img
                                src={post.featured_image || "/placeholder.svg"}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-black line-clamp-2 group-hover:text-gray-700">
                              {post.title}
                            </div>
                            {post.excerpt && (
                              <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{post.excerpt}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                            post.status === "published"
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                          }`}
                        >
                          {post.status === "published" ? "Live" : "Draft"}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium text-black bg-gray-100 px-2 py-0.5 rounded-md">
                          {post.category}
                        </span>
                      </td>

                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatDate(post.published_at || post.created_at)}
                      </td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          {post.status === "published" && (
                            <a
                              href={`/blog/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg"
                              title="View Article"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleEdit(post)}
                            className="p-1.5 text-gray-600 hover:text-black hover:bg-gray-100 rounded-lg"
                            title="Edit Article"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(post)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
