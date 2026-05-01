"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Loader2,
  BarChart3,
  Target,
  Users,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react"

// Import CRM components
import {
  Toast,
  DashboardView,
  PipelineView,
  OpportunitiesKanbanView,
  ClientsView,
  TasksView,
  SocialCalendarView,
  ClientDetailDrawer,
  OpportunityDetailDrawer,
  TaskDetailDrawer,
  ContentDetailDrawer,
  LinkedTasksPanel,
} from "@/components/crm"

import type {
  DashboardStats,
  PipelineColumn,
  Client,
  Task,
  ViewMode,
  Toast as ToastType,
  CurrentUser,
  TaskAttachment,
  CRMTag,
  ContentPost,
} from "@/components/crm/types"

import { useTaskHandlers, EMPTY_TASK_FORM } from "@/hooks/useTaskHandlers"
import type { TaskFormData } from "@/hooks/useTaskHandlers"
import { useClientHandlers, EMPTY_CLIENT_FORM, EMPTY_OPPORTUNITY_FORM } from "@/hooks/useClientHandlers"
import type { ClientFormData, OpportunityFormData } from "@/hooks/useClientHandlers"

export default function SalesCRMPage() {
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [isClientsLoaded, setIsClientsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastType | null>(null)

  // Data state
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pipeline, setPipeline] = useState<PipelineColumn[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [contentPosts, setContentPosts] = useState<ContentPost[]>([])
  
  // Content Post Modal state
  const [showContentPostForm, setShowContentPostForm] = useState(false)
  const [editingContentPost, setEditingContentPost] = useState<ContentPost | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [searchQuery, setSearchQuery] = useState("")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [opportunityAssigneeFilter, setOpportunityAssigneeFilter] = useState<string>("all")
  const [clientAssigneeFilter, setClientAssigneeFilter] = useState<string>("all")
  const [clientSourceFilter, setClientSourceFilter] = useState<string>("all")
  
  // Tags state
  const [availableTags, setAvailableTags] = useState<CRMTag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  // URL routing for deep-linkable detail drawer
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Client form state
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientForm, setClientForm] = useState<ClientFormData>(EMPTY_CLIENT_FORM)

  // Opportunity form state
  const [showOpportunityForm, setShowOpportunityForm] = useState(false)
  const [isEditingOpportunity, setIsEditingOpportunity] = useState(false)
  const [opportunityForm, setOpportunityForm] = useState<OpportunityFormData>(EMPTY_OPPORTUNITY_FORM)

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormData>(EMPTY_TASK_FORM)
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([])
  
  // Team members for dynamic email-to-name mapping
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, string>>({})
  
  // Linked tasks panel state (for stacked kanban cards)
  const [showLinkedTasksPanel, setShowLinkedTasksPanel] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [linkedClientForPanel, setLinkedClientForPanel] = useState<Client | null>(null)
  const [currentOpportunityForLinked, setCurrentOpportunityForLinked] = useState<Client | null>(null)
  const [taskOpenedFromLinkedPanel, setTaskOpenedFromLinkedPanel] = useState(false)

  // ======== Data loading functions (must be declared before hooks) ========

  // Load current user from session
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

  // Load team members for email-to-name mapping
  const loadTeamMembersMap = async () => {
    try {
      const response = await fetch("/api/admin/team-members")
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const map: Record<string, string> = {}
          for (const member of data.data) {
            if (member.email && member.name && member.isActive) {
              map[member.email.toLowerCase()] = member.name
            }
          }
          setTeamMembersMap(map)
        }
      }
    } catch (err) {
      console.error("Failed to load team members map:", err)
    }
  }

  const loadDashboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/crm")
      if (!response.ok) throw new Error("Failed to fetch CRM data")
      const data = await response.json()
      
      setStats(data.stats)
      setPipeline(data.pipeline || [])
      
      if (data.warning) {
        setToast({ message: data.warning, type: "error" })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load CRM data")
    } finally {
      setIsLoading(false)
    }
  }

  const loadClients = async () => {
    try {
      const response = await fetch("/api/admin/crm/clients")
      if (!response.ok) throw new Error("Failed to fetch clients")
      const data = await response.json()
      const allClients = data.clients || []
      
      const ARCHIVE_AFTER_DAYS = 60
      const archiveThreshold = new Date()
      archiveThreshold.setDate(archiveThreshold.getDate() - ARCHIVE_AFTER_DAYS)
      
      const opportunitiesToArchive = allClients.filter((c: Client) => 
        c.is_opportunity &&
        !c.is_archived &&
        (c.disposition === "closed_won" || c.disposition === "closed_lost") &&
        c.updated_at &&
        new Date(c.updated_at) < archiveThreshold
      )
      
      if (opportunitiesToArchive.length > 0) {
        console.log(`Auto-archiving ${opportunitiesToArchive.length} opportunities older than ${ARCHIVE_AFTER_DAYS} days`)
        
        opportunitiesToArchive.forEach((opp: Client) => {
          fetch("/api/admin/crm/clients", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              id: opp.id,
              is_archived: true,
              archived_at: new Date().toISOString(),
            }),
          }).catch(err => console.error("Failed to auto-archive opportunity:", err))
        })
        
        const archivedIds = new Set(opportunitiesToArchive.map((o: Client) => o.id))
        const updatedClients = allClients.map((c: Client) =>
          archivedIds.has(c.id)
            ? { ...c, is_archived: true, archived_at: new Date().toISOString() }
            : c
        )
        setClients(updatedClients)
      } else {
        setClients(allClients)
      }
      
      setIsClientsLoaded(true)
    } catch (err) {
      setToast({ message: "Failed to load clients", type: "error" })
      setIsClientsLoaded(true)
    }
  }

  const loadTasks = async () => {
    try {
      const response = await fetch("/api/admin/crm/tasks?all=true")
      if (!response.ok) throw new Error("Failed to fetch tasks")
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (err) {
      setToast({ message: "Failed to load tasks", type: "error" })
    }
  }

  const loadContentPosts = async () => {
    try {
      const response = await fetch("/api/admin/crm/content-posts")
      if (!response.ok) throw new Error("Failed to fetch content posts")
      const data = await response.json()
      setContentPosts(data.posts || [])
    } catch (err) {
      setToast({ message: "Failed to load content posts", type: "error" })
    }
  }

  const loadTags = async () => {
    setIsLoadingTags(true)
    try {
      const mailchimpResponse = await fetch("/api/mailchimp?endpoint=tags")
      let mailchimpTags: CRMTag[] = []
      if (mailchimpResponse.ok) {
        const mailchimpData = await mailchimpResponse.json()
        if (mailchimpData.success && mailchimpData.data?.tags) {
          mailchimpTags = mailchimpData.data.tags.map((tag: { id: string; name: string }) => ({
            id: `mailchimp_${tag.id}`,
            name: tag.name,
            color: "#f59e0b",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
        }
      }
      
      const crmResponse = await fetch("/api/admin/crm/tags")
      let crmTags: CRMTag[] = []
      if (crmResponse.ok) {
        const crmData = await crmResponse.json()
        crmTags = crmData.tags || []
      }
      
      const tagMap = new Map<string, CRMTag>()
      mailchimpTags.forEach(tag => tagMap.set(tag.name.toLowerCase(), tag))
      crmTags.forEach(tag => tagMap.set(tag.name.toLowerCase(), tag))
      
      const combinedTags = Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      setAvailableTags(combinedTags)
    } catch (err) {
      console.error("Failed to load tags:", err)
    } finally {
      setIsLoadingTags(false)
    }
  }

  const handleCreateTag = async (name: string): Promise<CRMTag | null> => {
    try {
      const response = await fetch("/api/admin/crm/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      })
      if (!response.ok) throw new Error("Failed to create tag")
      const data = await response.json()
      if (data.tag) {
        setAvailableTags(prev => {
          const exists = prev.some(t => t.id === data.tag.id)
          if (exists) return prev
          return [...prev, data.tag]
        })
        return data.tag
      }
      return null
    } catch (err) {
      console.error("Failed to create tag:", err)
      setToast({ message: "Failed to create tag", type: "error" })
      return null
    }
  }

  const loadPipeline = async () => {
    try {
      const response = await fetch("/api/admin/crm/opportunities?view=pipeline")
      if (!response.ok) throw new Error("Failed to fetch pipeline")
      const data = await response.json()
      setPipeline(data.pipeline || [])
    } catch (err) {
      setToast({ message: "Failed to load pipeline", type: "error" })
    }
  }

  // ======== Hooks: Task and Client handlers ========
  const {
    isSavingTask,
    isUploadingFile,
    openTaskModal,
    handleAddTask,
    handleOpenTaskFromNotification,
    handleDeleteTask,
    handleDeleteTeamTasks,
    handleSaveTask,
    handleFileUpload,
    handleRemoveAttachment,
    handleFileDrop,
    handleQuickStatusChange,
    handleUpdateTaskDisposition,
    handleAddLink,
    handleRemoveLink,
    toggleUserTag,
    handleAddComment,
    handleDeleteComment,
    handleEditComment,
  } = useTaskHandlers({
    tasks,
    setTasks,
    selectedTask,
    setSelectedTask,
    taskForm,
    setTaskForm,
    taskAttachments,
    setTaskAttachments,
    showTaskModal,
    setShowTaskModal,
    currentUser,
    setToast,
    newLink,
    setNewLink,
    newComment,
    setNewComment,
    assigneeFilter,
    loadTasks,
    taskOpenedFromLinkedPanel,
    setTaskOpenedFromLinkedPanel,
    currentOpportunityForLinked,
    setLinkedTasks,
    setShowLinkedTasksPanel,
    setViewMode,
  })

  // ---- Hook: Client/Opportunity/Content handlers ----
  const {
    isSaving,
    isSavingOpportunity,
    isSavingContentPost,
    handleSaveClient,
    handleSaveOpportunity,
    handleDeleteClient,
    handleArchiveOpportunity,
    handleRestoreOpportunity,
    handleUpdateClientDisposition,
    handleEditClient,
    handleEditOpportunity,
    handleStackedItemsClick,
    handleAddContentPost,
    handleOpenContentPost,
    handleOpenContentPostFromNotification,
    handleSaveContentPost,
    handleDeleteContentPost,
  } = useClientHandlers({
    clients,
    setClients,
    setToast,
    loadClients,
    loadDashboard,
    editingClient,
    setEditingClient,
    clientForm,
    setClientForm,
    showClientForm,
    setShowClientForm,
    opportunityForm,
    setOpportunityForm,
    isEditingOpportunity,
    setIsEditingOpportunity,
    showOpportunityForm,
    setShowOpportunityForm,
    contentPosts,
    setContentPosts,
    editingContentPost,
    setEditingContentPost,
    showContentPostForm,
    setShowContentPostForm,
    setCurrentOpportunityForLinked,
    setLinkedTasks,
    setLinkedClientForPanel,
    setShowLinkedTasksPanel,
    currentUser,
    setViewMode,
  })

  // ======== useEffects ========

  // Load data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      await loadDashboard()
      await Promise.all([
        loadClients(),
        loadTeamMembersMap(),
        loadTasks(),
      ])
    }
    loadInitialData()
    loadCurrentUser()
    loadTags()
  }, [])

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Check for task or content post to open from notification (from admin top bar)
  useEffect(() => {
    if (!isLoading && tasks.length > 0) {
      const storedTaskId = sessionStorage.getItem("openTaskId")
      if (storedTaskId) {
        sessionStorage.removeItem("openTaskId")
        handleOpenTaskFromNotification(storedTaskId)
      }
      const storedContentPostId = sessionStorage.getItem("openContentPostId")
      if (storedContentPostId) {
        sessionStorage.removeItem("openContentPostId")
        handleOpenContentPostFromNotification(storedContentPostId)
      }
    }
  }, [isLoading, tasks])

  // URL-driven Client drawer open state. ?open=<clientId> opens the drawer for
  // that client (used by Customer 360 cross-section pills, notification
  // deep-links, and refresh-restores-place behavior). When the drawer is open
  // for a different client, replacing the URL swaps which client is shown.
  const openClientId = searchParams?.get("open") ?? null
  useEffect(() => {
    if (!openClientId) {
      // URL says no drawer should be open. If our local state is open, close it.
      if (showClientForm) {
        setShowClientForm(false)
        setEditingClient(null)
      }
      return
    }
    // URL has ?open= but the matching client may not be loaded yet. Wait.
    if (clients.length === 0) return
    const target = clients.find((c) => c.id === openClientId)
    if (!target) return // client doesn't exist or isn't visible to this user
    if (editingClient?.id === openClientId && showClientForm) return // already open on this client
    handleEditClient(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openClientId, clients])

  // Helper: close the drawer AND strip ?open= from the URL
  const closeClientDrawer = () => {
    setShowClientForm(false)
    setEditingClient(null)
    if (searchParams?.get("open")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("open")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  // Keep ?open= in sync when the drawer opens via direct interaction
  // (clicking a row in any view). Refresh / share / back button restores it.
  useEffect(() => {
    if (!showClientForm || !editingClient?.id) return
    if (searchParams?.get("open") === editingClient.id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("open", editingClient.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showClientForm, editingClient?.id])

  // ?tab=<view> drives which tab renders. Lets the command palette and shared
  // links land directly on Pipeline / Tasks / Social Calendar without a click.
  const tabParam = searchParams?.get("tab") ?? null
  useEffect(() => {
    if (!tabParam) return
    const allowed: ViewMode[] = ["dashboard", "pipeline", "clients", "tasks", "social-calendar"]
    if (allowed.includes(tabParam as ViewMode) && tabParam !== viewMode) {
      setViewMode(tabParam as ViewMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam])

  // ?new=<entity> opens an empty create drawer (command palette quick actions).
  // Strip the param immediately so re-renders don't reopen it after the user closes.
  const newParam = searchParams?.get("new") ?? null
  useEffect(() => {
    if (!newParam) return
    if (newParam === "client") {
      setEditingClient(null)
      setClientForm({
        company_name: "",
        department: "",
        contacts: [],
        status: "prospect",
        next_followup_date: "",
        notes: "",
        source: "",
        is_opportunity: false,
        opportunity_id: "",
        assigned_to: currentUser?.name || "",
      })
      setShowClientForm(true)
    } else if (newParam === "opportunity") {
      setIsEditingOpportunity(false)
      setOpportunityForm({
        company_name: "",
        existing_company_id: null,
        linked_company_id: null,
        contacts: [],
        title: "",
        status: "prospect",
        brand: "",
        pitch_value: "",
        next_followup_date: "",
        assigned_to: currentUser?.name || "",
        notes: "",
        source: "",
        is_opportunity: true,
        disposition: "pitched",
        doc: "",
        web_links: [],
        docs: [],
      })
      setShowOpportunityForm(true)
    } else if (newParam === "task") {
      handleAddTask()
    } else if (newParam === "content") {
      handleAddContentPost()
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("new")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam])

  // ?openOpportunity=<id> mirrors ?open= for opportunities. Same lifecycle:
  // wait for clients to load, find the matching opportunity, hand it to the
  // edit handler. opportunityForm.existing_company_id tracks which one is open.
  const openOpportunityId = searchParams?.get("openOpportunity") ?? null
  useEffect(() => {
    if (!openOpportunityId) {
      if (showOpportunityForm) {
        setShowOpportunityForm(false)
        setIsEditingOpportunity(false)
      }
      return
    }
    if (clients.length === 0) return
    const target = clients.find((c) => c.id === openOpportunityId && c.is_opportunity)
    if (!target) return
    if (opportunityForm.existing_company_id === openOpportunityId && showOpportunityForm) return
    handleEditOpportunity(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOpportunityId, clients])

  const closeOpportunityDrawer = () => {
    setShowOpportunityForm(false)
    setIsEditingOpportunity(false)
    if (searchParams?.get("openOpportunity")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("openOpportunity")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  useEffect(() => {
    if (!showOpportunityForm || !opportunityForm.existing_company_id) return
    if (searchParams?.get("openOpportunity") === opportunityForm.existing_company_id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("openOpportunity", opportunityForm.existing_company_id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOpportunityForm, opportunityForm.existing_company_id])

  // ?openTask=<id> — same pattern, against the tasks[] array.
  const openTaskId = searchParams?.get("openTask") ?? null
  useEffect(() => {
    if (!openTaskId) {
      if (showTaskModal) {
        setShowTaskModal(false)
        setSelectedTask(null)
      }
      return
    }
    if (tasks.length === 0) return
    const target = tasks.find((t) => t.id === openTaskId)
    if (!target) return
    if (selectedTask?.id === openTaskId && showTaskModal) return
    openTaskModal(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTaskId, tasks])

  const closeTaskDrawer = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
    setTaskOpenedFromLinkedPanel(false)
    setTaskForm(EMPTY_TASK_FORM)
    setNewLink("")
    setNewComment("")
    setTaskAttachments([])
    if (searchParams?.get("openTask")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("openTask")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  useEffect(() => {
    if (!showTaskModal || !selectedTask?.id) return
    if (searchParams?.get("openTask") === selectedTask.id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("openTask", selectedTask.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskModal, selectedTask?.id])

  // ?openContent=<id> — same pattern, against the contentPosts[] array.
  // Note contentPosts only loads when viewMode === "social-calendar", so the
  // ?tab= sync above must run first to populate the array.
  const openContentId = searchParams?.get("openContent") ?? null
  useEffect(() => {
    if (!openContentId) {
      if (showContentPostForm) {
        setShowContentPostForm(false)
        setEditingContentPost(null)
      }
      return
    }
    if (contentPosts.length === 0) return
    const target = contentPosts.find((p) => p.id === openContentId)
    if (!target) return
    if (editingContentPost?.id === openContentId && showContentPostForm) return
    handleOpenContentPost(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContentId, contentPosts])

  const closeContentDrawer = () => {
    setShowContentPostForm(false)
    setEditingContentPost(null)
    if (searchParams?.get("openContent")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("openContent")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  useEffect(() => {
    if (!showContentPostForm || !editingContentPost?.id) return
    if (searchParams?.get("openContent") === editingContentPost.id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("openContent", editingContentPost.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showContentPostForm, editingContentPost?.id])

  // Set default assignee filter based on logged-in user
  useEffect(() => {
    if (currentUser?.email && Object.keys(teamMembersMap).length > 0) {
      const matchedName = teamMembersMap[currentUser.email.toLowerCase()]
      if (matchedName) {
        setAssigneeFilter(matchedName)
        setOpportunityAssigneeFilter(matchedName)
        setClientAssigneeFilter(matchedName)
      } else if (currentUser.name) {
        setAssigneeFilter(currentUser.name)
        setOpportunityAssigneeFilter(currentUser.name)
        setClientAssigneeFilter(currentUser.name)
      }
    }
  }, [currentUser, teamMembersMap])

  // Handle view changes
  useEffect(() => {
    if (viewMode === "dashboard") {
      loadDashboard()
      loadClients()
      loadTasks()
    } else if (viewMode === "clients") {
      loadClients()
    } else if (viewMode === "tasks") {
      loadTasks()
    } else if (viewMode === "pipeline") {
      loadPipeline()
      loadClients()
      loadTasks()
    } else if (viewMode === "social-calendar") {
      loadContentPosts()
    }
  }, [viewMode])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Loading CRM...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      {/* Toast */}
      <Toast toast={toast} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-neutral-200 pb-4">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3, badge: null },
            { id: "pipeline", label: "Opportunities", icon: Target, badge: null },
            { id: "clients", label: "Clients", icon: Users, badge: null },
            { id: "tasks", label: "Tasks", icon: CheckCircle2, badge: null },
            { id: "social-calendar", label: "Social Calendar", icon: Calendar, badge: null },
          ].map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setViewMode(id as ViewMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === id
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700 border border-amber-200">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 rounded-lg bg-red-50 border border-red-200 text-red-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Dashboard View - wait for clients to be loaded for accurate budget calculations */}
        {viewMode === "dashboard" && stats && isClientsLoaded && (
          <DashboardView 
            stats={stats} 
            pipeline={pipeline}
            clients={clients}
            tasks={tasks}
            onViewChange={setViewMode}
            onShowClientForm={() => setShowClientForm(true)}
            onClientClick={handleEditClient}
            onOpportunityClick={handleEditOpportunity}
            onTaskClick={openTaskModal}
            currentUser={currentUser}
          />
        )}

        {/* Dashboard loading state */}
        {viewMode === "dashboard" && (!stats || !isClientsLoaded) && !isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-neutral-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading dashboard data...</span>
            </div>
          </div>
        )}

        {/* Opportunities Kanban View */}
        {viewMode === "pipeline" && (
          <OpportunitiesKanbanView 
            clients={clients}
            tasks={tasks}
            assigneeFilter={opportunityAssigneeFilter}
            onAssigneeFilterChange={setOpportunityAssigneeFilter}
            onRefresh={() => {
              loadClients()
              loadTasks()
            }}
            onClientClick={handleEditClient}
            onOpportunityClick={handleEditOpportunity}
            onStackedItemsClick={handleStackedItemsClick}
            onTaskClick={openTaskModal}
            onUpdateClientDisposition={handleUpdateClientDisposition}
            onUpdateTaskDisposition={handleUpdateTaskDisposition}
            onRestoreOpportunity={handleRestoreOpportunity}
            currentUserName={opportunityAssigneeFilter !== "all" ? opportunityAssigneeFilter : undefined}
            onAddOpportunity={() => {
              // Reset the opportunity form and show modal for NEW opportunity
              setIsEditingOpportunity(false)
              setOpportunityForm({
                company_name: "",
                existing_company_id: null,
                linked_company_id: null,
                contacts: [],
                title: "",
                status: "prospect",
                brand: "",
                pitch_value: "",
                next_followup_date: "",
                assigned_to: "",
                notes: "",
                source: "",
                is_opportunity: true,
                disposition: "pitched",
                doc: "",
                web_links: [],
                docs: [],
              })
              setShowOpportunityForm(true)
            }}
          />
        )}

        {/* Clients View */}
        {viewMode === "clients" && (
          <ClientsView
            clients={clients}
            searchQuery={searchQuery}
            sourceFilter={clientSourceFilter}
            assigneeFilter={clientAssigneeFilter}
            onSearchChange={setSearchQuery}
            onSourceFilterChange={setClientSourceFilter}
            onAssigneeFilterChange={setClientAssigneeFilter}
            onAddClient={() => {
              setEditingClient(null)
              setClientForm({ company_name: "", department: "", contacts: [], status: "prospect", next_followup_date: "", notes: "", source: "", is_opportunity: false, opportunity_id: "", assigned_to: currentUser?.name || "" })
              setShowClientForm(true)
            }}
            onEditClient={handleEditClient}
            onDeleteClient={handleDeleteClient}
          />
        )}

        {/* Tasks View */}
        {viewMode === "tasks" && (
          <TasksView
            tasks={tasks}
            searchQuery={searchQuery}
            brandFilter={brandFilter}
            assigneeFilter={assigneeFilter}
            onSearchChange={setSearchQuery}
            onBrandFilterChange={setBrandFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            onAddTask={handleAddTask}
            onOpenTask={openTaskModal}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}

        {/* Social Calendar View */}
        {viewMode === "social-calendar" && (
          <SocialCalendarView
            contentPosts={contentPosts}
            onOpenPost={handleOpenContentPost}
            onAddPost={handleAddContentPost}
          />
        )}
      </div>

      {/* Content Post Detail Drawer */}
      <ContentDetailDrawer
        open={showContentPostForm}
        post={editingContentPost}
        isSaving={isSavingContentPost}
        currentUser={currentUser}
        onSave={handleSaveContentPost}
        onDelete={editingContentPost ? handleDeleteContentPost : undefined}
        onClose={closeContentDrawer}
      />

      {/* Client Detail Drawer */}
      <ClientDetailDrawer
        open={showClientForm}
        isEditing={!!editingClient}
        isSaving={isSaving}
        formData={clientForm}
        opportunities={clients.filter(c => c.is_opportunity).map(c => ({ id: c.id, company_name: c.company_name, title: c.title }))}
        onFormChange={setClientForm}
        onSave={handleSaveClient}
        onClose={() => closeClientDrawer()}
        clientId={editingClient?.id ?? null}
      />

      {/* Opportunity Detail Drawer */}
      <OpportunityDetailDrawer
        open={showOpportunityForm}
        isSaving={isSavingOpportunity}
        existingClients={clients}
        formData={opportunityForm}
        isEditing={isEditingOpportunity}
        onFormChange={setOpportunityForm}
        onSave={handleSaveOpportunity}
        onClose={closeOpportunityDrawer}
        onArchive={opportunityForm.existing_company_id ? () => handleArchiveOpportunity(opportunityForm.existing_company_id!) : undefined}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        open={showTaskModal}
        task={selectedTask}
        formData={taskForm}
        attachments={taskAttachments}
        opportunities={clients.filter(c => c.is_opportunity && c.disposition !== "closed_lost").map(c => ({ id: c.id, company_name: c.company_name, title: c.title }))}
        clients={clients.map(c => ({ id: c.id, company_name: c.company_name, name: c.name }))}
        currentUser={currentUser}
        isSaving={isSavingTask}
        isUploadingFile={isUploadingFile}
        newLink={newLink}
        newComment={newComment}
        showBackButton={taskOpenedFromLinkedPanel}
        onBackToLinkedItems={() => {
          setShowTaskModal(false)
          setSelectedTask(null)
          setTaskOpenedFromLinkedPanel(false)
          setShowLinkedTasksPanel(true)
        }}
        onFormChange={setTaskForm}
        onNewLinkChange={setNewLink}
        onNewCommentChange={setNewComment}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
        onToggleUserTag={toggleUserTag}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onEditComment={handleEditComment}
        onFileUpload={handleFileUpload}
        onFileDrop={handleFileDrop}
        onRemoveAttachment={handleRemoveAttachment}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={closeTaskDrawer}
      />

      {/* Linked Items Panel */}
      {showLinkedTasksPanel && (linkedTasks.length > 0 || linkedClientForPanel) && (
        <LinkedTasksPanel
          linkedTasks={linkedTasks}
          linkedClientForPanel={linkedClientForPanel}
          currentOpportunityForLinked={currentOpportunityForLinked}
          onClose={() => {
            setShowLinkedTasksPanel(false)
            setLinkedClientForPanel(null)
          }}
          onEditClient={handleEditClient}
          onOpenTask={(task) => {
            setTaskOpenedFromLinkedPanel(true)
            setShowLinkedTasksPanel(false)
            openTaskModal(task)
          }}
        />
      )}
    </div>
  )
}
