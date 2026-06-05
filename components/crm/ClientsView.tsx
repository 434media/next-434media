"use client"

import { Search, Plus, Mail, Phone, Users, Calendar, Filter, AlertCircle, Clock, Target, CheckCircle2, Trash2 } from "lucide-react"
import { formatDate, normalizeAssigneeName, getDueDateStatus } from "./types"
import { Dropdown } from "./Dropdown"
import { HowItWorks } from "@/components/admin/HowItWorks"
import { useSelection, BulkActionBar } from "@/components/admin/SubmissionStateUI"
import { useTeamMembers } from "@/hooks/useTeamMembers"
import type { Client } from "./types"

function fmtCurrency(v: number): string {
  return v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

// Restrained status dots — relationship state at a glance.
const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  prospect: "bg-neutral-400",
  lead: "bg-sky-500",
  inactive: "bg-neutral-300",
  churned: "bg-red-500",
  lost: "bg-red-500",
}

interface ClientsViewProps {
  clients: Client[]
  searchQuery: string
  sourceFilter: string
  assigneeFilter: string
  onSearchChange: (query: string) => void
  onSourceFilterChange: (source: string) => void
  onAssigneeFilterChange: (assignee: string) => void
  onAddClient: () => void
  onEditClient: (client: Client) => void
  onBulkDelete?: (ids: string[]) => Promise<void> | void
}

