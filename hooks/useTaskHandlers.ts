"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import {
  TEAM_MEMBERS,
  getTaskOwner,
} from "../components/crm/types"
import type {
  Task,
  TaskAttachment,
  TaskComment,
  CurrentUser,
  Brand,
  Disposition,
  DOC,
  SocialPlatform,
  ViewMode,
  Toast as ToastType,
} from "../components/crm/types"

// Task form data shape
export interface TaskFormData {
  title: string
  description: string
  assigned_to: string
  secondary_assigned_to: string[]
  brand: Brand | ""
  status: string
  priority: string
  due_date: string
  notes: string
  web_links: string[]
  tagged_users: string[]
  is_opportunity: boolean
  opportunity_id: string
  disposition: Disposition | ""
  doc: DOC | ""
  client_id: string
  client_name: string
  is_social_post: boolean
  social_post_date: string
  social_platforms: SocialPlatform[]
}

export const EMPTY_TASK_FORM: TaskFormData = {
  title: "",
  description: "",
  assigned_to: "",
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
  is_social_post: false,
  social_post_date: "",
  social_platforms: [],
}

interface UseTaskHandlersProps {
  tasks: Task[]
  setTasks: Dispatch<SetStateAction<Task[]>>
  selectedTask: Task | null
  setSelectedTask: Dispatch<SetStateAction<Task | null>>
  taskForm: TaskFormData
  setTaskForm: Dispatch<SetStateAction<TaskFormData>>
  taskAttachments: TaskAttachment[]
  setTaskAttachments: Dispatch<SetStateAction<TaskAttachment[]>>
  showTaskModal: boolean
  setShowTaskModal: Dispatch<SetStateAction<boolean>>
  currentUser: CurrentUser | null
  setToast: Dispatch<SetStateAction<ToastType | null>>
  newLink: string
  setNewLink: Dispatch<SetStateAction<string>>
  newComment: string
  setNewComment: Dispatch<SetStateAction<string>>
  assigneeFilter: string
  loadTasks: () => Promise<void>
  // Linked panel state
  taskOpenedFromLinkedPanel: boolean
  setTaskOpenedFromLinkedPanel: Dispatch<SetStateAction<boolean>>
  currentOpportunityForLinked: { id: string } | null
  setLinkedTasks: Dispatch<SetStateAction<Task[]>>
  setShowLinkedTasksPanel: Dispatch<SetStateAction<boolean>>
  // View state
  setViewMode: Dispatch<SetStateAction<ViewMode>>
}

