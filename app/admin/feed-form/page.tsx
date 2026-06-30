"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"

import { Toast } from "@/components/crm/Toast"
import type { Toast as ToastType, CurrentUser } from "@/components/crm/types"
import { useTeamMembers } from "@/hooks/useTeamMembers"
import {
  Loader2,
  Send,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Eye,
  Trash2,
  X,
  Pencil,
  MessageSquare,
  ChevronRight,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { useFeedFormShortcuts, MOD_KEY_LABEL } from "@/components/admin/useFeedFormShortcuts"
import { FeedPrePublishChecklist } from "@/components/admin/FeedPrePublishChecklist"
import { FeedCardStatusMenu, formatRelative, formatScheduledIn } from "@/components/admin/FeedCardStatusMenu"
import { FeedFormBody } from "@/components/feed/FeedFormBody"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import type { FeedItem, FeedFormData, FeedStatus, FeedComment } from "@/components/feed/feed-types"

const FEED_TABLE = "THEFEED"

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
  // Shared roster (active Firestore members) for @-mention tagging — no seeds.
  const { members: teamMembers } = useTeamMembers()
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  // QA: interns get a read-only Feed — they can open the forms and slide-out to
  // see them, but persistence (publish/update/delete/comment) is blocked.
  const readOnly = currentUser?.role === "intern"
  const blockReadOnly = (): boolean => {
    if (readOnly) {
      setToast({ message: "Read-only access — changes aren't saved during QA.", type: "error" })
      return true
    }
    return false
  }
  
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

  // Smart-expand on fresh newsletter — when the user opens "Create New" with
  // no edit target and an empty title, auto-open the two sections they need
  // first (Basic Information + Hero & Founder's Note). Reduces an 8-click
  // scroll-and-expand startup to zero. Only fires when entering create mode
  // from outside; once they've started typing, we leave their state alone.
  useEffect(() => {
    if (activeTab !== "create") return
    if (editingId) return
    if (formData.title) return
    setOpenSections((prev) => {
      if (prev.size > 0) return prev
      return new Set(["basic", "hero"])
    })
  }, [activeTab, editingId, formData.title])

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
    // Auto-save fires when:
    // - Form has meaningful content (title AND summary)
    // - There are unsaved changes
    // - One of: editing an existing item (any status), OR creating a new draft
    //
    // For new items, status must be draft (we don't want autosave to silently
    // publish a half-finished new newsletter). For existing items being edited,
    // we preserve whatever status the user has set — typo fixes on a published
    // item save back as published.
    const isEditingExisting = !!editingId
    if (!isEditingExisting && formData.status !== "draft") return
    if (!formData.title?.trim() || !formData.summary?.trim()) return
    if (!hasUnsavedChanges && autoSaveDraftId) return

    const currentFormString = JSON.stringify(formData)
    if (currentFormString === lastSavedFormData.current) return

    setIsAutoSaving(true)
    try {
      // If we already have an autosave-draft ID or are editing an existing item,
      // PATCH; otherwise POST a new draft.
      const isUpdating = autoSaveDraftId !== null || isEditingExisting
      const method = isUpdating ? "PATCH" : "POST"
      const draftId = autoSaveDraftId || editingId

      // For new items the body forces status=draft. For existing-item edits we
      // preserve formData.status as-is.
      const body = isUpdating
        ? isEditingExisting
          ? { id: draftId, ...formData }
          : { id: draftId, ...formData, status: "draft" }
        : { ...formData, status: "draft" }

      const response = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const result = await response.json()

      if (result.success) {
        if (!isUpdating && result.data?.id) {
          setAutoSaveDraftId(result.data.id)
        }
        setLastSavedAt(new Date())
        setHasUnsavedChanges(false)
        lastSavedFormData.current = currentFormString
        loadFeedItems()
      }
    } catch (error) {
      console.error("Auto-save failed:", error)
    } finally {
      setIsAutoSaving(false)
    }
  }, [formData, autoSaveDraftId, editingId, hasUnsavedChanges])

  // Auto-save to Firestore every 30 seconds when there's content. Fires for
  // both create-mode drafts and existing-item edits in the drawer.
  useEffect(() => {
    const inEditFlow = activeTab === "create" || !!editingId
    if (!inEditFlow) return
    if (!formData.title?.trim() || !formData.summary?.trim()) return
    if (!editingId && formData.status !== "draft") return

    const autoSaveInterval = setInterval(() => {
      autoSaveToFirestore()
    }, 30000)

    return () => clearInterval(autoSaveInterval)
  }, [activeTab, editingId, formData.title, formData.summary, formData.status, autoSaveToFirestore])

  // Save to Firestore when leaving the page (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const eligible =
        formData.title?.trim() &&
        formData.summary?.trim() &&
        (!!editingId || formData.status === "draft")
      if (hasUnsavedChanges && eligible) {
        autoSaveToFirestore()
        e.preventDefault()
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?"
        return e.returnValue
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges, formData, editingId, autoSaveToFirestore])

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
        return "bg-sky-100 text-sky-800"
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

  // Keyboard shortcuts — only active in create/edit tab.
  // ⌘S saves (always); ⌘↩ publishes (sets status then saves); ⌘P opens preview
  // in a new tab (requires editingId — preview reads from saved data); Esc
  // cancels back to view.
  useFeedFormShortcuts({
    enabled: activeTab === "create",
    onSave: () => {
      if (isSubmitting) return
      handleSubmit({ preventDefault: () => {} } as React.FormEvent)
    },
    onPublish: () => {
      if (isSubmitting) return
      setFormData((prev) => ({ ...prev, status: "published" }))
      // Defer one tick so the status flip lands before submit
      setTimeout(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent), 0)
    },
    onPreview: () => {
      if (editingId) {
        window.open(`/admin/feed-form/preview/${editingId}`, "_blank", "noopener,noreferrer")
      } else {
        setToast({ message: "Save the item first to preview it", type: "error" })
      }
    },
    onCancel: () => {
      if (editingId) handleCancelEdit()
      setActiveTab("view")
    },
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
    if (blockReadOnly()) return

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
    // Edit-mode renders inside a drawer overlay — keep activeTab on "view"
    // so the list stays visible behind it.

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

  // Quick status change from a list card — PATCHes status only, optimistic UI
  // update with rollback on error. Saves the user a full edit-mode round-trip
  // for the most common state change (draft → published, published → archived).
  const handleQuickStatusChange = async (id: string, nextStatus: FeedStatus) => {
    const prev = feedItems
    setFeedItems((items) =>
      items.map((f) => (f.id === id ? { ...f, status: nextStatus } : f)),
    )
    try {
      const res = await fetch(`/api/feed-submit?table=${FEED_TABLE}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to update")
      setToast({ message: `Status set to ${nextStatus}`, type: "success" })
    } catch (err) {
      setFeedItems(prev)
      setToast({
        message: err instanceof Error ? err.message : "Failed to update status",
        type: "error",
      })
    }
  }

  // Delete a feed item
  const handleDelete = async (id: string) => {
    if (blockReadOnly()) return
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
    if (blockReadOnly()) return
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
    if (blockReadOnly()) return
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
    if (blockReadOnly()) return
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
    <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
    <div className="container mx-auto py-6 px-4 sm:px-6 max-w-7xl overflow-hidden">
      {/* Toast Notification */}
      <Toast toast={toast} />
      {readOnly && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
          <span className="font-semibold">Read-only.</span> You can open the editor and the new-post form to see them, but publishing, editing, and deleting are disabled.
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="mb-6 flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900">The Feed</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Content management for{" "}
              <span className="font-medium text-neutral-700">digitalcanvas.community/thefeed</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "create" && !editingId ? (
              <button
                type="button"
                onClick={() => setActiveTab("view")}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Back to feeds (Esc)"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Back to feeds
              </button>
            ) : (
              <>
                <button
                  onClick={loadFeedItems}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  title="Refresh"
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("create")
                    setEditingId(null)
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Create New Feed
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter Tags - Only show when viewing */}
        {activeTab === "view" && (
          <div className="bg-white rounded-md ring-1 ring-neutral-200/70 p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                  Status
                </p>
                <div className="inline-flex h-8 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
                  {["all", "draft", "scheduled", "published", "archived"].map((status) => {
                    const isActive = filterStatus === status
                    return (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`inline-flex items-center px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Type Filter */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                  Type
                </p>
                <div className="inline-flex h-8 rounded-md ring-1 ring-neutral-200 divide-x divide-neutral-200 overflow-hidden bg-white">
                  {["all", "newsletter", "video", "article", "podcast"].map((type) => {
                    const isActive = filterType === type
                    return (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`inline-flex items-center px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? "bg-neutral-900 text-white"
                            : "bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500 mb-2">
                  Date range
                </p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFilter.start}
                    onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                    className="flex-1 h-8 px-2 rounded-md ring-1 ring-neutral-200 bg-white text-xs text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={dateFilter.end}
                    onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                    className="flex-1 h-8 px-2 rounded-md ring-1 ring-neutral-200 bg-white text-xs text-neutral-900 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
                  />
                </div>
                {(dateFilter.start || dateFilter.end) && (
                  <button
                    onClick={() => setDateFilter({ start: "", end: "" })}
                    className="text-[11px] text-neutral-700 hover:text-neutral-900 mt-1.5 font-medium"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </div>

            {/* Active Filter Summary */}
            {(filterStatus !== "all" || filterType !== "all" || dateFilter.start || dateFilter.end) && (
              <div className="mt-3 pt-3 border-t border-neutral-100">
                <p className="text-xs text-neutral-500 tabular-nums">
                  Showing <span className="font-semibold text-neutral-900">{filteredFeedItems.length}</span>{" "}
                  of <span className="font-semibold text-neutral-900">{feedItems.length}</span> feeds
                </p>
              </div>
            )}
          </div>
        )}

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
                        ? 'Click "New newsletter" in the page header to get started.'
                        : "No items match your current filters."}
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredFeedItems.map((item) => {
                      const displayImage = item.featured_post_image || item.hero_image_desktop || item.og_image
                      const isCommentOpen = !!(item.id && expandedFeedComments.has(item.id))
                      const statusDot =
                        item.status === "published"
                          ? "bg-emerald-500"
                          : item.status === "scheduled"
                          ? "bg-blue-500"
                          : item.status === "draft"
                          ? "bg-amber-500"
                          : "bg-neutral-400"
                      const visibleTopics = item.topics?.slice(0, 2) ?? []
                      const extraTopicCount = (item.topics?.length ?? 0) - visibleTopics.length
                      const lastEdited = formatRelative(item.updated_at)

                      return (
                        <React.Fragment key={item.id}>
                        <div
                          className={`bg-white rounded-md ring-1 overflow-hidden transition-[box-shadow,outline-color] flex flex-col ${
                            isCommentOpen
                              ? "ring-neutral-900/40"
                              : "ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)]"
                          } group relative`}
                        >
                          {/* Image */}
                          <div className="aspect-video relative overflow-hidden bg-neutral-100">
                            {displayImage ? (
                              <img
                                src={displayImage}
                                alt={item.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none"
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="h-8 w-8 text-neutral-300" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-3 flex-1 flex flex-col">
                            {/* Type eyebrow + inline status menu */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 truncate">
                                <span className={`inline-block h-1 w-1 rounded-full ${statusDot}`} aria-hidden="true" />
                                {item.type}
                              </p>
                              {item.id && (
                                <FeedCardStatusMenu
                                  status={item.status}
                                  onChange={(next) => handleQuickStatusChange(item.id!, next)}
                                />
                              )}
                            </div>

                            <h3 className="text-sm font-medium text-neutral-900 leading-snug line-clamp-2 mb-1.5">
                              {item.title}
                            </h3>

                            {/* Authors line */}
                            {item.authors?.length > 0 && (
                              <p className="text-[11px] text-neutral-500 truncate mb-1.5">
                                <span className="text-neutral-400">By</span> {item.authors.join(", ")}
                              </p>
                            )}

                            {/* Topics chips */}
                            {visibleTopics.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {visibleTopics.map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 ring-1 ring-neutral-200 text-[10px] truncate max-w-32"
                                    title={t}
                                  >
                                    {t}
                                  </span>
                                ))}
                                {extraTopicCount > 0 && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 text-[10px] tabular-nums">
                                    +{extraTopicCount}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Date row + last-edited */}
                            <div className="flex items-center justify-between gap-2 text-[11px] text-neutral-500 tabular-nums mt-auto pt-2">
                              {item.status === "scheduled" && item.scheduled_at ? (
                                <span
                                  className="text-blue-600"
                                  title={new Date(item.scheduled_at).toLocaleString()}
                                >
                                  Publishes {formatScheduledIn(item.scheduled_at)}
                                </span>
                              ) : (
                                <span>{formatDate(item.published_date)}</span>
                              )}
                              {lastEdited && (
                                <span className="text-neutral-400" title={`Updated ${item.updated_at}`}>
                                  Updated {lastEdited}
                                </span>
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-1 mt-3">
                              <button
                                onClick={() => handleEdit(item)}
                                className="flex-1 h-7 px-2 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                              {item.id && (
                                <a
                                  href={`/admin/feed-form/preview/${item.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center h-7 w-7 text-neutral-500 ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 hover:text-neutral-900 rounded-md transition-colors"
                                  title="Preview"
                                  aria-label="Preview"
                                >
                                  <Eye className="h-3 w-3" />
                                </a>
                              )}
                              <button
                                onClick={() => item.id && toggleFeedComments(item.id)}
                                className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium transition-colors ${
                                  isCommentOpen
                                    ? "bg-neutral-900 text-white"
                                    : "text-neutral-500 ring-1 ring-neutral-200 bg-white hover:bg-neutral-50 hover:text-neutral-900"
                                }`}
                                title="Comments"
                              >
                                <MessageSquare className="h-3 w-3" />
                                {(item.comments?.length || 0) > 0 && (
                                  <span className="text-[10px] tabular-nums">{item.comments!.length}</span>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!)}
                                className="inline-flex items-center justify-center h-7 w-7 text-neutral-400 ring-1 ring-neutral-200 bg-white hover:bg-red-50 hover:text-red-600 hover:ring-red-200 rounded-md transition-colors"
                                title="Delete"
                                aria-label="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
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
                    <div className="bg-white rounded-md ring-1 ring-neutral-200/70 overflow-hidden">
                      {/* Comment Header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700">
                            <MessageSquare className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-neutral-900">{item.title}</h4>
                            <p className="text-[11px] text-neutral-500 tabular-nums">
                              {item.comments?.length || 0} comment{(item.comments?.length || 0) !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => item.id && toggleFeedComments(item.id)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
                          aria-label="Close"
                        >
                          <X className="h-4 w-4" />
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

        {/* Create Section (inline, full-page) — only when creating new and not
            editing an existing item. Edit-mode opens the drawer below instead. */}
        {activeTab === "create" && !editingId && (
          <FeedFormBody
            formData={formData}
            setFormData={setFormData}
            feedItems={feedItems}
            editingId={editingId}
            isSubmitting={isSubmitting}
            previewMode={previewMode}
            openSections={openSections}
            setOpenSections={setOpenSections}
            hasDraft={hasDraft}
            loadDraft={loadDraft}
            clearDraft={clearDraft}
            loadMockData={loadMockData}
            isAutoSaving={isAutoSaving}
            lastSavedAt={lastSavedAt}
            hasUnsavedChanges={hasUnsavedChanges}
            autoSaveToFirestore={autoSaveToFirestore}
            onSubmit={handleSubmit}
            onCancel={() => setActiveTab("view")}
            variant="page"
          />
        )}
      </motion.div>

      {/* Edit drawer — opens whenever an existing feed item is being edited.
          List stays visible behind it. Form renders without its own sticky
          header (drawer provides one) and without its inline action bar
          (drawer footer provides Save/Cancel). */}
      <DetailDrawer
        open={!!editingId}
        onClose={handleCancelEdit}
        title={formData.title || "Edit feed item"}
        subtitle={
          (() => {
            // Pull updated_at from the source-of-truth feedItems list — formData
            // doesn't carry it (the form payload omits server-managed fields).
            const editing = feedItems.find((f) => f.id === editingId)
            const lastEdited = formatRelative(editing?.updated_at)
            return (
              <span className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap">
                <span className="capitalize">{formData.type}</span>
                <span className="text-neutral-300">·</span>
                <span className="capitalize">{formData.status}</span>
                {lastEdited && (
                  <>
                    <span className="text-neutral-300">·</span>
                    <span title={editing?.updated_at}>Updated {lastEdited}</span>
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
              {editingId && (
                <a
                  href={`/admin/feed-form/preview/${editingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  title={`Preview (${MOD_KEY_LABEL}P)`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </a>
              )}
              {/* Pre-publish checklist surfaces here so warnings sit next to
                  the action that triggers them. Component self-hides when
                  status is draft. */}
              <FeedPrePublishChecklist
                formData={formData}
                feedItems={feedItems}
                editingId={editingId}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md ring-1 ring-neutral-200 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                title="Cancel (Esc)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                disabled={isSubmitting || readOnly}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors disabled:opacity-50"
                title={readOnly ? "Read-only — publishing is disabled" : `Update (${MOD_KEY_LABEL}S)`}
              >
                {isSubmitting ? (
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
        {editingId && (
          <FeedFormBody
            formData={formData}
            setFormData={setFormData}
            feedItems={feedItems}
            editingId={editingId}
            isSubmitting={isSubmitting}
            previewMode={previewMode}
            openSections={openSections}
            setOpenSections={setOpenSections}
            hasDraft={false}
            loadDraft={loadDraft}
            clearDraft={clearDraft}
            loadMockData={loadMockData}
            isAutoSaving={isAutoSaving}
            lastSavedAt={lastSavedAt}
            hasUnsavedChanges={hasUnsavedChanges}
            autoSaveToFirestore={autoSaveToFirestore}
            onSubmit={handleSubmit}
            onCancel={handleCancelEdit}
            variant="drawer"
          />
        )}
      </DetailDrawer>
    </div>
    </AdminRoleGuard>
  )
}
