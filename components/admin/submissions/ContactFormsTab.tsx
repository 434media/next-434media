"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  Download,
  RefreshCw,
  Globe,
  MessageSquare,
  Search,
  AlertCircle,
  Eye,
  Trash2,
  Mail,
  Phone,
  Building2,
  Save,
  Pencil,
  Clock,
  Reply,
  User,
} from "lucide-react"
import {
  Eye as EyeIcon,
  MessageSquare as MsgIcon,
  Mail as MailIcon,
  Send as SendIcon,
} from "lucide-react"
import { LeadCrossLink, useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import {
  MailchimpSubscribedPill,
  useMailchimpSubscribers,
} from "@/components/admin/MailchimpSubscribedPill"
import {
  StateBadge,
  StateFilterChips,
  BulkActionBar,
  useSelection,
  useSubmissionStates,
  getStateOrNew,
  type SubmissionState,
  type SubmissionSource,
} from "@/components/admin/SubmissionStateUI"
import { MailchimpPushModal, type PushMember } from "@/components/admin/MailchimpPushModal"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { InboxReplyModal } from "./InboxReplyModal"
import { DetailRow, FieldInput } from "./shared"
import type { Toast } from "./types"
import { usePromoteToLeads } from "./usePromoteToLeads"
import { PromoteOverridesDrawer } from "./PromoteOverridesDrawer"
import { ArrowRightCircle, ArrowRight } from "lucide-react"

interface ContactFormSubmission {
  id: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone?: string
  message?: string
  source: string
  created_at: string
  // Set when this submission has been promoted into the leads pipeline.
  promotedLeadId?: string
  promotedAt?: string
}

export function ContactFormsTab({
  setToast,
  initialSearch = "",
}: {
  setToast: (t: Toast | null) => void
  initialSearch?: string
}) {
  const leadsByEmail = useLeadsByEmail()
  const subscriberMap = useMailchimpSubscribers()
  const SUBMISSION_SOURCE: SubmissionSource = "contact_forms"
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissions, setSubmissions] = useState<ContactFormSubmission[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stateFilter, setStateFilter] = useState<"all" | SubmissionState>("all")
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()
  const [showPushModal, setShowPushModal] = useState(false)
  const [selectedSource, setSelectedSource] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<ContactFormSubmission | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<ContactFormSubmission>>({})
  // Stage 5b — Reply via Resend modal target. When set, the InboxReplyModal
  // opens for that submission. Cleared on close or successful send.
  const [replyTarget, setReplyTarget] = useState<ContactFormSubmission | null>(null)

  const fetchSourcesAndCounts = useCallback(async () => {
    try {
      const [sourcesRes, countsRes] = await Promise.all([
        fetch("/api/admin/contact-forms?action=sources"),
        fetch("/api/admin/contact-forms?action=counts"),
      ])
      const sourcesData = await sourcesRes.json()
      const countsData = await countsRes.json()
      if (sourcesData.success) setSources(sourcesData.sources)
      if (countsData.success) setCounts(countsData.counts)
    } catch (err) {
      console.error("Error fetching contact form sources:", err)
    }
  }, [])

  const fetchSubmissions = useCallback(async (source?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const url = source
        ? `/api/admin/contact-forms?source=${encodeURIComponent(source)}`
        : "/api/admin/contact-forms"
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setSubmissions(data.submissions)
      } else {
        setError(data.error || "Failed to fetch submissions")
      }
    } catch {
      setError("Failed to fetch contact form data")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSourcesAndCounts()
    fetchSubmissions()
  }, [fetchSourcesAndCounts, fetchSubmissions])

  useEffect(() => {
    fetchSubmissions(selectedSource || undefined)
  }, [selectedSource, fetchSubmissions])

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete submission from ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/contact-forms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted submission from ${email}`, type: "success" })
        await fetchSourcesAndCounts()
        await fetchSubmissions(selectedSource || undefined)
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete submission", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleUpdate = async () => {
    if (!selectedSubmission) return
    try {
      setIsSaving(true)
      const res = await fetch("/api/admin/contact-forms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedSubmission.id, ...editForm }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: "Submission updated successfully", type: "success" })
        // Update in local state
        const updated = { ...selectedSubmission, ...editForm } as ContactFormSubmission
        setSelectedSubmission(updated)
        setSubmissions((prev) =>
          prev.map((s) => (s.id === selectedSubmission.id ? updated : s))
        )
        setIsEditing(false)
      } else {
        setToast({ message: data.error || "Failed to update", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to update submission", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  const startEditing = () => {
    if (!selectedSubmission) return
    setEditForm({
      firstName: selectedSubmission.firstName,
      lastName: selectedSubmission.lastName,
      email: selectedSubmission.email,
      phone: selectedSubmission.phone || "",
      company: selectedSubmission.company,
      message: selectedSubmission.message || "",
      source: selectedSubmission.source,
    })
    setIsEditing(true)
  }

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true)
      const url = selectedSource
        ? `/api/admin/contact-forms?source=${encodeURIComponent(selectedSource)}&format=csv`
        : "/api/admin/contact-forms?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `contact-forms-${selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"}-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${submissions.length} submissions`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const filteredSubmissionsBeforeState = submissions.filter((s) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      s.email.toLowerCase().includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.company.toLowerCase().includes(q) ||
      (s.message || "").toLowerCase().includes(q)
    )
  })

  const visibleIds = filteredSubmissionsBeforeState.map((s) => s.id)
  const { states: submissionStates, setLocal, setLocalBulk } =
    useSubmissionStates({ source: SUBMISSION_SOURCE, ids: visibleIds })

  const filteredSubmissions = filteredSubmissionsBeforeState.filter((s) => {
    if (stateFilter === "all") return true
    return getStateOrNew(submissionStates, s.id) === stateFilter
  })

  const stateCounts: Partial<Record<"all" | SubmissionState, number>> = {
    all: filteredSubmissionsBeforeState.length,
    new: 0,
    triaged: 0,
    replied: 0,
    archived: 0,
    spam: 0,
  }
  for (const s of filteredSubmissionsBeforeState) {
    const st = getStateOrNew(submissionStates, s.id)
    stateCounts[st] = (stateCounts[st] ?? 0) + 1
  }

  const allVisibleIds = filteredSubmissions.map((s) => s.id)
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))

  const runBulk = async (target: SubmissionState) => {
    if (selected.size === 0) return
    const updates = Array.from(selected).map((id) => ({
      source: SUBMISSION_SOURCE,
      id,
      state: target,
    }))
    try {
      const res = await fetch("/api/admin/submissions/states/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      })
      if (!res.ok) {
        setToast({ message: "Bulk update failed", type: "error" })
        return
      }
      setLocalBulk(updates.map((u) => ({ id: u.id, state: u.state })))
      setToast({
        message: `${updates.length} submission${updates.length === 1 ? "" : "s"} marked ${target}`,
        type: "success",
      })
      clearSelected()
    } catch {
      setToast({ message: "Bulk update failed", type: "error" })
    }
  }

  // Bulk delete — the single "go away" action. Hard-deletes each selected
  // submission through the existing per-id DELETE (which handles the aimsatx:
  // named-DB routing), chunked so a large selection doesn't fan out all at once.
  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    if (!confirm(`Delete ${ids.length} submission${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return
    const CHUNK = 10
    let deleted = 0
    for (let i = 0; i < ids.length; i += CHUNK) {
      const results = await Promise.allSettled(
        ids.slice(i, i + CHUNK).map((id) =>
          fetch("/api/admin/contact-forms", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }).then((r) => {
            if (!r.ok) throw new Error("failed")
          }),
        ),
      )
      deleted += results.filter((r) => r.status === "fulfilled").length
    }
    const failed = ids.length - deleted
    setToast({
      message: failed === 0 ? `Deleted ${deleted} submission${deleted === 1 ? "" : "s"}` : `Deleted ${deleted}, failed ${failed}`,
      type: failed === 0 ? "success" : "error",
    })
    clearSelected()
    await fetchSourcesAndCounts()
    await fetchSubmissions(selectedSource || undefined)
  }

  // Stage 5d — bulk acknowledge. Sends a fixed templated "got your message,
  // real reply within 24h" to every selected inquiry, then auto-flips each
  // to "replied". Confirmation is a `confirm()` dialog rather than a custom
  // modal — keeps the bar lightweight; reps who want to customize per-recipient
  // use the per-row Reply button instead.
  const runBulkAcknowledge = async () => {
    if (selected.size === 0) return
    const recipients = submissions
      .filter((s) => selected.has(s.id) && s.email)
      .map((s) => ({
        submissionId: s.id,
        email: s.email,
        firstName: s.firstName,
      }))
    if (recipients.length === 0) return
    const ok = confirm(
      `Send acknowledgment to ${recipients.length} inquir${recipients.length === 1 ? "y" : "ies"}? ` +
        `Each recipient gets a personalized "got your message, will follow up within 24 hours" reply, ` +
        `and the inquiries are marked as replied.`,
    )
    if (!ok) return
    try {
      const res = await fetch("/api/admin/contact-forms/bulk-acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setToast({ message: data?.error || "Bulk acknowledge failed", type: "error" })
        return
      }
      const { sent, sendFailed, stateFailed, invalid } = data as {
        sent: number
        sendFailed: number
        stateFailed: number
        invalid: number
      }
      // Optimistically mark fully-sent recipients as replied locally — same
      // pattern as per-row Reply. Per-recipient state-failures stay un-marked
      // so the rep sees they need manual flipping.
      const sentResults = (data.results as Array<{ submissionId: string; status: string }>).filter(
        (r) => r.status === "sent",
      )
      setLocalBulk(sentResults.map((r) => ({ id: r.submissionId, state: "replied" })))
      const parts = [`${sent} sent`]
      if (sendFailed > 0) parts.push(`${sendFailed} failed`)
      if (stateFailed > 0) parts.push(`${stateFailed} sent but status didn't save`)
      if (invalid > 0) parts.push(`${invalid} invalid`)
      setToast({
        message: `Acknowledgments: ${parts.join(", ")}`,
        type: sendFailed === 0 && stateFailed === 0 && invalid === 0 ? "success" : "error",
      })
      if (sent > 0) clearSelected()
    } catch {
      setToast({ message: "Bulk acknowledge failed", type: "error" })
    }
  }

  // Audience → Leads promotion (sets bidirectional backlinks). Replaces the
  // old runConvert flow; the contact-form's message body flows into the new
  // Lead's notes so the rep has the original inquiry context.
  const { promote: promoteSubmissions } = usePromoteToLeads({
    collection: "contact_forms",
    setToast,
    onSuccess: () => fetchSubmissions(selectedSource || undefined),
    onClearSelection: clearSelected,
  })

  const [promoteDrawerIds, setPromoteDrawerIds] = useState<string[]>([])
  const [isBulkPromoting, setIsBulkPromoting] = useState(false)

  const handleOpenPromoteDrawer = () => {
    const ids = submissions
      .filter((s) => s.id && selected.has(s.id) && !s.promotedLeadId)
      .map((s) => s.id)
    if (ids.length === 0) {
      setToast({ message: "No unpromoted submissions in selection", type: "error" })
      return
    }
    setPromoteDrawerIds(ids)
  }

  const handleConfirmBulkPromote = async (overrides: Parameters<typeof promoteSubmissions>[1]) => {
    setIsBulkPromoting(true)
    try {
      await promoteSubmissions(promoteDrawerIds, overrides)
      setPromoteDrawerIds([])
    } finally {
      setIsBulkPromoting(false)
    }
  }

  const totalCount = selectedSource
    ? counts[selectedSource] || 0
    : Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Contact Form Submissions
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Form data from 434 Media, AIM, and Vemos Vamos websites
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSubmissions(selectedSource || undefined)}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={isDownloading || totalCount === 0}
            className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Source Stats Cards */}
      {Object.keys(counts).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          <button
            onClick={() => setSelectedSource("")}
            className={`p-3 rounded-xl border transition-all text-left ${
              selectedSource === ""
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Globe className="w-3 h-3 opacity-50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">All</span>
            </div>
            <div className="text-xl font-bold leading-tight">
              {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString()}
            </div>
            <div className="text-[11px] opacity-50 font-normal leading-snug">submissions</div>
          </button>
          {Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .map(([source, count]) => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`p-3 rounded-xl border transition-all text-left ${
                  selectedSource === source
                    ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                    : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3 h-3 opacity-50" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                    {source}
                  </span>
                </div>
                <div className="text-xl font-bold leading-tight">{count.toLocaleString()}</div>
                <div className="text-[11px] opacity-50 font-normal leading-snug">submissions</div>
              </button>
            ))}
        </div>
      )}

      {/* Search */}
      {submissions.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-3 sm:p-4 mb-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
            <input
              type="text"
              placeholder="Search by name, email, company, or message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent text-[13px] font-normal text-neutral-700"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchSubmissions(selectedSource || undefined)}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !error && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-400 text-[13px] font-normal">Loading contact form data...</p>
        </div>
      )}

      {/* PR 3 — state filter chips */}
      {!isLoading && !error && submissions.length > 0 && (
        <div className="mb-3">
          <StateFilterChips active={stateFilter} onChange={setStateFilter} counts={stateCounts} />
        </div>
      )}

      {/* Submissions List */}
      {!isLoading && !error && submissions.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
          {/* Select-all header */}
          {filteredSubmissions.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 border-b border-neutral-100 bg-neutral-50">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(e) => {
                  if (e.target.checked) setSelected(allVisibleIds)
                  else clearSelected()
                }}
                className="rounded border-neutral-300"
                aria-label="Select all visible"
              />
              <span className="text-[11px] text-neutral-500">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${filteredSubmissions.length} visible`}
              </span>
            </div>
          )}
          {/* ── Mobile Card View ── */}
          <div className="block md:hidden divide-y divide-neutral-100 max-h-[65vh] overflow-y-auto">
            {filteredSubmissions.length === 0 ? (
              <div className="px-5 py-12 text-center text-neutral-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-500">No submissions found</p>
                {searchQuery && (
                  <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                )}
              </div>
            ) : (
              filteredSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="px-4 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer active:bg-neutral-100"
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selected.has(sub.id)}
                        onChange={() => toggleSelect(sub.id)}
                        className="rounded border-neutral-300 mt-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight">
                          {sub.firstName} {sub.lastName}
                          <LeadCrossLink email={sub.email} mapping={leadsByEmail} />
                          <MailchimpSubscribedPill email={sub.email} mapping={subscriberMap} />
                        </p>
                        <p className="text-[13px] text-neutral-500 font-normal leading-relaxed mt-0.5 truncate">
                          {sub.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <StateBadge
                        source={SUBMISSION_SOURCE}
                        id={sub.id}
                        state={getStateOrNew(submissionStates, sub.id)}
                        onChange={(s) => setLocal(sub.id, s)}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedSubmission(sub) }}
                        aria-label={`View ${sub.email}`}
                        className="grid place-items-center h-10 w-10 sm:h-9 sm:w-9 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(sub.id, sub.email) }}
                        disabled={isDeleting === sub.id}
                        aria-label={`Delete ${sub.email}`}
                        className="grid place-items-center h-10 w-10 sm:h-9 sm:w-9 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isDeleting === sub.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide whitespace-nowrap">
                      {sub.source}
                    </span>
                    {sub.company && (
                      <span className="text-[12px] text-neutral-400 font-normal truncate">
                        {sub.company}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[12px] text-neutral-400 font-normal leading-relaxed">
                    {formatDate(sub.created_at)}
                    {sub.message && (
                      <span className="ml-2 text-neutral-300">• has message</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Desktop Table View ── */}
          <div className="hidden md:block overflow-x-auto max-h-[65vh]">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Phone
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Company
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Source
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Date
                  </th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                      <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No submissions found</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSubmission(sub)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(sub.id)}
                            onChange={() => toggleSelect(sub.id)}
                            className="rounded border-neutral-300 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${sub.firstName} ${sub.lastName}`}
                          />
                          <span className="text-neutral-900 text-[13px] font-semibold leading-snug">
                            {sub.firstName} {sub.lastName}
                          </span>
                          <LeadCrossLink email={sub.email} mapping={leadsByEmail} />
                          <MailchimpSubscribedPill email={sub.email} mapping={subscriberMap} />
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-neutral-500 text-[13px] font-normal leading-snug">
                          {sub.email}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-neutral-500 text-[13px] font-normal leading-snug">
                          {sub.phone || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden lg:table-cell">
                        <span className="text-neutral-500 text-[13px] font-normal leading-snug">
                          {sub.company || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide whitespace-nowrap">
                            {sub.source}
                          </span>
                          <StateBadge
                            source={SUBMISSION_SOURCE}
                            id={sub.id}
                            state={getStateOrNew(submissionStates, sub.id)}
                            onChange={(s) => setLocal(sub.id, s)}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-neutral-400 text-[13px] font-normal whitespace-nowrap">
                        {formatDate(sub.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedSubmission(sub)
                            }}
                            aria-label={`View details for ${sub.email}`}
                            className="p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(sub.id, sub.email)
                            }}
                            disabled={isDeleting === sub.id}
                            aria-label={`Delete ${sub.email}`}
                            className="p-1.5 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title={`Delete ${sub.email}`}
                          >
                            {isDeleting === sub.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredSubmissions.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5 flex items-center justify-between">
              <span className="text-[12px] text-neutral-400 font-normal leading-relaxed">
                {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submission Detail Modal */}
      <DetailDrawer
        open={!!selectedSubmission}
        onClose={() => { setSelectedSubmission(null); setIsEditing(false) }}
        closeOnEscape={!isEditing}
        closeOnOverlayClick={!isEditing}
        title={
          selectedSubmission
            ? isEditing
              ? "Edit submission"
              : `${selectedSubmission.firstName} ${selectedSubmission.lastName}`.trim() ||
                selectedSubmission.email
            : ""
        }
        subtitle={
          selectedSubmission ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {formatDate(selectedSubmission.created_at)}
            </span>
          ) : null
        }
        footer={
          selectedSubmission ? (
            isEditing ? (
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-[12px] font-medium text-neutral-600 hover:bg-neutral-100 rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded-sm hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    handleDelete(selectedSubmission.id, selectedSubmission.email)
                    setSelectedSubmission(null)
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50 rounded-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <div className="flex items-center gap-1.5">
                  {/* Tier 1 (lightest) — meta action: Edit. Text-only ghost. */}
                  <button
                    onClick={startEditing}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-sm transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  {/* Tier 2 — pipeline action: Promote / Open in CRM. Promote
                      is an outline button (visible but secondary). When already
                      promoted, drops to a text link with → so it reads as
                      "FYI, the workflow continues over there" not another action. */}
                  {(() => {
                    const linkedLeadId =
                      selectedSubmission.promotedLeadId ||
                      leadsByEmail.get(selectedSubmission.email.toLowerCase())
                    return linkedLeadId ? (
                      <a
                        href={`/admin/leads?openLead=${encodeURIComponent(linkedLeadId)}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-sm transition-colors"
                        title="Open this contact in the CRM"
                      >
                        Open in CRM
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedSubmission.id) return
                          await promoteSubmissions([selectedSubmission.id])
                          setSelectedSubmission(null)
                        }}
                        className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-sm transition-colors"
                        title="Promote this submission to the leads pipeline"
                      >
                        <ArrowRightCircle className="w-3.5 h-3.5" />
                        Promote
                      </button>
                    )
                  })()}
                  {/* Tier 3 — primary action: Reply. Solid black bg. */}
                  <button
                    onClick={() => setReplyTarget(selectedSubmission)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded-sm hover:bg-neutral-800 transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    Reply
                  </button>
                </div>
              </div>
            )
          ) : null
        }
      >
        {selectedSubmission && (
          <div className="px-5 py-4 space-y-4">
            {isEditing ? (
              /* ── Edit Mode ── */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldInput
                    label="First Name"
                    value={editForm.firstName}
                    onChange={(v) => setEditForm({ ...editForm, firstName: v })}
                  />
                  <FieldInput
                    label="Last Name"
                    value={editForm.lastName}
                    onChange={(v) => setEditForm({ ...editForm, lastName: v })}
                  />
                </div>
                <FieldInput
                  type="email"
                  label="Email"
                  value={editForm.email}
                  onChange={(v) => setEditForm({ ...editForm, email: v })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FieldInput
                    type="tel"
                    label="Phone"
                    value={editForm.phone}
                    onChange={(v) => setEditForm({ ...editForm, phone: v })}
                  />
                  <FieldInput
                    label="Company"
                    value={editForm.company}
                    onChange={(v) => setEditForm({ ...editForm, company: v })}
                  />
                </div>
                <FieldInput
                  label="Source"
                  value={editForm.source}
                  onChange={(v) => setEditForm({ ...editForm, source: v })}
                />
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    Message
                  </label>
                  <textarea
                    value={editForm.message || ""}
                    onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 text-[13px] text-neutral-800 resize-none"
                  />
                </div>
              </div>
            ) : (
              /* ── View Mode ── */
              <>
                <dl className="divide-y divide-neutral-100 text-[13px]">
                  <DetailRow icon={User} label="Name">
                    {`${selectedSubmission.firstName ?? ""} ${selectedSubmission.lastName ?? ""}`.trim() || "—"}
                  </DetailRow>
                  <DetailRow icon={Mail} label="Email">
                    <a
                      href={`mailto:${selectedSubmission.email}`}
                      className="text-neutral-900 hover:underline"
                    >
                      {selectedSubmission.email}
                    </a>
                  </DetailRow>
                  <DetailRow icon={Phone} label="Phone">
                    {selectedSubmission.phone ? (
                      <a
                        href={`tel:${selectedSubmission.phone}`}
                        className="text-neutral-900 hover:underline"
                      >
                        {selectedSubmission.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </DetailRow>
                  <DetailRow icon={Building2} label="Company">
                    {selectedSubmission.company || "—"}
                  </DetailRow>
                  <DetailRow icon={Globe} label="Source">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-neutral-100 text-neutral-700">
                      {selectedSubmission.source}
                    </span>
                  </DetailRow>
                </dl>

                {/* Message */}
                {selectedSubmission.message && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      <MessageSquare className="w-3 h-3" />
                      Message
                    </div>
                    <p className="text-[13px] text-neutral-700 leading-relaxed whitespace-pre-wrap p-3 bg-neutral-50 rounded-sm">
                      {selectedSubmission.message}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </DetailDrawer>

      <BulkActionBar
        count={selected.size}
        onClear={clearSelected}
        actions={[
          { key: "push-mc", label: "Push to Mailchimp", icon: MailIcon, group: "primary", run: () => { setShowPushModal(true) } },
          { key: "promote", label: "Promote to leads", icon: ArrowRightCircle, group: "primary", run: handleOpenPromoteDrawer },
          { key: "acknowledge", label: "Send acknowledgment", icon: SendIcon, run: runBulkAcknowledge },
          { key: "triage", label: "Mark triaged", icon: EyeIcon, run: () => runBulk("triaged") },
          { key: "reply", label: "Mark replied", icon: MsgIcon, run: () => runBulk("replied") },
          { key: "delete", label: "Delete", icon: Trash2, destructive: true, run: handleBulkDelete },
        ]}
      />

      <MailchimpPushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
        members={submissions
          .filter((s) => selected.has(s.id) && s.email)
          .map<PushMember>((s) => ({
            email: s.email,
            firstName: s.firstName || undefined,
            lastName: s.lastName || undefined,
          }))}
        defaultTag={`from-contact-form-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`}
        onComplete={(result) => {
          setToast({
            message: `Pushed: ${result.newMembers} new, ${result.updatedMembers} updated${result.errors.length > 0 ? `, ${result.errors.length} failed` : ""}`,
            type: result.errors.length === 0 ? "success" : "error",
          })
          if (result.errors.length === 0) clearSelected()
        }}
      />

      {/* Stage 5b — Reply via Resend modal. Opens from the drawer Reply
          button. On successful send, auto-flips submission state to
          "replied" server-side; we mirror that locally so the drawer's
          state badge updates without a round-trip refresh. */}
      <InboxReplyModal
        open={!!replyTarget}
        submission={replyTarget}
        onClose={() => setReplyTarget(null)}
        onSent={(submissionId, stateUpdated) => {
          if (stateUpdated) {
            // Full success: email sent + state persisted. Mirror the state
            // change locally so the row badge updates without a refetch.
            setLocal(submissionId, "replied")
            setToast({ message: "Reply sent", type: "success" })
          } else {
            // Partial success: email already sent, but the sidecar state
            // write failed. Do NOT call setLocal — optimistically claiming
            // "replied" here would hide the desync until the next refresh.
            // The rep can manually flip the StateBadge in the drawer/row.
            setToast({
              message:
                "Reply sent — but the status didn't save. Click the badge on this row to mark it as replied.",
              type: "error",
            })
          }
        }}
        onError={(message) => {
          setToast({ message, type: "error" })
        }}
      />

      <PromoteOverridesDrawer
        open={promoteDrawerIds.length > 0}
        onClose={() => setPromoteDrawerIds([])}
        count={promoteDrawerIds.length}
        collection="contact_forms"
        defaultSource="web"
        isPromoting={isBulkPromoting}
        onConfirm={handleConfirmBulkPromote}
      />
    </div>
  )
}
