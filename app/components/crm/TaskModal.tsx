"use client"

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
  Trash2
} from "lucide-react"
import { 
  BRANDS, 
  TEAM_MEMBERS, 
  getDueDateStatus, 
  formatDate 
} from "./types"
import type { Task, TaskAttachment, TaskComment, CurrentUser, Brand } from "./types"

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
  if (!task) return null

  const dueDateStatus = getDueDateStatus(task.due_date, task.status)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-3xl max-h-[90vh] bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">Edit Task</h3>
                {dueDateStatus === "overdue" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Overdue
                  </span>
                )}
                {dueDateStatus === "approaching" && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    Due Soon
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Basic Info Section */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => onFormChange({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500 resize-none"
                    placeholder="Task description..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => onFormChange({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="blocked">Blocked</option>
                      <option value="deferred">Deferred</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">Brand</label>
                    <select
                      value={formData.brand}
                      onChange={(e) => onFormChange({ ...formData, brand: e.target.value as Brand | "" })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    >
                      <option value="">No brand</option>
                      {BRANDS.map((brand) => (
                        <option key={brand} value={brand}>{brand}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => onFormChange({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1.5">Assigned To</label>
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => onFormChange({ ...formData, assigned_to: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    >
                      <option value="">Select assignee...</option>
                      {TEAM_MEMBERS.map((member) => (
                        <option key={member.email} value={member.name}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Web Links Section */}
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  <Link2 className="w-4 h-4 inline mr-2" />
                  Web Links
                </label>
                <div className="space-y-2">
                  {formData.web_links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800">
                      <ExternalLink className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 truncate flex-1"
                      >
                        {link}
                      </a>
                      <button
                        onClick={() => onRemoveLink(index)}
                        className="p-1 rounded hover:bg-neutral-700 transition-colors"
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
                      className="flex-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500"
                    />
                    <button
                      onClick={onAddLink}
                      disabled={!newLink.trim()}
                      className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tag Team Members Section */}
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  <AtSign className="w-4 h-4 inline mr-2" />
                  Tag Team Members
                </label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_MEMBERS.map((member) => (
                    <button
                      key={member.email}
                      onClick={() => onToggleUserTag(member.email)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        formData.tagged_users.includes(member.email)
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600"
                      }`}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Attachments Section */}
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Attachments
                </label>
                
                {/* Existing Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800">
                        {attachment.type === "image" ? (
                          <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        )}
                        <a 
                          href={attachment.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-400 hover:text-blue-300 truncate flex-1"
                        >
                          {attachment.name}
                        </a>
                        <span className="text-xs text-neutral-500">
                          {attachment.uploaded_by}
                        </span>
                        <button
                          onClick={() => onRemoveAttachment(attachment.id)}
                          className="p-1 rounded hover:bg-neutral-700 transition-colors"
                        >
                          <X className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-neutral-700 hover:border-neutral-600 bg-neutral-800/50 cursor-pointer transition-colors">
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                      <span className="text-sm text-neutral-400">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-neutral-400" />
                      <span className="text-sm text-neutral-400">
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
                <p className="text-xs text-neutral-500 mt-2">
                  Supports images, PDF, DOC, XLS, TXT (max 10MB)
                </p>
              </div>

              {/* Notes Section */}
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  <FileText className="w-4 h-4 inline mr-2" />
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500 resize-none"
                  placeholder="Add notes..."
                />
              </div>

              {/* Comments Section */}
              <div className="pt-4 border-t border-neutral-800">
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  <MessageSquare className="w-4 h-4 inline mr-2" />
                  Comments & Updates
                </label>
                
                {/* Existing Comments */}
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
                      <div key={comment.id} className="p-3 rounded-lg bg-neutral-800/50">
                        <div className="flex items-start gap-2">
                          {comment.author_avatar ? (
                            <img 
                              src={comment.author_avatar} 
                              alt={comment.author_name}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                              <span className="text-xs font-medium text-neutral-300">
                                {comment.author_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-neutral-200">
                                {comment.author_name}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-400 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                            {comment.mentions && comment.mentions.length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {comment.mentions.map((email) => {
                                  const member = TEAM_MEMBERS.find(m => m.email === email)
                                  return member ? (
                                    <span key={email} className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
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
                    <p className="text-sm text-neutral-500 text-center py-4">No comments yet</p>
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
                        <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                          <span className="text-xs font-medium text-neutral-300">
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
                        className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-neutral-500 resize-none"
                        placeholder="Add a comment... (use @name to mention someone)"
                      />
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-neutral-500">
                          Commenting as {currentUser.name}
                        </p>
                        <button
                          onClick={onAddComment}
                          disabled={!newComment.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Comment
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-2">
                    Sign in to leave comments
                  </p>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between p-4 border-t border-neutral-800">
              <button
                onClick={onDelete}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete Task
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50"
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
