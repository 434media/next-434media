"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  X, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Link2, 
  AtSign, 
  Upload, 
  FileText, 
  Image as ImageIcon,
  MessageSquare,
  Plus,
  ExternalLink,
  Send,
  Trash2,
  UserPlus,
  UserMinus,
  Check,
  ChevronDown,
  Pencil,
  Settings
} from "lucide-react"
import { 
  BRANDS, 
  TEAM_MEMBERS, 
  getDueDateStatus, 
  formatDate,
  DISPOSITION_OPTIONS,
  DOC_OPTIONS
} from "./types"
import type { Task, TaskAttachment, TaskComment, CurrentUser, Brand, TeamMember, Disposition, DOC } from "./types"

interface TaskFormData {
  title: string
  description: string
  assigned_to: string
  brand: Brand | ""
  status: string
  priority: string
  due_date: string
  notes: string
  web_links: string[]
  tagged_users: string[]
  is_opportunity: boolean
  disposition: Disposition | ""
  doc: DOC | ""
}

interface TaskModalProps {
  isOpen: boolean
  task: Task | null
  formData: TaskFormData
  attachments: TaskAttachment[]
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
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAttachment: (id: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}

export function TaskModal({
  isOpen,
  task,
  formData,
  attachments,
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
  onFileUpload,
  onRemoveAttachment,
  onSave,
  onDelete,
  onClose,
}: TaskModalProps) {
  // State for team member management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showManageMembers, setShowManageMembers] = useState(false)
  const [newMemberName, setNewMemberName] = useState("")
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberError, setMemberError] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  
  // State for editing existing team members
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState("")
  const [editMemberEmail, setEditMemberEmail] = useState("")
  const [isSavingMember, setIsSavingMember] = useState(false)

  // Fetch team members from Firestore
  const fetchTeamMembers = useCallback(async () => {
    setIsLoadingMembers(true)
    try {
      const response = await fetch("/api/admin/team-members")
      const data = await response.json()
      if (data.success && data.data.length > 0) {
        setTeamMembers(data.data.filter((m: TeamMember) => m.isActive))
      } else {
        // Fallback to default TEAM_MEMBERS if no data in Firestore
        setTeamMembers(TEAM_MEMBERS.map((m, i) => ({
          id: `default-${i}`,
          name: m.name,
          email: m.email,
          isActive: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })))
      }
    } catch {
      // Fallback to default TEAM_MEMBERS
      setTeamMembers(TEAM_MEMBERS.map((m, i) => ({
        id: `default-${i}`,
        name: m.name,
        email: m.email,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })))
    } finally {
      setIsLoadingMembers(false)
    }
  }, [])

  // Fetch team members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen, fetchTeamMembers])

