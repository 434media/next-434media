"use client"

import { useEffect, useState } from "react"
import { Loader2, Star, MessageSquare } from "lucide-react"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { Combobox, type ComboboxOption } from "./Combobox"
import { SQUAD_LABELS } from "@/components/crm/types"
import type { CohortTask, TaskStatus } from "@/types/crm-types"

const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "completed", "blocked", "deferred"]
const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "To do",
  in_progress: "In progress",
  completed: "Done",
  blocked: "Blocked",
  deferred: "Deferred",
}

const LABEL = "block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1"
const FIELD =
  "w-full px-3 py-2 text-sm bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400"

interface CohortTaskDrawerProps {
  task: CohortTask | null
  open: boolean
  onClose: () => void
  /** Called with the updated task after a save or a new comment. */
  onChange: (task: CohortTask) => void
  onDelete: (id: string) => void
  teamMembers: { name: string }[]
}

export function CohortTaskDrawer({ task, open, onClose, onChange, onDelete, teamMembers }: CohortTaskDrawerProps) {
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<TaskStatus>("not_started")
  const [week, setWeek] = useState<string>("")
  const [isDeliverable, setIsDeliverable] = useState(false)
  const [assignedTo, setAssignedTo] = useState("")
  const [description, setDescription] = useState("")
  const [comments, setComments] = useState<NonNullable<CohortTask["comments"]>>([])
  const [newComment, setNewComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [commenting, setCommenting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever a different task opens.
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setStatus(task.status)
    setWeek(typeof task.week === "number" ? String(task.week) : "")
    setIsDeliverable(!!task.isDeliverable)
    setAssignedTo(task.assigned_to ?? "")
    setDescription(task.description ?? "")
    setComments(task.comments ?? [])
    setNewComment("")
    setError(null)
  }, [task])

  if (!task) return null

  const handleSave = async () => {
    if (!title.trim()) return setError("Title is required")
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        id: task.id,
        title: title.trim(),
        status,
        isDeliverable,
        assigned_to: assignedTo,
        description,
      }
      if (week !== "") payload.week = Number(week)
      const res = await fetch("/api/admin/crm/cohort-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to save")
      onChange(body.data as CohortTask)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleAddComment = async () => {
    const content = newComment.trim()
    if (!content) return
    setCommenting(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/crm/cohort-tasks/${task.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to add comment")
      setComments((c) => [...c, body.comment])
      setNewComment("")
      if (body.data) onChange(body.data as CohortTask)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment")
    } finally {
      setCommenting(false)
    }
  }

  const handleArchive = async () => {
    setArchiving(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/crm/cohort-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, is_archived: !task.is_archived }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error ?? "Failed to archive")
      onChange(body.data as CohortTask)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive")
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = () => {
    if (!confirm(`Delete "${task.title}"?`)) return
    onDelete(task.id)
    onClose()
  }

  const assigneeOptions: ComboboxOption[] = [
    { value: "", label: "Unassigned" },
    ...teamMembers.map((m) => ({ value: m.name, label: m.name })),
    // Preserve a legacy/free-text assignee not in the current roster.
    ...(assignedTo && !teamMembers.some((m) => m.name === assignedTo)
      ? [{ value: assignedTo, label: assignedTo }]
      : []),
  ]

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title="Task"
      subtitle={SQUAD_LABELS[task.squad]}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="text-[12px] font-medium text-neutral-400 hover:text-red-600"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiving}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-neutral-400 hover:text-neutral-800 disabled:opacity-50"
            >
              {archiving && <Loader2 className="w-3 h-3 animate-spin" />}
              {task.is_archived ? "Unarchive" : "Archive"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium text-neutral-600 hover:text-neutral-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900 text-white text-[12px] font-semibold hover:bg-neutral-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      }
    >
      <div className="px-4 sm:px-5 py-4 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[13px] text-red-700">{error}</div>
        )}

        <div>
          <label className={LABEL}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={FIELD}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Week</label>
            <select value={week} onChange={(e) => setWeek(e.target.value)} className={FIELD}>
              <option value="">—</option>
              {[1, 2, 3, 4, 5, 6].map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>Deliverable</label>
            <button
              type="button"
              onClick={() => setIsDeliverable((v) => !v)}
              className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-[12px] font-medium ${
                isDeliverable
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-800"
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isDeliverable ? "fill-amber-400 text-amber-500" : ""}`} />
              {isDeliverable ? "Friday" : "Mark"}
            </button>
          </div>
        </div>

        <div>
          <label className={LABEL}>Assignee</label>
          <Combobox
            value={assignedTo}
            onChange={(v) => setAssignedTo(v)}
            options={assigneeOptions}
            searchable
            placeholder="Unassigned"
            searchPlaceholder="Search team…"
            ariaLabel="Assignee"
          />
        </div>

        <div>
          <label className={LABEL}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What does this involve? Notes, links, acceptance criteria…"
            className={FIELD}
          />
        </div>

        {/* Comments */}
        <div className="pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 mb-2">
            <MessageSquare className="w-3.5 h-3.5 text-neutral-400" />
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Comments ({comments.length})
            </span>
          </div>

          <div className="space-y-2.5">
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-neutral-50 border border-neutral-200/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className="text-[12px] font-semibold text-neutral-800 truncate">{c.author_name}</span>
                  <span className="text-[10px] text-neutral-400 shrink-0">{fmt(c.created_at)}</span>
                </div>
                <p className="text-[13px] text-neutral-700 whitespace-pre-wrap wrap-break-word">{c.content}</p>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-[12px] text-neutral-400">No comments yet. Add a note on progress.</p>
            )}
          </div>

          <div className="mt-2 flex items-end gap-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault()
                  handleAddComment()
                }
              }}
              rows={2}
              placeholder="Add a comment… (⌘↵ to send)"
              className="flex-1 px-3 py-2 text-[13px] bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 resize-none"
            />
            <button
              type="button"
              onClick={handleAddComment}
              disabled={commenting || !newComment.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-neutral-100 text-neutral-700 text-[12px] font-semibold hover:bg-neutral-200 disabled:opacity-50"
            >
              {commenting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Comment"}
            </button>
          </div>
        </div>
      </div>
    </DetailDrawer>
  )
}
