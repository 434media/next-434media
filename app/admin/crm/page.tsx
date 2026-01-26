"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Loader2,
  BarChart3,
  Target,
  Users,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

// Import CRM components
import {
  Toast,
  DashboardView,
  PipelineView,
  OpportunitiesKanbanView,
  ClientsView,
  TasksView,
  ClientFormModal,
  OpportunityFormModal,
  TaskModal,
  TEAM_MEMBERS,
} from "../../components/crm"

import type {
  DashboardStats,
  PipelineColumn,
  Client,
  Task,
  ViewMode,
  Toast as ToastType,
  CurrentUser,
  TaskAttachment,
  TaskComment,
  Brand,
  Disposition,
  DOC,
  CRMTag,
} from "../../components/crm/types"

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

  // Client form state
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [clientForm, setClientForm] = useState({
    company_name: "",
    contacts: [] as Array<{
      id: string
      name: string
      email: string
      phone: string
      role: string
      is_primary: boolean
      address: string
      city: string
      state: string
      zipcode: string
      date_of_birth: string
    }>,
    status: "prospect",
    next_followup_date: "",
    notes: "",
    source: "",
    is_opportunity: false,
    opportunity_id: "",
    assigned_to: "",
  })
  const [isSaving, setIsSaving] = useState(false)

  // Opportunity form state
  const [showOpportunityForm, setShowOpportunityForm] = useState(false)
  const [isEditingOpportunity, setIsEditingOpportunity] = useState(false)  // Track if editing vs creating
  const [opportunityForm, setOpportunityForm] = useState({
    company_name: "",
    existing_company_id: null as string | null,  // Only set when editing an existing opportunity
    linked_company_id: null as string | null,     // Set when creating new opp linked to existing company
    contacts: [] as Array<{
      id: string
      name: string
      email: string
      phone: string
      role: string
      is_primary: boolean
      address: string
      city: string
      state: string
      zipcode: string
      date_of_birth: string
    }>,
    title: "",
    status: "prospect",
    brand: "" as Brand | "",
    pitch_value: "",
    next_followup_date: "",
    assigned_to: "",
    notes: "",
    source: "",
    is_opportunity: true,
    disposition: "pitched" as Disposition | "",
    doc: "" as DOC | "",
    web_links: [] as string[],
    docs: [] as string[],
  })
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false)

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    secondary_assigned_to: [] as string[],
    brand: "" as Brand | "",
    status: "not_started",
    priority: "medium",
    due_date: "",
    notes: "",
    web_links: [] as string[],
    tagged_users: [] as string[],
    is_opportunity: false,
    opportunity_id: "",
    disposition: "" as Disposition | "",
    doc: "" as DOC | "",
    client_id: "",
    client_name: "",
  })
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([])
  
  // Linked tasks panel state (for stacked kanban cards)
  const [showLinkedTasksPanel, setShowLinkedTasksPanel] = useState(false)
  const [linkedTasks, setLinkedTasks] = useState<Task[]>([])
  const [linkedClientForPanel, setLinkedClientForPanel] = useState<Client | null>(null)
  const [currentOpportunityForLinked, setCurrentOpportunityForLinked] = useState<Client | null>(null)

  // Load data on mount - load all data needed for dashboard
  useEffect(() => {
    const loadInitialData = async () => {
      // Load dashboard stats and pipeline
      await loadDashboard()
      // Load clients and tasks needed for dashboard budget calculations
      await Promise.all([
        loadClients(),
        loadTasks(),
      ])
    }
    loadInitialData()
    loadCurrentUser()
    loadTags()
  }, [])

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

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Set default assignee filter based on logged-in user
  useEffect(() => {
    if (currentUser?.email) {
      // Map email to full name for the assignee filter
      const emailToNameMap: Record<string, string> = {
        "jake@434media.com": "Jacob Lee Miles",
        "marcos@434media.com": "Marcos Resendez",
        "stacy@434media.com": "Stacy Carrizales",
        "jesse@434media.com": "Jesse Hernandez",
        "barb@434media.com": "Barbara Carreon",
        "nichole@434media.com": "Nichole Snow",
      }
      const matchedName = emailToNameMap[currentUser.email.toLowerCase()]
      if (matchedName) {
        setAssigneeFilter(matchedName)
        setOpportunityAssigneeFilter(matchedName)
        setClientAssigneeFilter(matchedName)
      }
    }
  }, [currentUser])

  const loadDashboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/crm")
      if (!response.ok) throw new Error("Failed to fetch CRM data")
      const data = await response.json()
      
      setStats(data.stats)
      setPipeline(data.pipeline || [])
      
      // Show warning if quota was exceeded
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
      
      // Debug: Log opportunity data
      const opportunities = allClients.filter((c: Client) => c.is_opportunity)
      console.log("=== Clients Loaded ===")
      console.log("Total clients:", allClients.length)
      console.log("Opportunities (is_opportunity=true):", opportunities.length)
      console.log("Opportunity details:", opportunities.map((c: Client) => ({
        id: c.id,
        company: c.company_name || c.name,
        title: c.title,
        is_opportunity: c.is_opportunity,
        disposition: c.disposition,
        pitch_value: c.pitch_value,
      })))
      
      // Auto-archive opportunities that are closed (won/lost) and older than 60 days
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
      
      // Auto-archive in background (don't block UI)
      if (opportunitiesToArchive.length > 0) {
        console.log(`Auto-archiving ${opportunitiesToArchive.length} opportunities older than ${ARCHIVE_AFTER_DAYS} days`)
        
        // Archive each opportunity (fire and forget - don't await)
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
        
        // Update local state immediately to show archived opportunities
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
      setIsClientsLoaded(true) // Set loaded even on error to prevent infinite loading
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

  // Load tags from both Mailchimp and CRM Firestore
  const loadTags = async () => {
    setIsLoadingTags(true)
    try {
      // Fetch Mailchimp tags
      const mailchimpResponse = await fetch("/api/mailchimp?endpoint=tags")
      let mailchimpTags: CRMTag[] = []
      if (mailchimpResponse.ok) {
        const mailchimpData = await mailchimpResponse.json()
        if (mailchimpData.success && mailchimpData.data?.tags) {
          mailchimpTags = mailchimpData.data.tags.map((tag: { id: string; name: string }) => ({
            id: `mailchimp_${tag.id}`,
            name: tag.name,
            color: "#f59e0b", // amber for Mailchimp tags
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
        }
      }
      
      // Fetch CRM-specific tags from Firestore
      const crmResponse = await fetch("/api/admin/crm/tags")
      let crmTags: CRMTag[] = []
      if (crmResponse.ok) {
        const crmData = await crmResponse.json()
        crmTags = crmData.tags || []
      }
      
      // Combine and deduplicate by name (prefer CRM tags if duplicate names)
      const tagMap = new Map<string, CRMTag>()
      mailchimpTags.forEach(tag => tagMap.set(tag.name.toLowerCase(), tag))
      crmTags.forEach(tag => tagMap.set(tag.name.toLowerCase(), tag)) // CRM overwrites Mailchimp
      
      const combinedTags = Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      setAvailableTags(combinedTags)
    } catch (err) {
      console.error("Failed to load tags:", err)
    } finally {
      setIsLoadingTags(false)
    }
  }

  // Create a new tag
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
        // Add new tag to available tags if it's not already there
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

  // Handle view changes - refresh data when switching views
  useEffect(() => {
    if (viewMode === "dashboard") {
      // Dashboard uses clients.is_opportunity for budget calculations
      // Loads fresh clients, tasks, and dashboard stats for accurate data
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
    }
  }, [viewMode])

  // Open task modal for editing
  const openTaskModal = (task: Task) => {
    setSelectedTask(task)
    // Convert secondary_assigned_to to array format for multi-select
    const secondaryAssignees = task.secondary_assigned_to 
      ? Array.isArray(task.secondary_assigned_to) 
        ? task.secondary_assigned_to 
        : [task.secondary_assigned_to]
      : []
    setTaskForm({
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to || "",
      secondary_assigned_to: secondaryAssignees,
      brand: task.brand || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      notes: task.notes || "",
      web_links: task.web_links || [],
      tagged_users: task.tagged_users || [],
      is_opportunity: task.is_opportunity || false,
      opportunity_id: task.opportunity_id || "",
      disposition: task.disposition || "",
      doc: task.doc || "",
      client_id: task.client_id || "",
      client_name: task.client_name || "",
    })
    setTaskAttachments(task.attachments || [])
    setShowTaskModal(true)
  }

  // Open task modal for creating a new task
  const handleAddTask = () => {
    // Create a new task object for the modal
    const newTask: Task = {
      id: "", // Empty id indicates new task
      title: "",
      description: "",
      assigned_to: currentUser?.name || assigneeFilter || "",
      secondary_assigned_to: [],
      brand: undefined,
      status: "not_started",
      priority: "medium",
      due_date: "",
      notes: "",
      web_links: [],
      tagged_users: [],
      is_opportunity: false,
      disposition: undefined,
      doc: undefined,
      attachments: [],
      comments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setSelectedTask(newTask)
    setTaskForm({
      title: "",
      description: "",
      assigned_to: currentUser?.name || assigneeFilter || "",
      secondary_assigned_to: [],
      brand: "",
      status: "not_started",
      priority: "medium",
      due_date: "",
      notes: "",
      web_links: [],
      tagged_users: [],
      is_opportunity: false,
      opportunity_id: "",
      disposition: "",
      doc: "",
      client_id: "",
      client_name: "",
    })
    setTaskAttachments([])
    setShowTaskModal(true)
  }

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedTask) return
    
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      return
    }

    setIsSavingTask(true)
    try {
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Jacob Lee Miles": "jake",
        "Marc": "marc",
        "Marcos Resendez": "marc",
        "Stacy": "stacy",
        "Stacy Ramirez": "stacy",
        "Stacy Carrizales": "stacy",
        "Jesse": "jesse",
        "Jesse Hernandez": "jesse",
        "Barb": "barb",
        "Barbara Carreon": "barb",
        "Nichole": "teams",
        "Nichole Snow": "teams",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      const response = await fetch(`/api/admin/crm/tasks?id=${selectedTask.id}&owner=${owner}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) throw new Error("Failed to delete task")

      setToast({ message: "Task deleted", type: "success" })
      setShowTaskModal(false)
      setSelectedTask(null)
      loadTasks()
    } catch (err) {
      setToast({ message: "Failed to delete task", type: "error" })
    } finally {
      setIsSavingTask(false)
    }
  }

  // Delete all tasks assigned to Team
  const handleDeleteTeamTasks = async () => {
    if (!confirm("Are you sure you want to delete ALL tasks assigned to Team? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch("/api/admin/crm/tasks/delete-team", {
        method: "DELETE",
        credentials: "include",
      })

      if (!response.ok) throw new Error("Failed to delete team tasks")

      const data = await response.json()
      setToast({ message: data.message || "Team tasks deleted", type: "success" })
      loadTasks()
    } catch (err) {
      setToast({ message: "Failed to delete team tasks", type: "error" })
    }
  }

  // Handle file upload - supports multiple files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedTask || !currentUser) return

    // Process each file (supports multiple uploads)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const maxSize = 50 * 1024 * 1024 // 50MB - matches server limit
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)
      
      if (file.size > maxSize) {
        setToast({ message: `File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is 50MB.`, type: "error" })
        continue // Skip this file but continue with others
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
      ]
      
      if (!allowedTypes.includes(file.type)) {
        setToast({ message: `File "${file.name}" type not supported. Use images, PDF, DOC, XLS, or TXT.`, type: "error" })
        continue // Skip this file but continue with others
      }

      setIsUploadingFile(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", "crm-tasks")

        const response = await fetch("/api/upload/crm", {
          method: "POST",
          credentials: "include",
          body: formData,
        })

        // Handle error responses with detailed messages
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || `Upload failed (${response.status})`
          
          // Show specific error for 413 (file too large)
          if (response.status === 413) {
            setToast({ message: `File "${file.name}" is too large. Maximum size is 50MB.`, type: "error" })
          } else {
            setToast({ message: errorMessage, type: "error" })
          }
          continue
        }

        const data = await response.json()
        
        // Determine file type
        let fileType: "image" | "document" | "link" = "document"
        if (file.type.startsWith("image/")) {
          fileType = "image"
        }

        const newAttachment: TaskAttachment = {
          id: crypto.randomUUID(),
          name: file.name,
          type: fileType,
          url: data.url,
          uploaded_by: currentUser.name,
          uploaded_at: new Date().toISOString(),
        }

        const updatedAttachments = [...taskAttachments, newAttachment]
        setTaskAttachments(updatedAttachments)

        // For NEW tasks (empty ID), don't save to Firestore yet - will be saved when task is created
        // For existing tasks, save immediately
        if (selectedTask.id) {
          // Save to Firestore
          const ownerMap: Record<string, string> = {
            "Jake": "jake",
            "Jacob Lee Miles": "jake",
            "Marc": "marc",
            "Marcos Resendez": "marc",
            "Stacy": "stacy",
            "Stacy Ramirez": "stacy",
            "Stacy Carrizales": "stacy",
            "Jesse": "jesse",
            "Jesse Hernandez": "jesse",
            "Barb": "barb",
            "Barbara Carreon": "barb",
            "Nichole": "teams",
            "Nichole Snow": "teams",
          }
          const owner = ownerMap[selectedTask.assigned_to] || "teams"
          
          await fetch("/api/admin/crm/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              id: selectedTask.id,
              owner,
              attachments: updatedAttachments,
            }),
          })

          // Update local task state
          setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
          setTasks(prevTasks => 
            prevTasks.map(t => t.id === selectedTask.id ? { ...t, attachments: updatedAttachments } : t)
          )
        } else {
          // For new tasks, just update local state - will save when task is created
          setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
        }

        setToast({ message: `File "${file.name}" uploaded successfully`, type: "success" })
      } catch (err) {
        console.error("Upload error:", err)
        // Provide more helpful error messages
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
          setToast({ message: `Network error uploading "${file.name}". Check your connection.`, type: "error" })
        } else if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
          setToast({ message: `Session expired. Please sign in again.`, type: "error" })
        } else {
          setToast({ message: `Failed to upload "${file.name}": ${errorMsg}`, type: "error" })
        }
      }
    }
    
    // Reset state after all files processed
    setIsUploadingFile(false)
    // Reset the input
    e.target.value = ""
  }

  // Remove attachment
  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!selectedTask) return

    const updatedAttachments = taskAttachments.filter(a => a.id !== attachmentId)
    setTaskAttachments(updatedAttachments)

    // For NEW tasks (empty ID), don't save to Firestore yet - will be saved when task is created
    // For existing tasks, save immediately
    if (selectedTask.id) {
      try {
        const ownerMap: Record<string, string> = {
          "Jake": "jake",
          "Jacob Lee Miles": "jake",
          "Marc": "marc",
          "Marcos Resendez": "marc",
          "Stacy": "stacy",
          "Stacy Ramirez": "stacy",
          "Stacy Carrizales": "stacy",
          "Jesse": "jesse",
          "Jesse Hernandez": "jesse",
          "Barb": "barb",
          "Barbara Carreon": "barb",
          "Nichole": "teams",
          "Nichole Snow": "teams",
        }
        const owner = ownerMap[selectedTask.assigned_to] || "teams"
        
        await fetch("/api/admin/crm/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: selectedTask.id,
            owner,
            attachments: updatedAttachments,
          }),
        })

        setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
        setTasks(prevTasks => 
          prevTasks.map(t => t.id === selectedTask.id ? { ...t, attachments: updatedAttachments } : t)
        )
      } catch (err) {
        console.error("Failed to remove attachment:", err)
      }
    } else {
      // For new tasks, just update local state
      setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
    }
  }

  // Save task (create or update)
  const handleSaveTask = async () => {
    if (!selectedTask) return
    
    setIsSavingTask(true)
    try {
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Jacob Lee Miles": "jake",
        "Marc": "marc",
        "Marcos Resendez": "marc",
        "Stacy": "stacy",
        "Stacy Ramirez": "stacy",
        "Stacy Carrizales": "stacy",
        "Jesse": "jesse",
        "Jesse Hernandez": "jesse",
        "Barb": "barb",
        "Barbara Carreon": "barb",
        "Nichole": "teams",
        "Nichole Snow": "teams",
      }
      
      const owner = ownerMap[taskForm.assigned_to] || "teams"
      
      // Check if this is a new task (empty id)
      const isNewTask = !selectedTask.id
      
      if (isNewTask) {
        // Create new task - include attachments and comments
        const response = await fetch("/api/admin/crm/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            owner,
            ...taskForm,
            created_by: currentUser?.name || currentUser?.email || "Unknown",
            attachments: taskAttachments,
            comments: selectedTask.comments || [],
          }),
        })

        if (!response.ok) throw new Error("Failed to create task")
        
        setToast({ message: "Task created successfully", type: "success" })
      } else {
        // Update existing task
        // If the task was completed, use "completed" as owner so the API can handle reactivation
        let updateOwner = owner
        if (selectedTask.status === "completed") {
          updateOwner = "completed"
        }
        
        const response = await fetch("/api/admin/crm/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: selectedTask.id,
            owner: updateOwner,
            ...taskForm,
          }),
        })

        if (!response.ok) throw new Error("Failed to update task")

        const result = await response.json()
        
        // Show appropriate message based on whether task was reactivated
        if (result.reactivated) {
          setToast({ message: "Task reactivated and moved back to active tasks", type: "success" })
        } else if (result.moved) {
          setToast({ message: "Task marked as completed", type: "success" })
        } else {
          setToast({ message: "Task updated successfully", type: "success" })
        }
      }
      
      setShowTaskModal(false)
      setSelectedTask(null)
      loadTasks()
    } catch (err) {
      setToast({ message: `Failed to ${!selectedTask.id ? "create" : "update"} task`, type: "error" })
    } finally {
      setIsSavingTask(false)
    }
  }

  // Add a web link to the task
  const handleAddLink = () => {
    if (newLink.trim()) {
      let url = newLink.trim()
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url
      }
      setTaskForm(prev => ({
        ...prev,
        web_links: [...prev.web_links, url]
      }))
      setNewLink("")
    }
  }

  // Remove a web link
  const handleRemoveLink = (index: number) => {
    setTaskForm(prev => ({
      ...prev,
      web_links: prev.web_links.filter((_, i) => i !== index)
    }))
  }

  // Toggle user tag
  const toggleUserTag = (email: string) => {
    setTaskForm(prev => ({
      ...prev,
      tagged_users: prev.tagged_users.includes(email)
        ? prev.tagged_users.filter(e => e !== email)
        : [...prev.tagged_users, email]
    }))
  }

  // Add a comment to the task
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask || !currentUser) return
    
    // Extract mentions from comment (format: @name or @FirstName)
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionName = match[1].toLowerCase()
      const mentionedMember = TEAM_MEMBERS.find(m => 
        m.name.toLowerCase() === mentionName ||
        m.name.split(' ')[0].toLowerCase() === mentionName
      )
      if (mentionedMember && !mentions.includes(mentionedMember.email)) {
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

    // Update the selected task with the new comment
    const updatedComments = [...(selectedTask.comments || []), comment]
    const updatedTask = {
      ...selectedTask,
      comments: updatedComments
    }
    setSelectedTask(updatedTask)
    setNewComment("")

    // For NEW tasks (empty ID), don't save to Firestore yet - will be saved when task is created
    if (!selectedTask.id) {
      setToast({ message: "Comment added (will be saved with task)", type: "success" })
      return
    }

    // Save to Firestore via API for existing tasks
    try {
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Jacob Lee Miles": "jake",
        "Marc": "marc",
        "Marcos Resendez": "marc",
        "Stacy": "stacy",
        "Stacy Ramirez": "stacy",
        "Stacy Carrizales": "stacy",
        "Jesse": "jesse",
        "Jesse Hernandez": "jesse",
        "Barb": "barb",
        "Barbara Carreon": "barb",
        "Nichole": "teams",
        "Nichole Snow": "teams",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: selectedTask.id,
          owner,
          comments: updatedComments,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save comment")
      }

      // Update the task in the local tasks array
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === selectedTask.id ? updatedTask : t)
      )

      setToast({ message: "Comment added", type: "success" })

      // Send notifications to mentioned users (async, don't block UI)
      if (mentions.length > 0) {
        fetch("/api/admin/crm/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            taskId: selectedTask.id,
            taskTitle: selectedTask.title,
            comment,
            mentionedEmails: mentions,
          }),
        }).catch(err => {
          console.error("Failed to send notifications:", err)
          // Don't show error to user - notifications are non-critical
        })
      }
    } catch (err) {
      console.error("Failed to save comment:", err)
      setToast({ message: "Failed to save comment", type: "error" })
      // Revert the optimistic update
      setSelectedTask(selectedTask)
    }
  }

  // Client handlers
  const handleSaveClient = async () => {
    if (!clientForm.company_name.trim()) {
      setToast({ message: "Client name is required", type: "error" })
      return
    }

    setIsSaving(true)
    try {
      // Get primary contact info for backwards compatibility
      const primaryContact = clientForm.contacts.find(c => c.is_primary) || clientForm.contacts[0]
      
      // Convert form data to API format
      const clientData = {
        name: primaryContact?.name || clientForm.company_name, // Fallback to company name
        company_name: clientForm.company_name,
        email: primaryContact?.email || "",
        phone: primaryContact?.phone || "",
        contacts: clientForm.contacts.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          is_primary: c.is_primary,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          zipcode: c.zipcode || "",
          date_of_birth: c.date_of_birth || "",
        })),
        status: clientForm.status,
        next_followup_date: clientForm.next_followup_date || undefined,
        notes: clientForm.notes,
        source: clientForm.source || undefined,
        is_opportunity: clientForm.is_opportunity,
        opportunity_id: clientForm.opportunity_id || undefined,
        assigned_to: clientForm.assigned_to || undefined,
      }

      const method = editingClient ? "PUT" : "POST"
      const body = editingClient 
        ? { ...clientData, id: editingClient.id }
        : clientData

      const response = await fetch("/api/admin/crm/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save contact")

      setToast({ message: `Contact ${editingClient ? "updated" : "created"} successfully`, type: "success" })
      setShowClientForm(false)
      setEditingClient(null)
      setClientForm({ company_name: "", contacts: [], status: "prospect", next_followup_date: "", notes: "", source: "", is_opportunity: false, opportunity_id: "", assigned_to: "" })
      loadClients()
    } catch (err) {
      setToast({ message: "Failed to save contact", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  // Save opportunity (creates or updates client with is_opportunity=true)
  const handleSaveOpportunity = async () => {
    if (!opportunityForm.company_name.trim()) {
      setToast({ message: "Client name is required", type: "error" })
      return
    }

    if (!opportunityForm.brand) {
      setToast({ message: "Please select a platform", type: "error" })
      return
    }

    // Validation: Closed Won should have 100% DOC
    if (opportunityForm.disposition === "closed_won" && opportunityForm.doc !== "100") {
      const confirmProceed = confirm(
        "Warning: This opportunity is being set to 'Closed Won' without 100% DOC.\n\n" +
        "Opportunities must have 100% DOC to count towards Remaining and Pacing.\n\n" +
        "Do you want to proceed anyway? (The opportunity will appear in the exceptions report)"
      )
      if (!confirmProceed) {
        return
      }
    }

    setIsSavingOpportunity(true)
    try {
      // Get primary contact info for backwards compatibility
      const primaryContact = opportunityForm.contacts.find(c => c.is_primary) || opportunityForm.contacts[0]
      
      // Build the opportunity data
      const opportunityData = {
        name: primaryContact?.name || opportunityForm.company_name,
        company_name: opportunityForm.company_name,
        title: opportunityForm.title || "",
        email: primaryContact?.email || "",
        phone: primaryContact?.phone || "",
        contacts: opportunityForm.contacts.map(c => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          role: c.role,
          is_primary: c.is_primary,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          zipcode: c.zipcode || "",
          date_of_birth: c.date_of_birth || "",
        })),
        status: opportunityForm.status,
        brand: opportunityForm.brand,
        pitch_value: opportunityForm.pitch_value ? parseFloat(opportunityForm.pitch_value) : undefined,
        next_followup_date: opportunityForm.next_followup_date || undefined,
        assigned_to: opportunityForm.assigned_to,
        notes: opportunityForm.notes,
        source: opportunityForm.source || undefined,
        is_opportunity: true, // Always true for opportunities
        disposition: opportunityForm.disposition || "pitched",
        doc: opportunityForm.doc || "25", // Default to 25% if not selected
        web_links: opportunityForm.web_links.filter(link => link.trim() !== ""),
        docs: opportunityForm.docs.filter(doc => doc.trim() !== ""),
      }

      // Only use PUT when EDITING an existing opportunity (existing_company_id is set AND isEditingOpportunity is true)
      // Use POST for NEW opportunities (even if linked to an existing company)
      const method = isEditingOpportunity && opportunityForm.existing_company_id ? "PUT" : "POST"
      const body = isEditingOpportunity && opportunityForm.existing_company_id 
        ? { ...opportunityData, id: opportunityForm.existing_company_id }
        : opportunityData

      const response = await fetch("/api/admin/crm/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save opportunity")

      setToast({ message: isEditingOpportunity ? "Opportunity updated successfully" : "Opportunity created successfully", type: "success" })
      setShowOpportunityForm(false)
      setIsEditingOpportunity(false)
      // Reset the form
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
      // Reload both clients (for syncing) and refresh dashboard
      loadClients()
      loadDashboard()
    } catch (err) {
      setToast({ message: "Failed to save opportunity", type: "error" })
    } finally {
      setIsSavingOpportunity(false)
    }
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return

    try {
      const response = await fetch(`/api/admin/crm/clients?id=${id}`, { method: "DELETE", credentials: "include" })
      if (!response.ok) throw new Error("Failed to delete client")
      
      setToast({ message: "Client deleted", type: "success" })
      loadClients()
    } catch (err) {
      setToast({ message: "Failed to delete client", type: "error" })
    }
  }

  // Archive an opportunity (move to archived section)
  const handleArchiveOpportunity = async (clientId: string) => {
    try {
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: clientId,
          is_archived: true,
          archived_at: new Date().toISOString(),
        }),
      })

      if (!response.ok) throw new Error("Failed to archive opportunity")

      // Optimistically update local state
      setClients(prevClients =>
        prevClients.map(c =>
          c.id === clientId
            ? { ...c, is_archived: true, archived_at: new Date().toISOString() }
            : c
        )
      )

      setToast({ message: "Opportunity archived", type: "success" })
      setShowOpportunityForm(false)
      setIsEditingOpportunity(false)
    } catch (err) {
      setToast({ message: "Failed to archive opportunity", type: "error" })
    }
  }

  // Restore an archived opportunity (move back to active kanban)
  const handleRestoreOpportunity = async (clientId: string) => {
    try {
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: clientId,
          is_archived: false,
          archived_at: null,
        }),
      })

      if (!response.ok) throw new Error("Failed to restore opportunity")

      // Optimistically update local state
      setClients(prevClients =>
        prevClients.map(c =>
          c.id === clientId
            ? { ...c, is_archived: false, archived_at: undefined }
            : c
        )
      )

      setToast({ message: "Opportunity restored to active pipeline", type: "success" })
    } catch (err) {
      setToast({ message: "Failed to restore opportunity", type: "error" })
    }
  }

  // Update client disposition via drag-and-drop in Kanban
  const handleUpdateClientDisposition = async (clientId: string, disposition: Disposition) => {
    console.log("=== Updating Client Disposition ===")
    console.log("Client ID:", clientId)
    console.log("New Disposition:", disposition)
    
    // Find the current client to check current state
    const currentClient = clients.find(c => c.id === clientId)
    const wasClosedWon = currentClient?.disposition === "closed_won"
    
    // Automatically set DOC to 100% when moving to Closed Won
    // This ensures the opportunity is counted in Remaining and Pacing calculations
    const shouldAutoSetDocTo100 = disposition === "closed_won"
    
    // Automatically set DOC to 25% when:
    // 1. Moving FROM closed_won back to pitched or closed_lost
    // 2. Moving TO closed_lost from ANY state (to ensure closed_lost is never counted in pacing)
    const shouldAutoSetDocTo25 = wasClosedWon && disposition === "pitched" || disposition === "closed_lost"
    
    let docValue: DOC | undefined = undefined
    if (shouldAutoSetDocTo100) {
      docValue = "100" as DOC
      console.log("Auto-setting DOC to 100% for Closed Won opportunity")
    } else if (shouldAutoSetDocTo25) {
      docValue = "25" as DOC
      console.log("Auto-setting DOC to 25% for opportunity moved to", disposition)
    }
    
    try {
      // Build the update payload - include DOC if moving to closed_won
      const updatePayload: { id: string; disposition: Disposition; doc?: DOC } = { 
        id: clientId, 
        disposition 
      }
      if (docValue) {
        updatePayload.doc = docValue
      }
      
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) throw new Error("Failed to update client")

      console.log("Disposition updated successfully")
      if (shouldAutoSetDocTo100) {
        console.log("DOC automatically set to 100%")
      } else if (shouldAutoSetDocTo25) {
        console.log("DOC automatically set to 25%")
      }
      
      // Optimistically update the local state (include DOC if set)
      setClients(prevClients => 
        prevClients.map(c => {
          if (c.id === clientId) {
            const updates: Partial<Client> = { disposition }
            if (docValue) {
              updates.doc = docValue
            }
            return { ...c, ...updates }
          }
          return c
        })
      )
      
      const successMessage = shouldAutoSetDocTo100 
        ? "Opportunity moved to Closed Won (DOC set to 100%)" 
        : shouldAutoSetDocTo25
        ? `Opportunity moved to ${disposition === "pitched" ? "Pitched" : "Closed Lost"} (DOC set to 25%)`
        : "Client moved"
      setToast({ message: successMessage, type: "success" })
    } catch (err) {
      setToast({ message: "Failed to move client", type: "error" })
    }
  }

  // Update task disposition via drag-and-drop in Kanban
  const handleUpdateTaskDisposition = async (taskId: string, disposition: Disposition) => {
    // Find the task to get the owner
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const ownerMap: Record<string, string> = {
      "Jake": "jake",
      "Jacob Lee Miles": "jake",
      "Marc": "marc",
      "Marcos Resendez": "marc",
      "Stacy": "stacy",
      "Stacy Carrizales": "stacy",
      "Jesse": "jesse",
      "Jesse Hernandez": "jesse",
      "Barb": "barb",
      "Barbara Carreon": "barb",
      "Nichole": "teams",
      "Nichole Snow": "teams",
    }
    const owner = ownerMap[task.assigned_to] || "teams"

    // Check if we're moving FROM closed_won
    const wasClosedWon = task.disposition === "closed_won"
    
    // Automatically set DOC to 100% when moving to Closed Won (for opportunity tasks)
    const shouldAutoSetDocTo100 = disposition === "closed_won" && task.is_opportunity
    
    // Automatically set DOC to 25% when:
    // 1. Moving FROM closed_won back to pitched
    // 2. Moving TO closed_lost from ANY state (to ensure closed_lost is never counted in pacing)
    const shouldAutoSetDocTo25 = task.is_opportunity && (wasClosedWon && disposition === "pitched" || disposition === "closed_lost")
    
    let docValue: DOC | undefined = undefined
    if (shouldAutoSetDocTo100) {
      docValue = "100" as DOC
    } else if (shouldAutoSetDocTo25) {
      docValue = "25" as DOC
    }

    try {
      // Build update payload - include DOC if moving opportunity to closed_won
      const updatePayload: { id: string; owner: string; disposition: Disposition; doc?: DOC } = { 
        id: taskId, 
        owner, 
        disposition 
      }
      if (docValue) {
        updatePayload.doc = docValue
      }
      
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) throw new Error("Failed to update task")

      // Optimistically update the local state (include DOC if set)
      setTasks(prevTasks => 
        prevTasks.map(t => {
          if (t.id === taskId) {
            const updates: Partial<Task> = { disposition }
            if (docValue) {
              updates.doc = docValue
            }
            return { ...t, ...updates }
          }
          return t
        })
      )
      
      const successMessage = shouldAutoSetDocTo100 
        ? "Opportunity moved to Closed Won (DOC set to 100%)" 
        : shouldAutoSetDocTo25
        ? `Opportunity moved to ${disposition === "pitched" ? "Pitched" : "Closed Lost"} (DOC set to 25%)`
        : "Task moved"
      setToast({ message: successMessage, type: "success" })
    } catch (err) {
      setToast({ message: "Failed to move task", type: "error" })
    }
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    
    // Convert existing client data to form format
    // First, build contacts array from existing data
    const contacts: Array<{
      id: string
      name: string
      email: string
      phone: string
      role: string
      is_primary: boolean
      address: string
      city: string
      state: string
      zipcode: string
      date_of_birth: string
    }> = []
    
    // Check if client has contacts array
    if (client.contacts && client.contacts.length > 0) {
      client.contacts.forEach(c => {
        contacts.push({
          id: c.id || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          role: c.role || "",
          is_primary: c.is_primary || false,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          zipcode: c.zipcode || "",
          date_of_birth: c.date_of_birth || "",
        })
      })
    } else if (client.name || client.email || client.phone) {
      // Legacy: convert single contact fields to contacts array
      contacts.push({
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        role: "",
        is_primary: true,
        address: "",
        city: "",
        state: "",
        zipcode: "",
        date_of_birth: "",
      })
    }
    
    setClientForm({
      company_name: client.company_name || client.name || "",
      contacts,
      status: client.status,
      next_followup_date: client.next_followup_date || "",
      notes: client.notes || "",
      source: client.source || "",
      is_opportunity: client.is_opportunity || false,
      opportunity_id: client.opportunity_id || "",
      assigned_to: client.assigned_to || "",
    })
    setShowClientForm(true)
  }

  // Handler to edit an opportunity using the opportunity modal
  const handleEditOpportunity = (client: Client) => {
    // Convert existing client data to opportunity form format
    const contacts: Array<{
      id: string
      name: string
      email: string
      phone: string
      role: string
      is_primary: boolean
      address: string
      city: string
      state: string
      zipcode: string
      date_of_birth: string
    }> = []
    
    // Check if client has contacts array
    if (client.contacts && client.contacts.length > 0) {
      client.contacts.forEach(c => {
        contacts.push({
          id: c.id || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          role: c.role || "",
          is_primary: c.is_primary || false,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          zipcode: c.zipcode || "",
          date_of_birth: c.date_of_birth || "",
        })
      })
    } else if (client.name || client.email || client.phone) {
      // Legacy: convert single contact fields to contacts array
      contacts.push({
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        role: "",
        is_primary: true,
        address: "",
        city: "",
        state: "",
        zipcode: "",
        date_of_birth: "",
      })
    }
    
    setOpportunityForm({
      company_name: client.company_name || client.name || "",
      existing_company_id: client.id, // Set the existing ID for update
      linked_company_id: null,
      contacts,
      title: client.title || "",
      status: client.status || "prospect",
      brand: client.brand || "",
      pitch_value: client.pitch_value ? String(client.pitch_value) : "",
      next_followup_date: client.next_followup_date || "",
      assigned_to: client.assigned_to || "",
      notes: client.notes || "",
      source: client.source || "",
      is_opportunity: true,
      disposition: client.disposition || "pitched",
      doc: client.doc || "",
      web_links: client.web_links || [],
      docs: client.docs || [],
    })
    setIsEditingOpportunity(true)  // Mark as editing existing opportunity
    setShowOpportunityForm(true)
  }

  // Handler for stacked kanban cards - opens opportunity AND shows linked tasks panel
  const handleStackedItemsClick = (opportunity: Client, linkedTasksList: Task[]) => {
    // First, open the opportunity modal
    handleEditOpportunity(opportunity)
    
    // Show the linked tasks panel if there are linked tasks
    if (linkedTasksList.length > 0) {
      setCurrentOpportunityForLinked(opportunity)
      setLinkedTasks(linkedTasksList)
      setLinkedClientForPanel(null)
      setShowLinkedTasksPanel(true)
    }
  }

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
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* Toast */}
      <Toast toast={toast} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </Link>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-ggx88 text-neutral-900 mb-2 tracking-tight">
            PLATFORM CRM
          </h1>
          <p className="text-neutral-500 text-sm sm:text-base">
            Manage tasks, clients, opportunities, and sales pipeline
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-neutral-200 pb-4">
          {[
            { id: "dashboard", label: "Dashboard", icon: BarChart3 },
            { id: "pipeline", label: "Opportunities", icon: Target },
            { id: "clients", label: "Clients", icon: Users },
            { id: "tasks", label: "Tasks", icon: CheckCircle2 },
          ].map(({ id, label, icon: Icon }) => (
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
              setClientForm({ company_name: "", contacts: [], status: "prospect", next_followup_date: "", notes: "", source: "", is_opportunity: false, opportunity_id: "", assigned_to: currentUser?.name || "" })
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
          />
        )}
      </div>

      {/* Client Form Modal */}
      <ClientFormModal
        isOpen={showClientForm}
        isEditing={!!editingClient}
        isSaving={isSaving}
        formData={clientForm}
        opportunities={clients.filter(c => c.is_opportunity).map(c => ({ id: c.id, company_name: c.company_name, title: c.title }))}
        onFormChange={setClientForm}
        onSave={handleSaveClient}
        onClose={() => setShowClientForm(false)}
      />

      {/* Opportunity Form Modal */}
      <OpportunityFormModal
        isOpen={showOpportunityForm}
        isSaving={isSavingOpportunity}
        existingClients={clients}
        formData={opportunityForm}
        isEditing={isEditingOpportunity}
        onFormChange={setOpportunityForm}
        onSave={handleSaveOpportunity}
        onClose={() => {
          setShowOpportunityForm(false)
          setIsEditingOpportunity(false)
        }}
        onArchive={opportunityForm.existing_company_id ? () => handleArchiveOpportunity(opportunityForm.existing_company_id!) : undefined}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
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
        onFormChange={setTaskForm}
        onNewLinkChange={setNewLink}
        onNewCommentChange={setNewComment}
        onAddLink={handleAddLink}
        onRemoveLink={handleRemoveLink}
        onToggleUserTag={toggleUserTag}
        onAddComment={handleAddComment}
        onFileUpload={handleFileUpload}
        onRemoveAttachment={handleRemoveAttachment}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        onClose={() => setShowTaskModal(false)}
      />

      {/* Linked Items Panel - Shows when clicking stacked kanban cards */}
      {showLinkedTasksPanel && (linkedTasks.length > 0 || linkedClientForPanel) && (
        <div className="fixed inset-0 z-50 flex items-center justify-end pointer-events-none">
          {/* Backdrop - only for the panel area */}
          <div 
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => {
              setShowLinkedTasksPanel(false)
              setLinkedClientForPanel(null)
            }}
          />
          
          {/* Panel */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl pointer-events-auto overflow-hidden flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-sky-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-sky-100 to-cyan-100 rounded-lg">
                  <Target className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Linked Items</h3>
                  {currentOpportunityForLinked && (
                    <p className="text-sm text-gray-500 truncate max-w-[250px]">
                      {currentOpportunityForLinked.title || currentOpportunityForLinked.company_name}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setShowLinkedTasksPanel(false)
                  setLinkedClientForPanel(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Linked Client Section */}
              {linkedClientForPanel && (
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <Users className="w-3 h-3" />
                    Linked Client
                  </p>
                  <button
                    onClick={() => {
                      setShowLinkedTasksPanel(false)
                      setLinkedClientForPanel(null)
                      handleEditClient(linkedClientForPanel)
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                          {linkedClientForPanel.company_name || linkedClientForPanel.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {linkedClientForPanel.brand && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">
                              {linkedClientForPanel.brand}
                            </span>
                          )}
                          {linkedClientForPanel.status && (
                            <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                              {linkedClientForPanel.status}
                            </span>
                          )}
                        </div>
                        {linkedClientForPanel.assigned_to && (
                          <p className="text-xs text-gray-400 mt-1.5">
                            Assigned to: {linkedClientForPanel.assigned_to}
                          </p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-blue-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                </div>
              )}

              {/* Linked Tasks Section */}
              {linkedTasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Linked Tasks ({linkedTasks.length})
                  </p>
                  <div className="space-y-3">
                    {linkedTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => {
                          setShowLinkedTasksPanel(false)
                          setLinkedClientForPanel(null)
                          openTaskModal(task)
                        }}
                        className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-teal-200 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            task.status === 'completed' ? 'bg-green-100' : 
                            task.status === 'in_progress' ? 'bg-blue-100' : 'bg-gray-100'
                          }`}>
                            <CheckCircle2 className={`w-4 h-4 ${
                              task.status === 'completed' ? 'text-green-600' : 
                              task.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate group-hover:text-teal-700 transition-colors">
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {task.brand && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-600">
                                  {task.brand}
                                </span>
                              )}
                              {task.priority && (
                                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded ${
                                  task.priority === 'high' || task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                  task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {task.priority}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="text-[10px] text-gray-500">
                                  Due: {new Date(task.due_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {task.assigned_to && (
                              <p className="text-xs text-gray-400 mt-1.5">
                                Assigned to: {task.assigned_to}
                              </p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-300 group-hover:text-teal-400 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                💡 Linked items move together when you drag the opportunity on the kanban
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
