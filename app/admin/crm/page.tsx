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
} from "../../components/crm/types"

export default function SalesCRMPage() {
  // State
  const [isLoading, setIsLoading] = useState(true)
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
  const [clientStatusFilter, setClientStatusFilter] = useState<string>("all")
  const [clientBrandFilter, setClientBrandFilter] = useState<string>("all")

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
    brand: "" as Brand | "",
    pitch_value: "",
    next_followup_date: "",
    assigned_to: "",
    notes: "",
    source: "",
    is_opportunity: false,
    disposition: "" as Disposition | "",
    doc: "" as DOC | "",
  })
  const [isSaving, setIsSaving] = useState(false)

  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigned_to: "",
    brand: "" as Brand | "",
    status: "not_started",
    priority: "medium",
    due_date: "",
    notes: "",
    web_links: [] as string[],
    tagged_users: [] as string[],
    is_opportunity: false,
    disposition: "" as Disposition | "",
    doc: "" as DOC | "",
  })
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([])

  // Load data on mount
  useEffect(() => {
    loadDashboard()
    loadCurrentUser()
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
      setClients(data.clients || [])
    } catch (err) {
      setToast({ message: "Failed to load clients", type: "error" })
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

  // Handle view changes
  useEffect(() => {
    if (viewMode === "clients" && clients.length === 0) {
      loadClients()
    } else if (viewMode === "tasks" && tasks.length === 0) {
      loadTasks()
    } else if (viewMode === "pipeline") {
      if (pipeline.length === 0) loadPipeline()
      if (clients.length === 0) loadClients()
      if (tasks.length === 0) loadTasks()
    }
  }, [viewMode])

  // Open task modal for editing
  const openTaskModal = (task: Task) => {
    setSelectedTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || "",
      assigned_to: task.assigned_to || "",
      brand: task.brand || "",
      status: task.status,
      priority: task.priority,
      due_date: task.due_date || "",
      notes: task.notes || "",
      web_links: task.web_links || [],
      tagged_users: task.tagged_users || [],
      is_opportunity: task.is_opportunity || false,
      disposition: task.disposition || "",
      doc: task.doc || "",
    })
    setTaskAttachments(task.attachments || [])
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
        "Marc": "marc",
        "Stacy": "stacy",
        "Jesse": "jesse",
        "Barb": "barb",
        "Nichole": "nichole",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      const response = await fetch(`/api/admin/crm/tasks?id=${selectedTask.id}&owner=${owner}`, {
        method: "DELETE",
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
      })

      if (!response.ok) throw new Error("Failed to delete team tasks")

      const data = await response.json()
      setToast({ message: data.message || "Team tasks deleted", type: "success" })
      loadTasks()
    } catch (err) {
      setToast({ message: "Failed to delete team tasks", type: "error" })
    }
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedTask || !currentUser) return

    const file = files[0]
    const maxSize = 10 * 1024 * 1024 // 10MB
    
    if (file.size > maxSize) {
      setToast({ message: "File size must be less than 10MB", type: "error" })
      return
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
      setToast({ message: "File type not supported. Use images, PDF, DOC, XLS, or TXT.", type: "error" })
      return
    }

    setIsUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", "crm-tasks")

      const response = await fetch("/api/upload/crm", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Upload failed")

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

      // Save to Firestore
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Marc": "marc",
        "Stacy": "stacy",
        "Jesse": "jesse",
        "Barb": "barb",
        "Nichole": "nichole",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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

      setToast({ message: "File uploaded", type: "success" })
    } catch (err) {
      console.error("Upload error:", err)
      setToast({ message: "Failed to upload file", type: "error" })
    } finally {
      setIsUploadingFile(false)
      // Reset the input
      e.target.value = ""
    }
  }

  // Remove attachment
  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!selectedTask) return

    const updatedAttachments = taskAttachments.filter(a => a.id !== attachmentId)
    setTaskAttachments(updatedAttachments)

    // Save to Firestore
    try {
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Marc": "marc",
        "Stacy": "stacy",
        "Jesse": "jesse",
        "Barb": "barb",
        "Nichole": "nichole",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
  }

  // Save task updates
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
        "Jesse": "jesse",
        "Jesse Hernandez": "jesse",
        "Barb": "barb",
        "Barbara Carreon": "barb",
        "Nichole": "teams",
        "Nichole Snow": "teams",
      }
      
      // If the task was completed, use "completed" as owner so the API can handle reactivation
      // Otherwise, determine owner from assignee
      let owner: string
      if (selectedTask.status === "completed") {
        owner = "completed"
      } else {
        owner = ownerMap[taskForm.assigned_to] || "teams"
      }
      
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedTask.id,
          owner,
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
      
      setShowTaskModal(false)
      setSelectedTask(null)
      loadTasks()
    } catch (err) {
      setToast({ message: "Failed to update task", type: "error" })
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
    
    // Extract mentions from comment (format: @name)
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionedMember = TEAM_MEMBERS.find(m => 
        m.name.toLowerCase() === match![1].toLowerCase()
      )
      if (mentionedMember) {
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

    // Save to Firestore via API
    try {
      const ownerMap: Record<string, string> = {
        "Jake": "jake",
        "Marc": "marc",
        "Stacy": "stacy",
        "Jesse": "jesse",
        "Barb": "barb",
        "Nichole": "nichole",
      }
      const owner = ownerMap[selectedTask.assigned_to] || "teams"
      
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
      setToast({ message: "Company name is required", type: "error" })
      return
    }

    if (!clientForm.brand) {
      setToast({ message: "Please select a platform", type: "error" })
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
        brand: clientForm.brand,
        pitch_value: clientForm.pitch_value ? parseFloat(clientForm.pitch_value) : undefined,
        next_followup_date: clientForm.next_followup_date || undefined,
        assigned_to: clientForm.assigned_to,
        notes: clientForm.notes,
        source: clientForm.source || undefined,
        is_opportunity: clientForm.is_opportunity,
        disposition: clientForm.is_opportunity ? (clientForm.disposition || "open") : undefined,
        doc: clientForm.is_opportunity ? clientForm.doc || undefined : undefined,
      }

      const method = editingClient ? "PUT" : "POST"
      const body = editingClient 
        ? { ...clientData, id: editingClient.id }
        : clientData

      const response = await fetch("/api/admin/crm/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) throw new Error("Failed to save client")

      setToast({ message: `Client ${editingClient ? "updated" : "created"} successfully`, type: "success" })
      setShowClientForm(false)
      setEditingClient(null)
      setClientForm({ company_name: "", contacts: [], status: "prospect", brand: "", pitch_value: "", next_followup_date: "", assigned_to: "", notes: "", source: "", is_opportunity: false, disposition: "", doc: "" })
      loadClients()
    } catch (err) {
      setToast({ message: "Failed to save client", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return

    try {
      const response = await fetch(`/api/admin/crm/clients?id=${id}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete client")
      
      setToast({ message: "Client deleted", type: "success" })
      loadClients()
    } catch (err) {
      setToast({ message: "Failed to delete client", type: "error" })
    }
  }

  // Update client disposition via drag-and-drop in Kanban
  const handleUpdateClientDisposition = async (clientId: string, disposition: Disposition) => {
    try {
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: clientId, disposition }),
      })

      if (!response.ok) throw new Error("Failed to update client")

      // Optimistically update the local state
      setClients(prevClients => 
        prevClients.map(c => c.id === clientId ? { ...c, disposition } : c)
      )
      setToast({ message: "Client moved", type: "success" })
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

    try {
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, owner, disposition }),
      })

      if (!response.ok) throw new Error("Failed to update task")

      // Optimistically update the local state
      setTasks(prevTasks => 
        prevTasks.map(t => t.id === taskId ? { ...t, disposition } : t)
      )
      setToast({ message: "Task moved", type: "success" })
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
      brand: client.brand || "",
      pitch_value: client.pitch_value ? String(client.pitch_value) : "",
      next_followup_date: client.next_followup_date || "",
      assigned_to: client.assigned_to || "",
      notes: client.notes || "",
      source: client.source || "",
      is_opportunity: client.is_opportunity || false,
      disposition: client.disposition || "",
      doc: client.doc || "",
    })
    setShowClientForm(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Loading CRM...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Toast */}
      <Toast toast={toast} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-emerald-600 font-medium">
                Keep killing it, {currentUser.name}! 🔥
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-ggx88 text-gray-900 mb-2 tracking-tight">
            PLATFORM CRM
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            Manage tasks, clients, opportunities, and sales pipeline
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-200 pb-4">
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
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
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

        {/* Dashboard View */}
        {viewMode === "dashboard" && stats && (
          <DashboardView 
            stats={stats} 
            pipeline={pipeline} 
            onViewChange={setViewMode}
            onShowClientForm={() => setShowClientForm(true)}
            currentUser={currentUser}
          />
        )}

        {/* Opportunities Kanban View */}
        {viewMode === "pipeline" && (
          <OpportunitiesKanbanView 
            clients={clients}
            tasks={tasks}
            onRefresh={() => {
              loadClients()
              loadTasks()
            }}
            onClientClick={handleEditClient}
            onTaskClick={openTaskModal}
            onUpdateClientDisposition={handleUpdateClientDisposition}
            onUpdateTaskDisposition={handleUpdateTaskDisposition}
          />
        )}

        {/* Clients View */}
        {viewMode === "clients" && (
          <ClientsView
            clients={clients}
            searchQuery={searchQuery}
            statusFilter={clientStatusFilter}
            brandFilter={clientBrandFilter}
            onSearchChange={setSearchQuery}
            onStatusFilterChange={setClientStatusFilter}
            onBrandFilterChange={setClientBrandFilter}
            onAddClient={() => {
              setEditingClient(null)
              setClientForm({ company_name: "", contacts: [], status: "prospect", brand: "", pitch_value: "", next_followup_date: "", assigned_to: "", notes: "", source: "", is_opportunity: false, disposition: "", doc: "" })
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
            onRefresh={loadTasks}
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
        onFormChange={setClientForm}
        onSave={handleSaveClient}
        onClose={() => setShowClientForm(false)}
      />

      {/* Task Modal */}
      <TaskModal
        isOpen={showTaskModal}
        task={selectedTask}
        formData={taskForm}
        attachments={taskAttachments}
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
    </div>
  )
}
