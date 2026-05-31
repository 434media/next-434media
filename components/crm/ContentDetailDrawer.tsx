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
  MessageSquare,
  Send,
  Pencil,
  ExternalLink,
  GripVertical,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { 
  BRANDS, 
  TEAM_MEMBERS,
  SOCIAL_PLATFORM_OPTIONS,
  CONTENT_POST_STATUS_OPTIONS,
} from "./types"
import type { ContentPost, ContentPostStatus, Brand, SocialPlatform, TeamMember, TaskComment, CurrentUser, Asset } from "./types"
import { DetailDrawer } from "@/components/admin/DetailDrawer"

// Shape returned by /api/admin/crm/content-posts/models (AI Gateway registry).
interface GenModel {
  id: string
  label: string
  kind: "image" | "video"
  priceLabel: string | null
  available: boolean
}

interface ContentDetailDrawerProps {
  open: boolean
  post: ContentPost | null
  isSaving: boolean
  currentUser?: CurrentUser | null
  onSave: (data: Partial<ContentPost>) => void
  onDelete?: (postId: string) => void
  onClose: () => void
  onAddComment?: (comment: TaskComment) => void
  onDeleteComment?: (commentId: string) => void
  onEditComment?: (commentId: string, newContent: string) => void
  // Approve/reject — only super-admins get the action bar (server enforces too).
  canReview?: boolean
  // Called after a decision is recorded so the parent can reload + close.
  onDecided?: () => void
}

const getDefaultFormData = () => ({
  user: "",
  platform: "" as Brand | "",
  status: "to_do" as ContentPostStatus,
  title: "",
  date_to_post: "",
  notes: "",
  social_copy: "",
  links: [] as string[],
  assets: [] as Asset[],
  social_platforms: [] as SocialPlatform[],
  comments: [] as TaskComment[],
})

/**
 * Sanitize a URL to only allow safe protocols (http/https).
 * Prevents XSS via javascript:, data:, or other dangerous URI schemes
 * when user-controlled strings are used in src or href attributes.
 */
function sanitizeUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString()
    }
    return ''
  } catch {
    return ''
  }
}

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

