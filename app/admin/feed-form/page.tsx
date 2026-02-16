"use client"

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/analytics/Button"
import { Badge } from "../../components/analytics/Badge"
import { Marked } from 'marked'

import { Toast } from "../../components/crm/Toast"
import type { Toast as ToastType, CurrentUser, TeamMember } from "../../components/crm/types"
import { TEAM_MEMBERS } from "../../components/crm/types"
import { Loader2, Send, ArrowLeft, Calendar, FileText, Link as LinkIcon, Users, Tag, Image as ImageIcon, RefreshCw, Eye, List, Edit, Trash2, Save, X, ChevronDown, ChevronRight, CheckCircle2, Sparkles, Star, Pencil, Cloud, Clock, MessageSquare } from "lucide-react"
import Link from "next/link"
import { RichTextEditor } from "../../components/RichTextEditor"
import { ImageUpload } from "../../components/ImageUpload"
import { AdminRoleGuard } from "../../components/AdminRoleGuard"

// Configure marked for consistent rendering with production
const previewMarked = new Marked({ 
  async: false, 
  gfm: true,
  breaks: true
})

// Collapsible Section Component
interface CollapsibleSectionProps {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  isComplete?: boolean
  children: React.ReactNode
}

function CollapsibleSection({ 
  id, 
  title, 
  description, 
  icon, 
  isOpen, 
  onToggle, 
  isComplete = false,
  children
}: CollapsibleSectionProps) {
  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all duration-200 ${
      isOpen 
        ? 'border-sky-400 shadow-lg shadow-sky-100/50 bg-white' 
        : isComplete 
          ? 'border-green-300 bg-green-50/30 hover:border-green-400' 
          : 'border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm'
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-xl transition-all ${
            isOpen 
              ? 'bg-sky-100 text-sky-600 shadow-sm' 
              : isComplete 
                ? 'bg-green-100 text-green-600' 
                : 'bg-neutral-100 text-neutral-500'
          }`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold tracking-tight ${
                isOpen ? 'text-sky-900' : isComplete ? 'text-green-800' : 'text-neutral-900'
              }`}>
                {title}
              </h3>
            </div>
            <p className="text-sm text-neutral-500 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isComplete && !isOpen && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Complete
            </span>
          )}
          <div className={`p-1.5 rounded-full transition-all ${
            isOpen ? 'bg-sky-100 rotate-0' : 'bg-neutral-100'
          }`}>
            {isOpen ? (
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'text-sky-600' : 'text-neutral-400'}`} />
            ) : (
              <ChevronRight className={`h-5 w-5 ${isComplete ? 'text-green-500' : 'text-neutral-400'}`} />
            )}
          </div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="px-5 pb-6 pt-3 border-t border-sky-100 bg-linear-to-b from-sky-50/30 to-transparent">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Preview Field Component - shows value in preview mode with ability to edit individual fields
interface PreviewFieldProps {
  label: string
  value: string
  isPreview: boolean
  required?: boolean
  children: React.ReactNode
  isRichText?: boolean
}

function PreviewField({ label, value, isPreview, required, children, isRichText }: PreviewFieldProps) {
  const [isEditing, setIsEditing] = useState(false)

  // Render markdown using the same library as production
  const renderedHtml = useMemo(() => {
    if (!value || !isRichText) return null
    try {
      return previewMarked.parse(value) as string
    } catch {
      return value.replace(/\n/g, '<br />')
    }
  }, [value, isRichText])

  // If not in preview mode globally, or if this field is being edited, show the edit form
  if (!isPreview || isEditing) {
    return (
      <div className="relative">
        {isPreview && isEditing && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 hover:text-green-700 px-3 py-1.5 bg-green-50 hover:bg-green-100 rounded-lg transition-all border border-green-200"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Done Editing
            </button>
          </div>
        )}
        {children}
      </div>
    )
  }

  // For rich text, render HTML using marked (matches production)
  const renderValue = () => {
    if (!value) {
      return <span className="text-neutral-400 italic text-sm">Click to add content</span>
    }
    if (isRichText && renderedHtml) {
      return (
        <div 
          className="prose prose-sm max-w-none text-neutral-700 leading-relaxed
            prose-headings:text-gray-900 prose-strong:text-gray-900
            prose-a:text-blue-600 prose-a:underline
            prose-code:bg-gray-100 prose-code:rounded prose-code:px-1
            prose-blockquote:border-gray-300 prose-blockquote:text-gray-600
            prose-ul:my-2 prose-ol:my-2 prose-li:my-0"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )
    }
    return <span className="text-neutral-800 font-medium">{value}</span>
  }

  return (
    <div 
      className="group cursor-pointer"
      onClick={() => setIsEditing(true)}
    >
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-neutral-600 group-hover:text-sky-600 transition-colors tracking-tight">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 group-hover:text-sky-600 px-2.5 py-1 rounded-lg group-hover:bg-sky-50 transition-all border border-transparent group-hover:border-sky-200">
          <Pencil className="h-3 w-3" />
          <span className="hidden group-hover:inline">Click to edit</span>
        </span>
      </div>
      <div className="px-4 py-3 bg-neutral-50 border-2 border-neutral-200 rounded-xl min-h-13 group-hover:border-sky-300 group-hover:bg-sky-50/30 transition-all flex items-center">
        {renderValue()}
      </div>
    </div>
  )
}

type FeedType = "video" | "article" | "podcast" | "newsletter"
type FeedStatus = "draft" | "published" | "archived"

// Comment interface for feed items (follows CRM TaskComment pattern)
interface FeedComment {
  id: string
  content: string
  author_name: string
  author_email: string
  author_avatar?: string
  created_at: string
  updated_at?: string
}

const FEED_TABLE = "THEFEED"

interface FeedItem {
  id?: string
  published_date: string
  title: string
  type: FeedType
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  og_image?: string
  og_title?: string
  og_description?: string
  status: FeedStatus
  
  // Newsletter-specific fields
  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string
  
  // Spotlight fields
  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string
  
  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string
  
  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string
  
  // Comments
  comments?: FeedComment[]
}

interface FeedFormData {
  title: string
  type: FeedType
  summary: string
  authors: string[]
  topics: string[]
  slug: string
  published_date: string
  status: FeedStatus
  og_image?: string
  og_title?: string
  og_description?: string
  
  // Newsletter-specific fields
  hero_image_desktop?: string
  hero_image_mobile?: string
  founders_note_text?: string
  founders_note_image?: string
  last_month_gif?: string
  the_drop_gif?: string
  featured_post_title?: string
  featured_post_image?: string
  featured_post_content?: string
  upcoming_event_title?: string
  upcoming_event_description?: string
  upcoming_event_image_desktop?: string
  upcoming_event_image_mobile?: string
  upcoming_event_cta_text?: string
  upcoming_event_cta_link?: string
  
  // Spotlight fields (3 items)
  spotlight_1_title?: string
  spotlight_1_description?: string
  spotlight_1_image?: string
  spotlight_1_cta_text?: string
  spotlight_1_cta_link?: string
  
  spotlight_2_title?: string
  spotlight_2_description?: string
  spotlight_2_image?: string
  spotlight_2_cta_text?: string
  spotlight_2_cta_link?: string
  
  spotlight_3_title?: string
  spotlight_3_description?: string
  spotlight_3_image?: string
  spotlight_3_cta_text?: string
  spotlight_3_cta_link?: string
}

export default function FeedFormPage() {
  const router = useRouter()
  const [toast, setToast] = useState<ToastType | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [activeTab, setActiveTab] = useState<"view" | "create">("view")
  
  // Comment & tagging state
  const [newComment, setNewComment] = useState("")
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState("")
  const [expandedFeedComments, setExpandedFeedComments] = useState<Set<string>>(new Set())
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  
  // Auto-save to Firestore state
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [autoSaveDraftId, setAutoSaveDraftId] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const lastSavedFormData = useRef<string>("")
  
  // Collapsible section states - all collapsed by default
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  
  const [formData, setFormData] = useState<FeedFormData>({
    title: "",
    type: "newsletter",
    summary: "",
    authors: [],
    topics: [],
    slug: "",
    published_date: new Date().toISOString().split("T")[0],
    status: "draft",
  })

  // Toggle section open/close
  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  // Expand all sections
  const expandAllSections = () => {
    const allSections = ["basic", "metadata", "hero", "sections", "event", "spotlight1", "spotlight2", "spotlight3"]
    setOpenSections(new Set(allSections))
  }

  // Collapse all sections
  const collapseAllSections = () => {
    setOpenSections(new Set())
  }

  // Check if a section is complete
  const isSectionComplete = useCallback((sectionId: string): boolean => {
    switch (sectionId) {
      case "basic":
        return !!(formData.title && formData.summary)
      case "metadata":
        return !!(formData.authors.length > 0 || formData.topics.length > 0)
      case "hero":
        return !!(formData.hero_image_desktop || formData.founders_note_text)
      case "sections":
        return !!(formData.featured_post_title || formData.last_month_gif)
      case "event":
        return !!(formData.upcoming_event_title)
      case "spotlight1":
        return !!(formData.spotlight_1_title)
      case "spotlight2":
        return !!(formData.spotlight_2_title)
      case "spotlight3":
        return !!(formData.spotlight_3_title)
      default:
        return false
    }
  }, [formData])

  // Calculate overall completion percentage
  const getCompletionPercentage = useCallback((): number => {
    const sections = ["basic", "metadata", "hero", "sections", "event", "spotlight1", "spotlight2", "spotlight3"]
    const completedCount = sections.filter(s => isSectionComplete(s)).length
    return Math.round((completedCount / sections.length) * 100)
  }, [isSectionComplete])

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("feedFormDraft")
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setHasDraft(true)
        // Don't auto-load, let user decide
      } catch (error) {
        console.error("Error loading draft:", error)
      }
    }
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Load current user from session
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/session")
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setCurrentUser(data.user)
          }
        }
      } catch (err) {
        console.error("Failed to load current user:", err)
      }
    }
    loadCurrentUser()
  }, [])

  // Load team members for @-mention tagging
  useEffect(() => {
    const fetchTeamMembers = async () => {
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
        const firestoreEmails = new Set(firestoreMembers.map(m => m.email?.toLowerCase()).filter(Boolean))
        
        const missingDefaults = defaultMembers.filter(d =>
          !firestoreNames.has(d.name.toLowerCase()) &&
          (!d.email || !firestoreEmails.has(d.email.toLowerCase()))
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
      }
    }
    fetchTeamMembers()
  }, [])

  // Auto-save draft to localStorage when form changes
  useEffect(() => {
    // Only auto-save if form has content and not editing an existing item
    if (!editingId && (formData.title || formData.summary)) {
      const saveTimer = setTimeout(() => {
        localStorage.setItem("feedFormDraft", JSON.stringify(formData))
        setHasDraft(true)
      }, 1000) // Debounce saves by 1 second

      return () => clearTimeout(saveTimer)
    }
  }, [formData, editingId])

  // Track unsaved changes
  useEffect(() => {
    const currentFormString = JSON.stringify(formData)
    if (lastSavedFormData.current && currentFormString !== lastSavedFormData.current) {
      setHasUnsavedChanges(true)
    }
  }, [formData])

  // Auto-save draft to Firestore every 30 seconds
  const autoSaveToFirestore = useCallback(async () => {
    // Only auto-save if:
    // 1. Not currently editing an existing published/archived item
    // 2. Form has meaningful content (title AND summary)
    // 3. Status is draft
    // 4. There are unsaved changes
    if (formData.status !== "draft") return
    if (!formData.title?.trim() || !formData.summary?.trim()) return
    if (!hasUnsavedChanges && autoSaveDraftId) return
    
    const currentFormString = JSON.stringify(formData)
    if (currentFormString === lastSavedFormData.current) return

    setIsAutoSaving(true)
    try {
      // If we already have a draft ID, update it; otherwise create new
      const isUpdating = autoSaveDraftId !== null || editingId !== null
      const method = isUpdating ? "PATCH" : "POST"
      const draftId = autoSaveDraftId || editingId
      
      const body = isUpdating 
        ? { id: draftId, ...formData, status: "draft" }
        : { ...formData, status: "draft" }

      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        // Store the draft ID for future updates
        if (!isUpdating && result.data?.id) {
          setAutoSaveDraftId(result.data.id)
        }
        setLastSavedAt(new Date())
        setHasUnsavedChanges(false)
        lastSavedFormData.current = currentFormString
        
        // Refresh feed items list to show the draft
        loadFeedItems()
      }
    } catch (error) {
      console.error("Auto-save failed:", error)
    } finally {
      setIsAutoSaving(false)
    }
  }, [formData, autoSaveDraftId, editingId, hasUnsavedChanges])

  // Auto-save to Firestore every 30 seconds when there's content
  useEffect(() => {
    if (activeTab !== "create") return
    if (!formData.title?.trim() || !formData.summary?.trim()) return
    if (formData.status !== "draft") return

    const autoSaveInterval = setInterval(() => {
      autoSaveToFirestore()
    }, 30000) // 30 seconds

    return () => clearInterval(autoSaveInterval)
  }, [activeTab, formData.title, formData.summary, formData.status, autoSaveToFirestore])

  // Save to Firestore when leaving the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && formData.title?.trim() && formData.summary?.trim() && formData.status === "draft") {
        // Trigger save
        autoSaveToFirestore()
        // Show browser warning
        e.preventDefault()
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges, formData, autoSaveToFirestore])

  // Load feed items on mount
  useEffect(() => {
    loadFeedItems()
  }, [])

  // Load feed items from Firestore
  const loadFeedItems = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`)

      const result = await response.json()

      if (result.success) {
        setFeedItems(result.data || [])
      } else {
        setToast({ message: result.error || "Failed to load feed items", type: "error" })
      }
    } catch (error) {
      console.error("Error loading feeds:", error)
      setToast({ message: "Failed to load feed items from database", type: "error" })
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-generate slug from title
  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim()
  }

  // Format date for display in CST timezone
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      // Parse the date and display in CST (America/Chicago)
      const date = new Date(dateString + 'T12:00:00')
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "America/Chicago"
      })
    } catch {
      return dateString
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800"
      case "draft":
        return "bg-yellow-100 text-yellow-800"
      case "archived":
        return "bg-neutral-100 text-neutral-800"
      default:
        return "bg-neutral-100 text-neutral-800"
    }
  }

  // Get type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "bg-purple-100 text-purple-800"
      case "article":
        return "bg-sky-100 text-sky-800"
      case "podcast":
        return "bg-pink-100 text-pink-800"
      case "newsletter":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-neutral-100 text-neutral-800"
    }
  }

  // Filter and sort feed items (latest date first)
  const filteredFeedItems = feedItems
    .filter((item) => {
      const statusMatch = filterStatus === "all" || item.status === filterStatus
      const typeMatch = filterType === "all" || item.type === filterType
      
      // Date range filtering
      let dateMatch = true
      if (dateFilter.start || dateFilter.end) {
        const itemDate = new Date(item.published_date + 'T12:00:00')
        if (dateFilter.start) {
          const startDate = new Date(dateFilter.start + 'T00:00:00')
          dateMatch = dateMatch && itemDate >= startDate
        }
        if (dateFilter.end) {
          const endDate = new Date(dateFilter.end + 'T23:59:59')
          dateMatch = dateMatch && itemDate <= endDate
        }
      }
      
      return statusMatch && typeMatch && dateMatch
    })
    .sort((a, b) => {
      // Sort by published_date descending (latest first)
      const dateA = new Date(a.published_date + 'T12:00:00').getTime()
      const dateB = new Date(b.published_date + 'T12:00:00').getTime()
      return dateB - dateA
    })

  const handleInputChange = (field: keyof FeedFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Auto-generate slug when title changes
    if (field === "title" && !formData.slug) {
      setFormData((prev) => ({
        ...prev,
        slug: generateSlug(value),
      }))
    }
  }

  const handleArrayInput = (field: "authors" | "topics", value: string) => {
    const items = value.split(",").map((item) => item.trim()).filter(Boolean)
    setFormData((prev) => ({
      ...prev,
      [field]: items,
    }))
  }

  const removeArrayItem = (field: "authors" | "topics", index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, idx) => idx !== index),
    }))
  }

  // Load saved draft
  const loadDraft = () => {
    const savedDraft = localStorage.getItem("feedFormDraft")
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        setFormData(draft)
        setHasDraft(false)
        setToast({ message: "Draft loaded successfully", type: "success" })
      } catch (error) {
        setToast({ message: "Failed to load draft", type: "error" })
      }
    }
  }

  // Clear saved draft
  const clearDraft = () => {
    localStorage.removeItem("feedFormDraft")
    setHasDraft(false)
    setToast({ message: "Draft cleared", type: "success" })
  }

  // Save current form as draft
  const saveDraft = () => {
    localStorage.setItem("feedFormDraft", JSON.stringify(formData))
    setHasDraft(true)
    setToast({ message: "Draft saved", type: "success" })
  }

  // Load mock data for testing
  const loadMockData = () => {
    const mockData: FeedFormData = {
      title: "Test Newsletter - December 2025",
      type: "newsletter",
      summary: "This is a **test newsletter** with *rich text* formatting. It includes [links](https://example.com) and `code snippets` for testing purposes.",
      authors: ["Digital Canvas Team", "Dev Team"],
      topics: ["Technology", "Design", "Innovation"],
      slug: "test-newsletter-december-2025",
      published_date: new Date().toISOString().split("T")[0],
      status: "draft",
      og_image: "https://images.unsplash.com/photo-1557821552-17105176677c?w=1200&h=630&fit=crop",
      
      // Newsletter fields
      hero_image_desktop: "https://images.unsplash.com/photo-1557821552-17105176677c?w=1920&h=1080&fit=crop",
      hero_image_mobile: "https://images.unsplash.com/photo-1557821552-17105176677c?w=800&h=600&fit=crop",
      founders_note_text: "Welcome to our **December newsletter**! We're excited to share some amazing updates with you this month.\n\nThis is a test note with *formatting*.",
      founders_note_image: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop",
      last_month_gif: "https://media.giphy.com/media/3o7aCTfyhYawdOXcFW/giphy.gif",
      the_drop_gif: "https://media.giphy.com/media/26gsspfbt1HfVQ9va/giphy.gif",
      
      featured_post_title: "How AI is Transforming Creative Industries",
      featured_post_image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop",
      featured_post_content: "Artificial intelligence is **revolutionizing** the creative landscape. From design to content creation, AI tools are:\n\n- Enhancing productivity\n- Enabling new forms of expression\n- Democratizing creative tools\n\nRead more about this exciting development.",
      
      upcoming_event_title: "Tech Innovation Summit 2025",
      upcoming_event_description: "Join us for a **full-day conference** featuring:\n\n1. Keynote speakers from industry leaders\n2. Interactive workshops\n3. Networking opportunities\n\nDon't miss this incredible event!",
      upcoming_event_image_desktop: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1920&h=1080&fit=crop",
      upcoming_event_image_mobile: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop",
      upcoming_event_cta_text: "Register Now",
      upcoming_event_cta_link: "https://example.com/register",
      
      // Spotlights
      spotlight_1_title: "New Product Launch",
      spotlight_1_description: "Introducing our **latest innovation** - a game-changing solution for modern businesses. Experience the future today.",
      spotlight_1_image: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=600&h=400&fit=crop",
      spotlight_1_cta_text: "Learn More",
      spotlight_1_cta_link: "https://example.com/product",
      
      spotlight_2_title: "Community Spotlight",
      spotlight_2_description: "Meet the creators making a *difference* in their communities through technology and innovation.",
      spotlight_2_image: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=400&fit=crop",
      spotlight_2_cta_text: "Read Stories",
      spotlight_2_cta_link: "https://example.com/community",
      
      spotlight_3_title: "Resources & Guides",
      spotlight_3_description: "Access our comprehensive library of guides, tutorials, and best practices for maximizing your workflow.",
      spotlight_3_image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&h=400&fit=crop",
      spotlight_3_cta_text: "Explore Resources",
      spotlight_3_cta_link: "https://example.com/resources",
    }

    setFormData(mockData)
    setToast({ message: "Test data loaded", type: "success" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.title || !formData.summary) {
      setToast({ message: "Please fill in all required fields (Title and Summary)", type: "error" })
      return
    }

    setIsSubmitting(true)

    try {
      const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
      
      // Determine if we're editing or creating
      const isEditing = editingId !== null
      const url = `/api/feed-submit?table=${FEED_TABLE}`
      const method = isEditing ? "PATCH" : "POST"
      const body = isEditing ? { id: editingId, ...formData } : formData
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        setToast({ message: isEditing ? "Feed item updated" : "Feed item created", type: "success" })
        
        // Clear draft on successful submission
        localStorage.removeItem("feedFormDraft")
        setHasDraft(false)
        
        // Reset auto-save state
        setAutoSaveDraftId(null)
        setLastSavedAt(null)
        setHasUnsavedChanges(false)
        lastSavedFormData.current = ""
        
        // Reset form and editing state
        setFormData({
          title: "",
          type: "newsletter",
          summary: "",
          authors: [],
          topics: [],
          slug: "",
          published_date: new Date().toISOString().split("T")[0],
          status: "draft",
        })
        setEditingId(null)
        
        // Reload feed items and switch to view tab
        await loadFeedItems()
        setActiveTab("view")
      } else {
        setToast({ message: result.error || "Unknown error occurred", type: "error" })
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Failed to submit feed item", type: "error" })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Start editing a feed item
  const handleEdit = (item: FeedItem) => {
    setEditingId(item.id || null)
    setPreviewMode(true) // Enable preview mode by default when editing
    setFormData({
      title: item.title,
      type: item.type,
      summary: item.summary,
      authors: item.authors,
      topics: item.topics,
      slug: item.slug,
      published_date: item.published_date,
      status: item.status,
      og_image: item.og_image,
      og_title: item.og_title,
      og_description: item.og_description,
      hero_image_desktop: item.hero_image_desktop,
      hero_image_mobile: item.hero_image_mobile,
      founders_note_text: item.founders_note_text,
      founders_note_image: item.founders_note_image,
      last_month_gif: item.last_month_gif,
      the_drop_gif: item.the_drop_gif,
      featured_post_title: item.featured_post_title,
      featured_post_image: item.featured_post_image,
      featured_post_content: item.featured_post_content,
      upcoming_event_title: item.upcoming_event_title,
      upcoming_event_description: item.upcoming_event_description,
      upcoming_event_image_desktop: item.upcoming_event_image_desktop,
      upcoming_event_image_mobile: item.upcoming_event_image_mobile,
      upcoming_event_cta_text: item.upcoming_event_cta_text,
      upcoming_event_cta_link: item.upcoming_event_cta_link,
      spotlight_1_title: item.spotlight_1_title,
      spotlight_1_description: item.spotlight_1_description,
      spotlight_1_image: item.spotlight_1_image,
      spotlight_1_cta_text: item.spotlight_1_cta_text,
      spotlight_1_cta_link: item.spotlight_1_cta_link,
      spotlight_2_title: item.spotlight_2_title,
      spotlight_2_description: item.spotlight_2_description,
      spotlight_2_image: item.spotlight_2_image,
      spotlight_2_cta_text: item.spotlight_2_cta_text,
      spotlight_2_cta_link: item.spotlight_2_cta_link,
      spotlight_3_title: item.spotlight_3_title,
      spotlight_3_description: item.spotlight_3_description,
      spotlight_3_image: item.spotlight_3_image,
      spotlight_3_cta_text: item.spotlight_3_cta_text,
      spotlight_3_cta_link: item.spotlight_3_cta_link,
    })
    setActiveTab("create")
    
    // Reset auto-save state when editing existing item
    setAutoSaveDraftId(null)
    setLastSavedAt(null)
    setHasUnsavedChanges(false)
    lastSavedFormData.current = JSON.stringify({
      title: item.title,
      type: item.type,
      summary: item.summary,
      // ... simplified - just mark as saved
    })
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null)
    setPreviewMode(false)
    
    // Reset auto-save state
    setAutoSaveDraftId(null)
    setLastSavedAt(null)
    setHasUnsavedChanges(false)
    lastSavedFormData.current = ""
    
    setFormData({
      title: "",
      type: "newsletter",
      summary: "",
      authors: [],
      topics: [],
      slug: "",
      published_date: new Date().toISOString().split("T")[0],
      status: "draft",
    })
  }

  // Delete a feed item
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feed item? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/feed-submit?id=${id}&table=${FEED_TABLE}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        setToast({ message: "Feed item deleted", type: "success" })
        
        // Reload feed items
        await loadFeedItems()
      } else {
        setToast({ message: result.error || "Unknown error occurred", type: "error" })
      }
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Failed to delete feed item", type: "error" })
    }
  }

  // Ref map for auto-scrolling to comment panels
  const commentPanelRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Toggle comment section for a feed item (only one open at a time)
  const toggleFeedComments = (feedId: string) => {
    setExpandedFeedComments(prev => {
      const next = new Set<string>()
      if (!prev.has(feedId)) {
        // Open this one (close all others)
        next.add(feedId)
        // Auto-scroll after render
        requestAnimationFrame(() => {
          setTimeout(() => {
            const panel = commentPanelRefs.current.get(feedId)
            if (panel) {
              panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }
          }, 100)
        })
      }
      // If already open, next is empty = close it
      return next
    })
    // Reset comment input when toggling
    setNewComment("")
    setEditingCommentId(null)
    setEditCommentContent("")
  }

  // Add comment to a feed item
  const handleAddComment = async (feedId: string) => {
    if (!newComment.trim() || !currentUser) return

    const comment: FeedComment = {
      id: crypto.randomUUID(),
      content: newComment.trim(),
      author_name: currentUser.name,
      author_email: currentUser.email,
      author_avatar: currentUser.picture,
      created_at: new Date().toISOString(),
    }

    // Find the feed item and update it optimistically
    const feedItem = feedItems.find(f => f.id === feedId)
    if (!feedItem) return

    const updatedComments = [...(feedItem.comments || []), comment]
    setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: updatedComments } : f))
    setNewComment("")

    try {
      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: feedId, comments: updatedComments }),
      })

      if (!response.ok) throw new Error("Failed to save comment")
      setToast({ message: "Comment added", type: "success" })
    } catch {
      setToast({ message: "Failed to save comment", type: "error" })
      // Rollback
      setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: feedItem.comments || [] } : f))
    }
  }

  // Delete comment from a feed item
  const handleDeleteComment = async (feedId: string, commentId: string) => {
    if (!confirm("Delete this comment?")) return

    const feedItem = feedItems.find(f => f.id === feedId)
    if (!feedItem) return

    const updatedComments = (feedItem.comments || []).filter(c => c.id !== commentId)
    setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: updatedComments } : f))

    try {
      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: feedId, comments: updatedComments }),
      })

      if (!response.ok) throw new Error("Failed to delete comment")
      setToast({ message: "Comment deleted", type: "success" })
    } catch {
      setToast({ message: "Failed to delete comment", type: "error" })
      setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: feedItem.comments || [] } : f))
    }
  }

  // Edit comment on a feed item
  const handleEditComment = async (feedId: string, commentId: string, newContent: string) => {
    const feedItem = feedItems.find(f => f.id === feedId)
    if (!feedItem) return

    const updatedComments = (feedItem.comments || []).map(c =>
      c.id === commentId
        ? { ...c, content: newContent, updated_at: new Date().toISOString() }
        : c
    )
    setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: updatedComments } : f))
    setEditingCommentId(null)
    setEditCommentContent("")

    try {
      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: feedId, comments: updatedComments }),
      })

      if (!response.ok) throw new Error("Failed to update comment")
      setToast({ message: "Comment updated", type: "success" })
    } catch {
      setToast({ message: "Failed to update comment", type: "error" })
      setFeedItems(prev => prev.map(f => f.id === feedId ? { ...f, comments: feedItem.comments || [] } : f))
    }
  }

  // Format comment date
  const formatCommentDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Chicago"
      })
    } catch {
      return dateString
    }
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
    <div className="container mx-auto py-10 px-4 sm:px-6 pt-32 md:pt-24 max-w-7xl overflow-hidden">
      {/* Toast Notification */}
      <Toast toast={toast} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin">
            <Button variant="outline" className="mb-6 hover:bg-neutral-50">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div className="">
            <h1 className="max-w-3xl uppercase text-5xl md:text-6xl mb-3 font-black md:font-menda-black tracking-tight">
              The Feed
            </h1>
            <p className="max-w-xl text-lg text-neutral-600 mb-6">
              Manage and schedule content for <span className="font-semibold text-neutral-900">Digital Canvas</span>.
            </p>
            
            {/* Header Bar */}
            <div className="rounded-xl p-6 shadow-lg bg-linear-to-r from-black to-sky-500">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white text-lg font-bold">The Feed — Digital Canvas</h2>
                  <p className="text-white/80 text-sm mt-1">Content feed management</p>
                </div>
                <Button 
                  onClick={loadFeedItems} 
                  variant="outline" 
                  disabled={isLoading} 
                  size="sm"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tags - Only show when viewing */}
        {activeTab === "view" && (
            <div className="bg-white border border-neutral-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wide">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {["all", "draft", "published", "archived"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-3 py-1 text-xs font-semibold transition-all ${
                          filterStatus === status
                            ? status === "published"
                              ? "bg-green-600 text-white shadow-sm"
                              : status === "draft"
                              ? "bg-yellow-500 text-white shadow-sm"
                              : status === "archived"
                              ? "bg-neutral-600 text-white shadow-sm"
                              : "bg-sky-600 text-white shadow-sm"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                        }`}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wide">Type</label>
                  <div className="flex flex-wrap gap-2">
                    {["all", "newsletter", "video", "article", "podcast"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`px-3 py-1 text-xs font-semibold transition-all ${
                          filterType === type
                            ? type === "newsletter"
                              ? "bg-orange-600 text-white shadow-sm"
                              : type === "video"
                              ? "bg-purple-600 text-white shadow-sm"
                              : type === "article"
                              ? "bg-sky-600 text-white shadow-sm"
                              : type === "podcast"
                              ? "bg-pink-600 text-white shadow-sm"
                              : "bg-neutral-900 text-white shadow-sm"
                            : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                        }`}
                      >
                        {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-bold text-neutral-600 mb-2 uppercase tracking-wide">Date Range</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                      className="flex-1 px-2 py-1 border border-neutral-300 text-xs focus:ring-1 focus:ring-sky-500 focus:border-transparent"
                    />
                    <input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="flex-1 px-2 py-1 border border-neutral-300 text-xs focus:ring-1 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  {(dateFilter.start || dateFilter.end) && (
                    <button
                      onClick={() => setDateFilter({ start: "", end: "" })}
                      className="text-xs text-sky-600 hover:text-sky-700 mt-1 font-medium"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              </div>
              
              {/* Active Filter Summary */}
              {(filterStatus !== "all" || filterType !== "all" || dateFilter.start || dateFilter.end) && (
                <div className="mt-3 pt-3 border-t border-neutral-200">
                  <p className="text-xs text-neutral-600">
                    Showing <span className="font-bold text-neutral-900">{filteredFeedItems.length}</span> of <span className="font-bold text-neutral-900">{feedItems.length}</span> feeds
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Action Buttons - Below Filters */}
        <div className="flex gap-2 py-3 mb-6">
          <button
            onClick={() => setActiveTab("view")}
            className={`flex-1 md:flex-initial px-6 py-3.5 text-base font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "view" 
                ? "bg-neutral-900 text-white shadow-lg shadow-neutral-900/25 scale-[1.02]" 
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
            }`}
          >
            <List className={`h-5 w-5 ${activeTab === "view" ? "text-white" : "text-neutral-500"}`} />
            <span>View Feeds</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "view" 
                ? "bg-white/20 text-white" 
                : "bg-neutral-300 text-neutral-700"
            }`}>
              {feedItems.length}
            </span>
          </button>
          <button
            onClick={() => {
              setActiveTab("create")
              setEditingId(null)
            }}
            className={`flex-1 md:flex-initial px-6 py-3.5 text-base font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "create" 
                ? "bg-linear-to-r from-sky-600 to-sky-600 text-white shadow-lg shadow-sky-600/25 scale-[1.02]" 
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
            }`}
          >
            <FileText className={`h-5 w-5 ${activeTab === "create" ? "text-white" : "text-neutral-500"}`} />
            <span>{editingId ? "Edit Feed" : "Create New"}</span>
            {activeTab === "create" && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            )}
          </button>
        </div>

        {/* View Section */}
        {activeTab === "view" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
                <span className="ml-3 text-neutral-500">Loading feeds...</span>
              </div>
            ) : (
              <>
                {/* Feed Items Grid */}
                {filteredFeedItems.length === 0 ? (
                  <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center shadow-sm">
                    <Eye className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-neutral-900 mb-1">No feed items found</h3>
                    <p className="text-neutral-500 text-sm">
                      {feedItems.length === 0
                        ? "Get started by using the Create New button above."
                        : "No items match your current filters."}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {filteredFeedItems.map((item) => {
                      const displayImage = item.featured_post_image || item.hero_image_desktop || item.og_image
                      const isCommentOpen = !!(item.id && expandedFeedComments.has(item.id))
                      
                      return (
                        <React.Fragment key={item.id}>
                        <div
                          className={`bg-white border-2 rounded-lg overflow-hidden hover:shadow-md transition-all duration-200 group relative ${
                            isCommentOpen
                              ? "border-sky-400 shadow-lg shadow-sky-100/50 ring-2 ring-sky-200/50"
                              : "border-neutral-200 hover:border-neutral-300"
                          }`}
                        >
                          {/* Image - Always show (with fallback) */}
                          <div className="h-20 md:h-24 relative overflow-hidden bg-neutral-100">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  // Hide broken image and show fallback
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-6 w-6 text-neutral-300" />
                              </div>
                            )}
                            {/* Status indicator dot */}
                            <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm ${
                              item.status === "published" ? "bg-green-500" :
                              item.status === "draft" ? "bg-amber-500" : "bg-neutral-400"
                            }`} title={item.status} />
                          </div>
                          
                          {/* Content */}
                          <div className="p-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wide ${
                                item.type === "newsletter" ? "text-orange-600" :
                                item.type === "video" ? "text-purple-600" :
                                item.type === "article" ? "text-sky-600" :
                                "text-pink-600"
                              }`}>
                                {item.type}
                              </span>
                            </div>
                            
                            {/* Title */}
                            <h3 className="text-sm font-semibold text-neutral-900 leading-tight line-clamp-2 mb-1 group-hover:text-sky-600 transition-colors">
                              {item.title}
                            </h3>
                            
                            {/* Date */}
                            <p className="text-[11px] text-neutral-400 mb-2">
                              {formatDate(item.published_date)}
                            </p>
                            
                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleEdit(item)}
                                className="flex-1 px-2 py-1.5 text-[11px] font-medium text-neutral-600 bg-neutral-50 hover:bg-sky-50 hover:text-sky-600 rounded transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => item.id && toggleFeedComments(item.id)}
                                className={`px-2 py-1.5 text-[11px] font-medium rounded transition-colors flex items-center gap-1 ${
                                  isCommentOpen
                                    ? "bg-sky-500 text-white shadow-sm"
                                    : "text-neutral-400 hover:bg-sky-50 hover:text-sky-600"
                                }`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                {(item.comments?.length || 0) > 0 && (
                                  <span className="text-[10px]">{item.comments!.length}</span>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!)}
                                className="px-2 py-1.5 text-[11px] font-medium text-neutral-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>

                          {/* Arrow indicator when comments are open */}
                          {isCommentOpen && (
                            <div className="absolute -bottom-2.25 left-1/2 -translate-x-1/2 z-10">
                              <div className="w-4 h-4 bg-sky-50 border-b-2 border-r-2 border-sky-400 rotate-45 transform" />
                            </div>
                          )}
                        </div>

                        {/* Inline Comment Panel - appears directly below card's row via col-span-full */}
                        <AnimatePresence>
                          {isCommentOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                              className="col-span-full overflow-hidden"
                              ref={(el: HTMLDivElement | null) => {
                                if (el && item.id) {
                                  commentPanelRefs.current.set(item.id, el)
                                }
                              }}
                            >
                    <div className="bg-white border-2 border-sky-400 rounded-xl shadow-lg shadow-sky-100/30 overflow-hidden">
                      {/* Comment Header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-sky-50 border-b border-sky-200">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-lg bg-sky-100">
                            <MessageSquare className="h-4 w-4 text-sky-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-neutral-900">{item.title}</h4>
                            <p className="text-xs text-sky-600 font-medium">
                              {(item.comments?.length || 0)} comment{(item.comments?.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => item.id && toggleFeedComments(item.id)}
                          className="p-1.5 rounded-lg hover:bg-sky-100 transition-colors"
                        >
                          <X className="h-4 w-4 text-neutral-400" />
                        </button>
                      </div>

                      {/* Existing Comments */}
                      <div className="px-5 py-4 space-y-3 max-h-80 overflow-y-auto">
                        {item.comments && item.comments.length > 0 ? (
                          item.comments.map((comment) => (
                            <div key={comment.id} className="p-3 rounded-lg bg-neutral-50 border border-neutral-100 group">
                              <div className="flex items-start gap-2">
                                {comment.author_avatar ? (
                                  <img 
                                    src={comment.author_avatar} 
                                    alt={comment.author_name}
                                    className="w-8 h-8 rounded-full"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                                    <span className="text-xs font-medium text-neutral-600">
                                      {comment.author_name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-neutral-900">
                                        {comment.author_name}
                                      </span>
                                      <span className="text-xs text-neutral-500">
                                        {formatCommentDate(comment.created_at)}
                                        {comment.updated_at && comment.updated_at !== comment.created_at && (
                                          <span className="ml-1 text-neutral-400">(edited)</span>
                                        )}
                                      </span>
                                    </div>
                                    {/* Edit/Delete - only for comment author */}
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
                                              className="p-1 rounded hover:bg-neutral-200 transition-colors"
                                              title="Edit comment"
                                            >
                                              <Pencil className="w-3 h-3 text-neutral-400 hover:text-sky-600" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteComment(item.id!, comment.id)}
                                              className="p-1 rounded hover:bg-neutral-200 transition-colors"
                                              title="Delete comment"
                                            >
                                              <Trash2 className="w-3 h-3 text-neutral-400 hover:text-red-600" />
                                            </button>
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
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:border-sky-500 resize-y min-h-15 max-h-50"
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (editCommentContent.trim()) {
                                              handleEditComment(item.id!, comment.id, editCommentContent.trim())
                                            }
                                          }}
                                          disabled={!editCommentContent.trim()}
                                          className="px-2 py-1 bg-sky-600 text-white text-xs font-medium rounded hover:bg-sky-700 disabled:opacity-50"
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingCommentId(null)
                                            setEditCommentContent("")
                                          }}
                                          className="px-2 py-1 bg-neutral-200 text-neutral-700 text-xs font-medium rounded hover:bg-neutral-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-neutral-600 whitespace-pre-wrap">
                                      {(() => {
                                        const text = comment.content
                                        const parts: React.ReactNode[] = []
                                        const mentionRegex = /@(\S+(?:\s+\S+)*?)(?=\s{2}|$|\.|,|!|\?)/g
                                        let lastIndex = 0
                                        let match
                                        while ((match = mentionRegex.exec(text)) !== null) {
                                          if (match.index > lastIndex) {
                                            parts.push(text.slice(lastIndex, match.index))
                                          }
                                          parts.push(
                                            <span key={match.index} className="inline-flex items-center px-1 py-0.5 rounded bg-sky-50 text-sky-600 font-medium text-xs mx-0.5">
                                              {match[0]}
                                            </span>
                                          )
                                          lastIndex = match.index + match[0].length
                                        }
                                        if (lastIndex < text.length) {
                                          parts.push(text.slice(lastIndex))
                                        }
                                        return parts.length > 0 ? parts : text
                                      })()}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-neutral-400 text-center py-4">No comments yet</p>
                        )}
                      </div>

                      {/* Add Comment */}
                      {currentUser ? (
                        <div className="px-5 py-4 border-t border-neutral-200 bg-neutral-50/50">
                          <div className="flex gap-3">
                            <div className="shrink-0">
                              {currentUser.picture ? (
                                <img 
                                  src={currentUser.picture} 
                                  alt={currentUser.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-neutral-600">
                                    {currentUser.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <textarea
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-sky-500 focus:bg-white resize-y min-h-14 max-h-50"
                                placeholder="Add a comment... (use @name to mention someone)"
                              />
                              {/* Tag options helper - shows available team members for @-mention tagging */}
                              <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                                <span className="text-xs text-neutral-400 mr-1">Tag:</span>
                                {teamMembers.filter(m => {
                                  if (m.isActive === false) return false
                                  const nameLower = m.name.toLowerCase()
                                  const excludeNames = ["elon", "434mediamgr", "testing"]
                                  return !excludeNames.includes(nameLower)
                                }).map((member) => (
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
                                    className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-600 text-xs transition-colors"
                                    title={`Tag ${member.name}`}
                                  >
                                    @{member.name.split(' ')[0]}
                                  </button>
                                ))}
                              </div>
                              <div className="flex justify-between items-center">
                                <p className="text-xs text-neutral-500">
                                  Commenting as {currentUser.name}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handleAddComment(item.id!)}
                                  disabled={!newComment.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3" />
                                  Comment
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="px-5 py-3 border-t border-neutral-200">
                          <p className="text-sm text-neutral-400 text-center">
                            Sign in to leave comments
                          </p>
                        </div>
                      )}
                    </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        </React.Fragment>
                      )
                    })}
                  </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Create Section */}
        {activeTab === "create" && (
          <div className="relative">
            {/* Sticky Header Bar - Always visible while scrolling */}
            <div className="sticky top-16 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-neutral-200 shadow-sm mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Status & Info */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status:</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                      className={`px-3 py-1.5 text-sm font-semibold rounded-lg border-2 focus:ring-2 focus:ring-offset-1 focus:outline-none transition-all ${
                        formData.status === "published" 
                          ? "bg-green-50 border-green-300 text-green-700 focus:ring-green-500"
                          : formData.status === "draft"
                          ? "bg-amber-50 border-amber-300 text-amber-700 focus:ring-amber-500"
                          : "bg-neutral-50 border-neutral-300 text-neutral-700 focus:ring-neutral-500"
                      }`}
                    >
                      <option value="draft">📝 Draft</option>
                      <option value="published">✅ Published</option>
                      <option value="archived">📦 Archived</option>
                    </select>
                  </div>
                  
                  {/* Completion Indicator */}
                  {formData.type === "newsletter" && (
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-24 h-2 bg-neutral-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            getCompletionPercentage() === 100 
                              ? 'bg-green-500' 
                              : getCompletionPercentage() >= 50 
                                ? 'bg-sky-500' 
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${getCompletionPercentage()}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-neutral-500">
                        {getCompletionPercentage()}%
                      </span>
                    </div>
                  )}

                  {/* Draft indicator */}
                  {hasDraft && !editingId && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                      <Save className="h-3 w-3 mr-1" />
                      Draft saved
                    </Badge>
                  )}
                  
                  {/* Auto-save status indicator */}
                  {formData.status === "draft" && formData.title?.trim() && formData.summary?.trim() && (
                    <div className="flex items-center gap-2">
                      {isAutoSaving ? (
                        <Badge className="bg-sky-100 text-sky-700 border-sky-200 text-xs animate-pulse">
                          <Cloud className="h-3 w-3 mr-1" />
                          Saving to cloud...
                        </Badge>
                      ) : lastSavedAt ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Badge>
                      ) : hasUnsavedChanges ? (
                        <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Unsaved changes
                        </Badge>
                      ) : null}
                      
                      {/* Manual save button */}
                      {hasUnsavedChanges && !isAutoSaving && (
                        <button
                          type="button"
                          onClick={autoSaveToFirestore}
                          className="px-2 py-1 text-xs font-medium text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded transition-colors"
                        >
                          Save now
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      if (editingId) handleCancelEdit()
                      setActiveTab("view")
                    }}
                    className="text-neutral-600"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`font-semibold transition-all ${
                      editingId 
                        ? 'bg-sky-600 hover:bg-sky-700' 
                        : 'bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    } text-white shadow-md hover:shadow-lg`}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        {editingId ? "Updating..." : "Saving..."}
                      </>
                    ) : (
                      <>
                        {editingId ? (
                          <><Save className="h-4 w-4 mr-1.5" />Update</>
                        ) : formData.status === "published" ? (
                          <><Send className="h-4 w-4 mr-1.5" />Publish</>
                        ) : (
                          <><Save className="h-4 w-4 mr-1.5" />Save Draft</>
                        )}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Draft Notification */}
            {hasDraft && !editingId && (
              <div className="mb-4 p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-900">Draft Available</p>
                    <p className="text-sm text-amber-700">You have an unfinished feed item saved locally.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadDraft}
                    className="bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    Load Draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearDraft}
                    className="text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Section Toggle Controls */}
            {formData.type === "newsletter" && (
              <div className="mb-6">
                {/* Intro Panel for New Feeds */}
                {!editingId && !formData.title && (
                  <div className="mb-4 p-5 bg-linear-to-br from-sky-50 to-sky-50 border-2 border-sky-200 rounded-xl">
                    <h3 className="text-base font-bold text-sky-900 mb-2 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-sky-600" />
                      Creating a New Newsletter
                    </h3>
                    <p className="text-sm text-sky-700 leading-relaxed mb-3">
                      Fill out each section below to create your newsletter. Click on any section header to expand it. 
                      <strong>Required fields are marked with a red asterisk (*)</strong>.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-sky-700 border border-sky-200">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                        Active section
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-green-700 border border-green-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed section
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full text-neutral-600 border border-neutral-200">
                        <ChevronRight className="h-3 w-3" />
                        Collapsed section
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-semibold text-neutral-700">Newsletter Sections</span>
                    <span className="text-xs text-neutral-500">({openSections.size} expanded)</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={expandAllSections}
                      className="text-xs text-sky-600 hover:text-sky-700 font-semibold px-3 py-1.5 hover:bg-sky-100 rounded-lg transition-all border border-transparent hover:border-sky-200"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllSections}
                      className="text-xs text-neutral-500 hover:text-neutral-700 font-semibold px-3 py-1.5 hover:bg-neutral-200 rounded-lg transition-all border border-transparent hover:border-neutral-300"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic Information - Collapsible */}
              <CollapsibleSection
                id="basic"
                title="Basic Information"
                description="Title, type, summary, and publishing details"
                icon={<FileText className="h-5 w-5" />}
                isOpen={openSections.has("basic")}
                onToggle={() => toggleSection("basic")}
                isComplete={isSectionComplete("basic")}
              >
                <div className="space-y-4">
                  <PreviewField label="Title" value={formData.title} isPreview={previewMode && !!editingId} required>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => handleInputChange("title", e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent text-lg"
                        placeholder="Enter feed item title"
                        required
                      />
                    </div>
                  </PreviewField>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PreviewField label="Type" value={`${formData.type === 'video' ? '🎬' : formData.type === 'article' ? '📄' : formData.type === 'podcast' ? '🎙️' : '📰'} ${formData.type.charAt(0).toUpperCase() + formData.type.slice(1)}`} isPreview={previewMode && !!editingId}>
                      <div>
                        <label className="block text-sm font-medium mb-2">Type</label>
                        <select
                          value={formData.type}
                          onChange={(e) => handleInputChange("type", e.target.value)}
                          className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        >
                          <option value="video">🎬 Video</option>
                          <option value="article">📄 Article</option>
                          <option value="podcast">🎙️ Podcast</option>
                          <option value="newsletter">📰 Newsletter</option>
                        </select>
                      </div>
                    </PreviewField>

                    <PreviewField label="Published Date" value={formData.published_date} isPreview={previewMode && !!editingId}>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium mb-2">
                          <Calendar className="h-4 w-4" />
                          Published Date
                        </label>
                        <input
                          type="date"
                          value={formData.published_date}
                          onChange={(e) => handleInputChange("published_date", e.target.value)}
                          className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                        />
                      </div>
                    </PreviewField>
                  </div>

                  <PreviewField label="Summary" value={formData.summary} isPreview={previewMode && !!editingId} required isRichText>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Summary <span className="text-red-500">*</span>
                      </label>
                      <RichTextEditor
                        value={formData.summary}
                        onChange={(value: string) => handleInputChange("summary", value)}
                        placeholder="Enter a brief summary (supports Markdown)"
                        minRows={4}
                      />
                    </div>
                  </PreviewField>

                  <PreviewField label="Slug" value={formData.slug} isPreview={previewMode && !!editingId}>
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <LinkIcon className="h-4 w-4" />
                        Slug
                      </label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => handleInputChange("slug", e.target.value)}
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent font-mono text-sm"
                        placeholder="auto-generated-from-title"
                      />
                      <p className="text-xs text-neutral-500 mt-1">Auto-generated from title if left empty</p>
                    </div>
                  </PreviewField>
                </div>
              </CollapsibleSection>

              {/* Metadata - Collapsible */}
              <CollapsibleSection
                id="metadata"
                title="Metadata & Social Sharing"
                description="Authors, topics, and Open Graph settings for social previews"
                icon={<Tag className="h-5 w-5" />}
                isOpen={openSections.has("metadata")}
                onToggle={() => toggleSection("metadata")}
                isComplete={isSectionComplete("metadata")}
              >
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2 tracking-tight">
                        <Users className="h-4 w-4 text-neutral-500" />
                        Authors
                      </label>
                      <p className="text-xs text-neutral-500 mb-2 leading-relaxed">
                        Enter names separated by commas (e.g., Digital Canvas Team, Dev Team)
                      </p>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("authors", e.target.value)}
                        className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base transition-all"
                        placeholder="Digital Canvas Team, Dev Team"
                      />
                      {formData.authors.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {formData.authors.map((author, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-100 text-sky-800 text-sm font-medium rounded-full">
                              {author}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("authors", idx)}
                                className="ml-0.5 hover:text-sky-900 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-neutral-800 mb-2 tracking-tight">
                        <Tag className="h-4 w-4 text-neutral-500" />
                        Topics
                      </label>
                      <p className="text-xs text-neutral-500 mb-2 leading-relaxed">Enter tags separated by commas for categorization</p>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("topics", e.target.value)}
                        className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base transition-all"
                        placeholder="Technology, Design, Business"
                      />
                      {formData.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {formData.topics.map((topic, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-sm font-medium rounded-full">
                              {topic}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("topics", idx)}
                                className="ml-0.5 hover:text-emerald-900 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Open Graph Settings */}
                  <div className="pt-4 border-t border-neutral-200">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-linear-to-br from-sky-500 to-sky-600 rounded-lg">
                        <LinkIcon className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800">Open Graph Settings</h4>
                        <p className="text-xs text-neutral-500">Customize how this content appears when shared on social media</p>
                      </div>
                    </div>
                    
                    <div className="bg-linear-to-br from-sky-50 to-sky-100 rounded-xl p-5 border-2 border-sky-100 space-y-5">
                      {/* OG Title */}
                      <PreviewField label="OG Title" value={formData.og_title || ""} isPreview={previewMode && !!editingId}>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">
                            Social Title
                          </label>
                          <p className="text-xs text-neutral-500 mb-2 leading-relaxed">Custom title for social sharing. Leave empty to use the main title.</p>
                          <input
                            type="text"
                            value={formData.og_title || ""}
                            onChange={(e) => handleInputChange("og_title", e.target.value)}
                            className="w-full px-4 py-3 border-2 border-sky-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base transition-all"
                            placeholder={formData.title || "Enter social title..."}
                          />
                        </div>
                      </PreviewField>
                      
                      {/* OG Description */}
                      <PreviewField label="OG Description" value={formData.og_description || ""} isPreview={previewMode && !!editingId}>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">
                            Social Description
                          </label>
                          <p className="text-xs text-neutral-500 mb-2 leading-relaxed">Custom description for social sharing. Leave empty to use the summary. (Max 160 characters recommended)</p>
                          <textarea
                            value={formData.og_description || ""}
                            onChange={(e) => handleInputChange("og_description", e.target.value)}
                            className="w-full px-4 py-3 border-2 border-sky-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base transition-all resize-y min-h-20"
                            placeholder={formData.summary ? formData.summary.substring(0, 160) : "Enter social description..."}
                            maxLength={200}
                          />
                          <p className="text-xs text-neutral-400 mt-1 text-right">
                            {(formData.og_description || "").length}/200 characters
                          </p>
                        </div>
                      </PreviewField>
                      
                      {/* OG Image */}
                      <div>
                        <ImageUpload
                          value={formData.og_image || ""}
                          onChange={(value) => handleInputChange("og_image", value)}
                          label="Social Share Image (1200×630px)"
                          hideUrl
                        />
                        <p className="text-xs text-sky-600 mt-2 leading-relaxed">
                          <strong>Recommended:</strong> 1200×630 pixels (1.91:1 ratio). This image appears when your content is shared on Facebook, Twitter/X, LinkedIn, and other social platforms.
                        </p>
                      </div>
                      
                      {/* Preview Card */}
                      {(formData.og_image || formData.og_title || formData.title) && (
                        <div className="mt-4 pt-4 border-t border-sky-200">
                          <p className="text-xs font-semibold text-neutral-600 mb-3 uppercase tracking-wide">Social Preview</p>
                          <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm max-w-md">
                            {formData.og_image && (
                              <div className="aspect-[1.91/1] bg-neutral-100 overflow-hidden">
                                <img 
                                  src={formData.og_image} 
                                  alt="OG Preview" 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-3">
                              <p className="text-xs text-neutral-400 uppercase tracking-wide mb-1">digitalcanvas.community</p>
                              <h5 className="text-sm font-bold text-neutral-900 line-clamp-2 mb-1">
                                {formData.og_title || formData.title || "Your title here"}
                              </h5>
                              <p className="text-xs text-neutral-500 line-clamp-2">
                                {formData.og_description || formData.summary || "Your description will appear here..."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Newsletter-Specific Fields (conditional) */}
              {formData.type === "newsletter" && (
                <>
                  {/* Hero & Founder's Note - Collapsible */}
                  <CollapsibleSection
                    id="hero"
                    title="Hero & Founder's Note"
                    description="Hero images and opening message"
                    icon={<Star className="h-5 w-5" />}
                    isOpen={openSections.has("hero")}
                    onToggle={() => toggleSection("hero")}
                    isComplete={isSectionComplete("hero")}
                  >
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-neutral-500" />
                          Hero Images
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Upload separate hero images optimized for desktop and mobile devices.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <ImageUpload
                            value={formData.hero_image_desktop || ""}
                            onChange={(value) => handleInputChange("hero_image_desktop", value)}
                            label="Desktop Hero (Recommended: 1920x1080)"
                            hideUrl
                          />
                          <ImageUpload
                            value={formData.hero_image_mobile || ""}
                            onChange={(value) => handleInputChange("hero_image_mobile", value)}
                            label="Mobile Hero (Recommended: 1080x1350)"
                            hideUrl
                          />
                        </div>
                      </div>

                      <div className="border-t border-neutral-200 pt-6">
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <Edit className="h-4 w-4 text-neutral-500" />
                          Founder's Note
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">A personal message from the founders. This appears prominently in the newsletter.</p>
                        <PreviewField label="Founder's Note Content" value={formData.founders_note_text || ""} isPreview={previewMode && !!editingId} isRichText>
                          <div>
                            <RichTextEditor
                              value={formData.founders_note_text || ""}
                              onChange={(value: string) => handleInputChange("founders_note_text", value)}
                              placeholder="Enter founder's note content (supports Markdown)"
                              minRows={6}
                            />
                          </div>
                        </PreviewField>

                        <div className="mt-4">
                          <ImageUpload
                            value={formData.founders_note_image || ""}
                            onChange={(value) => handleInputChange("founders_note_image", value)}
                            label="Founder's Photo or Signature"
                            hideUrl
                          />
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* GIFs & Featured Post - Collapsible */}
                  <CollapsibleSection
                    id="sections"
                    title="Content Sections"
                    description="Last Month, The Drop, and Featured Post"
                    icon={<ImageIcon className="h-5 w-5" />}
                    isOpen={openSections.has("sections")}
                    onToggle={() => toggleSection("sections")}
                    isComplete={isSectionComplete("sections")}
                  >
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-neutral-500" />
                          GIF Animations
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Add animated GIFs for the "Last Month" and "The Drop" sections.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <ImageUpload
                            value={formData.last_month_gif || ""}
                            onChange={(value) => handleInputChange("last_month_gif", value)}
                            label="Last Month GIF"
                            hideUrl
                          />
                          <ImageUpload
                            value={formData.the_drop_gif || ""}
                            onChange={(value) => handleInputChange("the_drop_gif", value)}
                            label="The Drop GIF"
                            hideUrl
                          />
                        </div>
                      </div>

                      <div className="border-t border-neutral-200 pt-6">
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          Featured Post
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Highlight your most important content with a featured post section.</p>
                        <div className="space-y-5 bg-purple-50/50 rounded-xl p-5 border-2 border-purple-100">
                          <PreviewField label="Featured Post Title" value={formData.featured_post_title || ""} isPreview={previewMode && !!editingId}>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Title</label>
                              <input
                                type="text"
                                value={formData.featured_post_title || ""}
                                onChange={(e) => handleInputChange("featured_post_title", e.target.value)}
                                className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 text-base font-medium transition-all"
                                placeholder="Enter featured post title"
                              />
                            </div>
                          </PreviewField>
                          <ImageUpload
                            value={formData.featured_post_image || ""}
                            onChange={(value) => handleInputChange("featured_post_image", value)}
                            label="Featured Post Image"
                            hideUrl
                          />
                          <PreviewField label="Featured Post Content" value={formData.featured_post_content || ""} isPreview={previewMode && !!editingId} isRichText>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Content</label>
                              <p className="text-xs text-neutral-500 mb-2 leading-relaxed">Write the main content for your featured post. Supports Markdown.</p>
                              <RichTextEditor
                                value={formData.featured_post_content || ""}
                                onChange={(value: string) => handleInputChange("featured_post_content", value)}
                                placeholder="Featured post content (supports Markdown)"
                                minRows={6}
                              />
                            </div>
                          </PreviewField>
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Upcoming Event - Collapsible */}
                  <CollapsibleSection
                    id="event"
                    title="Upcoming Event"
                    description="Event details and call-to-action"
                    icon={<Calendar className="h-5 w-5" />}
                    isOpen={openSections.has("event")}
                    onToggle={() => toggleSection("event")}
                    isComplete={isSectionComplete("event")}
                  >
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-neutral-500" />
                          Event Details
                        </h4>
                        <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Promote your upcoming event with details and a clear call-to-action.</p>
                        
                        <PreviewField label="Event Title" value={formData.upcoming_event_title || ""} isPreview={previewMode && !!editingId}>
                          <div>
                            <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Event Title</label>
                            <input
                              type="text"
                              value={formData.upcoming_event_title || ""}
                              onChange={(e) => handleInputChange("upcoming_event_title", e.target.value)}
                              className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-medium transition-all"
                              placeholder="Enter event title"
                            />
                          </div>
                        </PreviewField>
                      </div>
                      
                      <PreviewField label="Event Description" value={formData.upcoming_event_description || ""} isPreview={previewMode && !!editingId} isRichText>
                        <div>
                          <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Event Description</label>
                          <p className="text-xs text-neutral-500 mb-2 leading-relaxed">Describe the event details, schedule, and what attendees can expect.</p>
                          <RichTextEditor
                            value={formData.upcoming_event_description || ""}
                            onChange={(value: string) => handleInputChange("upcoming_event_description", value)}
                            placeholder="Event description (supports Markdown)"
                            minRows={6}
                          />
                        </div>
                      </PreviewField>
                      
                      <div>
                        <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-neutral-500" />
                          Event Images
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <ImageUpload
                            value={formData.upcoming_event_image_desktop || ""}
                            onChange={(value) => handleInputChange("upcoming_event_image_desktop", value)}
                            label="Desktop Image (1920x1080)"
                            hideUrl
                          />
                          <ImageUpload
                            value={formData.upcoming_event_image_mobile || ""}
                            onChange={(value) => handleInputChange("upcoming_event_image_mobile", value)}
                            label="Mobile Image (1080x1350)"
                            hideUrl
                          />
                        </div>
                      </div>
                      
                      <div className="bg-sky-50/50 rounded-xl p-5 border-2 border-sky-100">
                        <h4 className="text-sm font-bold text-sky-800 mb-3 flex items-center gap-2">
                          <LinkIcon className="h-4 w-4" />
                          Call-to-Action Button
                        </h4>
                        <p className="text-xs text-sky-600 mb-4 leading-relaxed">Add a button that links to your event registration or details page.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <PreviewField label="Button Text" value={formData.upcoming_event_cta_text || ""} isPreview={previewMode && !!editingId}>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Button Text</label>
                              <input
                                type="text"
                                value={formData.upcoming_event_cta_text || ""}
                                onChange={(e) => handleInputChange("upcoming_event_cta_text", e.target.value)}
                                className="w-full px-4 py-3 border-2 border-sky-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-medium transition-all"
                                placeholder="Register Now"
                              />
                            </div>
                          </PreviewField>
                          <PreviewField label="Button Link" value={formData.upcoming_event_cta_link || ""} isPreview={previewMode && !!editingId}>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Button Link</label>
                              <input
                                type="url"
                                value={formData.upcoming_event_cta_link || ""}
                                onChange={(e) => handleInputChange("upcoming_event_cta_link", e.target.value)}
                                className="w-full px-4 py-3 border-2 border-sky-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-medium font-mono transition-all"
                                placeholder="https://example.com/register"
                              />
                            </div>
                          </PreviewField>
                        </div>
                      </div>
                    </div>
                  </CollapsibleSection>

                  {/* Spotlights - Collapsible */}
                  {[1, 2, 3].map((num) => (
                    <CollapsibleSection
                      key={num}
                      id={`spotlight${num}`}
                      title={`Spotlight ${num}`}
                      description={`Highlight section ${num} with image and call-to-action`}
                      icon={<Sparkles className="h-5 w-5" />}
                      isOpen={openSections.has(`spotlight${num}`)}
                      onToggle={() => toggleSection(`spotlight${num}`)}
                      isComplete={isSectionComplete(`spotlight${num}`)}
                    >
                      <div className="space-y-5">
                        <div>
                          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">Create a spotlight section to highlight specific content, products, or features.</p>
                          
                          <PreviewField label={`Spotlight ${num} Title`} value={formData[`spotlight_${num}_title` as keyof FeedFormData] as string || ""} isPreview={previewMode && !!editingId}>
                            <div>
                              <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Title</label>
                              <input
                                type="text"
                                value={formData[`spotlight_${num}_title` as keyof FeedFormData] as string || ""}
                                onChange={(e) => handleInputChange(`spotlight_${num}_title` as keyof FeedFormData, e.target.value)}
                                className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-medium transition-all"
                                placeholder={`Enter spotlight ${num} title`}
                              />
                            </div>
                          </PreviewField>
                        </div>
                        
                        <PreviewField label={`Spotlight ${num} Description`} value={formData[`spotlight_${num}_description` as keyof FeedFormData] as string || ""} isPreview={previewMode && !!editingId} isRichText>
                          <div>
                            <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Description</label>
                            <p className="text-xs text-neutral-500 mb-2 leading-relaxed">A brief description of what you're spotlighting. Supports Markdown.</p>
                            <RichTextEditor
                              value={formData[`spotlight_${num}_description` as keyof FeedFormData] as string || ""}
                              onChange={(value: string) => handleInputChange(`spotlight_${num}_description` as keyof FeedFormData, value)}
                              placeholder={`Spotlight ${num} description`}
                              minRows={4}
                            />
                          </div>
                        </PreviewField>
                        
                        <ImageUpload
                          value={formData[`spotlight_${num}_image` as keyof FeedFormData] as string || ""}
                          onChange={(value) => handleInputChange(`spotlight_${num}_image` as keyof FeedFormData, value)}
                          label={`Spotlight ${num} Image`}
                          hideUrl
                        />
                        
                        <div className="bg-neutral-50 rounded-xl p-5 border-2 border-neutral-200">
                          <h4 className="text-sm font-bold text-neutral-800 mb-3 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-neutral-500" />
                            Call-to-Action Button
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <PreviewField label="Button Text" value={formData[`spotlight_${num}_cta_text` as keyof FeedFormData] as string || ""} isPreview={previewMode && !!editingId}>
                              <div>
                                <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Button Text</label>
                                <input
                                  type="text"
                                  value={formData[`spotlight_${num}_cta_text` as keyof FeedFormData] as string || ""}
                                  onChange={(e) => handleInputChange(`spotlight_${num}_cta_text` as keyof FeedFormData, e.target.value)}
                                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-medium transition-all"
                                  placeholder="Learn More"
                                />
                              </div>
                            </PreviewField>
                            <PreviewField label="Button Link" value={formData[`spotlight_${num}_cta_link` as keyof FeedFormData] as string || ""} isPreview={previewMode && !!editingId}>
                              <div>
                                <label className="block text-sm font-semibold text-neutral-800 mb-2 tracking-tight">Button Link</label>
                                <input
                                  type="url"
                                  value={formData[`spotlight_${num}_cta_link` as keyof FeedFormData] as string || ""}
                                  onChange={(e) => handleInputChange(`spotlight_${num}_cta_link` as keyof FeedFormData, e.target.value)}
                                  className="w-full px-4 py-3 border-2 border-neutral-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-400 text-base font-mono transition-all"
                                  placeholder="https://example.com/link"
                                />
                              </div>
                            </PreviewField>
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>
                  ))}
                </>
              )}

              {/* Bottom Action Bar - For additional options */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-6 border-t border-neutral-200">
                <div className="flex flex-wrap gap-2">
                  {!editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadMockData}
                      className="text-purple-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Load Test Data
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
    </AdminRoleGuard>
  )
}
