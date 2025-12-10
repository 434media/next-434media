"use client"

import { useState, useEffect } from "react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { Button } from "../../components/analytics/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/analytics/Card"
import { Badge } from "../../components/analytics/Badge"

import { useToast } from "../../hooks/use-toast"
import { Loader2, Send, ArrowLeft, Calendar, FileText, Link as LinkIcon, Users, Tag, Image as ImageIcon, RefreshCw, Eye, List, Edit, Trash2, Save, X } from "lucide-react"
import Link from "next/link"
import { RichTextEditor } from "../../components/RichTextEditor"
import { ImageUpload } from "../../components/ImageUpload"

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

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
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

  // Filter feed items
  const filteredFeedItems = feedItems.filter((item) => {
    const statusMatch = filterStatus === "all" || item.status === filterStatus
    const typeMatch = filterType === "all" || item.type === filterType
    
    // Date range filtering
    let dateMatch = true
    if (dateFilter.start || dateFilter.end) {
      const itemDate = new Date(item.published_date)
      if (dateFilter.start) {
        const startDate = new Date(dateFilter.start)
        dateMatch = dateMatch && itemDate >= startDate
      }
      if (dateFilter.end) {
        const endDate = new Date(dateFilter.end)
        dateMatch = dateMatch && itemDate <= endDate
      }
    }
    
    return statusMatch && typeMatch && dateMatch
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
      
      // Determine if we're editing or creating
      const isEditing = editingId !== null
      const url = "/api/feed-submit"
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
      const response = await fetch(`/api/feed-submit?id=${id}`, {
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
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                <span className="ml-3 text-lg text-gray-500">Loading feeds...</span>
              </div>
            ) : (
              <>

                {/* Feed Items List */}
                {filteredFeedItems.length === 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-16 text-center shadow-sm">
                    <Eye className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">No feed items found</h3>
                    <p className="text-gray-500 text-lg">
                      {feedItems.length === 0
                        ? "Get started by using the Create New button above."
                        : "No items match your current filters. Try adjusting your filters or create a new feed item."}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {filteredFeedItems.map((item) => {
                      // Determine which image to display (priority: featured_post_image > hero_image_desktop > og_image)
                      const displayImage = item.featured_post_image || item.hero_image_desktop || item.og_image
                      
                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 group"
                        >
                          <div className="flex flex-col lg:flex-row">
                            {/* Featured Image */}
                            {displayImage && (
                              <div className="lg:w-80 h-56 lg:h-auto relative overflow-hidden bg-gray-100 flex-shrink-0">
                                <img
                                  src={displayImage}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                {/* Type badge overlay */}
                                <div className="absolute top-4 left-4">
                                  <Badge className={`${getTypeColor(item.type)} shadow-md text-xs px-3 py-1`}>
                                    {item.type.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            )}
                            
                            {/* Content */}
                            <div className="flex-1 p-6 lg:p-8">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-3">
                                    <Badge className={`${getStatusColor(item.status)} text-xs px-3 py-1`}>
                                      {item.status.toUpperCase()}
                                    </Badge>
                                    <span className="text-sm text-gray-500 flex items-center gap-1.5">
                                      <Calendar className="h-4 w-4" />
                                      {formatDate(item.published_date)}
                                    </span>
                                  </div>
                                  
                                  <h3 className="text-2xl font-bold mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                                    {item.title}
                                  </h3>
                                  
                                  <p className="text-base text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                                    {item.summary}
                                  </p>
                                  
                                  {/* Metadata */}
                                  <div className="space-y-3">
                                    {item.slug && (
                                      <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <LinkIcon className="h-4 w-4 flex-shrink-0" />
                                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{item.slug}</code>
                                      </div>
                                    )}
                                    
                                    {item.authors && item.authors.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Users className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <div className="flex flex-wrap gap-1.5">
                                          {item.authors.map((author, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs font-normal">
                                              {author}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {item.topics && item.topics.length > 0 && (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Tag className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                        <div className="flex flex-wrap gap-1.5">
                                          {item.topics.map((topic, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 border-blue-200">
                                              {topic}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                                <Button
                                  onClick={() => handleEdit(item)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleDelete(item.id!)}
                                  variant="outline"
                                  size="sm"
                                  className="flex items-center gap-2 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </Button>
                              </div>
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
          <div>
            {/* Draft Notification */}
            {hasDraft && !editingId && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Draft Available</p>
                    <p className="text-sm text-amber-700">You have an unfinished feed item saved.</p>
                    <p className="text-xs text-amber-600 italic mt-1">💾 Drafts are automatically saved to your browser's local storage as you type</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadDraft}
                    className="flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Load Draft
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearDraft}
                    className="flex items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                  >
                    <X className="h-4 w-4" />
                    Discard
                  </Button>
                </div>
              </div>
            )}

            {/* Auto-save Info - Show when no draft exists and not editing */}
            {!hasDraft && !editingId && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700 italic">
                  💾 Your progress is automatically saved to your browser's local storage as you type
                </p>
              </div>
            )}

            {/* Editing Notification */}
            {editingId && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Editing Feed Item</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel Edit
                </Button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>Essential details for the feed item</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="video">Video</option>
                        <option value="article">Article</option>
                        <option value="podcast">Podcast</option>
                        <option value="newsletter">Newsletter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => handleInputChange("status", e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Calendar className="h-4 w-4" />
                        Published Date
                      </label>
                      <input
                        type="date"
                        value={formData.published_date}
                        onChange={(e) => handleInputChange("published_date", e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="auto-generated-from-title"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Metadata
                  </CardTitle>
                  <CardDescription>Authors, topics, and images</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Users className="h-4 w-4" />
                        Authors (comma-separated)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Options: Digital Canvas Team, Dev Team, Creative Team, Podcast Team
                      </p>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("authors", e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Digital Canvas Team, Dev Team"
                      />
                      {formData.authors.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.authors.map((author, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {author}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("authors", idx)}
                                className="ml-1 hover:text-blue-900"
                                aria-label="Remove author"
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
                        Topics (comma-separated)
                      </label>
                      <input
                        type="text"
                        onChange={(e) => handleArrayInput("topics", e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Technology, Design, Business"
                      />
                      {formData.topics.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.topics.map((topic, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              {topic}
                              <button
                                type="button"
                                onClick={() => removeArrayItem("topics", idx)}
                                className="ml-1 hover:text-green-900"
                                aria-label="Remove topic"
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
                      label="OG Image"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Newsletter-Specific Fields (conditional) */}
              {formData.type === "newsletter" && (
                <>
                  {/* Hero & Founder's Note */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Newsletter Content - Hero & Founder's Note</CardTitle>
                      <CardDescription>Hero images and founder's note section</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <ImageUpload
                            value={formData.hero_image_desktop || ""}
                            onChange={(value) => handleInputChange("hero_image_desktop", value)}
                            label="Hero Image Desktop"
                          />
                        </div>
                        <div>
                          <ImageUpload
                            value={formData.hero_image_mobile || ""}
                            onChange={(value) => handleInputChange("hero_image_mobile", value)}
                            label="Hero Image Mobile"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Founder's Note Text</label>
                        <RichTextEditor
                          value={formData.founders_note_text || ""}
                          onChange={(value) => handleInputChange("founders_note_text", value)}
                          placeholder="Enter founder's note content (supports Markdown)"
                          minRows={4}
                        />
                      </div>

                      <div>
                        <ImageUpload
                          value={formData.founders_note_image || ""}
                          onChange={(value) => handleInputChange("founders_note_image", value)}
                          label="Founder's Note Image"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* GIFs & Featured Post */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Newsletter Content - Sections</CardTitle>
                      <CardDescription>Last Month, The Drop, and Featured Post</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <ImageUpload
                            value={formData.last_month_gif || ""}
                            onChange={(value) => handleInputChange("last_month_gif", value)}
                            label="Last Month GIF"
                          />
                        </div>
                        <div>
                          <ImageUpload
                            value={formData.the_drop_gif || ""}
                            onChange={(value) => handleInputChange("the_drop_gif", value)}
                            label="The Drop GIF"
                          />
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Featured Post</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Featured Post Title</label>
                            <input
                              type="text"
                              value={formData.featured_post_title || ""}
                              onChange={(e) => handleInputChange("featured_post_title", e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Featured post title"
                            />
                          </div>
                          <div>
                            <ImageUpload
                              value={formData.featured_post_image || ""}
                              onChange={(value) => handleInputChange("featured_post_image", value)}
                              label="Featured Post Image"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Featured Post Content</label>
                            <RichTextEditor
                              value={formData.featured_post_content || ""}
                              onChange={(value) => handleInputChange("featured_post_content", value)}
                              placeholder="Featured post content (supports Markdown)"
                              minRows={4}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Upcoming Event */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Newsletter Content - Upcoming Event</CardTitle>
                      <CardDescription>Event details and call-to-action</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Event Title</label>
                        <input
                          type="text"
                          value={formData.upcoming_event_title || ""}
                          onChange={(e) => handleInputChange("upcoming_event_title", e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                        <div>
                          <ImageUpload
                            value={formData.upcoming_event_image_desktop || ""}
                            onChange={(value) => handleInputChange("upcoming_event_image_desktop", value)}
                            label="Event Image Desktop"
                          />
                        </div>
                        <div>
                          <ImageUpload
                            value={formData.upcoming_event_image_mobile || ""}
                            onChange={(value) => handleInputChange("upcoming_event_image_mobile", value)}
                            label="Event Image Mobile"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">CTA Text</label>
                          <input
                            type="text"
                            value={formData.upcoming_event_cta_text || ""}
                            onChange={(e) => handleInputChange("upcoming_event_cta_text", e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Register Now"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">CTA Link</label>
                          <input
                            type="url"
                            value={formData.upcoming_event_cta_link || ""}
                            onChange={(e) => handleInputChange("upcoming_event_cta_link", e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://example.com/register"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Spotlights */}
                  {[1, 2, 3].map((num) => (
                    <Card key={num}>
                      <CardHeader>
                        <CardTitle>Spotlight {num}</CardTitle>
                        <CardDescription>Details for spotlight item {num}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Title</label>
                          <input
                            type="text"
                            value={formData[`spotlight_${num}_title` as keyof FeedFormData] as string || ""}
                            onChange={(e) => handleInputChange(`spotlight_${num}_title` as keyof FeedFormData, e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder={`Spotlight ${num} title`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Description</label>
                          <RichTextEditor
                            value={formData[`spotlight_${num}_description` as keyof FeedFormData] as string || ""}
                            onChange={(value) => handleInputChange(`spotlight_${num}_description` as keyof FeedFormData, value)}
                            placeholder={`Spotlight ${num} description (supports Markdown)`}
                            minRows={3}
                          />
                        </div>
                        <div>
                          <ImageUpload
                            value={formData[`spotlight_${num}_image` as keyof FeedFormData] as string || ""}
                            onChange={(value) => handleInputChange(`spotlight_${num}_image` as keyof FeedFormData, value)}
                            label="Image"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">CTA Text</label>
                            <input
                              type="text"
                              value={formData[`spotlight_${num}_cta_text` as keyof FeedFormData] as string || ""}
                              onChange={(e) => handleInputChange(`spotlight_${num}_cta_text` as keyof FeedFormData, e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Learn More"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">CTA Link</label>
                            <input
                              type="url"
                              value={formData[`spotlight_${num}_cta_link` as keyof FeedFormData] as string || ""}
                              onChange={(e) => handleInputChange(`spotlight_${num}_cta_link` as keyof FeedFormData, e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="https://example.com/link"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    if (editingId) {
                      handleCancelEdit()
                    }
                    setActiveTab("view")
                  }}>
                    Cancel
                  </Button>
                  {!editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadMockData}
                      className="flex items-center gap-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300"
                    >
                      <FileText className="h-4 w-4" />
                      Load Mock Data
                    </Button>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingId ? "Updating..." : "Submitting..."}
                    </>
                  ) : (
                    <>
                      {editingId ? <Save className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                      {editingId ? "Update Feed Item" : "Submit to Airtable"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  )
}
