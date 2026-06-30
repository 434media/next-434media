"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Loader2,
  Mail,
  Search,
  AlertCircle,
  Calendar,
  Trash2,
  Globe,
  Layers,
  Clock,
  Eye,
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
import {
  EmailSourceInsights,
  type EmailAudienceFilter,
} from "@/components/admin/EmailSourceInsights"
import {
  EmailSignupsTable,
  compareSignupRows,
  type SignupSortState,
} from "@/components/admin/EmailSignupsTable"
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
import { PermissionStateRibbon } from "@/components/admin/PermissionStateRibbon"
import { TagList } from "@/components/admin/Tag"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { ExportMenu, DateRangeDropdown, DetailRow } from "./shared"
import type { Toast } from "./types"
import { usePromoteToLeads } from "./usePromoteToLeads"
import { PromoteOverridesDrawer } from "./PromoteOverridesDrawer"
import { ArrowRightCircle } from "lucide-react"

interface EmailSignup {
  id: string
  email: string
  source: string
  created_at: string
  // Optional — set on rows that have been pushed to Mailchimp. Surfaced in
  // the drawer with the same TagList overflow component used in Events.
  mailchimp_tags?: string[]
  // Set when this subscriber has been promoted into the leads pipeline.
  promotedLeadId?: string
  promotedAt?: string
}

