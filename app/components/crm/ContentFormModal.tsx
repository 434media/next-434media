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
  Image as ImageIcon
} from "lucide-react"
import { 
  BRANDS, 
  TEAM_MEMBERS,
  SOCIAL_PLATFORM_OPTIONS,
  CONTENT_POST_STATUS_OPTIONS,
} from "./types"
import type { ContentPost, ContentPostStatus, Brand, SocialPlatform, TeamMember } from "./types"

interface ContentFormModalProps {
  isOpen: boolean
  post: ContentPost | null
  isSaving: boolean
  onSave: (data: Partial<ContentPost>) => void
  onDelete?: (postId: string) => void
  onClose: () => void
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
})

export function ContentFormModal({
  isOpen,
  post,
  isSaving,
  onSave,
  onDelete,
  onClose,
}: ContentFormModalProps) {
  const [formData, setFormData] = useState(getDefaultFormData())
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [newLink, setNewLink] = useState("")

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
        })
      } else {
        setFormData(getDefaultFormData())
      }
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
      
      const allMembers = [...firestoreMembers, ...missingDefaults]
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
      // Reset the input so the same file can be selected again if needed
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
            className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {post ? "Edit Content Post" : "Create Content Post"}
                  </h3>
                  <p className="text-xs text-gray-500">Schedule content for your social calendar</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                            {formData.user === member.name && <Check className="w-4 h-4 text-pink-600" />}
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
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white"
                  >
                    <option value="">Select platform...</option>
                    {BRANDS.map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ContentPostStatus }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white"
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
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter post title..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white"
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Social Copy</label>
                <textarea
                  value={formData.social_copy}
                  onChange={(e) => setFormData(prev => ({ ...prev, social_copy: e.target.value }))}
                  placeholder="Enter the post caption or copy..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes or instructions..."
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Enter tags (comma separated)..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-pink-500 focus:bg-white"
                />
              </div>

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
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-300 hover:border-pink-400 cursor-pointer transition-colors">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Links</label>
                <div className="space-y-2">
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 truncate">
                        <Link2 className="w-4 h-4 inline mr-2" />
                        {link}
                      </div>
                      <button type="button" onClick={() => handleRemoveLink(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
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
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-pink-500"
                    />
                    <button type="button" onClick={handleAddLink} disabled={!newLink.trim()} className="p-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 disabled:opacity-50">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Assets</label>
                <div className="space-y-2">
                  {formData.assets.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {formData.assets.map((asset, index) => (
                        <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                          <img src={asset} alt={`Asset ${index + 1}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => handleRemoveAsset(index)} className="absolute top-0.5 right-0.5 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-300 hover:border-pink-400 cursor-pointer transition-colors">
                    <input type="file" accept="image/*,video/*" onChange={(e) => handleFileUpload(e, "asset")} className="hidden" />
                    {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-500">Upload asset</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
              <div>
                {post && onDelete && (
                  <button type="button" onClick={() => onDelete(post.id)} className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    Delete
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !formData.user || !formData.title}
                  className="px-6 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
