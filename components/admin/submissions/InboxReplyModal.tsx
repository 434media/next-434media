"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, X, Send, AlertCircle, Mail, MessageSquare } from "lucide-react"

// Stage 5b — compose modal for replying to a contact-form inquiry via
// Resend. Single-row, opens from the ContactFormsTab detail drawer footer.
//
// Design notes:
//  - Centered modal overlay (drawer stays in place behind the backdrop).
//  - Pre-populates `Hi {firstName},` greeting and a subject; blank body so
//    the rep types the actual response. The signature is intentionally NOT
//    pre-populated — most reps have their own.
//  - Original message is shown read-only above the form so the rep has
//    context without scrolling back to the drawer.
//  - On send: backend auto-flips submission state to "replied", parent gets
//    notified via onSent so the drawer's state badge updates locally.

interface ContactFormSubmissionLite {
  id: string
  firstName: string
  lastName: string
  email: string
  message?: string
  source: string
}

interface InboxReplyModalProps {
  open: boolean
  submission: ContactFormSubmissionLite | null
  onClose: () => void
  /**
   * Called after a successful send. `stateUpdated` reflects whether the
   * server-side state-flip to "replied" persisted: when false the parent
   * must NOT optimistically update local state (that would mask the silent
   * desync) and should surface a clear "mark replied manually" prompt.
   */
  onSent: (submissionId: string, stateUpdated: boolean) => void
  onError: (message: string) => void
}

function defaultSubject(submission: ContactFormSubmissionLite | null): string {
  if (!submission) return ""
  return "Re: Your inquiry to 434 Media"
}

function defaultBody(submission: ContactFormSubmissionLite | null): string {
  if (!submission) return ""
  const first = submission.firstName?.trim() || "there"
  // Two blank lines between greeting and signoff so the cursor lands in
  // the middle on focus and the rep can start typing immediately.
  return `Hi ${first},\n\n\n\n`
}

export function InboxReplyModal({
  open,
  submission,
  onClose,
  onSent,
  onError,
}: InboxReplyModalProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form whenever the modal opens for a new submission.
  useEffect(() => {
    if (!open || !submission) return
    setSubject(defaultSubject(submission))
    setBody(defaultBody(submission))
    setError(null)
    setIsSending(false)
  }, [open, submission])

  // Esc to close (when not sending — don't lose draft mid-send)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, isSending, onClose])

  const fullName = useMemo(() => {
    if (!submission) return ""
    return `${submission.firstName ?? ""} ${submission.lastName ?? ""}`.trim() || submission.email
  }, [submission])

  if (!open || !submission) return null

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !isSending

  const handleSend = async () => {
    if (!canSend || !submission) return
    setIsSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/contact-forms/${submission.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: submission.email,
          subject: subject.trim(),
          body,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to send reply")
      }
      // Pass `stateUpdated` through so the parent decides whether to apply
      // the optimistic local state update. If state didn't persist on the
      // server, optimistically marking it "replied" locally would silently
      // desync the badge — the rep would see "replied" while the source of
      // truth still says triaged, and the inquiry would resurface in
      // "awaiting reply" on the next refresh.
      const stateUpdated: boolean = data.stateUpdated !== false
      onSent(submission.id, stateUpdated)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send reply"
      setError(msg)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSending) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reply-modal-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
          <div className="min-w-0">
            <h2
              id="reply-modal-title"
              className="text-[15px] font-semibold text-neutral-900 truncate"
            >
              Reply to {fullName}
            </h2>
            <p className="text-[12px] text-neutral-500 mt-0.5 truncate">
              {submission.email} · {submission.source}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            aria-label="Close"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Original message — read-only context. Hidden if the inquiry
              had no message body (rare but possible). */}
          {submission.message && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <MessageSquare className="w-3 h-3" />
                Their message
              </div>
              <div className="rounded-md bg-neutral-50 border border-neutral-200/70 px-3 py-2 text-[12px] text-neutral-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                {submission.message}
              </div>
            </div>
          )}

          {/* To field — locked to the submitter's email. Display-only so the
              rep can't accidentally retype and misdirect the reply. */}
          <div>
            <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              To
            </label>
            <div className="flex items-center gap-2 px-2.5 py-1.5 border border-neutral-200 rounded-sm bg-neutral-50 text-[13px] text-neutral-700">
              <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="truncate">{submission.email}</span>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label
              htmlFor="reply-subject"
              className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1"
            >
              Subject
            </label>
            <input
              id="reply-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 text-[13px] text-neutral-800 disabled:opacity-50"
            />
          </div>

          {/* Body */}
          <div>
            <label
              htmlFor="reply-body"
              className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1"
            >
              Message
            </label>
            <textarea
              id="reply-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSending}
              rows={10}
              autoFocus
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 text-[13px] text-neutral-800 leading-relaxed font-normal resize-none disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200/70 text-[12px] text-red-700">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-neutral-200 bg-neutral-50">
          <p className="text-[11px] text-neutral-500 truncate">
            Replies route to your inbox.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-3 py-1.5 text-[12px] font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isSending ? "Sending…" : "Send reply"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
