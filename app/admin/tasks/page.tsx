"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { Toast, TasksView, TaskDetailDrawer } from "@/components/crm"
import type { Client, Task, Toast as ToastType, CurrentUser, TaskAttachment } from "@/components/crm/types"
import { useTaskHandlers, EMPTY_TASK_FORM } from "@/hooks/useTaskHandlers"
import type { TaskFormData } from "@/hooks/useTaskHandlers"

// /admin/tasks: every task as one list, on its own page in the sidebar (founder, 2026-11-19: "approve list for Tasks";
// tasks are not only deals, so not a tab on Opportunities). It restores the list the Opportunities page's Tasks tab
// held until 2026-07-05. Opportunity tasks still show on the Pipeline kanban too. Display Standard §3.21 (Provisional).
//
// ?new=task opens the new-task form (the command palette's "Create task"); ?openTask=<id> opens that task.

function TasksPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<ToastType | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, string>>({})

  const [searchQuery, setSearchQuery] = useState("")
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")

  const [showTaskModal, setShowTaskModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskForm, setTaskForm] = useState<TaskFormData>(EMPTY_TASK_FORM)
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([])
  const [newLink, setNewLink] = useState("")
  const [newComment, setNewComment] = useState("")
  // The handlers serve the Pipeline's linked-tasks panel too; this page has no panel, so these stay idle.
  const [taskOpenedFromLinkedPanel, setTaskOpenedFromLinkedPanel] = useState(false)
  const [, setLinkedTasks] = useState<Task[]>([])
  const [, setShowLinkedTasksPanel] = useState(false)

  const loadTasks = async () => {
    try {
      const response = await fetch("/api/admin/crm/tasks?all=true")
      if (!response.ok) throw new Error("Failed to fetch tasks")
      const data = await response.json()
      setTasks(data.tasks || [])
    } catch {
      setToast({ message: "Failed to load tasks", type: "error" })
    }
  }

  // The drawer links a task to a client or an opportunity, so it needs the list of both.
  const loadClients = async () => {
    try {
      const response = await fetch("/api/admin/crm/clients")
      if (!response.ok) throw new Error("Failed to fetch clients")
      const data = await response.json()
      setClients(data.clients || [])
    } catch {
      // The list still works without them; only the drawer's link pickers are empty.
    }
  }

  const loadCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/session")
      if (!response.ok) return
      const data = await response.json()
      if (data.user) setCurrentUser(data.user)
    } catch {}
  }

  const loadTeamMembersMap = async () => {
    try {
      const response = await fetch("/api/admin/team-members")
      if (!response.ok) return
      const data = await response.json()
      if (!data.success || !data.data) return
      const map: Record<string, string> = {}
      for (const member of data.data) {
        if (member.email && member.name && member.isActive) map[member.email.toLowerCase()] = member.name
      }
      setTeamMembersMap(map)
    } catch {}
  }

  const {
    isSavingTask,
    isUploadingFile,
    openTaskModal,
    handleAddTask,
    handleOpenTaskFromNotification,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleSaveTask,
    handleFileUpload,
    handleRemoveAttachment,
    handleFileDrop,
    handleQuickStatusChange,
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
    currentOpportunityForLinked: null,
    setLinkedTasks,
    setShowLinkedTasksPanel,
  })

  useEffect(() => {
    Promise.all([loadTasks(), loadClients(), loadTeamMembersMap()]).finally(() => setIsLoading(false))
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  // Start on the signed-in person's own tasks, as the Opportunities tab did.
  useEffect(() => {
    if (!currentUser?.email || Object.keys(teamMembersMap).length === 0) return
    const matchedName = teamMembersMap[currentUser.email.toLowerCase()]
    if (matchedName) setAssigneeFilter(matchedName)
    else if (currentUser.name) setAssigneeFilter(currentUser.name)
  }, [currentUser, teamMembersMap])

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    mutate(params)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // ?new=task opens an empty form once, then leaves the URL so closing it does not reopen it.
  const newParam = searchParams?.get("new") ?? null
  useEffect(() => {
    if (!newParam) return
    if (newParam === "task") handleAddTask()
    replaceQuery((p) => p.delete("new"))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam])

  // ?openTask=<id> opens that task once the list has loaded; a task outside the loaded list is fetched fresh.
  const openTaskId = searchParams?.get("openTask") ?? null
  useEffect(() => {
    if (!openTaskId) {
      if (showTaskModal && selectedTask) {
        setShowTaskModal(false)
        setSelectedTask(null)
      }
      return
    }
    if (isLoading) return
    if (selectedTask?.id === openTaskId && showTaskModal) return
    handleOpenTaskFromNotification(openTaskId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTaskId, isLoading])

  // Keep ?openTask= in step with the open task, so refresh and share land on it, and drop it once a save or delete
  // closes the drawer, so a refresh does not reopen a task already dealt with.
  useEffect(() => {
    if (!showTaskModal) {
      if (!isLoading && openTaskId && !selectedTask) replaceQuery((p) => p.delete("openTask"))
      return
    }
    if (!selectedTask?.id) return
    if (searchParams?.get("openTask") === selectedTask.id) return
    replaceQuery((p) => p.set("openTask", selectedTask.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTaskModal, selectedTask?.id])

  const closeTaskDrawer = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
    setTaskOpenedFromLinkedPanel(false)
    setTaskForm(EMPTY_TASK_FORM)
    setNewLink("")
    setNewComment("")
    setTaskAttachments([])
    if (searchParams?.get("openTask")) replaceQuery((p) => p.delete("openTask"))
  }

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <Toast toast={toast} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading tasks">
            <div className="h-5 w-24 rounded bg-neutral-200/80" />
            <div className="h-4 w-72 rounded bg-neutral-200/70" />
            <div className="h-9 w-full rounded-md bg-neutral-200/60" />
            <div className="rounded-md ring-1 ring-neutral-200/70 bg-white divide-y divide-neutral-100">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 px-4 flex items-center">
                  <div className="h-3.5 w-1/2 rounded bg-neutral-200/70" />
                </div>
              ))}
            </div>
          </div>
        ) : (
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
            onBulkDelete={handleBulkDeleteTasks}
          />
        )}
      </div>

      <TaskDetailDrawer
        open={showTaskModal}
        task={selectedTask}
        formData={taskForm}
        attachments={taskAttachments}
        opportunities={clients
          .filter((c) => c.is_opportunity && c.disposition !== "closed_lost")
          .map((c) => ({ id: c.id, company_name: c.company_name, title: c.title }))}
        clients={clients.map((c) => ({ id: c.id, company_name: c.company_name, name: c.name }))}
        currentUser={currentUser}
        isSaving={isSavingTask}
        isUploadingFile={isUploadingFile}
        newLink={newLink}
        newComment={newComment}
        showBackButton={false}
        onBackToLinkedItems={() => {}}
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
    </div>
  )
}

// Same reach as the Opportunities page the list came from.
export default function TasksPage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <TasksPageInner />
    </AdminRoleGuard>
  )
}
