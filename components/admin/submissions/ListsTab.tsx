"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Loader2,
  RefreshCw,
  Search,
  AlertCircle,
  Users2,
  Mail,
  Building2,
  Linkedin,
  Phone,
  ArrowRightCircle,
} from "lucide-react"
import { Mail as MailIcon } from "lucide-react"
import {
  MailchimpSubscribedPill,
  useMailchimpSubscribers,
} from "@/components/admin/MailchimpSubscribedPill"
import { MailchimpPushModal, type PushMember } from "@/components/admin/MailchimpPushModal"
import { BulkActionBar, useSelection } from "@/components/admin/SubmissionStateUI"
import type { PartnerListMember } from "@/lib/firestore-partner-list-members"
import { ExportMenu } from "./shared"
import type { Toast } from "./types"
import { usePromoteToLeads } from "./usePromoteToLeads"
import { PromoteOverridesDrawer } from "./PromoteOverridesDrawer"

// Audiences > Lists tab.
//
// Reads from the audience-side `partner_list_members` collection — partner-
// shared rosters (Alamo Angels members et al.) live here as audience cohorts
// until explicitly promoted into the leads pipeline. Mirrors the pattern used
// by Newsletter (email_signups) and Events (event_registrations).
//
// Partner members are NOT leads. Score / priority / status are Lead-only
// concepts and don't apply here. Use this surface for cohort prep — push to
// Mailchimp, then promote individuals into leads when you're ready to work.