export function useTaskHandlers({
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
}: UseTaskHandlersProps) {
  const [isSavingTask, setIsSavingTask] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  // Helper to convert assignee name to email
  const getAssigneeEmail = (name: string): string | null => {
    const member = TEAM_MEMBERS.find(m =>
      m.name.toLowerCase() === name.toLowerCase() ||
      m.name.split(" ")[0].toLowerCase() === name.toLowerCase()
    )
    return member?.email || null
  }

  // Open task modal for editing
  const openTaskModal = (task: Task) => {
    setSelectedTask(task)
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
      is_social_post: task.is_social_post || false,
      social_post_date: task.social_post_date || "",
      social_platforms: task.social_platforms || [],
    })
    setTaskAttachments(task.attachments || [])
    setShowTaskModal(true)
  }

  // Open task modal for creating a new task
  const handleAddTask = () => {
    const newTask: Task = {
      id: "",
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
      is_social_post: false,
      social_post_date: "",
      social_platforms: [],
      attachments: [],
      comments: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setSelectedTask(newTask)
    setTaskForm({
      ...EMPTY_TASK_FORM,
      assigned_to: currentUser?.name || assigneeFilter || "",
    })
    setTaskAttachments([])
    setShowTaskModal(true)
  }

  // Open task from notification
  const handleOpenTaskFromNotification = async (taskId: string) => {
    let task = tasks.find(t => t.id === taskId)
    if (task) {
      openTaskModal(task)
      return
    }

    try {
      setToast({ message: "Loading task...", type: "success" })
      const response = await fetch("/api/admin/crm/tasks?all=true")
      if (!response.ok) throw new Error("Failed to fetch tasks")
      const data = await response.json()
      const freshTasks: Task[] = data.tasks || []
      setTasks(freshTasks)

      task = freshTasks.find(t => t.id === taskId)
      if (task) {
        openTaskModal(task)
      } else {
        setViewMode("tasks")
        setToast({ message: "Could not find the task", type: "error" })
      }
    } catch (err) {
      console.error("Failed to load task from notification:", err)
      setToast({ message: "Could not find the task", type: "error" })
    }
  }

  // Delete task
  const handleDeleteTask = async () => {
    if (!selectedTask) return
    if (!confirm("Are you sure you want to delete this task? This action cannot be undone.")) return

    setIsSavingTask(true)
    try {
      const owner = getTaskOwner(selectedTask.assigned_to)
      const response = await fetch(`/api/admin/crm/tasks?id=${selectedTask.id}&owner=${owner}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to delete task")

      setToast({ message: "Task deleted", type: "success" })
      setShowTaskModal(false)
      setSelectedTask(null)
      loadTasks()
    } catch {
      setToast({ message: "Failed to delete task", type: "error" })
    } finally {
      setIsSavingTask(false)
    }
  }

  // Delete all tasks assigned to Team
  const handleDeleteTeamTasks = async () => {
    if (!confirm("Are you sure you want to delete ALL tasks assigned to Team? This action cannot be undone.")) return

    try {
      const response = await fetch("/api/admin/crm/tasks/delete-team", {
        method: "DELETE",
        credentials: "include",
      })
      if (!response.ok) throw new Error("Failed to delete team tasks")

      const data = await response.json()
      setToast({ message: data.message || "Team tasks deleted", type: "success" })
      loadTasks()
    } catch {
      setToast({ message: "Failed to delete team tasks", type: "error" })
    }
  }

  // Save task (create or update)
  const handleSaveTask = async () => {
    if (!selectedTask) return

    setIsSavingTask(true)
    try {
      const owner = getTaskOwner(taskForm.assigned_to)
      const isNewTask = !selectedTask.id

      // Track who needs to be notified
      const assigneesToNotify: string[] = []
      const taggedToNotify: string[] = []

      if (isNewTask) {
        if (taskForm.assigned_to && taskForm.assigned_to !== currentUser?.name) {
          const email = getAssigneeEmail(taskForm.assigned_to)
          if (email && email !== currentUser?.email) assigneesToNotify.push(email)
        }
        for (const name of taskForm.secondary_assigned_to) {
          if (name !== currentUser?.name) {
            const email = getAssigneeEmail(name)
            if (email && email !== currentUser?.email && !assigneesToNotify.includes(email)) assigneesToNotify.push(email)
          }
        }
        for (const email of taskForm.tagged_users) {
          if (email !== currentUser?.email && !assigneesToNotify.includes(email)) taggedToNotify.push(email)
        }

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

        const result = await response.json()
        const newTaskId = result.id || result.data?.id

        // Send notifications (async, don't block UI)
        if (assigneesToNotify.length > 0 && newTaskId) {
          fetch("/api/admin/crm/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              notificationType: "assignment",
              taskId: newTaskId,
              taskTitle: taskForm.title,
              assignedEmails: assigneesToNotify,
              assignedBy: currentUser?.name || "Someone",
            }),
          }).catch(err => console.error("Failed to send assignment notifications:", err))
        }
        if (taggedToNotify.length > 0 && newTaskId) {
          fetch("/api/admin/crm/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              notificationType: "tagged",
              taskId: newTaskId,
              taskTitle: taskForm.title,
              assignedEmails: taggedToNotify,
              assignedBy: currentUser?.name || "Someone",
            }),
          }).catch(err => console.error("Failed to send tagged notifications:", err))
        }

        setToast({ message: "Task created successfully", type: "success" })
      } else {
        // Update existing task
        const previousPrimaryAssignee = selectedTask.assigned_to
        const previousSecondaryAssignees = Array.isArray(selectedTask.secondary_assigned_to)
          ? selectedTask.secondary_assigned_to
          : selectedTask.secondary_assigned_to ? [selectedTask.secondary_assigned_to] : []
        const previousTaggedUsers = selectedTask.tagged_users || []

        if (taskForm.assigned_to && taskForm.assigned_to !== previousPrimaryAssignee && taskForm.assigned_to !== currentUser?.name) {
          const email = getAssigneeEmail(taskForm.assigned_to)
          if (email && email !== currentUser?.email) assigneesToNotify.push(email)
        }
        for (const name of taskForm.secondary_assigned_to) {
          if (!previousSecondaryAssignees.includes(name) && name !== currentUser?.name) {
            const email = getAssigneeEmail(name)
            if (email && email !== currentUser?.email && !assigneesToNotify.includes(email)) assigneesToNotify.push(email)
          }
        }
        for (const email of taskForm.tagged_users) {
          if (!previousTaggedUsers.includes(email) && email !== currentUser?.email) taggedToNotify.push(email)
        }

        let updateOwner = owner
        if (selectedTask.status === "completed") updateOwner = "completed"

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

        if (assigneesToNotify.length > 0) {
          fetch("/api/admin/crm/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              notificationType: "assignment",
              taskId: selectedTask.id,
              taskTitle: taskForm.title,
              assignedEmails: assigneesToNotify,
              assignedBy: currentUser?.name || "Someone",
            }),
          }).catch(err => console.error("Failed to send assignment notifications:", err))
        }
        if (taggedToNotify.length > 0) {
          fetch("/api/admin/crm/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              notificationType: "tagged",
              taskId: selectedTask.id,
              taskTitle: taskForm.title,
              assignedEmails: taggedToNotify,
              assignedBy: currentUser?.name || "Someone",
            }),
          }).catch(err => console.error("Failed to send tagged notifications:", err))
        }

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
      await loadTasks()

      // If opened from linked panel, refresh linked tasks
      if (taskOpenedFromLinkedPanel && currentOpportunityForLinked) {
        const opportunityId = currentOpportunityForLinked.id
        const response = await fetch("/api/admin/crm/tasks", { credentials: "include" })
        if (response.ok) {
          const data = await response.json()
          const allTasks = data.tasks || []
          const refreshedLinkedTasks = allTasks.filter((t: Task) => t.opportunity_id === opportunityId)
          setLinkedTasks(refreshedLinkedTasks)
        }
        setTaskOpenedFromLinkedPanel(false)
        setShowLinkedTasksPanel(true)
      } else {
        setTaskOpenedFromLinkedPanel(false)
      }
    } catch {
      setToast({ message: `Failed to ${!selectedTask.id ? "create" : "update"} task`, type: "error" })
    } finally {
      setIsSavingTask(false)
    }
  }

  // Handle file upload - supports multiple files
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !selectedTask || !currentUser) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const maxSize = 50 * 1024 * 1024
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)

      if (file.size > maxSize) {
        setToast({ message: `File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is 50MB.`, type: "error" })
        continue
      }

      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv",
      ]

      if (!allowedTypes.includes(file.type)) {
        setToast({ message: `File "${file.name}" type not supported. Use images, PDF, DOC, XLS, or TXT.`, type: "error" })
        continue
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || `Upload failed (${response.status})`
          if (response.status === 413) {
            setToast({ message: `File "${file.name}" is too large. Maximum size is 50MB.`, type: "error" })
          } else {
            setToast({ message: errorMessage, type: "error" })
          }
          continue
        }

        const data = await response.json()
        let fileType: "image" | "document" | "link" = "document"
        if (file.type.startsWith("image/")) fileType = "image"

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

        if (selectedTask.id) {
          const owner = getTaskOwner(selectedTask.assigned_to)
          await fetch("/api/admin/crm/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id: selectedTask.id, owner, attachments: updatedAttachments }),
          })
          setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, attachments: updatedAttachments } : t))
        } else {
          setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
        }

        setToast({ message: `File "${file.name}" uploaded successfully`, type: "success" })
      } catch (err) {
        console.error("Upload error:", err)
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

    setIsUploadingFile(false)
    e.target.value = ""
  }

  // Remove attachment
  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!selectedTask) return

    const updatedAttachments = taskAttachments.filter(a => a.id !== attachmentId)
    setTaskAttachments(updatedAttachments)

    if (selectedTask.id) {
      try {
        const owner = getTaskOwner(selectedTask.assigned_to)
        await fetch("/api/admin/crm/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: selectedTask.id, owner, attachments: updatedAttachments }),
        })
        setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, attachments: updatedAttachments } : t))
      } catch (err) {
        console.error("Failed to remove attachment:", err)
      }
    } else {
      setSelectedTask({ ...selectedTask, attachments: updatedAttachments })
    }
  }

  // Handle file drop for drag and drop uploads
  const handleFileDrop = async (files: FileList) => {
    if (!files || files.length === 0 || !selectedTask || !currentUser) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const maxSize = 50 * 1024 * 1024
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1)

      if (file.size > maxSize) {
        setToast({ message: `File "${file.name}" is too large (${fileSizeMB}MB). Maximum size is 50MB.`, type: "error" })
        continue
      }

      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv",
      ]

      if (!allowedTypes.includes(file.type)) {
        setToast({ message: `File "${file.name}" type not supported. Use images, PDF, DOC, XLS, or TXT.`, type: "error" })
        continue
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          setToast({ message: errorData.error || `Upload failed (${response.status})`, type: "error" })
          continue
        }

        const data = await response.json()
        let fileType: "image" | "document" | "link" = "document"
        if (file.type.startsWith("image/")) fileType = "image"

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

        if (selectedTask.id) {
          const owner = getTaskOwner(selectedTask.assigned_to)
          await fetch("/api/admin/crm/tasks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ id: selectedTask.id, owner, attachments: updatedAttachments }),
          })
        }

        setToast({ message: `Uploaded ${file.name}`, type: "success" })
      } catch (err) {
        console.error("Upload error:", err)
        setToast({ message: `Failed to upload ${file.name}`, type: "error" })
      } finally {
        setIsUploadingFile(false)
      }
    }
  }

  // Quick status change handler for TasksView
  const handleQuickStatusChange = async (taskId: string, newStatus: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))

    try {
      let owner = getTaskOwner(task.assigned_to)
      if (task.status === "completed") owner = "completed"

      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: taskId, owner, status: newStatus }),
      })
      if (!response.ok) throw new Error("Failed to update status")

      const result = await response.json()
      if (result.reactivated) {
        setToast({ message: "Task reactivated", type: "success" })
      } else if (result.moved) {
        setToast({ message: "Task marked as completed", type: "success" })
      } else {
        setToast({ message: "Status updated", type: "success" })
      }
      loadTasks()
    } catch {
      console.error("Failed to update status")
      setToast({ message: "Failed to update status", type: "error" })
      setTasks(prev => prev.map(t => t.id === taskId ? task : t))
    }
  }

  // Update task disposition via drag-and-drop in Kanban
  const handleUpdateTaskDisposition = async (taskId: string, disposition: Disposition) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const owner = getTaskOwner(task.assigned_to)
    const wasClosedWon = task.disposition === "closed_won"
    const shouldAutoSetDocTo100 = disposition === "closed_won" && task.is_opportunity
    const shouldAutoSetDocTo25 = task.is_opportunity && (wasClosedWon && disposition === "pitched" || disposition === "closed_lost")

    let docValue: DOC | undefined = undefined
    if (shouldAutoSetDocTo100) docValue = "100" as DOC
    else if (shouldAutoSetDocTo25) docValue = "25" as DOC

    try {
      const updatePayload: { id: string; owner: string; disposition: Disposition; doc?: DOC } = {
        id: taskId, owner, disposition,
      }
      if (docValue) updatePayload.doc = docValue

      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      })
      if (!response.ok) throw new Error("Failed to update task")

      setTasks(prev =>
        prev.map(t => {
          if (t.id === taskId) {
            const updates: Partial<Task> = { disposition }
            if (docValue) updates.doc = docValue
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
    } catch {
      setToast({ message: "Failed to move task", type: "error" })
    }
  }

  // Add a web link to the task
  const handleAddLink = () => {
    if (newLink.trim()) {
      let url = newLink.trim()
      if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url
      setTaskForm(prev => ({ ...prev, web_links: [...prev.web_links, url] }))
      setNewLink("")
    }
  }

  // Remove a web link
  const handleRemoveLink = (index: number) => {
    setTaskForm(prev => ({ ...prev, web_links: prev.web_links.filter((_, i) => i !== index) }))
  }

  // Toggle user tag
  const toggleUserTag = (email: string) => {
    setTaskForm(prev => ({
      ...prev,
      tagged_users: prev.tagged_users.includes(email)
        ? prev.tagged_users.filter(e => e !== email)
        : [...prev.tagged_users, email],
    }))
  }

  // Add a comment to the task
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask || !currentUser) return

    // Extract mentions from comment
    const mentionRegex = /@(\w+(?:\s+\w+)?)/g
    const mentions: string[] = []
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionName = match[1].toLowerCase()
      const firstName = mentionName.split(/\s+/)[0]
      const mentionedMember = TEAM_MEMBERS.find(m =>
        m.name.toLowerCase() === mentionName ||
        m.name.split(" ")[0].toLowerCase() === mentionName ||
        m.name.split(" ")[0].toLowerCase() === firstName
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

    const updatedComments = [...(selectedTask.comments || []), comment]
    const updatedTask = { ...selectedTask, comments: updatedComments }
    setSelectedTask(updatedTask)
    setNewComment("")

    if (!selectedTask.id) {
      setToast({ message: "Comment added (will be saved with task)", type: "success" })
      return
    }

    try {
      const owner = getTaskOwner(selectedTask.assigned_to)
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selectedTask.id, owner, comments: updatedComments }),
      })
      if (!response.ok) throw new Error("Failed to save comment")

      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t))
      setToast({ message: "Comment added", type: "success" })

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
        }).catch(err => console.error("Failed to send notifications:", err))
      }
    } catch {
      console.error("Failed to save comment")
      setToast({ message: "Failed to save comment", type: "error" })
      setSelectedTask(selectedTask)
    }
  }

  // Delete a comment from the task
  const handleDeleteComment = async (commentId: string) => {
    if (!selectedTask || !currentUser) return

    const updatedComments = (selectedTask.comments || []).filter(c => c.id !== commentId)
    const updatedTask = { ...selectedTask, comments: updatedComments }
    setSelectedTask(updatedTask)

    if (!selectedTask.id) {
      setToast({ message: "Comment deleted", type: "success" })
      return
    }

    try {
      const owner = getTaskOwner(selectedTask.assigned_to)
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selectedTask.id, owner, comments: updatedComments }),
      })
      if (!response.ok) throw new Error("Failed to delete comment")

      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t))
      setToast({ message: "Comment deleted", type: "success" })
    } catch {
      console.error("Failed to delete comment")
      setToast({ message: "Failed to delete comment", type: "error" })
      setSelectedTask(selectedTask)
    }
  }

  // Edit an existing comment
  const handleEditComment = async (commentId: string, newContent: string) => {
    if (!selectedTask || !currentUser) return

    const updatedComments = (selectedTask.comments || []).map(c =>
      c.id === commentId
        ? { ...c, content: newContent, updated_at: new Date().toISOString() }
        : c
    )
    const updatedTask = { ...selectedTask, comments: updatedComments }
    setSelectedTask(updatedTask)

    if (!selectedTask.id) {
      setToast({ message: "Comment updated", type: "success" })
      return
    }

    try {
      const owner = getTaskOwner(selectedTask.assigned_to)
      const response = await fetch("/api/admin/crm/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: selectedTask.id, owner, comments: updatedComments }),
      })
      if (!response.ok) throw new Error("Failed to update comment")

      setTasks(prev => prev.map(t => t.id === selectedTask.id ? updatedTask : t))
      setToast({ message: "Comment updated", type: "success" })
    } catch {
      console.error("Failed to update comment")
      setToast({ message: "Failed to update comment", type: "error" })
      setSelectedTask(selectedTask)
    }
  }

  return {
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
  }
}
