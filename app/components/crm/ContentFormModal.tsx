"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  X, 
  Loader2, 
  Upload,
  Link2,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  Calendar,
  Image as ImageIcon,
  MessageSquare,
  Send,
  Pencil,
  ExternalLink,
  GripVertical
} from "lucide-react"
import { 
  BRANDS, 
  TEAM_MEMBERS,
  SOCIAL_PLATFORM_OPTIONS,
  CONTENT_POST_STATUS_OPTIONS,
} from "./types"
import type { ContentPost, ContentPostStatus, Brand, SocialPlatform, TeamMember, TaskComment, CurrentUser } from "./types"

interface ContentFormModalProps {
  isOpen: boolean
  post: ContentPost | null
  isSaving: boolean
  currentUser?: CurrentUser | null
  onSave: (data: Partial<ContentPost>) => void
  onDelete?: (postId: string) => void
  onClose: () => void
  onAddComment?: (comment: TaskComment) => void
  onDeleteComment?: (commentId: string) => void
  onEditComment?: (commentId: string, newContent: string) => void
}

const getDefaultFormData = () => ({
  user: "",
  platform: "" as Brand | "",
  status: "to_do" as ContentPostStatus,
  title: "",
  date_to_post: "",
  notes: "",
  thumbnail: "",
  social_copy: "",
  links: [] as string[],
  assets: [] as string[],
  tags: "",
  social_platforms: [] as SocialPlatform[],
  comments: [] as TaskComment[],
})

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function ContentFormModal({
  isOpen,
  post,
  isSaving,
  currentUser,
  onSave,
  onDelete,
  onClose,
  onAddComment,
  onDeleteComment,
  onEditComment,
}: ContentFormModalProps) {
  const [formData, setFormData] = useState(getDefaultFormData())
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState("")

  useEffect(() => {
    if (isOpen) {
      if (post) {
        setFormData({
          user: post.user || "",
          platform: post.platform || "",
          status: post.status || "to_do",
          title: post.title || "",
          date_to_post: post.date_to_post || "",
          notes: post.notes || "",
          thumbnail: post.thumbnail || "",
          social_copy: post.social_copy || "",
          links: post.links || [],
          assets: post.assets || [],
          tags: post.tags || "",
          social_platforms: post.social_platforms || [],
          comments: post.comments || [],
        })
      } else {
        setFormData(getDefaultFormData())
      }
      setNewComment("")
      setEditingCommentId(null)
    }
  }, [isOpen, post])

  const fetchTeamMembers = useCallback(async () => {
    setIsLoadingMembers(true)
    try {
      const response = await fetch("/api/admin/team-members")
      const data = await response.json()
      
      const firestoreMembers: TeamMember[] = data.success && data.data 
        ? data.data.filter((m: TeamMember) => m.isActive)
        : []
      
      const defaultMembers = TEAM_MEMBERS.map((m, i) => ({
        id: `default-${i}`,
        name: m.name,
        email: m.email,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))
      
      const firestoreNames = new Set(firestoreMembers.map(m => m.name.toLowerCase()))
      const missingDefaults = defaultMembers.filter(d => 
        !firestoreNames.has(d.name.toLowerCase())
      )
      
      // Exclude certain names from tag options
      const EXCLUDED_TAG_NAMES = ["Elon Musk", "Elton John", "Testing", "Guna", "Barbara", "Barbara Carreon", "Nichole Snow"]
      const excludedLower = new Set(EXCLUDED_TAG_NAMES.map(n => n.toLowerCase()))
      
      const allMembers = [...firestoreMembers, ...missingDefaults]
        .filter(m => !excludedLower.has(m.name.toLowerCase()))
      allMembers.sort((a, b) => a.name.localeCompare(b.name))
      
      setTeamMembers(allMembers)
    } catch {
      setTeamMembers(TEAM_MEMBERS.map((m, i) => ({
        id: `default-${i}`,
        name: m.name,
        email: m.email,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })))
    } finally {
      setIsLoadingMembers(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen, fetchTeamMembers])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldType: "thumbnail" | "asset") => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploadingFile(true)
    try {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)
      formDataUpload.append("folder", "content-posts")
      
      const response = await fetch("/api/upload/crm", {
        method: "POST",
        body: formDataUpload,
      })
      
      if (response.ok) {
        const { url } = await response.json()
        if (fieldType === "thumbnail") {
          setFormData(prev => ({ ...prev, thumbnail: url }))
        } else {
          setFormData(prev => ({ ...prev, assets: [...prev.assets, url] }))
        }
      } else {
        const errorData = await response.json()
        console.error("Upload failed:", errorData.error)
      }
    } catch (err) {
      console.error("Upload failed:", err)
    } finally {
      setIsUploadingFile(false)
      e.target.value = ""
    }
  }

  const handleAddLink = () => {
    if (newLink.trim()) {
      let url = newLink.trim()
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
      }
      setFormData(prev => ({ ...prev, links: [...prev.links, url] }))
      setNewLink("")
    }
  }

  const handleRemoveLink = (index: number) => {
    setFormData(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== index) }))
  }

  const handleRemoveAsset = (index: number) => {
    setFormData(prev => ({ ...prev, assets: prev.assets.filter((_, i) => i !== index) }))
  }

  const handleLocalAddComment = () => {
    if (!newComment.trim() || !currentUser) return
    
    // Extract mentions from comment
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionName = match[1].toLowerCase()
      const mentionedMember = teamMembers.find(m => 
        m.name.toLowerCase() === mentionName ||
        m.name.split(' ')[0].toLowerCase() === mentionName
      )
      if (mentionedMember && mentionedMember.email && !mentions.includes(mentionedMember.email)) {
        mentions.push(mentionedMember.email)
      }
    }

    const comment: TaskComment = {
      id: crypto.randomUUID(),
      content: newComment.trim(),
      author_name: currentUser.name,
      author_email: currentUser.email,
      author_avatar: currentUser.picture,
      created_at: new Date().toISOString(),
      mentions,
    }

    // Update local form data
    setFormData(prev => ({
      ...prev,
      comments: [...prev.comments, comment]
    }))
    setNewComment("")

    // Also call the parent handler if provided (for API saving)
    if (onAddComment) {
      onAddComment(comment)
    }
  }

  const handleSave = () => {
    onSave({
      user: formData.user,
      platform: formData.platform || undefined,
      status: formData.status,
      title: formData.title,
      date_to_post: formData.date_to_post || undefined,
      notes: formData.notes || undefined,
      thumbnail: formData.thumbnail || undefined,
      social_copy: formData.social_copy || undefined,
      links: formData.links,
      assets: formData.assets,
      tags: formData.tags || undefined,
      social_platforms: formData.social_platforms,
      comments: formData.comments,
    })
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-neutral-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-neutral-700" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {post ? "Edit Content Post" : "Create Content Post"}
                  </h3>
                  <p className="text-xs text-gray-500">Schedule content for your social calendar</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Row 1: User & Platform */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">User *</label>
                  <button
                    type="button"
                    onClick={() => setShowUserDropdown(!showUserDropdown)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    <span className={formData.user ? "text-gray-900" : "text-gray-400"}>
                      {formData.user || "Select user..."}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  {showUserDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {isLoadingMembers ? (
                        <div className="p-3 text-center text-gray-500 text-sm">
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        </div>
                      ) : (
                        teamMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, user: member.name }))
                              setShowUserDropdown(false)
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            {member.name}
                            {formData.user === member.name && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform (Brand)</label>
                  <select
                    value={formData.platform}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value as Brand | "" }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="">Select platform...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Status & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ContentPostStatus }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    {CONTENT_POST_STATUS_OPTIONS.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Date to Post</label>
                  <input
                    type="date"
                    value={formData.date_to_post}
                    onChange={(e) => setFormData(prev => ({ ...prev, date_to_post: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter post title..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Social Platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Social Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORM_OPTIONS.map((platform) => {
                    const isSelected = formData.social_platforms.includes(platform.value)
                    return (
                      <button
                        key={platform.value}
                        type="button"
                        onClick={() => {
                          const newPlatforms = isSelected
                            ? formData.social_platforms.filter(p => p !== platform.value)
                            : [...formData.social_platforms, platform.value]
                          setFormData(prev => ({ ...prev, social_platforms: newPlatforms }))
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          isSelected ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        style={isSelected ? { backgroundColor: platform.color } : undefined}
                      >
                        {platform.label}
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Social Copy - Large Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Social Copy
                  <span className="ml-2 text-xs text-gray-400 font-normal">Drag corner to resize</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.social_copy}
                    onChange={(e) => setFormData(prev => ({ ...prev, social_copy: e.target.value }))}
                    placeholder="Enter the post caption or copy..."
                    rows={6}
                    className="w-full px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-[120px] max-h-[400px] leading-relaxed"
                  />
                  <div className="absolute bottom-1 right-1 text-gray-300 pointer-events-none">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">{formData.social_copy?.length || 0} characters</p>
              </div>

              {/* Notes - Large Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Notes
                  <span className="ml-2 text-xs text-gray-400 font-normal">Drag corner to resize</span>
                </label>
                <div className="relative">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes, instructions, or context for the team..."
                    rows={5}
                    className="w-full px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-[100px] max-h-[350px] leading-relaxed"
                  />
                  <div className="absolute bottom-1 right-1 text-gray-300 pointer-events-none">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Enter tags (comma separated)..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Thumbnail */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Thumbnail</label>
                {formData.thumbnail ? (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
                    <img src={formData.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, thumbnail: "" }))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50/30">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "thumbnail")}
                      className="hidden"
                    />
                    {isUploadingFile ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-500">Upload thumbnail image</span>
                  </label>
                )}
              </div>

              {/* Links - Clickable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Links</label>
                <div className="space-y-2">
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors truncate"
                      >
                        <Link2 className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{link}</span>
                        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                      <button 
                        type="button" 
                        onClick={() => handleRemoveLink(index)} 
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      placeholder="Add a link..."
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLink())}
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button 
                      type="button" 
                      onClick={handleAddLink} 
                      disabled={!newLink.trim()} 
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Assets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assets</label>
                <div className="space-y-2">
                  {formData.assets.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.assets.map((asset, index) => (
                        <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group">
                          <img src={asset} alt={`Asset ${index + 1}`} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => handleRemoveAsset(index)} 
                            className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50/30">
                    <input type="file" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, "asset")} className="hidden" />
                    {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-500">Upload asset</span>
                  </label>
                </div>
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Comments & Updates
                </label>
                
                {/* Existing Comments */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {formData.comments && formData.comments.length > 0 ? (
                    formData.comments.map((comment) => (
                      <div key={comment.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100 group">
                        <div className="flex items-start gap-2">
                          {comment.author_avatar ? (
                            <img 
                              src={comment.author_avatar} 
                              alt={comment.author_name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {comment.author_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {comment.author_name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDate(comment.created_at)}
                                  {comment.updated_at && comment.updated_at !== comment.created_at && (
                                    <span className="ml-1 text-gray-400">(edited)</span>
                                  )}
                                </span>
                              </div>
                              {/* Edit/Delete buttons */}
                              {currentUser && comment.author_email === currentUser.email && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {editingCommentId !== comment.id && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingCommentId(comment.id)
                                          setEditCommentContent(comment.content)
                                        }}
                                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                                        title="Edit comment"
                                      >
                                        <Pencil className="w-3 h-3 text-gray-400 hover:text-blue-600" />
                                      </button>
                                      {onDeleteComment && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm("Delete this comment?")) {
                                              onDeleteComment(comment.id)
                                              setFormData(prev => ({
                                                ...prev,
                                                comments: prev.comments.filter(c => c.id !== comment.id)
                                              }))
                                            }
                                          }}
                                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                                          title="Delete comment"
                                        >
                                          <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-600" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Editing mode */}
                            {editingCommentId === comment.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editCommentContent}
                                  onChange={(e) => setEditCommentContent(e.target.value)}
                                  rows={3}
                                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500 resize-y min-h-[60px] max-h-[200px]"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onEditComment && editCommentContent.trim()) {
                                        onEditComment(comment.id, editCommentContent.trim())
                                        setFormData(prev => ({
                                          ...prev,
                                          comments: prev.comments.map(c => 
                                            c.id === comment.id 
                                              ? { ...c, content: editCommentContent.trim(), updated_at: new Date().toISOString() }
                                              : c
                                          )
                                        }))
                                      }
                                      setEditingCommentId(null)
                                      setEditCommentContent("")
                                    }}
                                    disabled={!editCommentContent.trim()}
                                    className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null)
                                      setEditCommentContent("")
                                    }}
                                    className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                                {comment.content}
                              </p>
                            )}
                            {comment.mentions && comment.mentions.length > 0 && !editingCommentId && (
                              <div className="flex gap-1 mt-2">
                                {comment.mentions.map((email) => {
                                  const member = teamMembers.find(m => m.email === email)
                                  return member ? (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                                      @{member.name}
                                    </span>
                                  ) : null
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
                  )}
                </div>

                {/* Add Comment */}
                {currentUser ? (
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">
                      {currentUser.picture ? (
                        <img 
                          src={currentUser.picture} 
                          alt={currentUser.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {currentUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-[70px] max-h-[200px]"
                        placeholder="Add a comment... (use @name to mention someone)"
                      />
                      {/* Tag options helper */}
                      <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                        <span className="text-xs text-gray-400 mr-1">Tag:</span>
                        {teamMembers.filter(m => m.isActive !== false).slice(0, 8).map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              const tagText = `@${member.name} `
                              const currentText = newComment
                              if (!currentText.includes(`@${member.name}`)) {
                                setNewComment(currentText + (currentText.endsWith(' ') || currentText === '' ? '' : ' ') + tagText)
                              }
                            }}
                            className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs transition-colors"
                            title={`Tag ${member.name}`}
                          >
                            @{member.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-xs text-gray-500">
                          Commenting as {currentUser.name}
                        </p>
                        <button
                          type="button"
                          onClick={handleLocalAddComment}
                          disabled={!newComment.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Sign in to leave comments
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
              <div>
                {post && onDelete && (
                  <button 
                    type="button" 
                    onClick={() => onDelete(post.id)} 
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !formData.user || !formData.title}
                  className="px-6 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {post ? "Save Changes" : "Create Post"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
