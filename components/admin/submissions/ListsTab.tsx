"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  Users2,
  ExternalLink,
  Mail,
  Building2,
  Linkedin,
  Phone,
} from "lucide-react"
import { Mail as MailIcon } from "lucide-react"
import {
  MailchimpSubscribedPill,
  useMailchimpSubscribers,
} from "@/components/admin/MailchimpSubscribedPill"
import { MailchimpPushModal, type PushMember } from "@/components/admin/MailchimpPushModal"
import { BulkActionBar, useSelection } from "@/components/admin/SubmissionStateUI"
import { parseTag } from "@/lib/tag-taxonomy"
import type { Lead } from "@/types/crm-types"
import { ExportMenu } from "./shared"
import type { Toast } from "./types"

// Stage 2 — Partner Lists tab.
//
// Surfaces leads where source === "partner" so partner-shared rosters
// (Alamo Angels members, future imports) have a navigational home alongside
// Newsletter and Events. The data lives in `leads` and stays there — this is
// purely a filtered view, not a separate collection.
//
// Stage 3 moved this under /admin/audiences as the "Lists" sub-tab,
// alongside Newsletter and Events. Each surface shares the same campaign-
// cohort flow (push to Mailchimp → engagement → promote to Lead).

function unslugify(slug: string): string {
  if (!slug) return ""
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

function getPartnerSlug(lead: Lead): string | null {
  if (!lead.tags) return null
  for (const t of lead.tags) {
    const parsed = parseTag(t)
    if (parsed.namespace === "partner") return parsed.value
  }
  return null
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const PRIORITY_BADGE: Record<Lead["priority"], string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-neutral-200 text-neutral-700",
}

export function ListsTab({
  setToast,
  initialSearch = "",
}: {
  setToast: (t: Toast | null) => void
  initialSearch?: string
}) {
  const subscriberMap = useMailchimpSubscribers()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [selectedPartner, setSelectedPartner] = useState<string>("")
  const [showPushModal, setShowPushModal] = useState(false)
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch("/api/admin/leads", { cache: "no-store" })
      const data = await res.json()
      if (data.success) {
        // Filter to partner-source only. The dataset is small enough to do
        // this client-side; mirrors the same approach the leads page takes
        // for view filtering.
        const partnerLeads = (data.leads as Lead[]).filter((l) => l.source === "partner")
        setLeads(partnerLeads)
      } else {
        setError(data.error || "Failed to fetch partner lists")
      }
    } catch {
      setError("Failed to fetch partner lists")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Roll up counts per partner slug. Used by the tile row at the top of the
  // tab so the user can see roster sizes at a glance and click to filter.
  const partnerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const lead of leads) {
      const slug = getPartnerSlug(lead)
      if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
    return counts
  }, [leads])

  const partnersSorted = useMemo(
    () =>
      Array.from(partnerCounts.entries()).sort(
        ([, a], [, b]) => b - a,
      ),
    [partnerCounts],
  )

  // Apply partner + search filter. Sort by score desc so high-priority
  // partner-imported leads bubble to the top of the visible list.
  const filtered = useMemo(() => {
    let pool = leads
    if (selectedPartner) {
      pool = pool.filter((l) => getPartnerSlug(l) === selectedPartner)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      pool = pool.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          (l.company || "").toLowerCase().includes(q) ||
          (l.title || "").toLowerCase().includes(q),
      )
    }
    return [...pool].sort((a, b) => b.score - a.score)
  }, [leads, selectedPartner, searchQuery])

  const totalCount = leads.length
  const allVisibleIds = filtered.map((l) => l.id)
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))

  const buildAndDownloadCSV = (rows: Lead[], filenameBase: string) => {
    try {
      const headers = [
        "Name",
        "Email",
        "Company",
        "Title",
        "Phone",
        "LinkedIn",
        "Partner",
        "Score",
        "Priority",
        "Imported",
      ]
      const csvRows = rows.map((r) => [
        r.name,
        r.email,
        r.company || "",
        r.title || "",
        r.phone || "",
        r.linkedin || "",
        unslugify(getPartnerSlug(r) || ""),
        String(r.score),
        r.priority,
        r.created_at ? new Date(r.created_at).toLocaleDateString() : "",
      ])
      const escape = (val: string) => {
        const s = String(val).replace(/"/g, '""')
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s
      }
      const csv = [headers.join(","), ...csvRows.map((row) => row.map(escape).join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${filenameBase}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setToast({ message: `Downloaded ${rows.length} contact${rows.length === 1 ? "" : "s"}`, type: "success" })
    } catch {
      setToast({ message: "Failed to download CSV", type: "error" })
    }
  }

  const stamp = new Date().toISOString().split("T")[0]
  const handleExportAll = () =>
    buildAndDownloadCSV(leads, `partner-lists-all-${stamp}`)
  const handleExportFiltered = () =>
    buildAndDownloadCSV(filtered, `partner-lists-filtered-${stamp}`)
  const handleExportSelected = () => {
    const rows = leads.filter((l) => selected.has(l.id))
    if (rows.length === 0) return
    buildAndDownloadCSV(rows, `partner-lists-selected-${stamp}`)
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Partner Lists
          </h2>
          <p className="text-[13px] text-neutral-400 font-normal leading-relaxed mt-1">
            Partner-shared rosters in the leads pipeline. Push to Mailchimp campaigns or open in the CRM to work.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLeads()}
            disabled={isLoading}
            className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <ExportMenu
            disabled={totalCount === 0}
            allCount={totalCount}
            filteredCount={filtered.length}
            selectedCount={selected.size}
            onExportAll={handleExportAll}
            onExportFiltered={handleExportFiltered}
            onExportSelected={handleExportSelected}
          />
        </div>
      </div>

      {/* Partner tiles — overview surface. Click to filter to a single
          partner roster; click "All" to clear. */}
      {partnerCounts.size > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
          <button
            onClick={() => setSelectedPartner("")}
            className={`p-3 rounded-xl border transition-all text-left ${
              selectedPartner === ""
                ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Users2 className="w-3 h-3 opacity-50" />
              <span className="text-[11px] font-semibold uppercase tracking-wider">All</span>
            </div>
            <div className="text-xl font-bold leading-tight">
              {totalCount.toLocaleString()}
            </div>
            <div className="text-[11px] opacity-50 font-normal leading-snug">contacts</div>
          </button>
          {partnersSorted.map(([slug, count]) => (
            <button
              key={slug}
              onClick={() => setSelectedPartner(slug)}
              className={`p-3 rounded-xl border transition-all text-left ${
                selectedPartner === slug
                  ? "bg-neutral-900 text-white border-neutral-900 shadow-md"
                  : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Users2 className="w-3 h-3 opacity-50" />
                <span className="text-[11px] font-semibold uppercase tracking-wider truncate">
                  {unslugify(slug)}
                </span>
              </div>
              <div className="text-xl font-bold leading-tight">{count.toLocaleString()}</div>
              <div className="text-[11px] opacity-50 font-normal leading-snug">contacts</div>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {leads.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, company, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200/70 rounded-md focus:outline-none focus:border-neutral-400 text-[13px] font-normal text-neutral-700 placeholder:text-neutral-400"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 text-sm font-medium">{error}</p>
          <button
            onClick={() => fetchLeads()}
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
          <p className="text-neutral-400 text-[13px] font-normal">Loading partner lists...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && leads.length === 0 && (
        <div className="bg-white rounded-md border border-neutral-200/70 p-12 text-center">
          <Users2 className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
          <p className="text-sm font-medium text-neutral-500">No partner lists yet</p>
          <p className="text-[12px] text-neutral-400 mt-1 font-normal">
            Import a partner roster from{" "}
            <a
              href="/admin/leads/import-partner-list"
              className="text-neutral-700 hover:text-neutral-900 underline"
            >
              /admin/leads/import-partner-list
            </a>
          </p>
        </div>
      )}

      {/* Contacts table */}
      {!isLoading && !error && leads.length > 0 && (
        <div className="bg-white rounded-md border border-neutral-200/70 overflow-hidden">
          {/* Select-all header */}
          {filtered.length > 0 && (
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
                  : `${filtered.length} visible`}
              </span>
            </div>
          )}

          {/* ── Mobile Card View ── */}
          <div className="block md:hidden divide-y divide-neutral-100 max-h-[65vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-5 py-12 text-center text-neutral-400">
                <Users2 className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                <p className="text-sm font-medium text-neutral-500">No contacts match your filter</p>
                {searchQuery && (
                  <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                )}
              </div>
            ) : (
              filtered.map((lead) => {
                const slug = getPartnerSlug(lead)
                return (
                  <div
                    key={lead.id}
                    className="px-4 py-3.5 hover:bg-neutral-50 transition-colors cursor-pointer active:bg-neutral-100"
                    onClick={() => {
                      window.location.href = `/admin/leads?openLead=${encodeURIComponent(lead.id)}`
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded border-neutral-300 mt-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight">
                            {lead.name || lead.email}
                            <MailchimpSubscribedPill email={lead.email} mapping={subscriberMap} />
                          </p>
                          <p className="text-[13px] text-neutral-500 font-normal leading-relaxed mt-0.5 truncate">
                            {lead.email}
                          </p>
                          {lead.company && (
                            <p className="text-[12px] text-neutral-400 font-normal leading-relaxed mt-0.5 truncate">
                              {lead.company}
                              {lead.title && <span className="text-neutral-300"> · {lead.title}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-sm text-[12px] font-semibold tabular-nums shrink-0 ${
                          PRIORITY_BADGE[lead.priority] || PRIORITY_BADGE.low
                        }`}
                      >
                        {lead.score}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {slug && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 tracking-wide whitespace-nowrap">
                          {unslugify(slug)}
                        </span>
                      )}
                      <span className="text-[12px] text-neutral-400 font-normal">
                        Imported {formatDate(lead.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── Desktop Table View ── */}
          <div className="hidden md:block overflow-x-auto max-h-[65vh]">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 w-12">
                    {/* select-all header lives in the bar above */}
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 w-16">
                    Score
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Contact
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden lg:table-cell">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50">
                    Partner
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 hidden xl:table-cell">
                    Imported
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-neutral-400">
                      <Users2 className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No contacts match your filter</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((lead) => {
                    const slug = getPartnerSlug(lead)
                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-neutral-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={() => toggleSelect(lead.id)}
                            className="rounded border-neutral-300"
                            aria-label={`Select ${lead.name || lead.email}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-sm text-[12px] font-semibold tabular-nums ${
                              PRIORITY_BADGE[lead.priority] || PRIORITY_BADGE.low
                            }`}
                          >
                            {lead.score}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-0">
                          <div className="font-semibold text-[13px] text-neutral-900 truncate flex items-center gap-1.5">
                            {lead.name || lead.email}
                            <MailchimpSubscribedPill email={lead.email} mapping={subscriberMap} />
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                          {(lead.title || lead.phone || lead.linkedin) && (
                            <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                              {lead.title && <span className="truncate">{lead.title}</span>}
                              {lead.phone && (
                                <span className="inline-flex items-center gap-1 shrink-0">
                                  <Phone className="w-3 h-3" />
                                  {lead.phone}
                                </span>
                              )}
                              {lead.linkedin && (
                                <a
                                  href={lead.linkedin}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 shrink-0 text-blue-500 hover:text-blue-700"
                                >
                                  <Linkedin className="w-3 h-3" />
                                  LinkedIn
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5 text-[12px] text-neutral-700 truncate">
                            <Building2 className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate">{lead.company || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {slug ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 tracking-wide whitespace-nowrap">
                              {unslugify(slug)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-neutral-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-[12px] text-neutral-400 whitespace-nowrap">
                          {formatDate(lead.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={`/admin/leads?openLead=${encodeURIComponent(lead.id)}`}
                            aria-label={`Open ${lead.email} in CRM`}
                            title="Open in CRM"
                            className="inline-flex items-center justify-center p-1.5 text-neutral-300 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-5 py-2.5">
              <span className="text-[12px] text-neutral-400 font-normal leading-relaxed tabular-nums">
                <strong className="text-neutral-700 font-semibold">
                  {filtered.length.toLocaleString()}
                </strong>
                {filtered.length !== totalCount && (
                  <> of {totalCount.toLocaleString()}</>
                )}
                {" "}
                contact{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar — slimmer than the other tabs since partner lists
          don't have submission states. Push-to-Mailchimp is the headline
          campaign-prep action; export is a fallback for offline workflows. */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelected}
        actions={[
          { key: "push-mc", label: "Push to Mailchimp", icon: MailIcon, run: () => { setShowPushModal(true) } },
        ]}
      />

      <MailchimpPushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
        members={leads
          .filter((l) => selected.has(l.id) && l.email)
          .map<PushMember>((l) => {
            const slug = getPartnerSlug(l)
            // Split "First Last" out of the lead.name (best-effort) so the
            // push gets first/last name fields populated. Single-token names
            // become firstName only.
            const nameParts = l.name.trim().split(/\s+/)
            const firstName = nameParts[0] || undefined
            const lastName = nameParts.slice(1).join(" ") || undefined
            return {
              email: l.email,
              firstName,
              lastName,
              sourceTags: slug ? [`partner:${slug}`] : undefined,
            }
          })}
        defaultTag={
          selectedPartner
            ? `partner-${selectedPartner}`
            : `from-partner-list-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
        }
        onComplete={(result) => {
          setToast({
            message: `Pushed: ${result.newMembers} new, ${result.updatedMembers} updated${result.errors.length > 0 ? `, ${result.errors.length} failed` : ""}`,
            type: result.errors.length === 0 ? "success" : "error",
          })
          if (result.errors.length === 0) clearSelected()
        }}
      />
    </div>
  )
}
