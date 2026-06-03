"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Loader2,
  AlertCircle,
  Search,
  Trash2,
  Eye,
  Mail,
  Building2,
  Globe,
  Clock,
  Ticket,
  MapPin,
  Check,
  User,
} from "lucide-react"
import { Lock as LockIcon } from "lucide-react"
import {
  Eye as EyeIcon,
  MessageSquare as MsgIcon,
  ArrowRight,
} from "lucide-react"
import { LeadCrossLink, useLeadsByEmail } from "@/components/admin/LeadCrossLink"
import {
  MailchimpSubscribedPill,
  useMailchimpSubscribers,
  isMarketable,
  isOptedOut,
} from "@/components/admin/MailchimpSubscribedPill"
import { EventInsights, type AudienceFilter } from "@/components/admin/EventInsights"
import {
  EventRegistrationsTable,
  compareRows,
  type SortState,
} from "@/components/admin/EventRegistrationsTable"
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
import { TagList } from "@/components/admin/Tag"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { BackfillField } from "@/components/admin/BackfillField"
import { ExportMenu, DetailRow } from "./shared"
import type { Toast } from "./types"
import { usePromoteToLeads } from "./usePromoteToLeads"
import { PromoteOverridesDrawer } from "./PromoteOverridesDrawer"
import { ArrowRightCircle } from "lucide-react"

interface EventRegistration {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  company: string | null
  subscribeToFeed: boolean
  event: string
  eventName: string
  eventDate: string
  registeredAt: string
  source: string
  tags: string[]
  pageUrl: string
  // Provenance — set by `updateEventRegistration` server-side after a backfill.
  enrichedAt?: string
  enrichedBy?: string
  // Set when this registrant has been promoted into the leads pipeline.
  promotedLeadId?: string
  promotedAt?: string
}

