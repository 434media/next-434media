"use client"

import { Search, Plus, Mail, Phone, Users, Calendar, Filter, AlertCircle, Clock } from "lucide-react"
import { formatDate, normalizeAssigneeName, TEAM_MEMBERS, getDueDateStatus } from "./types"
import { Dropdown } from "./Dropdown"
import type { Client } from "./types"

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
}: ClientsViewProps) {
  // Use only the predefined team members for the dropdown
  // This ensures only full names appear, not partial names from data
  const allAssignees = TEAM_MEMBERS.map(m => m.name).sort()

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

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search clients by name or email..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
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
        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Clients Table - Focused on Client, Primary Contact, Follow Up */}
      <div className="rounded-md border border-neutral-200/70 overflow-hidden bg-white">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full table-fixed">
            <thead className="bg-neutral-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-[25%] px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider bg-neutral-50">
                  Client
                </th>
                <th className="w-[40%] px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider bg-neutral-50">
                  Primary Contact
                </th>
                <th className="w-[35%] px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell bg-neutral-50">
                  Follow Up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-neutral-400">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-8 h-8 text-neutral-300" />
                      <p className="text-sm">{clients.length === 0 ? "No clients yet. Add your first client!" : "No clients match your search"}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedClients.map((client) => {
                  const primaryContact = getPrimaryContact(client)
                  const contactCount = getContactCount(client)
                  
                  return (
                    <tr
                      key={client.id}
                      onClick={() => onEditClient(client)}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer"
                    >
                      {/* Client */}
                      <td className="px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-neutral-900 truncate">{client.company_name || client.name || "Unnamed Client"}</p>
                          {client.department && (
                            <p className="text-xs text-neutral-500 mt-0.5 truncate">
                              {client.department}
                            </p>
                          )}
                          {contactCount > 1 && (
                            <p className="inline-flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                              <Users className="w-3 h-3 flex-shrink-0" />
                              <span>{contactCount} contacts</span>
                            </p>
                          )}
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
                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="truncate max-w-[180px]">{primaryContact.email}</span>
                                  </a>
                                )}
                                {primaryContact.phone && (
                                  <a
                                    href={`tel:${primaryContact.phone}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
                                  >
                                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
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
                                <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
