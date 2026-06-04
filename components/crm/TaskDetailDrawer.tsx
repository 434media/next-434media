"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Link2, 
  Upload, 
  FileText, 
  Image as ImageIcon,
  MessageSquare,
  Plus,
  ExternalLink,
  Send,
  Trash2,
  Users,
  Check,
  ChevronDown,
  Pencil,
  Target,
  Search,
  Building2,
  ArrowLeft
} from "lucide-react"
import {
  BRANDS,
  TEAM_MEMBERS,
  getDueDateStatus,
  formatDate
} from "./types"
import type { Task, TaskAttachment, CurrentUser, Brand } from "./types"
import type { TaskFormData } from "@/hooks/useTaskHandlers"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { useTeamMembers } from "@/hooks/useTeamMembers"

// Simplified opportunity type for selection
interface OpportunityOption {
  id: string
  company_name?: string
  title?: string
}

// Simplified client type for selection (non-opportunity contacts)
interface ClientOption {
  id: string
  company_name?: string
  name?: string
}

interface TaskDetailDrawerProps {
  open: boolean
  task: Task | null
  formData: TaskFormData
  attachments: TaskAttachment[]
  opportunities: OpportunityOption[]
  clients: ClientOption[]
  currentUser: CurrentUser | null
  isSaving: boolean
  isUploadingFile: boolean
  newLink: string
  newComment: string
  onFormChange: (data: TaskFormData) => void
  onNewLinkChange: (link: string) => void
  onNewCommentChange: (comment: string) => void
  onAddLink: () => void
  onRemoveLink: (index: number) => void
  onToggleUserTag: (email: string) => void
  onAddComment: () => void
  onDeleteComment?: (commentId: string) => void
  onEditComment?: (commentId: string, newContent: string) => void
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onFileDrop?: (files: FileList) => void
  onRemoveAttachment: (id: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  onBackToLinkedItems?: () => void  // Optional: for navigating back to linked items panel
  showBackButton?: boolean  // Optional: show back button when opened from linked items
}

export function TaskDetailDrawer({
  open,
  task,
  formData,
  attachments,
  opportunities,
  clients,
  currentUser,
  isSaving,
  isUploadingFile,
  newLink,
  newComment,
  onFormChange,
  onNewLinkChange,
  onNewCommentChange,
  onAddLink,
  onRemoveLink,
  onToggleUserTag,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onFileUpload,
  onFileDrop,
  onRemoveAttachment,
  onSave,
  onDelete,
  onClose,
  onBackToLinkedItems,
  showBackButton = false,
}: TaskDetailDrawerProps) {
  // Assignable roster (read-only). Management lives in CRM Settings → Team
  // members; refetched each time the drawer opens.
  const { members: teamMembers, isLoading: isLoadingMembers } = useTeamMembers(open)

  // Assignee dropdown open state
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSecondaryDropdown, setShowSecondaryDropdown] = useState(false)

  // State for drag-and-drop file upload
  const [isDragOver, setIsDragOver] = useState(false)