export function ContentDetailDrawer({
  open,
  post,
  isSaving,
  currentUser,
  onSave,
  onDelete,
  onClose,
  onAddComment,
  onDeleteComment,
  onEditComment,
  canReview,
  onDecided,
}: ContentDetailDrawerProps) {
  const [formData, setFormData] = useState(getDefaultFormData())
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState("")
  // Approve/reject local state
  const [isDeciding, setIsDeciding] = useState(false)
  const [showRejectNote, setShowRejectNote] = useState(false)
  const [rejectNote, setRejectNote] = useState("")
  const [decisionError, setDecisionError] = useState<string | null>(null)
  // Mark-as-posted local state
  const [isPublishing, setIsPublishing] = useState(false)
  const [showPublishForm, setShowPublishForm] = useState(false)
  const [publishUrl, setPublishUrl] = useState("")
  const [publishError, setPublishError] = useState<string | null>(null)
  // Ingest-asset-from-URL local state (locally-generated media / large video)
  const [ingestUrl, setIngestUrl] = useState("")
  const [isIngesting, setIsIngesting] = useState(false)
  const [ingestError, setIngestError] = useState<string | null>(null)
  // Generate-with-AI local state (create mode only). genKind is the segmented
  // Image/Video toggle that drives which models are shown + which fields render.
  const [genModels, setGenModels] = useState<GenModel[]>([])
  const [genKind, setGenKind] = useState<"image" | "video">("image")
  const [genModelId, setGenModelId] = useState("")
  const [genPrompt, setGenPrompt] = useState("")
  const [genImageUrl, setGenImageUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [genOutOfCredits, setGenOutOfCredits] = useState(false)

  useEffect(() => {
    if (open) {
      if (post) {
        setFormData({
          user: post.user || "",
          platform: post.platform || "",
          status: post.status || "to_do",
          title: post.title || "",
          date_to_post: post.date_to_post || "",
          notes: post.notes || "",
          social_copy: post.social_copy || "",
          links: (post.links || []).filter((link: string) => {
            try {
              const parsed = new URL(link)
              return ['http:', 'https:'].includes(parsed.protocol)
            } catch {
              return false
            }
          }),
          assets: post.assets || [],
          social_platforms: post.social_platforms || [],
          comments: post.comments || [],
        })
      } else {
        setFormData(getDefaultFormData())
      }
      setNewComment("")
      setEditingCommentId(null)
      setEditCommentContent("")
      setShowRejectNote(false)
      setRejectNote("")
      setDecisionError(null)
      setShowPublishForm(false)
      setPublishUrl("")
      setPublishError(null)
      setIngestUrl("")
      setIsIngesting(false)
      setIngestError(null)
      setGenKind("image")
      setGenPrompt("")
      setGenImageUrl("")
      setIsGenerating(false)
      setGenError(null)
      setGenOutOfCredits(false)
    }
  }, [open, post])

  // Load the AI Gateway model roster when opening a NEW post (generate is
  // create-mode only). Fetched server-side so pricing/availability stay live.
  useEffect(() => {
    if (!open || post) return
    let cancelled = false
    fetch("/api/admin/crm/content-posts/models", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.models) return
        setGenModels(data.models as GenModel[])
      })
      .catch(() => {
        /* leave roster empty — panel hides itself when there are no models */
      })
    return () => {
      cancelled = true
    }
  }, [open, post])

  // Keep the selected model valid for the active modality: when the Image/Video
  // toggle changes (or models load), default to the first model of that kind.
  const genModelsForKind = genModels.filter((m) => m.kind === genKind)
  useEffect(() => {
    if (genModelsForKind.length === 0) return
    if (!genModelsForKind.some((m) => m.id === genModelId)) {
      setGenModelId(genModelsForKind[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genKind, genModels])

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
      
      // Exclude certain names from tag options (check both full name AND first name)
      const EXCLUDED_FIRST_NAMES = ["elon", "elton", "testing", "guna", "barbara", "nichole", "barb", "test"]
      
      const allMembers = [...firestoreMembers, ...missingDefaults]
        .filter(m => {
          const nameLower = m.name.toLowerCase()
          const firstNameLower = m.name.split(' ')[0].toLowerCase()
          // Exclude if first name matches any excluded name
          return !EXCLUDED_FIRST_NAMES.includes(firstNameLower) && !EXCLUDED_FIRST_NAMES.includes(nameLower)
        })
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
    if (open) {
      fetchTeamMembers()
    }
  }, [open, fetchTeamMembers])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // Capture media kind from the uploaded file's MIME type so tiles/cards
        // render video vs image correctly.
        const kind: Asset["kind"] = file.type.startsWith("video/") ? "video" : "image"
        const newAsset: Asset = { url, kind, source: "upload" }
        setFormData(prev => ({ ...prev, assets: [...prev.assets, newAsset] }))
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
      // Validate the URL is safe (no javascript: or data: protocols)
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return // Reject non-HTTP(S) URLs
        }
      } catch {
        return // Reject malformed URLs
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

  // Ingest an asset from a URL (e.g. a locally-generated media output). The server
  // fetches + streams it into Blob and returns a structured Asset — this is the
  // path for video and large files that can't go through the direct-upload body.
  const handleIngestAssetUrl = async () => {
    const url = ingestUrl.trim()
    if (!url) return
    setIsIngesting(true)
    setIngestError(null)
    try {
      const res = await fetch("/api/admin/crm/content-posts/ingest-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url, source: "upload" }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.asset) {
        throw new Error(data.error || "Failed to ingest asset")
      }
      setFormData(prev => ({ ...prev, assets: [...prev.assets, data.asset as Asset] }))
      setIngestUrl("")
    } catch (err) {
      setIngestError(err instanceof Error ? err.message : "Failed to ingest asset")
    } finally {
      setIsIngesting(false)
    }
  }

  const handleLocalAddComment = async () => {
    if (!newComment.trim() || !currentUser) return
    
    // Extract mentions from comment (case-insensitive, supports multiple tags)
    // Matches @word or @FirstName LastName patterns
    const mentionRegex = /@([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null
    
    // Reset regex lastIndex to ensure we start from beginning
    mentionRegex.lastIndex = 0
    
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionName = match[1].toLowerCase().trim()
      
      // Find team member by first name or full name (case-insensitive)
      const mentionedMember = teamMembers.find(m => {
        const fullNameLower = m.name.toLowerCase()
        const firstNameLower = m.name.split(' ')[0].toLowerCase()
        return fullNameLower === mentionName || firstNameLower === mentionName
      })
      
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

    // Send notifications to mentioned users
    if (mentions.length > 0 && post?.id) {
      fetch("/api/admin/crm/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskId: post.id,
          taskTitle: formData.title || post.title || "Content Post",
          comment,
          mentionedEmails: mentions,
          isContentPost: true,
        }),
      }).catch(err => {
        console.error("Failed to send notifications:", err)
      })
    }

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
      social_copy: formData.social_copy || undefined,
      links: formData.links,
      assets: formData.assets,
      social_platforms: formData.social_platforms,
      comments: formData.comments,
    })
  }

  // Approve / request-changes. Posts to the decision route (server enforces
  // super-admin), then asks the parent to reload + close so the new status,
  // audit entry, and decision comment are reflected.
  const handleDecision = async (decision: "approved" | "rejected") => {
    if (!post?.id) return
    if (decision === "rejected" && !rejectNote.trim()) {
      setShowRejectNote(true)
      setDecisionError("A note is required so the assignee knows what to change.")
      return
    }
    setIsDeciding(true)
    setDecisionError(null)
    try {
      const res = await fetch(`/api/admin/crm/content-posts/${post.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decision,
          note: decision === "rejected" ? rejectNote.trim() : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to record decision")
      }
      onDecided?.()
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Failed to record decision")
    } finally {
      setIsDeciding(false)
    }
  }

  // Mark-as-posted. Records the live URL (optional) and flips status → posted
  // via the publish route, then reloads + closes.
  const handlePublish = async () => {
    if (!post?.id) return
    setIsPublishing(true)
    setPublishError(null)
    try {
      const res = await fetch(`/api/admin/crm/content-posts/${post.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ published_url: publishUrl.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to mark posted")
      }
      onDecided?.()
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to mark posted")
    } finally {
      setIsPublishing(false)
    }
  }

  // Generate with AI — kicks off an AI Gateway generation that creates its own
  // ai_drafted post (server-side), then reloads + closes so it appears on the
  // Board. Only shown in create mode.
  const handleGenerate = async () => {
    if (!genPrompt.trim()) {
      setGenError("A prompt is required.")
      return
    }
    setIsGenerating(true)
    setGenError(null)
    try {
      const res = await fetch("/api/admin/crm/content-posts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelId: genModelId,
          prompt: genPrompt.trim(),
          platform: formData.platform || undefined,
          title: formData.title.trim() || undefined,
          image_url: genKind === "video" && genImageUrl.trim() ? genImageUrl.trim() : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Out-of-credits is a distinct, expected state — surface it as a calm
        // notice rather than a transient error.
        if (data.code === "out_of_credits") {
          setGenOutOfCredits(true)
          return
        }
        throw new Error(data.error || "Generation failed")
      }
      onDecided?.()
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
    }
  }

  if (!open) return null

  // Latest reviewer decision, if any (the audit history is newest-last).
  const latestApproval =
    post?.approvals && post.approvals.length > 0
      ? post.approvals[post.approvals.length - 1]
      : null

  const drawerTitle = post ? formData.title || "Content Post" : "New Content Post"

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle="Schedule content for your social calendar"
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {post && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(post.id)}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !formData.user || !formData.title}
              className="px-5 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {post ? "Save Changes" : "Create Post"}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-5 space-y-6">
        {/* Header strip — preserves the original Calendar icon identity */}
        <div className="flex items-center gap-3 -mx-5 -mt-5 px-5 py-3 border-b border-neutral-200 bg-neutral-50">
          <div className="p-2 bg-white rounded-lg border border-neutral-200 shrink-0">
            <Calendar className="w-5 h-5 text-neutral-700" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-neutral-500 font-medium uppercase tracking-wide">
              {post ? "Edit Content Post" : "Create Content Post"}
            </p>
            <p className="text-[11px] text-neutral-400">Schedule content for your social calendar</p>
          </div>
        </div>

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
                    className="w-full px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-30 max-h-100 leading-relaxed"
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
                    className="w-full px-3 py-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-25 max-h-87.5 leading-relaxed"
                  />
                  <div className="absolute bottom-1 right-1 text-gray-300 pointer-events-none">
                    <GripVertical className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Reference links — internal context (briefs, source footage,
                  reference reels). Not published; the live post URL is captured
                  by mark-as-posted (published_url). */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference links</label>
                <div className="space-y-2">
                  {formData.links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 group">
                      <a 
                        href={sanitizeUrl(link) || '#'}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors truncate"
                      >
                        <Link2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{link}</span>
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                        <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group bg-neutral-900">
                          {asset.kind === "video" ? (
                            <video
                              src={sanitizeUrl(asset.url)}
                              muted
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img src={sanitizeUrl(asset.url)} alt={`Asset ${index + 1}`} className="w-full h-full object-cover" />
                          )}
                          {asset.kind === "video" && (
                            <span className="absolute bottom-0.5 left-0.5 px-1 py-0.5 text-[9px] font-medium text-white bg-black/60 rounded">
                              video
                            </span>
                          )}
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
                    <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
                    {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm text-gray-500">Upload asset</span>
                  </label>

                  {/* Add from URL — ingests a media URL server-side into Blob.
                      Handles video / large files the direct upload can't. */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ingestUrl}
                      onChange={(e) => setIngestUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleIngestAssetUrl())}
                      placeholder="…or paste a media URL"
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleIngestAssetUrl}
                      disabled={isIngesting || !ingestUrl.trim()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                      {isIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add
                    </button>
                  </div>
                  {ingestError && <p className="text-xs text-red-600">{ingestError}</p>}

                  {/* Generate with AI — create mode only. Produces an ai_drafted
                      post with the generated asset attached, via the Vercel AI
                      Gateway (one key, many providers). Sits with the other "add
                      media" methods. Models not on the Gateway are generated
                      locally and brought in via the paste-URL field above.
                      Video runs in the background; the draft appears immediately. */}
                  {!post && genModels.length > 0 && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2.5">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Generate with AI</h4>
                        <p className="text-[11px] text-neutral-500">Via Vercel AI Gateway · billed to your Vercel account.</p>
                      </div>

                      {/* Modality toggle — pick the task first, then the form is
                          purpose-built for it (no field shuffling). */}
                      <div className="inline-flex w-full rounded-md ring-1 ring-neutral-200 bg-white overflow-hidden divide-x divide-neutral-200">
                        {(["image", "video"] as const).map((k) => {
                          const active = genKind === k
                          const has = genModels.some((m) => m.kind === k)
                          return (
                            <button
                              key={k}
                              type="button"
                              disabled={!has}
                              onClick={() => setGenKind(k)}
                              aria-pressed={active}
                              className={`flex-1 h-8 text-xs font-medium capitalize transition-colors ${
                                active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              {k}
                            </button>
                          )
                        })}
                      </div>

                      {genOutOfCredits && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <span className="font-medium">Generation unavailable</span> — the AI Gateway account is out of credits.
                          Add credits in the Vercel dashboard, or generate locally and paste the URL above.
                        </div>
                      )}

                      <select
                        value={genModelId}
                        onChange={(e) => setGenModelId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                      >
                        {genModelsForKind.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label}{m.priceLabel ? ` · ${m.priceLabel}` : ""}
                          </option>
                        ))}
                      </select>

                      {genKind === "video" && (
                        <input
                          type="text"
                          value={genImageUrl}
                          onChange={(e) => setGenImageUrl(e.target.value)}
                          placeholder="Source image URL (optional — to animate an image)"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
                        />
                      )}

                      <textarea
                        value={genPrompt}
                        onChange={(e) => setGenPrompt(e.target.value)}
                        placeholder={genKind === "video" ? "Describe the motion / scene…" : "Describe the image…"}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400"
                      />

                      {genKind === "video" && (
                        <p className="text-[11px] text-neutral-500 leading-snug">
                          Video can take a few minutes — the draft appears now and the clip attaches when it&apos;s ready.
                        </p>
                      )}
                      {genError && <p className="text-xs text-red-600">{genError}</p>}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleGenerate}
                          disabled={isGenerating || !genPrompt.trim() || !genModelId}
                          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Generate {genKind === "video" ? "video" : "image"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval — decision banner (everyone) + action bar (reviewers) */}
              {post && (
                <div className="pt-4 border-t border-gray-200 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Approval
                  </label>

                  {/* Latest decision banner */}
                  {latestApproval && (
                    <div
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
                        latestApproval.decision === "approved"
                          ? "border-blue-200 bg-blue-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      {latestApproval.decision === "approved" ? (
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 text-sm">
                        <p className={latestApproval.decision === "approved" ? "text-blue-800" : "text-red-800"}>
                          <span className="font-medium">
                            {latestApproval.decision === "approved" ? "Approved" : "Changes requested"}
                          </span>{" "}
                          by {latestApproval.by_name} · {formatDate(latestApproval.at)}
                        </p>
                        {latestApproval.note && (
                          <p className="mt-0.5 text-neutral-600 wrap-break-word">{latestApproval.note}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reviewer action bar — only super-admins, only when awaiting approval */}
                  {canReview && post.status === "needs_approval" && (
                    <div className="space-y-2">
                      {showRejectNote && (
                        <textarea
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="What needs to change? (required to request changes)"
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-red-400"
                        />
                      )}
                      {decisionError && (
                        <p className="text-xs text-red-600">{decisionError}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecision("approved")}
                          disabled={isDeciding}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isDeciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!showRejectNote) {
                              setShowRejectNote(true)
                              setDecisionError(null)
                            } else {
                              handleDecision("rejected")
                            }
                          }}
                          disabled={isDeciding}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Request changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Posted banner — shown once the post is live */}
                  {post.status === "posted" && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                      <Send className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 text-sm">
                        <p className="text-green-800">
                          <span className="font-medium">Posted</span>
                          {post.posted_at && <> · {formatDate(post.posted_at)}</>}
                        </p>
                        {post.published_url && (
                          <a
                            href={sanitizeUrl(post.published_url) || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-green-700 hover:text-green-800 wrap-break-word"
                          >
                            View live post
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Mark-as-posted action — any admin, once approved/scheduled */}
                  {(post.status === "approved" || post.status === "scheduled") && (
                    <div className="space-y-2">
                      {showPublishForm && (
                        <input
                          type="text"
                          value={publishUrl}
                          onChange={(e) => setPublishUrl(e.target.value)}
                          placeholder="Live post URL (optional) — https://…"
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:border-green-400"
                        />
                      )}
                      {publishError && <p className="text-xs text-red-600">{publishError}</p>}
                      <button
                        onClick={() => {
                          if (!showPublishForm) {
                            setShowPublishForm(true)
                            setPublishError(null)
                          } else {
                            handlePublish()
                          }
                        }}
                        disabled={isPublishing}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {showPublishForm ? "Confirm posted" : "Mark as posted"}
                      </button>
                    </div>
                  )}
                </div>
              )}

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
                              src={sanitizeUrl(comment.author_avatar)} 
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
                                  className="w-full px-3 py-2 rounded-lg bg-white border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500 resize-y min-h-15 max-h-50"
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
                            {comment.mentions && comment.mentions.length > 0 && editingCommentId !== comment.id && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {comment.mentions.map((email) => {
                                  const member = teamMembers.find(m => m.email?.toLowerCase() === email?.toLowerCase())
                                  return member ? (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
                                      @{member.name.split(' ')[0].toLowerCase()}
                                    </span>
                                  ) : (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                                      @{email.split('@')[0]}
                                    </span>
                                  )
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
                    <div className="shrink-0">
                      {currentUser.picture ? (
                        <img 
                          src={sanitizeUrl(currentUser.picture)} 
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
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-y min-h-17.5 max-h-50"
                        placeholder="Add a comment... (use @name to mention someone)"
                      />
                      {/* Tag options helper */}
                      <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                        <span className="text-xs text-gray-400 mr-1">Tag:</span>
                        {teamMembers.filter(m => m.isActive !== false).slice(0, 8).map((member) => {
                          const firstName = member.name.split(' ')[0].toLowerCase()
                          return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              // Use lowercase first name for easier typing
                              const tagText = `@${firstName} `
                              const currentText = newComment
                              // Check if already tagged (case-insensitive)
                              if (!currentText.toLowerCase().includes(`@${firstName}`)) {
                                setNewComment(currentText + (currentText.endsWith(' ') || currentText === '' ? '' : ' ') + tagText)
                              }
                            }}
                            className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs transition-colors"
                            title={`Tag ${member.name}`}
                          >
                            @{firstName}
                          </button>
                        )})}
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
    </DetailDrawer>
  )
}