export function EventRegistrationsTab({
  setToast,
  initialSearch = "",
  initialEvent = "",
  onChanged,
}: {
  setToast: (t: Toast | null) => void
  initialSearch?: string
  initialEvent?: string
  /** Fired after a mutation (delete / promote) so the Audiences header strip
   *  can re-fetch its per-source counts live. */
  onChanged?: () => void
}) {
  const leadsByEmail = useLeadsByEmail()
  const subscriberMap = useMailchimpSubscribers()
  const SUBMISSION_SOURCE: SubmissionSource = "event_registrations"
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<EventRegistration[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stateFilter, setStateFilter] = useState<"all" | SubmissionState>("all")
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()
  const [selectedEvent, setSelectedEvent] = useState<string>(initialEvent)
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedRegistration, setSelectedRegistration] = useState<EventRegistration | null>(null)
  // Audience filter — driven by the stat tiles on the event detail page.
  // "all" = no filter, "in-crm" = registrations whose email exists in `leadsByEmail`,
  // "in-mailchimp" = registrations SUBSCRIBED (marketable) in Mailchimp — consent,
  // not mere presence, to match the consent-aware header strip,
  // "untapped" = registrations NOT in CRM (the conversion opportunity bucket),
  // "opted-out" = registrations who unsubscribed/cleaned or are on the
  // broadcast suppression list.
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>("all")
  // Default sort: most recent registrations first. Click any column header to
  // resort; clicking the same column toggles asc/desc.
  const [sortState, setSortState] = useState<SortState>({
    column: "registeredAt",
    direction: "desc",
  })

  // Reset audience filter when the user navigates back to overview or to a
  // different event so a stale filter doesn't silently empty the next view.
  useEffect(() => {
    setAudienceFilter("all")
  }, [selectedEvent])

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/event-registrations?action=counts&_t=${Date.now()}`, { cache: "no-store" })
      const data = await res.json()
      if (data.success) setCounts(data.counts)
    } catch (err) {
      console.error("Error fetching event registration counts:", err)
    }
  }, [])

  const fetchRegistrations = useCallback(async (eventSlug?: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const url = eventSlug
        ? `/api/admin/event-registrations?event=${encodeURIComponent(eventSlug)}&_t=${Date.now()}`
        : `/api/admin/event-registrations?_t=${Date.now()}`
      const res = await fetch(url, { cache: "no-store" })
      const data = await res.json()
      if (data.success) {
        setRegistrations(data.registrations)
      } else {
        setError(data.error || "Failed to fetch registrations")
      }
    } catch {
      setError("Failed to fetch event registrations")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCounts()
    fetchRegistrations()
  }, [fetchCounts, fetchRegistrations])

  // Audience → Leads promotion (sets bidirectional backlinks: registration's
  // promotedLeadId + Lead's origin_ref). Replaces the old runConvert flow,
  // which created Leads but didn't track the backlink.
  const { promote: promoteRegistrations } = usePromoteToLeads({
    collection: "event_registrations",
    setToast,
    onSuccess: () => {
      fetchRegistrations()
      onChanged?.()
    },
    onClearSelection: clearSelected,
  })

  const [promoteDrawerIds, setPromoteDrawerIds] = useState<string[]>([])
  const [isBulkPromoting, setIsBulkPromoting] = useState(false)

  const handleOpenPromoteDrawer = () => {
    const ids = registrations
      .filter((r) => r.id && selected.has(r.id) && !r.promotedLeadId)
      .map((r) => r.id)
    if (ids.length === 0) {
      setToast({ message: "No unpromoted registrations in selection", type: "error" })
      return
    }
    setPromoteDrawerIds(ids)
  }

  const handleConfirmBulkPromote = async (overrides: Parameters<typeof promoteRegistrations>[1]) => {
    setIsBulkPromoting(true)
    try {
      await promoteRegistrations(promoteDrawerIds, overrides)
      setPromoteDrawerIds([])
    } finally {
      setIsBulkPromoting(false)
    }
  }

  const handleFilterByEvent = (eventName: string) => {
    setSelectedEvent(eventName)
    if (eventName) {
      // Filter client-side since we have all data
      // No need to re-fetch
    }
  }

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete registration for ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/event-registrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted registration for ${email}`, type: "success" })
        setRegistrations((prev) => prev.filter((r) => r.id !== id))
        if (selectedRegistration?.id === id) setSelectedRegistration(null)
        await fetchCounts()
        onChanged?.()
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete registration", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDownloadCSV = async () => {
    try {
      setIsDownloading(true)
      const url = "/api/admin/event-registrations?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `event-registrations-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${registrations.length} registrations`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  // Build a CSV from a row subset and trigger download. Powers the
  // Filtered / Selected branches of the ExportMenu — All goes through the
  // server route above so the export reflects the canonical dataset.
  const buildAndDownloadRegCSV = (
    rows: EventRegistration[],
    filenameBase: string,
    successLabel: string,
  ) => {
    try {
      const headers = ["First Name", "Last Name", "Email", "Company", "Event", "Event Date", "Registered At", "Source"]
      const csvRows = rows.map((r) => [
        r.firstName,
        r.lastName,
        r.email,
        r.company || "",
        r.eventName,
        r.eventDate,
        r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : "",
        r.source,
      ])
      const escape = (val: string) => {
        const s = String(val).replace(/"/g, '""')
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
      }
      const csv = [headers.join(","), ...csvRows.map((row) => row.map(escape).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `${filenameBase}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${rows.length} ${successLabel}`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    }
  }

  const handleDownloadFilteredRegCSV = () => {
    const stamp = new Date().toISOString().split("T")[0]
    buildAndDownloadRegCSV(filteredRegistrations, `event-registrations-filtered-${stamp}`, "registrations")
  }

  const handleDownloadSelectedRegCSV = () => {
    const rows = registrations.filter((r) => selected.has(r.id!))
    if (rows.length === 0) return
    const stamp = new Date().toISOString().split("T")[0]
    buildAndDownloadRegCSV(rows, `event-registrations-selected-${stamp}`, "registrations")
  }

  // Backfill a blank field on a registration. Server enforces blank-existing
  // (returns 409 if another admin already filled it). On success we patch the
  // local registrations list AND the open drawer so the UI reflects the write
  // without a refetch.
  const handleBackfill = async (
    id: string,
    field: "firstName" | "lastName" | "company",
    value: string,
  ): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/event-registrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, [field]: value }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setToast({
          message: data?.error || "Failed to save",
          type: "error",
        })
        return false
      }
      const stamp = new Date().toISOString()
      setRegistrations((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r
          const next = { ...r, [field]: value }
          // Re-derive fullName when first/last change so the table updates.
          if (field === "firstName" || field === "lastName") {
            next.fullName = `${field === "firstName" ? value : r.firstName} ${field === "lastName" ? value : r.lastName}`.trim()
          }
          return next
        }),
      )
      setSelectedRegistration((prev) => {
        if (!prev || prev.id !== id) return prev
        const next = { ...prev, [field]: value }
        if (field === "firstName" || field === "lastName") {
          next.fullName = `${field === "firstName" ? value : prev.firstName} ${field === "lastName" ? value : prev.lastName}`.trim()
        }
        // Stamp provenance locally so the drawer shows "Edited just now".
        // Server is the source of truth; this is just optimistic display.
        return { ...next, enrichedAt: stamp }
      })
      setToast({ message: "Saved", type: "success" })
      return true
    } catch {
      setToast({ message: "Failed to save", type: "error" })
      return false
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

  // Filter registrations
  const filteredRegistrationsBeforeState = registrations.filter((r) => {
    if (selectedEvent && r.eventName !== selectedEvent) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        r.email.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        (r.company || "").toLowerCase().includes(q) ||
        r.eventName.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
    if (audienceFilter !== "all") {
      const email = r.email.toLowerCase()
      const inCrm = leadsByEmail.has(email)
      const inMc = isMarketable(subscriberMap.get(email))
      if (audienceFilter === "in-crm" && !inCrm) return false
      if (audienceFilter === "in-mailchimp" && !inMc) return false
      if (audienceFilter === "untapped" && inCrm) return false
      if (audienceFilter === "opted-out" && !isOptedOut(subscriberMap.get(email))) return false
    }
    return true
  }).sort((a, b) => compareRows(a, b, sortState))

  const visibleIds = filteredRegistrationsBeforeState.map((r) => r.id ?? "").filter(Boolean) as string[]
  const { states: submissionStates, setLocal, setLocalBulk } =
    useSubmissionStates({ source: SUBMISSION_SOURCE, ids: visibleIds })

  const filteredRegistrations = filteredRegistrationsBeforeState.filter((r) => {
    if (stateFilter === "all") return true
    if (!r.id) return stateFilter === "new"
    return getStateOrNew(submissionStates, r.id) === stateFilter
  })

  const stateCounts: Partial<Record<"all" | SubmissionState, number>> = {
    all: filteredRegistrationsBeforeState.length,
    new: 0,
    triaged: 0,
    replied: 0,
    archived: 0,
    spam: 0,
  }
  for (const r of filteredRegistrationsBeforeState) {
    const st = r.id ? getStateOrNew(submissionStates, r.id) : "new"
    stateCounts[st] = (stateCounts[st] ?? 0) + 1
  }

  const allVisibleIds = filteredRegistrations.map((r) => r.id ?? "").filter(Boolean) as string[]
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
        message: `${updates.length} registration${updates.length === 1 ? "" : "s"} marked ${target}`,
        type: "success",
      })
      clearSelected()
    } catch {
      setToast({ message: "Bulk update failed", type: "error" })
    }
  }

  // Bulk delete — the single "go away" action. Hard-deletes each selected
  // registration through the existing per-id DELETE, chunked so a large
  // selection doesn't fan out all at once.
  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    if (!confirm(`Delete ${ids.length} registration${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return
    const CHUNK = 10
    const deletedIds: string[] = []
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const results = await Promise.allSettled(
        chunk.map((id) =>
          fetch("/api/admin/event-registrations", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }).then((r) => {
            if (!r.ok) throw new Error("failed")
            return id
          }),
        ),
      )
      results.forEach((r) => { if (r.status === "fulfilled") deletedIds.push(r.value) })
    }
    const deletedSet = new Set(deletedIds)
    if (deletedSet.size > 0) {
      setRegistrations((prev) => prev.filter((r) => !r.id || !deletedSet.has(r.id)))
    }
    const failed = ids.length - deletedSet.size
    setToast({
      message: failed === 0 ? `Deleted ${deletedSet.size} registration${deletedSet.size === 1 ? "" : "s"}` : `Deleted ${deletedSet.size}, failed ${failed}`,
      type: failed === 0 ? "success" : "error",
    })
    clearSelected()
    await fetchCounts()
    onChanged?.()
  }

  // "Convert all" — converts every CURRENTLY VISIBLE registration into a lead,
  // ignoring the selection set. Powers the action button in the event detail
  // header so the user doesn't have to select-all-then-convert. Idempotent on
  // the backend (already-existing leads get updated, not duplicated).
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div>
      {/* No tab header — the Audiences segmented control already labels this
          section ("Events"). The event pill rows (grouped Upcoming/Past) are
          the only chrome, with Export tucked into their right edge via the
          `actions` slot. Selecting an event reveals its stat-chip filters +
          the registrations-over-time chart. */}
      <EventInsights
        selectedEvent={selectedEvent}
        onSelect={handleFilterByEvent}
        totalRegistrationsFallback={totalCount}
        audienceFilter={audienceFilter}
        onAudienceFilterChange={setAudienceFilter}
        // Timestamps from the FULL event set (not filtered) so the chart shows
        // the true history regardless of audience/state filters.
        drilldownTimestamps={
          selectedEvent
            ? registrations
                .filter((r) => r.eventName === selectedEvent)
                .map((r) => r.registeredAt)
                .filter(Boolean)
            : undefined
        }
        actions={
          <ExportMenu
            disabled={isDownloading || totalCount === 0}
            isDownloading={isDownloading}
            allCount={totalCount}
            filteredCount={filteredRegistrations.length}
            selectedCount={selected.size}
            onExportAll={handleDownloadCSV}
            onExportFiltered={handleDownloadFilteredRegCSV}
            onExportSelected={handleDownloadSelectedRegCSV}
          />
        }
      />

      {/* Filter toolbar — search + state chips on one quiet row (wraps on
          narrow widths). No date filter: selecting an event above *is* the
          temporal filter. */}
      {registrations.length > 0 && !error && (
        <div className="flex items-center gap-2.5 flex-wrap mb-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, company, or event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 text-[13px] font-normal text-neutral-700 placeholder:text-neutral-400"
            />
          </div>
          {!isLoading && (
            <StateFilterChips active={stateFilter} onChange={setStateFilter} counts={stateCounts} />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchRegistrations()}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-[13px] font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && !error && (
        <div className="bg-white rounded-md border border-neutral-200/70 p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-400 text-[13px] font-normal">Loading event registrations...</p>
        </div>
      )}


      {/* Registrations List */}
      {!isLoading && !error && registrations.length > 0 && (
        <div className="bg-white rounded-md border border-neutral-200/70 overflow-hidden">
          {filteredRegistrations.length > 0 && (() => {
            // "Hidden by filter" = selected rows that aren't currently in the
            // visible (post-state-filter) set. Surfaces a subtle hint when the
            // user changes the state filter while rows are selected so they
            // don't think their selection got dropped.
            const visibleSelected = allVisibleIds.reduce(
              (n, id) => n + (selected.has(id) ? 1 : 0),
              0,
            )
            const hiddenSelected = selected.size - visibleSelected
            return (
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
                    : `${filteredRegistrations.length} visible`}
                  {hiddenSelected > 0 && (
                    <span className="ml-2 text-neutral-400">
                      ({hiddenSelected} hidden by filter)
                    </span>
                  )}
                </span>
              </div>
            )
          })()}
          {/* ── Mobile Card View ── */}
          <div className="block md:hidden divide-y divide-neutral-100 max-h-[65vh] overflow-y-auto">
            {filteredRegistrations.length === 0 ? (
              <div className="px-5 py-12 text-center text-neutral-400">
                <Ticket className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-500">No registrations found</p>
                {searchQuery && (
                  <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                )}
              </div>
            ) : (
              filteredRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="px-4 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer active:bg-neutral-100"
                  onClick={() => setSelectedRegistration(reg)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={!!reg.id && selected.has(reg.id)}
                        onChange={() => reg.id && toggleSelect(reg.id)}
                        className="rounded border-neutral-300 mt-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight">
                          {reg.firstName} {reg.lastName}
                          <LeadCrossLink email={reg.email} mapping={leadsByEmail} />
                          <MailchimpSubscribedPill email={reg.email} mapping={subscriberMap} />
                        </p>
                        <p className="text-[13px] text-neutral-500 font-normal leading-relaxed mt-0.5 truncate">
                          {reg.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {reg.id && (
                        <StateBadge
                          source={SUBMISSION_SOURCE}
                          id={reg.id}
                          state={getStateOrNew(submissionStates, reg.id)}
                          onChange={(s) => setLocal(reg.id!, s)}
                        />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedRegistration(reg) }}
                        aria-label={`View ${reg.email}`}
                        className="grid place-items-center h-10 w-10 sm:h-9 sm:w-9 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(reg.id!, reg.email) }}
                        disabled={isDeleting === reg.id}
                        aria-label={`Delete ${reg.email}`}
                        className="grid place-items-center h-10 w-10 sm:h-9 sm:w-9 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isDeleting === reg.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide whitespace-nowrap">
                      {reg.eventName}
                    </span>
                    {reg.company && (
                      <span className="text-[12px] text-neutral-400 font-normal truncate">
                        {reg.company}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-neutral-400 font-normal leading-relaxed">
                    <span>{formatDate(reg.registeredAt)}</span>
                    {reg.subscribeToFeed && (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" /> Feed
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop — virtualized table (Sprint 2) */}
          <EventRegistrationsTable
            rows={filteredRegistrations}
            sort={sortState}
            onSortChange={setSortState}
            selected={selected}
            onToggleSelect={toggleSelect}
            source={SUBMISSION_SOURCE}
            states={submissionStates}
            onLocalState={setLocal}
            leadsByEmail={leadsByEmail}
            onSelectRow={(row) => setSelectedRegistration(row)}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            searchQuery={searchQuery}
          />

          {filteredRegistrations.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5">
              <span className="text-[12px] text-neutral-400 font-normal leading-relaxed tabular-nums">
                <strong className="text-neutral-700 font-semibold">
                  {filteredRegistrations.length.toLocaleString()}
                </strong>
                {filteredRegistrations.length !== totalCount && (
                  <> of {totalCount.toLocaleString()}</>
                )}
                {" "}
                registration{filteredRegistrations.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* No data */}
      {!isLoading && !error && registrations.length === 0 && (
        <div className="bg-white rounded-md border border-neutral-200/70 p-12 text-center">
          <Ticket className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-500">No event registrations found</p>
          <p className="text-[12px] text-neutral-400 mt-1 font-normal">
            Event registrations will appear here once collected
          </p>
        </div>
      )}

      {/* Registration Detail Modal */}
      <DetailDrawer
        open={!!selectedRegistration}
        onClose={() => setSelectedRegistration(null)}
        title={
          selectedRegistration
            ? selectedRegistration.fullName ||
              `${selectedRegistration.firstName} ${selectedRegistration.lastName}`.trim() ||
              selectedRegistration.email
            : ""
        }
        subtitle={
          selectedRegistration ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Registered {formatDate(selectedRegistration.registeredAt)}
            </span>
          ) : null
        }
        footer={
          selectedRegistration ? (() => {
            const existingLeadId = leadsByEmail.get(
              selectedRegistration.email.toLowerCase(),
            )
            return (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    handleDelete(selectedRegistration.id!, selectedRegistration.email)
                    setSelectedRegistration(null)
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50 rounded-sm transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                {selectedRegistration.promotedLeadId || existingLeadId ? (
                  // Already promoted — render as a navigation link rather than
                  // an action button so its visual weight matches "FYI, the
                  // workflow continues over there" instead of "do this now".
                  <a
                    href={`/admin/leads?openLead=${encodeURIComponent(selectedRegistration.promotedLeadId || existingLeadId!)}`}
                    className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-sm transition-colors"
                    title="Open this contact in the CRM"
                  >
                    Open in CRM
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedRegistration.id) return
                      await promoteRegistrations([selectedRegistration.id])
                      setSelectedRegistration(null)
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded hover:bg-neutral-800 transition-colors"
                    title="Promote this registrant to the leads pipeline"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    Promote to lead
                  </button>
                )}
              </div>
            )
          })() : null
        }
      >
        {selectedRegistration && (
          <div className="px-5 py-4 space-y-4">
            {/* Identity rows — first/last/company are backfill-only inline
                edits (lock once populated). Email/source are immutable
                identity fields, marked with a Lock affordance. */}
            <dl className="divide-y divide-neutral-100 text-[13px]">
              <DetailRow icon={User} label="First name">
                <BackfillField
                  value={selectedRegistration.firstName}
                  emptyLabel="Add first name"
                  onSave={(next) =>
                    handleBackfill(selectedRegistration.id, "firstName", next)
                  }
                />
              </DetailRow>
              <DetailRow icon={User} label="Last name">
                <BackfillField
                  value={selectedRegistration.lastName}
                  emptyLabel="Add last name"
                  onSave={(next) =>
                    handleBackfill(selectedRegistration.id, "lastName", next)
                  }
                />
              </DetailRow>
              <DetailRow icon={Mail} label="Email">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <a
                    href={`mailto:${selectedRegistration.email}`}
                    className="text-neutral-900 hover:underline"
                  >
                    {selectedRegistration.email}
                  </a>
                  <span
                    title="Identity field — to change, delete this registration and add a new one"
                    aria-label="Identity field, not editable"
                  >
                    <LockIcon className="w-3 h-3 text-neutral-300" />
                  </span>
                  <MailchimpSubscribedPill
                    email={selectedRegistration.email}
                    mapping={subscriberMap}
                  />
                </span>
              </DetailRow>
              <DetailRow icon={Building2} label="Company">
                <BackfillField
                  value={selectedRegistration.company}
                  emptyLabel="Add company"
                  onSave={(next) =>
                    handleBackfill(selectedRegistration.id, "company", next)
                  }
                />
              </DetailRow>
              <DetailRow icon={Globe} label="Source">
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-neutral-100 text-neutral-700">
                    {selectedRegistration.source}
                  </span>
                  <span
                    title="Provenance field — captured at signup, not editable"
                    aria-label="Provenance field, not editable"
                  >
                    <LockIcon className="w-3 h-3 text-neutral-300" />
                  </span>
                </span>
              </DetailRow>
            </dl>

            {/* Enrichment hint — sparse rows get a one-line nudge to push
                the user toward the CRM where deeper fields (phone, role,
                notes, score) live. */}
            {(() => {
              const sparse =
                !selectedRegistration.firstName ||
                !selectedRegistration.lastName ||
                !selectedRegistration.company
              if (!sparse) return null
              return (
                <div className="rounded-md border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[12px] text-amber-800 leading-relaxed">
                  Some fields are missing. Backfill them above, or open this
                  contact in the CRM for deeper enrichment (phone, role, notes).
                </div>
              )
            })()}

            {/* Event block — name/date are immutable history (changing them
                would rewrite the record of what they signed up for). Tags
                stay editable elsewhere; here they're shown read-only. */}
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                <Ticket className="w-3 h-3" />
                Event
              </div>
              <dl className="divide-y divide-neutral-100 text-[13px]">
                <DetailRow label="Name">
                  <span className="inline-flex items-center gap-2">
                    {selectedRegistration.eventName}
                    <span title="History field — to change, delete and re-add">
                      <LockIcon className="w-3 h-3 text-neutral-300" />
                    </span>
                  </span>
                </DetailRow>
                <DetailRow label="Date">{formatDate(selectedRegistration.eventDate)}</DetailRow>
                <DetailRow label="Feed">
                  {selectedRegistration.subscribeToFeed ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <Check className="w-3 h-3" /> Subscribed
                    </span>
                  ) : (
                    <span className="text-neutral-400">No</span>
                  )}
                </DetailRow>
                {selectedRegistration.tags?.length > 0 && (
                  <DetailRow label="Tags">
                    <TagList tags={selectedRegistration.tags} />
                  </DetailRow>
                )}
              </dl>
            </div>

            {/* Provenance footer — only renders when the row has been
                touched manually. Tells the user "this isn't pristine
                signup data anymore" without taking any space otherwise. */}
            {selectedRegistration.enrichedAt && (
              <div className="text-[11px] text-neutral-400 leading-relaxed">
                Enriched {formatDate(selectedRegistration.enrichedAt)}
                {selectedRegistration.enrichedBy && (
                  <> by <span className="text-neutral-600">{selectedRegistration.enrichedBy}</span></>
                )}
              </div>
            )}

            {/* Page URL */}
            {selectedRegistration.pageUrl && (
              <div>
                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                  <MapPin className="w-3 h-3" />
                  Registered From
                </div>
                <a
                  href={selectedRegistration.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-neutral-700 hover:text-neutral-900 hover:underline truncate block"
                >
                  {selectedRegistration.pageUrl.replace(/https?:\/\//, "").split("?")[0]}
                </a>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <BulkActionBar
        count={selected.size}
        onClear={clearSelected}
        actions={[
          { key: "promote", label: "Promote to leads", icon: ArrowRightCircle, group: "primary", run: handleOpenPromoteDrawer },
          { key: "triage", label: "Mark triaged", icon: EyeIcon, run: () => runBulk("triaged") },
          { key: "reply", label: "Mark replied", icon: MsgIcon, run: () => runBulk("replied") },
          { key: "delete", label: "Delete", icon: Trash2, destructive: true, run: handleBulkDelete },
        ]}
      />

      <PromoteOverridesDrawer
        open={promoteDrawerIds.length > 0}
        onClose={() => setPromoteDrawerIds([])}
        count={promoteDrawerIds.length}
        collection="event_registrations"
        defaultSource="event"
        isPromoting={isBulkPromoting}
        onConfirm={handleConfirmBulkPromote}
      />
    </div>
  )
}