  // Add new team member
  const handleAddMember = async () => {
    if (!newMemberName.trim()) {
      setMemberError("Name is required")
      return
    }
    
    setIsAddingMember(true)
    setMemberError("")
    
    try {
      const response = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Add to local state and select the new member
        setTeamMembers(prev => [...prev, data.data])
        onFormChange({ ...formData, assigned_to: data.data.name })
        setNewMemberName("")
        setNewMemberEmail("")
        setShowAddMember(false)
      } else {
        setMemberError(data.error || "Failed to add member")
      }
    } catch {
      setMemberError("Failed to add member")
    } finally {
      setIsAddingMember(false)
    }
  }

  // Delete team member
  const handleDeleteMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.name} from the team? This will hide them from future assignments.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/admin/team-members?id=${member.id}`, {
        method: "DELETE",
      })
      
      const data = await response.json()
      
      if (data.success) {
        setTeamMembers(prev => prev.filter(m => m.id !== member.id))
        // If the deleted member was selected, clear the selection
        if (formData.assigned_to === member.name) {
          onFormChange({ ...formData, assigned_to: "" })
        }
      }
    } catch (error) {
      console.error("Failed to delete member:", error)
    }
  }

  // Start editing a team member
  const handleStartEdit = (member: TeamMember) => {
    setEditingMemberId(member.id)
    setEditMemberName(member.name)
    setEditMemberEmail(member.email)
    setMemberError("")
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMemberId(null)
    setEditMemberName("")
    setEditMemberEmail("")
    setMemberError("")
  }

  // Save edited team member
  const handleSaveMember = async (memberId: string) => {
    if (!editMemberName.trim()) {
      setMemberError("Name is required")
      return
    }

    setIsSavingMember(true)
    setMemberError("")

    try {
      const response = await fetch("/api/admin/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: memberId,
          name: editMemberName.trim(),
          email: editMemberEmail.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        const oldMember = teamMembers.find(m => m.id === memberId)
        setTeamMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { ...m, name: editMemberName.trim(), email: editMemberEmail.trim() }
              : m
          )
        )
        // Update the form if this member was selected
        if (oldMember && formData.assigned_to === oldMember.name) {
          onFormChange({ ...formData, assigned_to: editMemberName.trim() })
        }
        handleCancelEdit()
      } else {
        setMemberError(data.error || "Failed to update member")
      }
    } catch {
      setMemberError("Failed to update member")
    } finally {
      setIsSavingMember(false)
    }
  }

  if (!task) return null

  const dueDateStatus = getDueDateStatus(task.due_date, task.status)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">Edit Task</h3>
                {dueDateStatus === "overdue" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-600 text-xs font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
                {dueDateStatus === "approaching" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-600 text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    Due Soon
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                    placeholder="Task description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => onFormChange({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform</label>
                    <select
                      value={formData.brand}
                      onChange={(e) => onFormChange({ ...formData, brand: e.target.value as Brand | "" })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => onFormChange({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned To</label>
                    <div className="relative">
                      {/* Custom dropdown button */}
                      <button
                        type="button"
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white flex items-center justify-between"
                      >
                        <span className={formData.assigned_to ? "text-gray-900" : "text-gray-400"}>
                          {formData.assigned_to || "Select assignee..."}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
                      </button>
                      
                      {/* Dropdown menu */}
                      <AnimatePresence>
                        {showDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                          >
                            <div className="max-h-64 overflow-y-auto">
                              {/* Unassigned option */}
                              <button
                                type="button"
                                onClick={() => {
                                  onFormChange({ ...formData, assigned_to: "Unassigned" })
                                  setShowDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                              >
                                <span className="text-gray-500">Unassigned</span>
                                {formData.assigned_to === "Unassigned" && <Check className="w-4 h-4 text-blue-600" />}
                              </button>
                              
                              {/* Divider */}
                              <div className="border-t border-gray-100" />
                              
                              {/* Team members */}
                              {isLoadingMembers ? (
                                <div className="px-3 py-4 text-center">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                                </div>
                              ) : (
                                <>
                                  {teamMembers.map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center justify-between hover:bg-gray-50 group"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onFormChange({ ...formData, assigned_to: member.name })
                                          setShowDropdown(false)
                                        }}
                                        className="flex-1 px-3 py-2 text-left text-sm flex items-center justify-between"
                                      >
                                        <div>
                                          <span className="text-gray-900">{member.name}</span>
                                          {member.email && (
                                            <span className="text-gray-400 text-xs ml-2">{member.email}</span>
                                          )}
                                        </div>
                                        {formData.assigned_to === member.name && <Check className="w-4 h-4 text-blue-600" />}
                                      </button>
                                      {/* Delete button - only show on hover and for non-default members */}
                                      {!member.id.startsWith("default-") && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteMember(member)
                                          }}
                                          className="px-2 py-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                          title={`Remove ${member.name}`}
                                        >
                                          <UserMinus className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              {/* Divider */}
                              <div className="border-t border-gray-100" />
                              
                              {/* Add new member button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowAddMember(true)
                                  setShowDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                              >
                                <UserPlus className="w-4 h-4" />
                                Add new team member
                              </button>
                              
                              {/* Manage members button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setShowManageMembers(!showManageMembers)
                                  setShowDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Settings className="w-4 h-4" />
                                Manage team members
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      {/* Click outside to close dropdown */}
                      {showDropdown && (
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowDropdown(false)}
                        />
                      )}
                    </div>
                    
                    {/* Add new member form */}
                    <AnimatePresence>
                      {showAddMember && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-blue-900">Add New Team Member</h4>
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddMember(false)
                                setNewMemberName("")
                                setNewMemberEmail("")
                                setMemberError("")
                              }}
                              className="text-blue-400 hover:text-blue-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={newMemberName}
                              onChange={(e) => setNewMemberName(e.target.value)}
                              placeholder="Full name (required)"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                            />
                            <input
                              type="email"
                              value={newMemberEmail}
                              onChange={(e) => setNewMemberEmail(e.target.value)}
                              placeholder="Email (optional)"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                            />
                            {memberError && (
                              <p className="text-xs text-red-600">{memberError}</p>
                            )}
                            <button
                              type="button"
                              onClick={handleAddMember}
                              disabled={isAddingMember || !newMemberName.trim()}
                              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {isAddingMember ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Adding...
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4" />
                                  Add Team Member
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    {/* Team Management Panel */}
                    <AnimatePresence>
                      {showManageMembers && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              <Settings className="w-4 h-4" />
                              Manage Team Members
                            </h4>
                            <button
                              type="button"
                              onClick={() => {
                                setShowManageMembers(false)
                                handleCancelEdit()
                              }}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {memberError && showManageMembers && (
                            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                              {memberError}
                            </div>
                          )}
                          
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {isLoadingMembers ? (
                              <div className="py-4 text-center">
                                <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                                <p className="text-xs text-gray-500 mt-2">Loading team members...</p>
                              </div>
                            ) : teamMembers.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">
                                No team members yet. Add one using the dropdown above.
                              </p>
                            ) : (
                              teamMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="p-3 bg-white border border-gray-200 rounded-lg"
                                >
                                  {editingMemberId === member.id ? (
                                    // Edit mode
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        value={editMemberName}
                                        onChange={(e) => setEditMemberName(e.target.value)}
                                        placeholder="Full name"
                                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                      />
                                      <input
                                        type="email"
                                        value={editMemberEmail}
                                        onChange={(e) => setEditMemberEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveMember(member.id)}
                                          disabled={isSavingMember || !editMemberName.trim()}
                                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                        >
                                          {isSavingMember ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Check className="w-3 h-3" />
                                          )}
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCancelEdit}
                                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    // View mode
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                          {member.name}
                                        </p>
                                        {member.email && (
                                          <p className="text-xs text-gray-500 truncate">
                                            {member.email}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 ml-2">
                                        {!member.id.startsWith("default-") && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleStartEdit(member)}
                                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                              title="Edit member"
                                            >
                                              <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteMember(member)}
                                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                              title="Remove member"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                        {member.id.startsWith("default-") && (
                                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                            Default
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                          
                          {/* Add new member shortcut */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMembers(false)
                              setShowAddMember(true)
                            }}
                            className="w-full mt-3 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
                          >
                            <UserPlus className="w-4 h-4" />
                            Add new team member
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Opportunity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Opportunity</label>
                <select
                  value={formData.is_opportunity ? "yes" : "no"}
                  onChange={(e) => onFormChange({ 
                    ...formData, 
                    is_opportunity: e.target.value === "yes",
                    // Set default disposition when enabling opportunity
                    disposition: e.target.value === "yes" && !formData.disposition ? "open" : formData.disposition
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {/* Disposition & DOC - Only show when is_opportunity is true */}
              <AnimatePresence>
                {formData.is_opportunity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Disposition */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Disposition <span className="text-gray-400 font-normal">(Pipeline Stage)</span>
                      </label>
                      <select
                        value={formData.disposition || "open"}
                        onChange={(e) => onFormChange({ ...formData, disposition: e.target.value as Disposition })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        {DISPOSITION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DOC (Degree of Confidence) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        DOC <span className="text-gray-400 font-normal">(Degree of Confidence)</span>
                      </label>
                      <select
                        value={formData.doc || ""}
                        onChange={(e) => onFormChange({ ...formData, doc: e.target.value as DOC })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">Select probability...</option>
                        {DOC_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Used for pacing calculations in dashboard
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Web Links Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Link2 className="w-4 h-4 inline mr-2" />
                  Web Links
                </label>
                <div className="space-y-2">
                  {formData.web_links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 truncate flex-1"
                      >
                        {link}
                      </a>
                      <button
                        onClick={() => onRemoveLink(index)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-400" />
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
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white"
                    />
                    <button
                      onClick={onAddLink}
                      disabled={!newLink.trim()}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 text-gray-700" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tag Team Members Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <AtSign className="w-4 h-4 inline mr-2" />
                  Tag Team Members
                </label>
                <div className="flex flex-wrap gap-2">
                  {(teamMembers.length > 0 ? teamMembers : TEAM_MEMBERS.map((m, i) => ({ ...m, id: `default-${i}`, isActive: true, created_at: "", updated_at: "" }))).map((member) => (
                    <button
                      key={member.id || member.email}
                      onClick={() => onToggleUserTag(member.email)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        formData.tagged_users.includes(member.email)
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Attachments Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Attachments
                </label>
                
                {/* Existing Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
                        {attachment.type === "image" ? (
                          <ImageIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 truncate flex-1"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-xs text-gray-500">
                          {attachment.uploaded_by}
                        </span>
                        <button
                          onClick={() => onRemoveAttachment(attachment.id)}
                          className="p-1 rounded hover:bg-gray-200 transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 cursor-pointer transition-colors">
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      <span className="text-sm text-gray-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        Drop a file or click to upload
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    onChange={onFileUpload}
                    disabled={isUploadingFile}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Supports images, PDF, DOC, XLS, TXT (max 10MB)
                </p>
              </div>

              {/* Notes Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                  placeholder="Add notes..."
                />
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Comments & Updates
                </label>
                
                {/* Existing Comments */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
                      <div key={comment.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex items-start gap-2">
                          {comment.author_avatar ? (
                            <img 
                              src={comment.author_avatar} 
                              alt={comment.author_name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-600">
                                {comment.author_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {comment.author_name}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                            {comment.mentions && comment.mentions.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {comment.mentions.map((email) => {
                                  const member = TEAM_MEMBERS.find(m => m.email === email)
                                  return member ? (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">
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
                    <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>
                  )}
                </div>

                {/* Add Comment */}
                {currentUser ? (
                  <div className="flex gap-2">
                    <div className="flex-shrink-0">
                      {currentUser.picture ? (
                        <img 
                          src={currentUser.picture} 
                          alt={currentUser.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {currentUser.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => onNewCommentChange(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                        placeholder="Add a comment... (use @name to mention someone)"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                          Commenting as {currentUser.name}
                        </p>
                        <button
                          onClick={onAddComment}
                          disabled={!newComment.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-2">
                    Sign in to leave comments
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={onDelete}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Task
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