export function ClientsView({
  clients,
  searchQuery,
  sourceFilter,
  assigneeFilter,
  onSearchChange,
  onSourceFilterChange,
  onAssigneeFilterChange,
  onAddClient,
  onEditClient,
  onBulkDelete,
}: ClientsViewProps) {
  const { selected, toggle, set, clear } = useSelection()

  // Live roster (active Firestore members), so the assignee filter reflects
  // exactly who's on the team — no built-in seed names.
  const { members: teamMembers } = useTeamMembers()
  const allAssignees = teamMembers.map((m) => m.name).sort()

  // Per-client pipeline via the opportunity→client FK. Opportunities are
  // crm_clients rows (is_opportunity=true) whose client_id points to a client.
  const pipelineByClient = new Map<string, { open: number; openValue: number; won: number }>()
  for (const c of clients) {
    if (!c.is_opportunity || !c.client_id) continue
    const e = pipelineByClient.get(c.client_id) ?? { open: 0, openValue: 0, won: 0 }
    if (c.disposition === "closed_won") e.won++
    else if (c.disposition !== "closed_lost") {
      e.open++
      e.openValue += c.pitch_value || 0
    }
    pipelineByClient.set(c.client_id, e)
  }

  // First, deduplicate clients by company_name + department to ensure each company/department combo appears only once
  // This handles the case where a company has multiple opportunities - we want ONE client entry per department
  // Priority: prefer non-opportunity records, but include opportunity-only companies too
  const deduplicatedClients = clients.reduce((acc, client) => {
    const companyName = (client.company_name || client.name || "").toLowerCase().trim()
    if (!companyName) return acc
    
    // Create a unique key combining company name and department
    const department = (client.department || "").toLowerCase().trim()
    const uniqueKey = department ? `${companyName}|${department}` : companyName
    
    const existingIndex = acc.findIndex(c => {
      const existingCompany = (c.company_name || c.name || "").toLowerCase().trim()
      const existingDept = (c.department || "").toLowerCase().trim()
      const existingKey = existingDept ? `${existingCompany}|${existingDept}` : existingCompany
      return existingKey === uniqueKey
    })
    
    if (existingIndex === -1) {
      // First time seeing this company/department combo - add it
      acc.push(client)
    } else {
      // Company/department already exists - prefer non-opportunity record over opportunity record
      const existing = acc[existingIndex]
      if (existing.is_opportunity && !client.is_opportunity) {
        // Replace opportunity record with non-opportunity record
        acc[existingIndex] = client
      }
      // If both are opportunities or both are non-opportunities, keep the first one
    }
    return acc
  }, [] as Client[])

  // Filter clients based on search and filters
  const filteredClients = deduplicatedClients.filter((client) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      (client.company_name || "").toLowerCase().includes(searchLower) ||
      (client.name || "").toLowerCase().includes(searchLower) ||
      (client.email || "").toLowerCase().includes(searchLower) ||
      client.contacts?.some(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
      )
    const matchesSource = sourceFilter === "all" || client.source === sourceFilter
    const normalizedAssignee = normalizeAssigneeName(client.assigned_to || "")
    const matchesAssignee = assigneeFilter === "all" || normalizedAssignee === assigneeFilter
    return matchesSearch && matchesSource && matchesAssignee
  })

  // Sort by follow-up date (oldest first) - following the mockup's default sorting
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (!a.next_followup_date && !b.next_followup_date) return 0
    if (!a.next_followup_date) return 1
    if (!b.next_followup_date) return -1
    return new Date(a.next_followup_date).getTime() - new Date(b.next_followup_date).getTime()
  })

  // Helper to get primary contact info
  const getPrimaryContact = (client: Client) => {
    if (client.contacts && client.contacts.length > 0) {
      const primary = client.contacts.find(c => c.is_primary) || client.contacts[0]
      // Build full name from first_name + last_name
      const fullName = [primary.first_name, primary.last_name].filter(Boolean).join(" ") || primary.name
      return { ...primary, fullName }
    }
    // Fallback to legacy fields
    if (client.name || client.email || client.phone) {
      return { first_name: "", last_name: "", fullName: client.name, email: client.email, phone: client.phone }
    }
    return null
  }

  // Helper to get contact count
  const getContactCount = (client: Client) => {
    return client.contacts?.length || (client.name || client.email || client.phone ? 1 : 0)
  }

  // Multi-select over the visible rows
  const allVisibleIds = sortedClients.map((c) => c.id)
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id))
  const someSelected = allVisibleIds.some((id) => selected.has(id))
  const toggleAll = () => (allSelected ? clear() : set(allVisibleIds))

  return (
    <div>
      {/* Header — title + funnel context, matching the Leads/Audiences/Inbox idiom */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-tight tracking-tight">
            Clients
          </h2>
          <p className="text-[13px] text-neutral-500 mt-1">
            Your won and active customer accounts — converted from qualified leads and closed opportunities.
          </p>
        </div>
        <button
          onClick={onAddClient}
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add client
        </button>
      </div>

      {/* How it works — dismissible first-run intro (shared across the funnel pages). */}
      <HowItWorks
        className="mb-4"
        storageKey="clientsIntroDismissed"
        steps={[
          { title: "Clients are your active accounts", detail: "Companies you've won — each with its own contacts and follow-ups." },
          { title: "Sorted by follow-up", detail: "The most overdue follow-ups surface first, so nothing slips." },
          { title: "Open to manage", detail: "Click a client for its contacts, opportunities, tasks, and history." },
        ]}
      />

      {/* Toolbar — search + assignee filter */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 pointer-events-none" />
          <input
            type="text"
            placeholder="Search clients by name or email…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-md bg-white border border-neutral-200/70 text-[13px] text-neutral-700 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
          />
        </div>
        {/* Assignee Filter — custom dropdown (matches the app idiom). */}
        <Dropdown
          ariaLabel="Filter by assignee"
          icon={<Filter className="w-3.5 h-3.5 text-neutral-400" />}
          value={assigneeFilter}
          onChange={onAssigneeFilterChange}
          options={[
            { value: "all", label: "All Assignees" },
            ...allAssignees.map((a) => ({ value: a, label: a })),
          ]}
        />
      </div>

      {/* Clients table — or an empty/onboarding state when there's nothing to show */}
      {sortedClients.length === 0 ? (
        <ClientsEmptyState
          filtered={searchQuery.trim() !== "" || assigneeFilter !== "all" || sourceFilter !== "all"}
          onClear={() => {
            onSearchChange("")
            onAssigneeFilterChange("all")
            onSourceFilterChange("all")
          }}
          onCreate={onAddClient}
        />
      ) : (
      <div className="rounded-md border border-neutral-200/70 overflow-hidden bg-white">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full table-fixed">
            <thead className="bg-neutral-50/60 sticky top-0 z-10 border-b border-neutral-100">
              <tr>
                <th className="w-10 px-4 py-2.5 bg-neutral-50/60">
                  <input
                    type="checkbox"
                    aria-label="Select all clients"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected }}
                    onChange={toggleAll}
                    className="rounded border-neutral-300 align-middle"
                  />
                </th>
                <th className="w-[25%] px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] bg-neutral-50/60">
                  Client
                </th>
                <th className="w-[40%] px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] bg-neutral-50/60">
                  Primary Contact
                </th>
                <th className="w-[35%] px-4 py-2.5 text-left text-[10px] font-medium text-neutral-500 uppercase tracking-[0.18em] hidden md:table-cell bg-neutral-50/60">
                  Follow Up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedClients.map((client) => {
                  const primaryContact = getPrimaryContact(client)
                  const contactCount = getContactCount(client)
                  const pipeline = pipelineByClient.get(client.id)

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onEditClient(client)}
                      className={`transition-colors cursor-pointer ${selected.has(client.id) ? "bg-neutral-50" : "hover:bg-neutral-50"}`}
                    >
                      {/* Multi-select checkbox — stops the row from opening */}
                      <td className="px-4 py-3.5 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${client.company_name || client.name || "client"}`}
                          checked={selected.has(client.id)}
                          onChange={() => toggle(client.id)}
                          className="rounded border-neutral-300 mt-0.5"
                        />
                      </td>
                      {/* Client */}
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-neutral-900 truncate">{client.company_name || client.name || "Unnamed Client"}</p>
                            {client.status && (
                              <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-neutral-100 text-[10px] font-medium text-neutral-600 capitalize">
                                <span className={`inline-block h-1 w-1 rounded-full ${STATUS_DOT[client.status] ?? "bg-neutral-400"}`} aria-hidden="true" />
                                {client.status}
                              </span>
                            )}
                          </div>
                          {client.department && (
                            <p className="text-xs text-neutral-500 mt-0.5 truncate">
                              {client.department}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-xs text-neutral-500">
                            {contactCount > 1 && (
                              <span className="inline-flex items-center gap-1">
                                <Users className="w-3 h-3 shrink-0" />
                                {contactCount} contacts
                              </span>
                            )}
                            {pipeline && pipeline.open > 0 && (
                              <span className="inline-flex items-center gap-1 text-sky-700">
                                <Target className="w-3 h-3 shrink-0" />
                                {pipeline.open} {pipeline.open === 1 ? "deal" : "deals"} · <span className="tabular-nums">{fmtCurrency(pipeline.openValue)}</span>
                              </span>
                            )}
                            {pipeline && pipeline.open === 0 && pipeline.won > 0 && (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                {pipeline.won} won
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Primary Contact */}
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 space-y-1">
                          {primaryContact ? (
                            <>
                              {primaryContact.fullName && (
                                <p className="text-sm font-medium text-neutral-800 truncate">{primaryContact.fullName}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                {primaryContact.email && (
                                  <a
                                    href={`mailto:${primaryContact.email}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                                  >
                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate max-w-45">{primaryContact.email}</span>
                                  </a>
                                )}
                                {primaryContact.phone && (
                                  <a
                                    href={`tel:${primaryContact.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                                  >
                                    <Phone className="w-3.5 h-3.5 shrink-0" />
                                    <span className="whitespace-nowrap">{primaryContact.phone}</span>
                                  </a>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-sm text-neutral-400">No contact info</span>
                          )}
                        </div>
                      </td>
                      {/* Follow Up */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {client.next_followup_date ? (
                          (() => {
                            const followUpStatus = getDueDateStatus(client.next_followup_date, client.status)
                            const statusStyles = {
                              overdue: "bg-red-50 text-red-700 border-red-200",
                              approaching: "bg-amber-50 text-amber-700 border-amber-200",
                              normal: "bg-neutral-50 text-neutral-600 border-neutral-200",
                            }
                            const IconComponent = followUpStatus === "overdue" ? AlertCircle : followUpStatus === "approaching" ? Clock : Calendar
                            return (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border whitespace-nowrap ${statusStyles[followUpStatus || "normal"]}`}>
                                <IconComponent className="w-3.5 h-3.5 shrink-0" />
                                <span>{formatDate(client.next_followup_date)}</span>
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Bulk-action bar — the shared component (same as Tasks / Audiences / Inbox) */}
      {onBulkDelete && (
        <BulkActionBar
          count={selected.size}
          onClear={clear}
          actions={[
            {
              key: "delete",
              label: "Delete",
              icon: Trash2,
              destructive: true,
              run: async () => {
                await onBulkDelete(Array.from(selected))
                clear()
              },
            },
          ]}
        />
      )}
    </div>
  )
}

// Empty / first-run state for the Clients table. Distinguishes "filters hid
// everything" (offer a clear) from "no clients yet" (explain where clients come
// from + a primary CTA) — mirrors the Leads EmptyState.
function ClientsEmptyState({
  filtered,
  onClear,
  onCreate,
}: {
  filtered: boolean
  onClear: () => void
  onCreate: () => void
}) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-md border border-neutral-200/70">
        <Search className="w-8 h-8 text-neutral-300 mb-3" />
        <p className="text-sm font-medium text-neutral-700">No clients match your filters</p>
        <button onClick={onClear} className="mt-3 text-[13px] text-neutral-600 hover:text-neutral-900 underline">
          Clear filters
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-md border border-neutral-200/70">
      <Users className="w-8 h-8 text-neutral-300 mb-3" />
      <p className="text-sm font-medium text-neutral-700">No clients yet</p>
      <p className="text-[12px] text-neutral-500 mt-1 max-w-md">
        Clients are your won accounts — they arrive when you convert a qualified lead or close an
        opportunity. You can also add one manually.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 flex items-center gap-1.5 px-3 py-2 bg-neutral-900 text-white text-[13px] font-medium rounded-lg hover:bg-neutral-800"
      >
        <Plus className="w-3.5 h-3.5" />
        Add first client
      </button>
    </div>
  )
}