  // State for comment editing
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editCommentContent, setEditCommentContent] = useState("")

  // State for the "Link to" picker (links the task to a client or opportunity)
  const [showLinkDropdown, setShowLinkDropdown] = useState(false)
  const [linkSearchQuery, setLinkSearchQuery] = useState("")

  // Unified "Link to" options: opportunities (tagged) + plain clients. Both are
  // crm_clients rows; tagging each row lets the picker set the right foreign key
  // (opportunity_id vs client_id). Plain clients are deduped by name
  // (case-insensitive, so "HEB" and "HEB " collapse).
  const opportunityIdSet = new Set(opportunities.map((o) => o.id))
  const linkOptions = [
    ...opportunities.map((o) => ({
      id: o.id,
      name: (o.title || o.company_name || "Unnamed opportunity").trim(),
      kind: "opportunity" as const,
    })),
    ...clients
      .filter((c) => !opportunityIdSet.has(c.id) && (c.company_name || c.name))
      .reduce(
        (acc, c) => {
          const name = (c.company_name || c.name || "").trim()
          if (!acc.find((x) => x.name.toLowerCase() === name.toLowerCase())) {
            acc.push({ id: c.id, name, kind: "client" as const })
          }
          return acc
        },
        [] as { id: string; name: string; kind: "client" }[],
      ),
  ].sort((a, b) => a.name.localeCompare(b.name))

  const filteredLinkOptions = linkOptions.filter((o) =>
    o.name.toLowerCase().includes(linkSearchQuery.toLowerCase()),
  )

  // Trigger label: the linked opportunity's name, else the linked client name.
  const linkedLabel = formData.opportunity_id
    ? linkOptions.find((o) => o.id === formData.opportunity_id)?.name ?? "Linked opportunity"
    : formData.client_name || ""

  if (!task) return null

  // Create vs. detail mode. A brand-new task has no id; collaboration/metadata
  // sections (comments, attachments, links, created-by) are only meaningful once
  // the task exists, so they're hidden while creating.
  const isNew = !task.id

  const dueDateStatus = getDueDateStatus(task.due_date, task.status)

  const drawerTitle = task.id ? formData.title || "Task" : "New Task"
  const dueBadge =
    dueDateStatus === "overdue" ? (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-600 text-xs font-medium">
        <AlertCircle className="w-3 h-3" />
        Overdue
      </span>
    ) : dueDateStatus === "approaching" ? (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-600 text-xs font-medium">
        <Clock className="w-3 h-3" />
        Due Soon
      </span>
    ) : null

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={task.id ? "Edit task" : "Create a new task"}
      badge={dueBadge}
      width="xl"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {task.id && (
              <button
                type="button"
                onClick={onDelete}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showBackButton && onBackToLinkedItems && (
              <button
                type="button"
                onClick={onBackToLinkedItems}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 text-sm font-medium transition-colors"
                title="Back to linked items"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {task.id ? "Saving…" : "Creating…"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {task.id ? "Save Changes" : "Create Task"}
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-6">
        {/* Basic Info Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white resize-y min-h-25 max-h-75"
                    placeholder="Task description..."
                  />
                </div>

                {/* Created-by / date — reference metadata, only meaningful once the
                    task exists. Shown as a muted line, not disabled inputs. */}
                {!isNew && (
                  <p className="text-xs text-neutral-400">
                    Created by {task.created_by || "—"} · {formatDate(task.created_at)}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => onFormChange({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="to_do">To Do</option>
                      <option value="ready_for_review">Ready for Review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Platform</label>
                    <select
                      value={formData.brand}
                      onChange={(e) => onFormChange({ ...formData, brand: e.target.value as Brand | "" })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    >
                      <option value="">No platform</option>
                      {BRANDS.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => onFormChange({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Link to</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setShowLinkDropdown(!showLinkDropdown)
                          setLinkSearchQuery("")
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white flex items-center justify-between"
                      >
                        <span className={(formData.opportunity_id || formData.client_id) ? "text-neutral-900 truncate" : "text-neutral-400"}>
                          {linkedLabel || "Nothing linked"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${showLinkDropdown ? "rotate-180" : ""}`} />
                      </button>
                      
                      {/* Link-to dropdown menu */}
                      <AnimatePresence>
                        {showLinkDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute z-30 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
                          >
                            {/* Search input */}
                            <div className="p-2 border-b border-neutral-100">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                  type="text"
                                  value={linkSearchQuery}
                                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                                  placeholder="Search clients & opportunities..."
                                  className="w-full pl-8 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 rounded-md focus:outline-none focus:border-neutral-400 focus:bg-white"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>
                            
                            <div className="max-h-48 overflow-y-auto">
                              {/* Nothing-linked option */}
                              <button
                                type="button"
                                onClick={() => {
                                  onFormChange({ ...formData, client_id: "", client_name: "", opportunity_id: "" })
                                  setShowLinkDropdown(false)
                                  setLinkSearchQuery("")
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between"
                              >
                                <span className="text-neutral-500">Nothing linked</span>
                                {!formData.client_id && !formData.opportunity_id && <Check className="w-4 h-4 text-neutral-900" />}
                              </button>
                              
                              <div className="border-t border-neutral-100" />
                              
                              {/* Filtered options (clients + opportunities) */}
                              {filteredLinkOptions.length === 0 ? (
                                <div className="px-3 py-4 text-center text-sm text-neutral-500">
                                  {linkSearchQuery ? "No matches found" : "Nothing available"}
                                </div>
                              ) : (
                                <>
                                  {filteredLinkOptions.slice(0, 50).map((option) => {
                                    const isOpp = option.kind === "opportunity"
                                    const selected = isOpp
                                      ? formData.opportunity_id === option.id
                                      : formData.client_id === option.id
                                    return (
                                      <button
                                        key={`${option.kind}-${option.id}`}
                                        type="button"
                                        onClick={() => {
                                          onFormChange(
                                            isOpp
                                              ? { ...formData, opportunity_id: option.id, client_id: "", client_name: "" }
                                              : { ...formData, client_id: option.id, client_name: option.name, opportunity_id: "" }
                                          )
                                          setShowLinkDropdown(false)
                                          setLinkSearchQuery("")
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isOpp ? (
                                            <Target className="w-4 h-4 text-sky-500 shrink-0" />
                                          ) : (
                                            <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
                                          )}
                                          <span className="text-neutral-900 truncate">{option.name}</span>
                                          {isOpp && (
                                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 text-[10px] font-medium uppercase tracking-wide">
                                              Opp
                                            </span>
                                          )}
                                        </div>
                                        {selected && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
                                      </button>
                                    )
                                  })}
                                  {linkOptions.length > 50 && (
                                    <div className="px-3 py-2 text-center text-xs text-neutral-500 bg-neutral-50">
                                      Showing {Math.min(50, filteredLinkOptions.length)} of {linkOptions.length}. Type to search for more.
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {showLinkDropdown && (
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => {
                            setShowLinkDropdown(false)
                            setLinkSearchQuery("")
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment Section */}
                <div className="pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-neutral-500" />
                      <label className="text-sm font-medium text-neutral-700">Assignment</label>
                    </div>
                    <a
                      href="/admin/crm/settings?tab=team"
                      className="text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      Manage team →
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Primary Assignee */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Primary</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowDropdown(!showDropdown)}
                          className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white flex items-center justify-between"
                        >
                          <span className={formData.assigned_to ? "text-neutral-900 truncate" : "text-neutral-400"}>
                            {formData.assigned_to || "Select..."}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${showDropdown ? "rotate-180" : ""}`} />
                        </button>
                        
                        {/* Dropdown menu */}
                        <AnimatePresence>
                          {showDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
                            >
                              <div className="max-h-64 overflow-y-auto">
                                {/* Unassigned option */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    onFormChange({ ...formData, assigned_to: "Unassigned" })
                                    setShowDropdown(false)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between"
                                >
                                  <span className="text-neutral-500">Unassigned</span>
                                  {formData.assigned_to === "Unassigned" && <Check className="w-4 h-4 text-neutral-900" />}
                                </button>
                                
                                <div className="border-t border-neutral-100" />
                                
                                {/* Team members */}
                                {isLoadingMembers ? (
                                  <div className="px-3 py-4 text-center">
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400" />
                                  </div>
                                ) : (
                                  <>
                                    {teamMembers.map((member) => (
                                      <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => {
                                          onFormChange({ ...formData, assigned_to: member.name })
                                          setShowDropdown(false)
                                        }}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between"
                                      >
                                        <span className="text-neutral-900 truncate">{member.name}</span>
                                        {formData.assigned_to === member.name && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
                                      </button>
                                    ))}
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {showDropdown && (
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowDropdown(false)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Secondary Assignee - Multi-select */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 mb-1.5">Secondary (Multi-select)</label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowSecondaryDropdown(!showSecondaryDropdown)}
                          className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 focus:bg-white flex items-center justify-between min-h-9.5"
                        >
                          <span className={formData.secondary_assigned_to.length > 0 ? "text-neutral-900 truncate" : "text-neutral-400"}>
                            {formData.secondary_assigned_to.length > 0 
                              ? formData.secondary_assigned_to.length === 1 
                                ? formData.secondary_assigned_to[0]
                                : `${formData.secondary_assigned_to.length} selected`
                              : "None"}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${showSecondaryDropdown ? "rotate-180" : ""}`} />
                        </button>
                        
                        {/* Selected members chips */}
                        {formData.secondary_assigned_to.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {formData.secondary_assigned_to.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 text-neutral-900 text-xs rounded-full"
                              >
                                {name}
                                <button
                                  type="button"
                                  onClick={() => {
                                    onFormChange({
                                      ...formData,
                                      secondary_assigned_to: formData.secondary_assigned_to.filter(n => n !== name)
                                    })
                                  }}
                                  className="hover:text-neutral-900"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Dropdown menu - Multi-select */}
                        <AnimatePresence>
                          {showSecondaryDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              className="absolute z-20 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden"
                            >
                              <div className="max-h-64 overflow-y-auto">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onFormChange({ ...formData, secondary_assigned_to: [] })
                                    setShowSecondaryDropdown(false)
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 flex items-center justify-between"
                                >
                                  <span className="text-neutral-500">Clear all</span>
                                  {formData.secondary_assigned_to.length === 0 && <Check className="w-4 h-4 text-neutral-900" />}
                                </button>
                                
                                <div className="border-t border-neutral-100" />
                                
                                {isLoadingMembers ? (
                                  <div className="px-3 py-4 text-center">
                                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-400" />
                                  </div>
                                ) : (
                                  <>
                                    {teamMembers.map((member) => {
                                      const isSelected = formData.secondary_assigned_to.includes(member.name)
                                      return (
                                        <button
                                          key={member.id}
                                          type="button"
                                          onClick={() => {
                                            if (isSelected) {
                                              onFormChange({
                                                ...formData,
                                                secondary_assigned_to: formData.secondary_assigned_to.filter(n => n !== member.name)
                                              })
                                            } else {
                                              onFormChange({
                                                ...formData,
                                                secondary_assigned_to: [...formData.secondary_assigned_to, member.name]
                                              })
                                            }
                                          }}
                                          className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between ${isSelected ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                                        >
                                          <span className="text-neutral-900 truncate">{member.name}</span>
                                          {isSelected && <Check className="w-4 h-4 text-neutral-900 shrink-0" />}
                                        </button>
                                      )
                                    })}
                                  </>
                                )}
                                {formData.secondary_assigned_to.length > 0 && (
                                  <>
                                    <div className="border-t border-neutral-100" />
                                    <button
                                      type="button"
                                      onClick={() => setShowSecondaryDropdown(false)}
                                      className="w-full px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50 flex items-center justify-center gap-2 font-medium"
                                    >
                                      Done
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {showSecondaryDropdown && (
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setShowSecondaryDropdown(false)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Web Links Section — detail-only (hidden while creating) */}
              {!isNew && (
              <div className="pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  <Link2 className="w-4 h-4 inline mr-2" />
                  Web Links
                </label>
                <div className="space-y-2">
                  {formData.web_links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                      <ExternalLink className="w-4 h-4 text-neutral-400 shrink-0" />
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-neutral-900 hover:text-neutral-700 truncate flex-1"
                      >
                        {link}
                      </a>
                      <button
                        onClick={() => onRemoveLink(index)}
                        className="p-1 rounded hover:bg-neutral-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-neutral-400" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newLink}
                      onChange={(e) => onNewLinkChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddLink())}
                      placeholder="Add a link (https://...)"
                      className="flex-1 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    />
                    <button
                      onClick={onAddLink}
                      disabled={!newLink.trim()}
                      className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 text-neutral-700" />
                    </button>
                  </div>
                </div>
              </div>
              )}

              {/* File Attachments Section — detail-only */}
              {!isNew && (
              <div className="pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Attachments
                </label>
                
                {/* Existing Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                        {attachment.type === "image" ? (
                          <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-neutral-900 shrink-0" />
                        )}
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-neutral-900 hover:text-neutral-700 truncate flex-1"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-xs text-neutral-500">
                          {attachment.uploaded_by}
                        </span>
                        <button
                          onClick={() => onRemoveAttachment(attachment.id)}
                          className="p-1 rounded hover:bg-neutral-200 transition-colors"
                        >
                          <X className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Drag and Drop Upload Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragOver(true)
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragOver(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsDragOver(false)
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFileDrop) {
                      onFileDrop(e.dataTransfer.files)
                    }
                  }}
                  className={`relative rounded-lg border-2 border-dashed transition-all ${
                    isDragOver 
                      ? "border-neutral-400 bg-neutral-100" 
                      : "border-neutral-300 hover:border-neutral-400 bg-neutral-50"
                  }`}
                >
                  <label className="flex items-center justify-center gap-2 p-4 cursor-pointer">
                    {isUploadingFile ? (
                      <>
                        <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                        <span className="text-sm text-neutral-500">Uploading...</span>
                      </>
                    ) : isDragOver ? (
                      <>
                        <Upload className="w-5 h-5 text-neutral-900" />
                        <span className="text-sm text-neutral-900 font-medium">
                          Drop files here
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-neutral-400" />
                        <span className="text-sm text-neutral-500">
                          Drag & drop files here, or click to browse
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      onChange={onFileUpload}
                      disabled={isUploadingFile}
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      className="hidden"
                      multiple
                    />
                  </label>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Supports images, PDF, DOC, XLS, TXT (max 50MB per file)
                </p>
              </div>
              )}

              <div className="pt-4 border-t border-neutral-200 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.is_opportunity ? 'bg-sky-100' : 'bg-neutral-200'}`}>
                      <Target className={`w-4 h-4 ${formData.is_opportunity ? 'text-sky-600' : 'text-neutral-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">Track in pipeline</p>
                      <p className="text-xs text-neutral-500">Show this task as a card in the opportunities pipeline</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onFormChange({ ...formData, is_opportunity: !formData.is_opportunity })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      formData.is_opportunity ? 'bg-sky-600' : 'bg-neutral-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        formData.is_opportunity ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                
                {/* Linking to a parent opportunity is done via "Link to" above;
                    this toggle only controls pipeline visibility. */}
                {formData.is_opportunity && (
                  <p className="pl-12 text-xs text-neutral-500">
                    Appears in the pipeline&apos;s Pitched column by default — drag it in the kanban to set its stage.
                  </p>
                )}
              </div>

              {/* Comments Section — detail-only */}
              {!isNew && (
              <div className="pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Comments & Updates
                </label>
                
                {/* Existing Comments */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
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
                                  {formatDate(comment.created_at)}
                                  {comment.updated_at && comment.updated_at !== comment.created_at && (
                                    <span className="ml-1 text-neutral-400">(edited)</span>
                                  )}
                                </span>
                              </div>
                              {/* Edit/Delete buttons - only show for comment author */}
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
                                        <Pencil className="w-3 h-3 text-neutral-400 hover:text-neutral-900" />
                                      </button>
                                      {onDeleteComment && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (confirm("Delete this comment?")) {
                                              onDeleteComment(comment.id)
                                            }
                                          }}
                                          className="p-1 rounded hover:bg-neutral-200 transition-colors"
                                          title="Delete comment"
                                        >
                                          <Trash2 className="w-3 h-3 text-neutral-400 hover:text-red-600" />
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
                                  className="w-full px-3 py-2 rounded-lg bg-white border border-neutral-300 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400 resize-y min-h-15 max-h-50"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onEditComment && editCommentContent.trim()) {
                                        onEditComment(comment.id, editCommentContent.trim())
                                      }
                                      setEditingCommentId(null)
                                      setEditCommentContent("")
                                    }}
                                    disabled={!editCommentContent.trim()}
                                    className="px-2 py-1 bg-neutral-900 text-white text-xs font-medium rounded hover:bg-neutral-800 disabled:opacity-50"
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
                                {comment.content}
                              </p>
                            )}
                            {comment.mentions && comment.mentions.length > 0 && !editingCommentId && (
                              <div className="flex gap-1 mt-2">
                                {comment.mentions.map((email) => {
                                  const member = TEAM_MEMBERS.find(m => m.email === email)
                                  return member ? (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-900 text-xs">
                                      @{member.name}
                                    </span>
                                  ) : null
                                })}
                              </div>
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
                  <div className="flex gap-2">
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
                        onChange={(e) => onNewCommentChange(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white resize-y min-h-17.5 max-h-50"
                        placeholder="Add a comment... (use @name to mention someone)"
                      />
                      {/* Tag options helper - shows available team members for tagging */}
                      <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                        <span className="text-xs text-neutral-400 mr-1">Tag:</span>
                        {teamMembers.filter(m => {
                          if (m.isActive === false) return false
                          // Filter out test/demo team member entries
                          const nameLower = m.name.toLowerCase()
                          const excludeNames = ["elon", "434mediamgr", "testing"]
                          return !excludeNames.includes(nameLower)
                        }).map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              // Insert @name at cursor position or end
                              const tagText = `@${member.name} `
                              const currentText = newComment
                              // Add tag to end if not already present
                              if (!currentText.includes(`@${member.name}`)) {
                                onNewCommentChange(currentText + (currentText.endsWith(' ') || currentText === '' ? '' : ' ') + tagText)
                              }
                            }}
                            className="px-1.5 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs transition-colors"
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
                          onClick={onAddComment}
                          disabled={!newComment.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-2">
                    Sign in to leave comments
                  </p>
                )}
              </div>
              )}
      </div>
    </DetailDrawer>
  )
}
