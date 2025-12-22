"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"

import { useToast } from "../../hooks/use-toast"
import { Loader2, Send, ArrowLeft, Calendar, FileText, Link as LinkIcon, Users, Tag, Image as ImageIcon, RefreshCw, Eye, List, Edit, Trash2, Save, X, ChevronDown, ChevronRight, CheckCircle2, Circle, Sparkles, Star } from "lucide-react"
import Link from "next/link"
import { RichTextEditor } from "../../components/RichTextEditor"
import { ImageUpload } from "../../components/ImageUpload"

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
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${
      isOpen 
        ? 'border-blue-300 shadow-lg shadow-blue-100/50 bg-white' 
        : isComplete 
          ? 'border-green-200 bg-green-50/30 hover:border-green-300' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isOpen 
              ? 'bg-blue-100 text-blue-600' 
              : isComplete 
                ? 'bg-green-100 text-green-600' 
                : 'bg-gray-100 text-gray-500'
          }`}>
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${isOpen ? 'text-blue-900' : 'text-gray-900'}`}>
                {title}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isComplete && !isOpen && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
          <div className={`p-1 rounded-full transition-colors ${
            isOpen ? 'bg-blue-100' : 'bg-gray-100'
          }`}>
            {isOpen ? (
              <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'text-blue-600' : 'text-gray-400'}`} />
            ) : (
              <ChevronRight className={`h-5 w-5 ${isComplete ? 'text-green-500' : 'text-gray-400'}`} />
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
            <div className="px-5 pb-5 pt-2 border-t border-gray-100">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type FeedType = "video" | "article" | "podcast" | "newsletter"
type FeedStatus = "draft" | "published" | "archived"

// Brand feed configuration
interface BrandFeed {
  id: string
  name: string
  tableName: string
  description: string
}

const BRAND_FEEDS: BrandFeed[] = [
  {
    id: "digital-canvas",
    name: "The Feed - Digital Canvas",
    tableName: "thefeed",
    description: "Digital Canvas content feed"
  },
  {
    id: "vemos-vamos",
    name: "Culture Deck - Vemos Vamos",
    tableName: "culture_deck",
    description: "Vemos Vamos cultural content"
  },
  {
    id: "txmx-boxing",
    name: "8 Count - TXMX Boxing",
    tableName: "8_count",
    description: "TXMX Boxing updates"
  }
]

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
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [feedItems, setFeedItems] = useState<FeedItem[]>([])
  const [activeTab, setActiveTab] = useState<"view" | "create">("view")
  const [selectedBrand, setSelectedBrand] = useState<string>("digital-canvas")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: "", end: "" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [hasDraft, setHasDraft] = useState(false)
  
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

  // Load feed items on mount and when brand changes
  useEffect(() => {
    loadFeedItems()
  }, [selectedBrand])

  // Load feed items from Airtable
  const loadFeedItems = async () => {
    setIsLoading(true)
    try {
      const currentBrand = BRAND_FEEDS.find(b => b.id === selectedBrand)
      
      const response = await fetch(`/api/feed-submit?table=${currentBrand?.tableName || "thefeed"}`)

      const result = await response.json()

      if (result.success) {
        setFeedItems(result.data || [])
      } else {
        toast({
          title: "Error Loading Feeds",
          description: result.error || "Failed to load feed items",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error loading feeds:", error)
      toast({
        title: "Error",
        description: "Failed to load feed items from Airtable",
        variant: "destructive",
      })
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
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case "video":
        return "bg-purple-100 text-purple-800"
      case "article":
        return "bg-blue-100 text-blue-800"
      case "podcast":
        return "bg-pink-100 text-pink-800"
      case "newsletter":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
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
        toast({
          title: "Draft Loaded",
          description: "Your saved draft has been restored.",
          variant: "default",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load draft.",
          variant: "destructive",
        })
      }
    }
  }

  // Clear saved draft
  const clearDraft = () => {
    localStorage.removeItem("feedFormDraft")
    setHasDraft(false)
    toast({
      title: "Draft Cleared",
      description: "Saved draft has been removed.",
      variant: "default",
    })
  }

  // Save current form as draft
  const saveDraft = () => {
    localStorage.setItem("feedFormDraft", JSON.stringify(formData))
    setHasDraft(true)
    toast({
      title: "Draft Saved",
      description: "Your progress has been saved. You can come back later to finish.",
      variant: "default",
    })
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
    toast({
      title: "Mock Data Loaded",
      description: "Test data has been loaded into the form. You can now test the Airtable connection.",
      variant: "default",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.title || !formData.summary) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Title and Summary).",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const adminKey = sessionStorage.getItem("adminKey") || localStorage.getItem("adminKey")
      
      // Get current brand's table name
      const currentBrand = BRAND_FEEDS.find(b => b.id === selectedBrand)
      const tableName = currentBrand?.tableName || "thefeed"
      
      // Determine if we're editing or creating
      const isEditing = editingId !== null
      const url = `/api/feed-submit?table=${tableName}`
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
        toast({
          title: "Success!",
          description: isEditing 
            ? "Feed item has been updated successfully." 
            : "Feed item has been submitted to Airtable successfully.",
          variant: "default",
        })
        
        // Clear draft on successful submission
        localStorage.removeItem("feedFormDraft")
        setHasDraft(false)
        
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
        toast({
          title: isEditing ? "Update Failed" : "Submission Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit feed item",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Start editing a feed item
  const handleEdit = (item: FeedItem) => {
    setEditingId(item.id || null)
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
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingId(null)
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
      // Get current brand's table name
      const currentBrand = BRAND_FEEDS.find(b => b.id === selectedBrand)
      const tableName = currentBrand?.tableName || "thefeed"
      
      const response = await fetch(`/api/feed-submit?id=${id}&table=${tableName}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Deleted",
          description: "Feed item has been deleted successfully.",
          variant: "default",
        })
        
        // Reload feed items
        await loadFeedItems()
      } else {
        toast({
          title: "Delete Failed",
          description: result.error || "Unknown error occurred",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete feed item",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto py-10 px-4 sm:px-6 pt-32 md:pt-24 max-w-7xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin">
            <Button variant="outline" className="mb-6 hover:bg-gray-50">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-5xl md:text-6xl font-black mb-3 tracking-tight" style={{ fontFamily: 'var(--font-menda-black)' }}>
              THE FEED
            </h1>
            <p className="text-lg text-gray-600 mb-6">Manage content across all brand channels</p>
            
            {/* Brand Selector - Hero Element with Custom Gradients */}
            <div className={`rounded-xl p-6 shadow-lg transition-all ${
              selectedBrand === "digital-canvas" 
                ? "bg-gradient-to-r from-black to-sky-500"
                : selectedBrand === "vemos-vamos"
                ? "bg-gradient-to-r from-rose-500 to-red-600"
                : "bg-gradient-to-r from-black to-red-600"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-white text-sm font-semibold uppercase tracking-wide">Select Brand Feed</label>
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
              <select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value)
                  setActiveTab("view")
                }}
                className="w-full px-4 py-3 text-lg font-bold rounded-lg border-2 border-white bg-white text-gray-900 focus:ring-4 focus:ring-white/50 focus:outline-none"
              >
                {BRAND_FEEDS.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <p className="text-white/90 text-sm mt-2">
                {BRAND_FEEDS.find(b => b.id === selectedBrand)?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tags - Only show when viewing */}
        {activeTab === "view" && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Status</label>
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
                              ? "bg-gray-600 text-white shadow-sm"
                              : "bg-blue-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Type</label>
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
                              ? "bg-blue-600 text-white shadow-sm"
                              : type === "podcast"
                              ? "bg-pink-600 text-white shadow-sm"
                              : "bg-gray-900 text-white shadow-sm"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">Date Range</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="flex-1 px-2 py-1 border border-gray-300 text-xs focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {(dateFilter.start || dateFilter.end) && (
                    <button
                      onClick={() => setDateFilter({ start: "", end: "" })}
                      className="text-xs text-blue-600 hover:text-blue-700 mt-1 font-medium"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              </div>
              
              {/* Active Filter Summary */}
              {(filterStatus !== "all" || filterType !== "all" || dateFilter.start || dateFilter.end) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    Showing <span className="font-bold text-gray-900">{filteredFeedItems.length}</span> of <span className="font-bold text-gray-900">{feedItems.length}</span> feeds
                  </p>
                </div>
              )}
            </div>
          )}

        {/* Action Buttons - Below Filters */}
        <div className="flex gap-3 py-2">
          <button
            onClick={() => setActiveTab("view")}
            className={`flex-1 md:flex-initial px-6 py-3 text-base font-semibold rounded-lg border-2 bg-white text-black transition-all flex items-center justify-center ${
              activeTab === "view" ? "border-black" : "border-transparent hover:border-black"
            }`}
          >
            <List className="mr-2 h-5 w-5" />
            View Feeds ({feedItems.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("create")
              setEditingId(null)
            }}
            className={`flex-1 md:flex-initial px-6 py-3 text-base font-semibold rounded-lg bg-white text-black border-2 transition-all flex items-center justify-center ${
              activeTab === "create" ? "border-black" : "border-transparent hover:border-black"
            }`}
          >
            <FileText className="mr-2 h-5 w-5" />
            Create New
          </button>
        </div>

        {/* View Section */}
        {activeTab === "view" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-500">Loading feeds...</span>
              </div>
            ) : (
              <>
                {/* Feed Items Grid */}
                {filteredFeedItems.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
                    <Eye className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-gray-900 mb-1">No feed items found</h3>
                    <p className="text-gray-500 text-sm">
                      {feedItems.length === 0
                        ? "Get started by using the Create New button above."
                        : "No items match your current filters."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {filteredFeedItems.map((item) => {
                      const displayImage = item.featured_post_image || item.hero_image_desktop || item.og_image
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 hover:shadow-md transition-all duration-150 group"
                        >
                          {/* Image - Desktop only */}
                          {displayImage && (
                            <div className="hidden md:block h-24 relative overflow-hidden bg-gray-100">
                              <img
                                src={displayImage}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              {/* Status indicator dot */}
                              <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm ${
                                item.status === "published" ? "bg-green-500" :
                                item.status === "draft" ? "bg-amber-500" : "bg-gray-400"
                              }`} title={item.status} />
                            </div>
                          )}
                          
                          {/* Content */}
                          <div className="p-3">
                            {/* Header row */}
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wide ${
                                item.type === "newsletter" ? "text-orange-600" :
                                item.type === "video" ? "text-purple-600" :
                                item.type === "article" ? "text-blue-600" :
                                "text-pink-600"
                              }`}>
                                {item.type}
                              </span>
                              {/* Mobile status dot */}
                              <div className={`md:hidden w-2 h-2 rounded-full ${
                                item.status === "published" ? "bg-green-500" :
                                item.status === "draft" ? "bg-amber-500" : "bg-gray-400"
                              }`} title={item.status} />
                            </div>
                            
                            {/* Title */}
                            <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
                              {item.title}
                            </h3>
                            
                            {/* Date */}
                            <p className="text-[11px] text-gray-400 mb-2">
                              {formatDate(item.published_date)}
                            </p>
                            
                            {/* Action buttons */}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleEdit(item)}
                                className="flex-1 px-2 py-1.5 text-[11px] font-medium text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!)}
                                className="px-2 py-1.5 text-[11px] font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Create Section */}
        {activeTab === "create" && (
          <div className="relative">
            {/* Sticky Header Bar - Always visible while scrolling */}
            <div className="sticky top-16 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm mb-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left: Status & Info */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status:</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange("status", e.target.value)}
                      className={`px-3 py-1.5 text-sm font-semibold rounded-lg border-2 focus:ring-2 focus:ring-offset-1 focus:outline-none transition-all ${
                        formData.status === "published" 
                          ? "bg-green-50 border-green-300 text-green-700 focus:ring-green-500"
                          : formData.status === "draft"
                          ? "bg-amber-50 border-amber-300 text-amber-700 focus:ring-amber-500"
                          : "bg-gray-50 border-gray-300 text-gray-700 focus:ring-gray-500"
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
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            getCompletionPercentage() === 100 
                              ? 'bg-green-500' 
                              : getCompletionPercentage() >= 50 
                                ? 'bg-blue-500' 
                                : 'bg-amber-500'
                          }`}
                          style={{ width: `${getCompletionPercentage()}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-500">
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
                    className="text-gray-600"
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
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
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
              <div className="mb-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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

            {/* Editing Banner */}
            {editingId && (
              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Edit className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-blue-900">Editing Mode</p>
                    <p className="text-sm text-blue-700">Updating: {formData.title || "Untitled"}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              </div>
            )}

            {/* Section Toggle Controls */}
            {formData.type === "newsletter" && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-600">Newsletter Sections</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={expandAllSections}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded transition-colors"
                  >
                    Expand All
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={collapseAllSections}
                    className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      placeholder="Enter feed item title"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => handleInputChange("type", e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="video">🎬 Video</option>
                        <option value="article">📄 Article</option>
                        <option value="podcast">🎙️ Podcast</option>
                        <option value="newsletter">📰 Newsletter</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Calendar className="h-4 w-4" />
                        Published Date
                      </label>
                      <input
                        type="date"
                        value={formData.published_date}
                        onChange={(e) => handleInputChange("published_date", e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Summary <span className="text-red-500">*</span>
                    </label>
                    <RichTextEditor
                      value={formData.summary}
                      onChange={(value) => handleInputChange("summary", value)}
                      placeholder="Enter a brief summary (supports Markdown)"
                      minRows={4}
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <LinkIcon className="h-4 w-4" />
                      Slug
                    </label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleInputChange("slug", e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      placeholder="auto-generated-from-title"
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-generated from title if left empty</p>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Metadata - Collapsible */}
              <CollapsibleSection
                id="metadata"
                title="Metadata"
                description="Authors, topics, and social image"
                icon={<Tag className="h-5 w-5" />}
                isOpen={openSections.has("metadata")}
                onToggle={() => toggleSection("metadata")}
                isComplete={isSectionComplete("metadata")}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Users className="h-4 w-4" />
                        Authors
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Comma-separated: Digital Canvas Team, Dev Team, Creative Team
                      </p>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("authors", e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Digital Canvas Team, Dev Team"
                      />
                      {formData.authors.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.authors.map((author, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                              {author}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("authors", idx)}
                                className="ml-1 hover:text-blue-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Tag className="h-4 w-4" />
                        Topics
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Comma-separated tags</p>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("topics", e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Technology, Design, Business"
                      />
                      {formData.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.topics.map((topic, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-sm rounded-full">
                              {topic}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("topics", idx)}
                                className="ml-1 hover:text-emerald-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <ImageUpload
                      value={formData.og_image || ""}
                      onChange={(value) => handleInputChange("og_image", value)}
                      label="OG Image (Social Share)"
                    />
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
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUpload
                          value={formData.hero_image_desktop || ""}
                          onChange={(value) => handleInputChange("hero_image_desktop", value)}
                          label="Hero Image Desktop"
                        />
                        <ImageUpload
                          value={formData.hero_image_mobile || ""}
                          onChange={(value) => handleInputChange("hero_image_mobile", value)}
                          label="Hero Image Mobile"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Founder's Note</label>
                        <RichTextEditor
                          value={formData.founders_note_text || ""}
                          onChange={(value) => handleInputChange("founders_note_text", value)}
                          placeholder="Enter founder's note content (supports Markdown)"
                          minRows={4}
                        />
                      </div>

                      <ImageUpload
                        value={formData.founders_note_image || ""}
                        onChange={(value) => handleInputChange("founders_note_image", value)}
                        label="Founder's Note Image"
                      />
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUpload
                          value={formData.last_month_gif || ""}
                          onChange={(value) => handleInputChange("last_month_gif", value)}
                          label="Last Month GIF"
                        />
                        <ImageUpload
                          value={formData.the_drop_gif || ""}
                          onChange={(value) => handleInputChange("the_drop_gif", value)}
                          label="The Drop GIF"
                        />
                      </div>

                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          Featured Post
                        </h4>
                        <div className="space-y-4 bg-purple-50/50 rounded-lg p-4 border border-purple-100">
                          <div>
                            <label className="block text-sm font-medium mb-2">Title</label>
                            <input
                              type="text"
                              value={formData.featured_post_title || ""}
                              onChange={(e) => handleInputChange("featured_post_title", e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              placeholder="Featured post title"
                            />
                          </div>
                          <ImageUpload
                            value={formData.featured_post_image || ""}
                            onChange={(value) => handleInputChange("featured_post_image", value)}
                            label="Image"
                          />
                          <div>
                            <label className="block text-sm font-medium mb-2">Content</label>
                            <RichTextEditor
                              value={formData.featured_post_content || ""}
                              onChange={(value) => handleInputChange("featured_post_content", value)}
                              placeholder="Featured post content (supports Markdown)"
                              minRows={3}
                            />
                          </div>
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
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Event Title</label>
                        <input
                          type="text"
                          value={formData.upcoming_event_title || ""}
                          onChange={(e) => handleInputChange("upcoming_event_title", e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Event title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Event Description</label>
                        <RichTextEditor
                          value={formData.upcoming_event_description || ""}
                          onChange={(value) => handleInputChange("upcoming_event_description", value)}
                          placeholder="Event description (supports Markdown)"
                          minRows={3}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ImageUpload
                          value={formData.upcoming_event_image_desktop || ""}
                          onChange={(value) => handleInputChange("upcoming_event_image_desktop", value)}
                          label="Event Image Desktop"
                        />
                        <ImageUpload
                          value={formData.upcoming_event_image_mobile || ""}
                          onChange={(value) => handleInputChange("upcoming_event_image_mobile", value)}
                          label="Event Image Mobile"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 rounded-lg p-4 border border-blue-100">
                        <div>
                          <label className="block text-sm font-medium mb-2">CTA Button Text</label>
                          <input
                            type="text"
                            value={formData.upcoming_event_cta_text || ""}
                            onChange={(e) => handleInputChange("upcoming_event_cta_text", e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Register Now"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">CTA Link</label>
                          <input
                            type="url"
                            value={formData.upcoming_event_cta_link || ""}
                            onChange={(e) => handleInputChange("upcoming_event_cta_link", e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://example.com/register"
                          />
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
                      description={`Highlight section ${num} with image and CTA`}
                      icon={<Sparkles className="h-5 w-5" />}
                      isOpen={openSections.has(`spotlight${num}`)}
                      onToggle={() => toggleSection(`spotlight${num}`)}
                      isComplete={isSectionComplete(`spotlight${num}`)}
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Title</label>
                          <input
                            type="text"
                            value={formData[`spotlight_${num}_title` as keyof FeedFormData] as string || ""}
                            onChange={(e) => handleInputChange(`spotlight_${num}_title` as keyof FeedFormData, e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Spotlight ${num} title`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Description</label>
                          <RichTextEditor
                            value={formData[`spotlight_${num}_description` as keyof FeedFormData] as string || ""}
                            onChange={(value) => handleInputChange(`spotlight_${num}_description` as keyof FeedFormData, value)}
                            placeholder={`Spotlight ${num} description`}
                            minRows={2}
                          />
                        </div>
                        <ImageUpload
                          value={formData[`spotlight_${num}_image` as keyof FeedFormData] as string || ""}
                          onChange={(value) => handleInputChange(`spotlight_${num}_image` as keyof FeedFormData, value)}
                          label="Image"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div>
                            <label className="block text-sm font-medium mb-2">CTA Text</label>
                            <input
                              type="text"
                              value={formData[`spotlight_${num}_cta_text` as keyof FeedFormData] as string || ""}
                              onChange={(e) => handleInputChange(`spotlight_${num}_cta_text` as keyof FeedFormData, e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Learn More"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">CTA Link</label>
                            <input
                              type="url"
                              value={formData[`spotlight_${num}_cta_link` as keyof FeedFormData] as string || ""}
                              onChange={(e) => handleInputChange(`spotlight_${num}_cta_link` as keyof FeedFormData, e.target.value)}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="https://example.com/link"
                            />
                          </div>
                        </div>
                      </div>
                    </CollapsibleSection>
                  ))}
                </>
              )}

              {/* Bottom Action Bar - For additional options */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-6 border-t border-gray-200">
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
                <p className="text-xs text-gray-500 italic">
                  💾 Your work is auto-saved to browser storage
                </p>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}