export function EmailListsTab({
  setToast,
  initialSearch = "",
  onChanged,
  readOnly = false,
}: {
  setToast: (t: Toast | null) => void
  initialSearch?: string
  /** Fired after a mutation (delete / promote) so the Audiences header strip
   *  can re-fetch its per-source counts live. */
  onChanged?: () => void
  /** QA read-only — blocks destructive actions (delete / bulk-delete / promote). */
  readOnly?: boolean
}) {
  const blockReadOnly = (): boolean => {
    if (readOnly) {
      setToast({ message: "Read-only access — this action is disabled during QA.", type: "error" })
      return true
    }
    return false
  }
  const leadsByEmail = useLeadsByEmail()
  const subscriberMap = useMailchimpSubscribers()
  const SUBMISSION_SOURCE: SubmissionSource = "email_signups"
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signups, setSignups] = useState<EmailSignup[]>([])
  const [sources, setSources] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  // Default to "" (All sources). The previous AIM default surprised users
  // entering the tab — now the overview cards are the navigation surface.
  const [selectedSource, setSelectedSource] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [isDownloading, setIsDownloading] = useState(false)
  // PR 3 — state filter + per-row state badges
  const [stateFilter, setStateFilter] = useState<"all" | SubmissionState>("all")
  // PR 4 — bulk select
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [datePreset, setDatePreset] = useState("")
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  // Sprint A: audience filter (driven by drilldown stat tiles), table sort,
  // detail drawer.
  const [audienceFilter, setAudienceFilter] = useState<EmailAudienceFilter>("all")
  const [signupSort, setSignupSort] = useState<SignupSortState>({
    column: "created_at",
    direction: "desc",
  })
  const [selectedSignup, setSelectedSignup] = useState<EmailSignup | null>(null)
  // Sprint D — cross-collection signal map. Built from /cross-source-dupes
  // so the drawer can answer "this email is also a contact form / event
  // registrant" without a per-row fetch. Counts of OTHER collections only.
  const [crossCollectionMap, setCrossCollectionMap] = useState<
    Map<string, { contactForms: number; eventRegistrations: number }>
  >(new Map())

  // Reset audience filter when the user navigates between sources so a stale
  // filter doesn't silently empty the next view.
  useEffect(() => {
    setAudienceFilter("all")
  }, [selectedSource])

  const fetchSourcesAndCounts = useCallback(async () => {
    try {
      const [sourcesRes, countsRes] = await Promise.all([
        fetch(`/api/admin/email-lists-firestore?action=sources&_t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/admin/email-lists-firestore?action=counts&_t=${Date.now()}`, { cache: "no-store" }),
      ])
      const sourcesData = await sourcesRes.json()
      const countsData = await countsRes.json()
      if (sourcesData.success) setSources(sourcesData.sources)
      if (countsData.success) setCounts(countsData.counts)
    } catch (err) {
      console.error("Error fetching sources:", err)
    }
  }, [])

  // Always load ALL signups on mount so the source-cards can compute CRM /
  // Mailchimp coverage per source via client-side join. Filtering by source
  // happens in the render path. This trades a one-time wider fetch for
  // accurate rollups + a fixed bug where selectedSource="" used to show
  // an empty table.
  const fetchSignups = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(
        `/api/admin/email-lists-firestore?_t=${Date.now()}`,
        { cache: "no-store" },
      )
      const data = await res.json()
      if (data.success) {
        setSignups(data.signups)
      } else {
        setError(data.error || "Failed to fetch signups")
      }
    } catch {
      setError("Failed to fetch email signups")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Cross-collection dupes — single fetch on tab mount. Result is consumed
  // by the drawer's "Also in" row so the user sees when an email also lives
  // in contact forms or event registrations. Silent failure: if the API
  // hiccups, the badge just doesn't render — not load-bearing.
  const fetchCrossCollectionMap = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/submissions/cross-source-dupes?minSources=2`,
        { cache: "no-store" },
      )
      if (!res.ok) return
      const data = await res.json()
      const groups = (data?.groups ?? []) as Array<{
        email: string
        counts: { email_signups: number; contact_forms: number; event_registrations: number }
      }>
      const next = new Map<string, { contactForms: number; eventRegistrations: number }>()
      for (const g of groups) {
        // Only surface groups that include an email_signups entry — otherwise
        // there's no row in this tab to attach the badge to.
        if (g.counts.email_signups <= 0) continue
        next.set(g.email.toLowerCase(), {
          contactForms: g.counts.contact_forms,
          eventRegistrations: g.counts.event_registrations,
        })
      }
      setCrossCollectionMap(next)
    } catch {
      // ignored — non-fatal
    }
  }, [])

  useEffect(() => {
    fetchSourcesAndCounts()
    fetchSignups()
    fetchCrossCollectionMap()
  }, [fetchSourcesAndCounts, fetchSignups, fetchCrossCollectionMap])

  const handleDeleteEmail = async (id: string, email: string) => {
    if (blockReadOnly()) return
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return
    try {
      setIsDeleting(id)
      const res = await fetch("/api/admin/email-lists-firestore", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.success) {
        setToast({ message: `Deleted ${email}`, type: "success" })
        await fetchSourcesAndCounts()
        await fetchSignups()
        onChanged?.()
      } else {
        setToast({ message: data.error || "Failed to delete", type: "error" })
      }
    } catch {
      setToast({ message: "Failed to delete email", type: "error" })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleDownloadAllCSV = async () => {
    try {
      setIsDownloading(true)
      const url = selectedSource
        ? `/api/admin/email-lists-firestore?source=${encodeURIComponent(selectedSource)}&format=csv`
        : "/api/admin/email-lists-firestore?format=csv"
      const res = await fetch(url)
      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `${selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"}-emails-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${counts[selectedSource] || signups.length} emails`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    } finally {
      setIsDownloading(false)
    }
  }

  // Shared CSV builder — used by both Filtered and Selected exports below.
  const buildAndDownloadCSV = (
    rows: EmailSignup[],
    filenameBase: string,
    successLabel: string,
  ) => {
    try {
      const headers = ["Email", "Source", "Signup Date"]
      const rowsCsv = rows.map((signup) => [
        signup.email,
        signup.source,
        signup.created_at ? new Date(signup.created_at).toLocaleDateString() : "",
      ])
      const csvContent = [
        headers.join(","),
        ...rowsCsv.map((row) =>
          row
            .map((cell) => {
              const escaped = String(cell).replace(/"/g, '""')
              return escaped.includes(",") || escaped.includes('"')
                ? `"${escaped}"`
                : escaped
            })
            .join(","),
        ),
      ].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv" })
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

  const handleDownloadSelectedCSV = () => {
    const rows = signups.filter((s) => selected.has(s.id))
    if (rows.length === 0) return
    const base = `selected-emails-${new Date().toISOString().split("T")[0]}`
    buildAndDownloadCSV(rows, base, "selected emails")
  }

  const handleDownloadFilteredCSV = () => {
    try {
      const headers = ["Email", "Source", "Signup Date"]
      const rows = filteredSignups.map((signup) => [
        signup.email,
        signup.source,
        signup.created_at ? new Date(signup.created_at).toLocaleDateString() : "",
      ])
      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const escaped = String(cell).replace(/"/g, '""')
              return escaped.includes(",") || escaped.includes('"')
                ? `"${escaped}"`
                : escaped
            })
            .join(",")
        ),
      ].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv" })
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      let filename = selectedSource?.toLowerCase().replace(/\s+/g, "-") || "all"
      filename += "-emails"
      if (startDate && endDate) filename += `-${startDate}-to-${endDate}`
      else if (startDate) filename += `-from-${startDate}`
      else if (endDate) filename += `-until-${endDate}`
      else filename += `-${new Date().toISOString().split("T")[0]}`
      a.download = `${filename}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      setToast({ message: `Downloaded ${filteredSignups.length} emails`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
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

  // Filter signups
  // Pre-state-filter set — used to fetch states (so chip counts include
  // state-filtered-out rows in the count UI). Source filtering moved here
  // (client-side) since Sprint A loads all signups upfront for the rollups.
  const filteredSignupsBeforeState = signups
    .filter((signup) => {
      if (selectedSource && signup.source !== selectedSource) return false
      if (searchQuery && !signup.email.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (startDate || endDate) {
        const signupDate = new Date(signup.created_at)
        if (startDate) {
          const start = new Date(startDate)
          start.setHours(0, 0, 0, 0)
          if (signupDate < start) return false
        }
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          if (signupDate > end) return false
        }
      }
      if (audienceFilter !== "all") {
        const email = signup.email.toLowerCase()
        const inCrm = leadsByEmail.has(email)
        // "In Mailchimp" = subscribed (marketable), matching the tile — not mere presence.
        const inMc = isMarketable(subscriberMap.get(email))
        if (audienceFilter === "in-crm" && !inCrm) return false
        if (audienceFilter === "in-mailchimp" && !inMc) return false
        if (audienceFilter === "untapped" && inCrm) return false
        if (audienceFilter === "opted-out" && !isOptedOut(subscriberMap.get(email))) return false
      }
      return true
    })
    .sort((a, b) => compareSignupRows(a, b, signupSort))

  // Fetch sidecar states for visible rows in one batch.
  const visibleIds = filteredSignupsBeforeState.map((s) => s.id)
  const { states: submissionStates, refresh: refreshStates, setLocal, setLocalBulk } =
    useSubmissionStates({ source: SUBMISSION_SOURCE, ids: visibleIds })

  // Apply state filter on top
  const filteredSignups = filteredSignupsBeforeState.filter((signup) => {
    if (stateFilter === "all") return true
    return getStateOrNew(submissionStates, signup.id) === stateFilter
  })

  // Counts per state — for the chip badges
  const stateCounts: Partial<Record<"all" | SubmissionState, number>> = {
    all: filteredSignupsBeforeState.length,
    new: 0,
    triaged: 0,
    replied: 0,
    archived: 0,
    spam: 0,
  }
  for (const s of filteredSignupsBeforeState) {
    const st = getStateOrNew(submissionStates, s.id)
    stateCounts[st] = (stateCounts[st] ?? 0) + 1
  }

  // Bulk handler factory — shared shape for "mark all selected as X"
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
        message: `${updates.length} signup${updates.length === 1 ? "" : "s"} marked ${target}`,
        type: "success",
      })
      clearSelected()
    } catch {
      setToast({ message: "Bulk update failed", type: "error" })
    }
  }

  // Bulk delete — the single "go away" action. Hard-deletes each selected signup
  // through the existing per-id DELETE (handles aimsatx: named-DB routing),
  // chunked so a large selection doesn't fan out all at once.
  const handleBulkDelete = async () => {
    if (blockReadOnly()) return
    if (selected.size === 0) return
    const ids = Array.from(selected)
    if (!confirm(`Delete ${ids.length} signup${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return
    const CHUNK = 10
    let deleted = 0
    for (let i = 0; i < ids.length; i += CHUNK) {
      const results = await Promise.allSettled(
        ids.slice(i, i + CHUNK).map((id) =>
          fetch("/api/admin/email-lists-firestore", {
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
      message: failed === 0 ? `Deleted ${deleted} signup${deleted === 1 ? "" : "s"}` : `Deleted ${deleted}, failed ${failed}`,
      type: failed === 0 ? "success" : "error",
    })
    clearSelected()
    await fetchSourcesAndCounts()
    await fetchSignups()
    onChanged?.()
  }

  // Audience → Leads promotion (sets bidirectional backlinks). Replaces the
  // old runConvert flow, which created Leads but didn't track the backlink.
  const { promote: promoteSignups } = usePromoteToLeads({
    collection: "email_signups",
    setToast,
    onSuccess: () => {
      fetchSignups()
      onChanged?.()
    },
    onClearSelection: clearSelected,
  })

  const [promoteDrawerIds, setPromoteDrawerIds] = useState<string[]>([])
  const [isBulkPromoting, setIsBulkPromoting] = useState(false)

  const handleOpenPromoteDrawer = () => {
    const ids = signups
      .filter((s) => s.id && selected.has(s.id) && !s.promotedLeadId)
      .map((s) => s.id)
    if (ids.length === 0) {
      setToast({ message: "No unpromoted signups in selection", type: "error" })
      return
    }
    setPromoteDrawerIds(ids)
  }

  const handleConfirmBulkPromote = async (overrides: Parameters<typeof promoteSignups>[1]) => {
    if (blockReadOnly()) return
    setIsBulkPromoting(true)
    try {
      await promoteSignups(promoteDrawerIds, overrides)
      setPromoteDrawerIds([])
    } finally {
      setIsBulkPromoting(false)
    }
  }

  const allVisibleIds = filteredSignups.map((s) => s.id)
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))

  // Sprint C — cross-source dupes lookup, scoped to the email_signups
  // collection. Built once per `signups` change and passed to the table
  // for in-row badges. Keys are lowercased email; values are Set of every
  // distinct source that carried a row for that email. Sets >= 2 mean the
  // user signed up to multiple lists with the same email.
  const sourcesByEmail = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const s of signups) {
      const k = (s.email || "").toLowerCase()
      if (!k) continue
      let set = m.get(k)
      if (!set) {
        set = new Set()
        m.set(k, set)
      }
      set.add(s.source)
    }
    return m
  }, [signups])

  const handleDatePreset = (preset: string) => {
    setDatePreset(preset)
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().split("T")[0]
    switch (preset) {
      case "today":
        setStartDate(fmt(today))
        setEndDate(fmt(today))
        break
      case "yesterday": {
        const y = new Date(today)
        y.setDate(y.getDate() - 1)
        setStartDate(fmt(y))
        setEndDate(fmt(y))
        break
      }
      case "last7days": {
        const d = new Date(today)
        d.setDate(d.getDate() - 7)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "last30days": {
        const d = new Date(today)
        d.setDate(d.getDate() - 30)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "thisMonth": {
        const d = new Date(today.getFullYear(), today.getMonth(), 1)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      case "lastMonth": {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const last = new Date(today.getFullYear(), today.getMonth(), 0)
        setStartDate(fmt(first))
        setEndDate(fmt(last))
        break
      }
      case "thisYear": {
        const d = new Date(today.getFullYear(), 0, 1)
        setStartDate(fmt(d))
        setEndDate(fmt(today))
        break
      }
      default:
        setStartDate("")
        setEndDate("")
        break
    }
  }

  const totalCount = selectedSource
    ? counts[selectedSource] || 0
    : Object.values(counts).reduce((a, b) => a + b, 0)

  // The permission ribbon only earns its place once the list is narrowed —
  // otherwise it just restates the source-level consent stats already shown in
  // the Audiences header strip. Any of these filters counts as "narrowed".
  const isFiltered =
    !!selectedSource ||
    searchQuery.trim() !== "" ||
    datePreset !== "" ||
    startDate !== "" ||
    endDate !== "" ||
    stateFilter !== "all" ||
    audienceFilter !== "all"

  return (
    <div>
      {/* No tab header — the Audiences segmented control already labels this
          section ("Newsletter"). The source pill row below is the only chrome,
          with Export tucked into its right edge via the `actions` slot. */}
      <EmailSourceInsights
        sourceCounts={counts}
        allSignups={signups}
        selectedSource={selectedSource}
        onSelectSource={setSelectedSource}
        audienceFilter={audienceFilter}
        onAudienceFilterChange={setAudienceFilter}
        onRefresh={() => { fetchSourcesAndCounts(); fetchSignups() }}
        isLoading={isLoading}
        actions={
          <ExportMenu
            disabled={isDownloading || totalCount === 0}
            isDownloading={isDownloading}
            allCount={totalCount}
            filteredCount={filteredSignups.length}
            selectedCount={selected.size}
            onExportAll={handleDownloadAllCSV}
            onExportFiltered={handleDownloadFilteredCSV}
            onExportSelected={handleDownloadSelectedCSV}
          />
        }
      />

      {/* Filter toolbar — search + a single Date dropdown + state chips on
          one quiet row (wraps on narrow widths). Date/state filters only
          appear once the list has loaded. */}
      <div className="flex items-center gap-2.5 flex-wrap mb-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 text-[13px] font-normal text-neutral-700 placeholder:text-neutral-400"
          />
        </div>
        {!isLoading && !error && (
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeDropdown
              preset={datePreset}
              startDate={startDate}
              endDate={endDate}
              onPresetChange={handleDatePreset}
              onCustomChange={(s, e) => {
                setStartDate(s)
                setEndDate(e)
                setDatePreset(s || e ? "custom" : "")
              }}
              onClear={() => {
                setStartDate("")
                setEndDate("")
                setDatePreset("")
              }}
            />
            <span className="h-5 w-px bg-neutral-200 shrink-0" aria-hidden="true" />
            <StateFilterChips active={stateFilter} onChange={setStateFilter} counts={stateCounts} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchSignups()}
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
          <p className="text-neutral-400 text-[13px] font-normal">Loading email signups...</p>
        </div>
      )}

      {/* Permission state — reachability of the *filtered* slice, right above
          the table so the numbers match what you're viewing. Only shown when a
          filter is active; unfiltered, the Audiences header strip already
          carries the source-level consent breakdown. */}
      {!isLoading && !error && isFiltered && filteredSignups.length > 0 && (
        <div className="mb-3">
          <PermissionStateRibbon
            emails={filteredSignups.map((s) => s.email).filter(Boolean)}
            subscriberMap={subscriberMap}
          />
        </div>
      )}

      {/* Email List */}
      {!isLoading && !error && (
        <div className="bg-white rounded-md border border-neutral-200/70 overflow-hidden">
          {/* Select-all header — appears when there are visible rows */}
          {filteredSignups.length > 0 && (() => {
            // Surface hidden-by-filter when a state/audience filter pushes
            // selected rows off the visible set — same affordance Events
            // gained in Sprint 2.
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
                  {/* Selection-only — the visible/total row count lives once, in
                      the table footer, so it isn't repeated at top and bottom. */}
                  {selected.size > 0 ? `${selected.size} selected` : "Select all"}
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
          <div className="block sm:hidden divide-y divide-neutral-100 max-h-[65vh] overflow-y-auto">
            {filteredSignups.length === 0 ? (
              <div className="px-5 py-12 text-center text-neutral-400">
                <Mail className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-500">No email signups found</p>
                {searchQuery && (
                  <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                )}
              </div>
            ) : (
              filteredSignups.map((signup) => (
                <div
                  key={signup.id}
                  onClick={() => setSelectedSignup(signup)}
                  className="px-4 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer active:bg-neutral-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight truncate">
                        {signup.email}
                        <LeadCrossLink email={signup.email} mapping={leadsByEmail} />
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteEmail(signup.id, signup.email)}
                      disabled={isDeleting === signup.id}
                      aria-label={`Delete ${signup.email}`}
                      className="grid place-items-center h-10 w-10 sm:h-9 sm:w-9 text-neutral-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isDeleting === signup.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <input
                      type="checkbox"
                      checked={selected.has(signup.id)}
                      onChange={() => toggleSelect(signup.id)}
                      className="rounded border-neutral-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600 tracking-wide whitespace-nowrap">
                      {signup.source}
                    </span>
                    <StateBadge
                      source={SUBMISSION_SOURCE}
                      id={signup.id}
                      state={getStateOrNew(submissionStates, signup.id)}
                      onChange={(s) => setLocal(signup.id, s)}
                    />
                    <span className="text-[12px] text-neutral-400 font-normal leading-relaxed">
                      {formatDate(signup.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop — virtualized table (Sprint A) */}
          <EmailSignupsTable
            rows={filteredSignups}
            sort={signupSort}
            onSortChange={setSignupSort}
            selected={selected}
            onToggleSelect={toggleSelect}
            source={SUBMISSION_SOURCE}
            states={submissionStates}
            onLocalState={setLocal}
            leadsByEmail={leadsByEmail}
            subscriberMap={subscriberMap}
            sourcesByEmail={sourcesByEmail}
            crossCollectionMap={crossCollectionMap}
            onSelectRow={setSelectedSignup}
            onDelete={handleDeleteEmail}
            isDeleting={isDeleting}
            searchQuery={searchQuery}
          />

          {filteredSignups.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5">
              <span className="text-[12px] text-neutral-400 font-normal leading-relaxed tabular-nums">
                <strong className="text-neutral-700 font-semibold">
                  {filteredSignups.length.toLocaleString()}
                </strong>
                {filteredSignups.length !== totalCount && (
                  <> of {totalCount.toLocaleString()}</>
                )}
                {" "}email{filteredSignups.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* PR 4 — bulk action bar (sticky bottom, appears when selection > 0) */}
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

      {/* Email signup detail drawer — opens on row click. Slim version of
          the Events drawer: email + Mailchimp pill, locked source/date,
          editable state, footer with Open in CRM / Convert to lead. */}
      <DetailDrawer
        open={!!selectedSignup}
        onClose={() => setSelectedSignup(null)}
        title={selectedSignup ? selectedSignup.email : ""}
        subtitle={
          selectedSignup ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Signed up {formatDate(selectedSignup.created_at)}
            </span>
          ) : null
        }
        footer={
          selectedSignup ? (() => {
            const existingLeadId = leadsByEmail.get(
              selectedSignup.email.toLowerCase(),
            )
            return (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    handleDeleteEmail(selectedSignup.id, selectedSignup.email)
                    setSelectedSignup(null)
                  }}
                  className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
                <div className="flex items-center gap-1.5">
                  {selectedSignup.promotedLeadId || existingLeadId ? (
                    // Already promoted — link rather than action button.
                    <a
                      href={`/admin/leads?openLead=${encodeURIComponent(selectedSignup.promotedLeadId || existingLeadId!)}`}
                      className="inline-flex items-center gap-1.5 px-2 py-1 text-[12px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                      title="Open this contact in the CRM"
                    >
                      Open in CRM
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedSignup.id) return
                        await promoteSignups([selectedSignup.id])
                        setSelectedSignup(null)
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-white bg-neutral-900 rounded hover:bg-neutral-800 transition-colors"
                      title="Promote this subscriber to the leads pipeline"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                      Promote to lead
                    </button>
                  )}
                </div>
              </div>
            )
          })() : null
        }
      >
        {selectedSignup && (
          <div className="px-5 py-4 space-y-4">
            <dl className="divide-y divide-neutral-100 text-[13px]">
              <DetailRow icon={Mail} label="Email">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <a
                    href={`mailto:${selectedSignup.email}`}
                    className="text-neutral-900 hover:underline"
                  >
                    {selectedSignup.email}
                  </a>
                  <span
                    title="Identity field — to change, delete and re-add"
                    aria-label="Identity field, not editable"
                  >
                    <LockIcon className="w-3 h-3 text-neutral-300" />
                  </span>
                  <MailchimpSubscribedPill
                    email={selectedSignup.email}
                    mapping={subscriberMap}
                  />
                </span>
              </DetailRow>
              <DetailRow icon={Globe} label="Source">
                <span className="inline-flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-neutral-100 text-neutral-700">
                    {selectedSignup.source}
                  </span>
                  <span title="Provenance — captured at signup, not editable">
                    <LockIcon className="w-3 h-3 text-neutral-300" />
                  </span>
                </span>
              </DetailRow>
              {(() => {
                // Cross-collection signal — fold within-collection (other
                // email_signups sources) and across-collection (contact
                // forms / event registrations) into a single "Also in" row
                // so the user has one place to scan for upstream dedup
                // candidates.
                const emailKey = selectedSignup.email.toLowerCase()
                const set: Set<string> | undefined = sourcesByEmail.get(emailKey)
                const otherSources: string[] = set
                  ? Array.from(set).filter((s) => s !== selectedSignup.source)
                  : []
                const cross = crossCollectionMap.get(emailKey)
                const hasCross = !!(cross && (cross.contactForms > 0 || cross.eventRegistrations > 0))
                if (otherSources.length === 0 && !hasCross) return null
                return (
                  <DetailRow icon={Layers} label="Also in">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {otherSources.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-indigo-50 text-indigo-700"
                          title={`Also signed up to ${s}`}
                        >
                          {s}
                        </span>
                      ))}
                      {cross && cross.contactForms > 0 && (
                        <a
                          href={`/admin/inbox?search=${encodeURIComponent(selectedSignup.email)}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
                          title="View contact form submissions for this email"
                        >
                          {cross.contactForms} contact form{cross.contactForms === 1 ? "" : "s"}
                        </a>
                      )}
                      {cross && cross.eventRegistrations > 0 && (
                        <a
                          href={`/admin/audiences?sub=events&search=${encodeURIComponent(selectedSignup.email)}`}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
                          title="View event registrations for this email"
                        >
                          {cross.eventRegistrations} event reg{cross.eventRegistrations === 1 ? "" : "s"}
                        </a>
                      )}
                    </div>
                  </DetailRow>
                )
              })()}
              <DetailRow icon={Calendar} label="Signed up">
                <span className="inline-flex items-center gap-2">
                  {formatDate(selectedSignup.created_at)}
                  <span title="History field — not editable">
                    <LockIcon className="w-3 h-3 text-neutral-300" />
                  </span>
                </span>
              </DetailRow>
              <DetailRow icon={Eye} label="State">
                <StateBadge
                  source={SUBMISSION_SOURCE}
                  id={selectedSignup.id}
                  state={getStateOrNew(submissionStates, selectedSignup.id)}
                  onChange={(s) => setLocal(selectedSignup.id, s)}
                />
              </DetailRow>
              {selectedSignup.mailchimp_tags && selectedSignup.mailchimp_tags.length > 0 && (
                <DetailRow icon={Mail} label="MC tags">
                  <TagList tags={selectedSignup.mailchimp_tags} max={4} />
                </DetailRow>
              )}
            </dl>
          </div>
        )}
      </DetailDrawer>

      <PromoteOverridesDrawer
        open={promoteDrawerIds.length > 0}
        onClose={() => setPromoteDrawerIds([])}
        count={promoteDrawerIds.length}
        collection="email_signups"
        defaultSource="newsletter"
        isPromoting={isBulkPromoting}
        onConfirm={handleConfirmBulkPromote}
      />
    </div>
  )
}