function unslugify(slug: string): string {
  if (!slug) return ""
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
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
  const [members, setMembers] = useState<PartnerListMember[]>([])
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [selectedPartner, setSelectedPartner] = useState<string>("")
  const [showPushModal, setShowPushModal] = useState(false)
  const { selected, toggle: toggleSelect, set: setSelected, clear: clearSelected } = useSelection()

  const fetchMembers = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch("/api/admin/audiences/partner-list-members", {
        cache: "no-store",
      })
      const data = await res.json()
      if (data.success) {
        setMembers(data.members as PartnerListMember[])
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
    fetchMembers()
  }, [fetchMembers])

  // Roll up counts per partner slug for the tile row at the top of the tab.
  const partnerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of members) {
      if (m.partnerSlug) counts.set(m.partnerSlug, (counts.get(m.partnerSlug) ?? 0) + 1)
    }
    return counts
  }, [members])

  const partnersSorted = useMemo(
    () =>
      Array.from(partnerCounts.entries()).sort(
        ([, a], [, b]) => b - a,
      ),
    [partnerCounts],
  )

  // Apply partner + search filter. Sort newest-imported first so freshly added
  // cohorts surface immediately.
  const filtered = useMemo(() => {
    let pool = members
    if (selectedPartner) {
      pool = pool.filter((m) => m.partnerSlug === selectedPartner)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      pool = pool.filter(
        (m) =>
          m.fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          (m.company || "").toLowerCase().includes(q),
      )
    }
    return [...pool].sort((a, b) =>
      (b.importedAt || "").localeCompare(a.importedAt || ""),
    )
  }, [members, selectedPartner, searchQuery])

  const totalCount = members.length
  const allVisibleIds = filtered.map((m) => m.id).filter((id): id is string => !!id)
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))

  const buildAndDownloadCSV = (rows: PartnerListMember[], filenameBase: string) => {
    try {
      const headers = [
        "Name",
        "Email",
        "Company",
        "Phone",
        "LinkedIn",
        "Partner",
        "Imported",
        "Promoted",
      ]
      const csvRows = rows.map((m) => [
        m.fullName,
        m.email,
        m.company || "",
        m.phone || "",
        m.linkedin || "",
        m.partnerName || unslugify(m.partnerSlug),
        m.importedAt ? new Date(m.importedAt).toLocaleDateString() : "",
        m.promotedLeadId ? "yes" : "no",
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
    buildAndDownloadCSV(members, `partner-lists-all-${stamp}`)
  const handleExportFiltered = () =>
    buildAndDownloadCSV(filtered, `partner-lists-filtered-${stamp}`)
  const handleExportSelected = () => {
    const rows = members.filter((m) => m.id && selected.has(m.id))
    if (rows.length === 0) return
    buildAndDownloadCSV(rows, `partner-lists-selected-${stamp}`)
  }

  const { promotingIds, promote: promoteMembers } = usePromoteToLeads({
    collection: "partner_list_members",
    setToast,
    onSuccess: fetchMembers,
    onClearSelection: clearSelected,
  })

  // Drawer for bulk promote — lets the user override source/tags/notes once
  // and have it applied across the whole batch. Per-row promote stays direct.
  const [promoteDrawerIds, setPromoteDrawerIds] = useState<string[]>([])
  const [isBulkPromoting, setIsBulkPromoting] = useState(false)

  const handleOpenPromoteDrawer = () => {
    const ids = members
      .filter((m) => m.id && selected.has(m.id) && !m.promotedLeadId)
      .map((m) => m.id!)
    if (ids.length === 0) {
      setToast({ message: "No unpromoted contacts in selection", type: "error" })
      return
    }
    setPromoteDrawerIds(ids)
  }

  const handleConfirmBulkPromote = async (overrides: Parameters<typeof promoteMembers>[1]) => {
    setIsBulkPromoting(true)
    try {
      await promoteMembers(promoteDrawerIds, overrides)
      setPromoteDrawerIds([])
    } finally {
      setIsBulkPromoting(false)
    }
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
            Partner-shared rosters held as audience cohorts. Push to Mailchimp campaigns, or promote individuals into the leads pipeline when you&apos;re ready to work them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMembers()}
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

      {/* Partner tiles — overview surface. Click to filter to a single partner;
          click "All" to clear. */}
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
      {members.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
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
            onClick={() => fetchMembers()}
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
      {!isLoading && !error && members.length === 0 && (
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
      {!isLoading && !error && members.length > 0 && (
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
              filtered.map((member) => (
                <div
                  key={member.id}
                  className="px-4 py-3.5 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!member.id && selected.has(member.id)}
                      onChange={() => member.id && toggleSelect(member.id)}
                      className="rounded border-neutral-300 mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-neutral-900 leading-tight tracking-tight">
                        {member.fullName || member.email}
                        <MailchimpSubscribedPill email={member.email} mapping={subscriberMap} />
                      </p>
                      <p className="text-[13px] text-neutral-500 font-normal leading-relaxed mt-0.5 truncate">
                        {member.email}
                      </p>
                      {member.company && (
                        <p className="text-[12px] text-neutral-400 font-normal leading-relaxed mt-0.5 truncate">
                          {member.company}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 tracking-wide whitespace-nowrap">
                          {member.partnerName || unslugify(member.partnerSlug)}
                        </span>
                        <span className="text-[12px] text-neutral-400 font-normal">
                          Imported {formatDate(member.importedAt)}
                        </span>
                        {member.promotedLeadId ? (
                          <a
                            href={`/admin/leads?openLead=${encodeURIComponent(member.promotedLeadId)}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            Promoted →
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              member.id && promoteMembers([member.id])
                            }}
                            disabled={!member.id || (!!member.id && promotingIds.has(member.id))}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-neutral-200 text-neutral-600 disabled:opacity-50 disabled:cursor-wait"
                          >
                            {member.id && promotingIds.has(member.id) ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <ArrowRightCircle className="w-2.5 h-2.5" />
                            )}
                            Promote
                          </button>
                        )}
                      </div>
                    </div>
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
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 w-12">
                    {/* select-all header lives in the bar above */}
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
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-neutral-400 uppercase tracking-widest bg-neutral-50 w-24">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-neutral-400">
                      <Users2 className="w-8 h-8 mx-auto mb-2 text-neutral-200" />
                      <p className="text-sm font-medium text-neutral-500">No contacts match your filter</p>
                      {searchQuery && (
                        <p className="text-[12px] mt-1 font-normal">Try adjusting your search</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-neutral-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!member.id && selected.has(member.id)}
                          onChange={() => member.id && toggleSelect(member.id)}
                          className="rounded border-neutral-300"
                          aria-label={`Select ${member.fullName || member.email}`}
                        />
                      </td>
                      <td className="px-4 py-3 min-w-0">
                        <div className="font-semibold text-[13px] text-neutral-900 truncate flex items-center gap-1.5">
                          {member.fullName || member.email}
                          <MailchimpSubscribedPill email={member.email} mapping={subscriberMap} />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5 truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          <span className="truncate">{member.email}</span>
                        </div>
                        {(member.phone || member.linkedin) && (
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                            {member.phone && (
                              <span className="inline-flex items-center gap-1 shrink-0">
                                <Phone className="w-3 h-3" />
                                {member.phone}
                              </span>
                            )}
                            {member.linkedin && (
                              <a
                                href={member.linkedin}
                                target="_blank"
                                rel="noopener noreferrer"
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
                          <span className="truncate">{member.company || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 tracking-wide whitespace-nowrap">
                          {member.partnerName || unslugify(member.partnerSlug)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-[12px] text-neutral-400 whitespace-nowrap">
                        {formatDate(member.importedAt)}
                      </td>
                      <td className="px-4 py-3">
                        {member.promotedLeadId ? (
                          <a
                            href={`/admin/leads?openLead=${encodeURIComponent(member.promotedLeadId)}`}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            title="Open in CRM"
                          >
                            Promoted →
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => member.id && promoteMembers([member.id])}
                            disabled={!member.id || (!!member.id && promotingIds.has(member.id))}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-wait transition-colors"
                            title="Promote to leads"
                          >
                            {member.id && promotingIds.has(member.id) ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <ArrowRightCircle className="w-2.5 h-2.5" />
                            )}
                            Promote
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
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

      {/* Bulk action bar — Promote turns audience members into active Leads;
          Push to Mailchimp adds them to a Mailchimp campaign segment. */}
      <BulkActionBar
        count={selected.size}
        onClear={clearSelected}
        actions={[
          {
            key: "promote",
            label: "Promote to leads",
            icon: ArrowRightCircle,
            run: handleOpenPromoteDrawer,
          },
          {
            key: "push-mc",
            label: "Push to Mailchimp",
            icon: MailIcon,
            run: () => { setShowPushModal(true) },
          },
        ]}
      />

      <MailchimpPushModal
        open={showPushModal}
        onClose={() => setShowPushModal(false)}
        members={members
          .filter((m) => m.id && selected.has(m.id) && m.email)
          .map<PushMember>((m) => ({
            email: m.email,
            firstName: m.firstName ?? m.preferredName ?? m.fullName.split(/\s+/)[0],
            lastName: m.lastName ?? m.fullName.split(/\s+/).slice(1).join(" ") || undefined,
            sourceTags: m.partnerSlug ? [`partner:${m.partnerSlug}`] : undefined,
          }))}
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

      <PromoteOverridesDrawer
        open={promoteDrawerIds.length > 0}
        onClose={() => setPromoteDrawerIds([])}
        count={promoteDrawerIds.length}
        collection="partner_list_members"
        defaultSource="partner"
        isPromoting={isBulkPromoting}
        onConfirm={handleConfirmBulkPromote}
      />
    </div>
  )
}
