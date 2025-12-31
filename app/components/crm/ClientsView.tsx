"use client"

import { Search, Plus, Edit, Trash2, Mail, Phone, Users } from "lucide-react"
import { STATUS_COLORS, formatDate } from "./types"
import type { Client } from "./types"

interface ClientsViewProps {
  clients: Client[]
  searchQuery: string
  statusFilter: string
  onSearchChange: (query: string) => void
  onStatusFilterChange: (status: string) => void
  onAddClient: () => void
  onEditClient: (client: Client) => void
  onDeleteClient: (id: string) => void
}

export function ClientsView({
  clients,
  searchQuery,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onAddClient,
  onEditClient,
  onDeleteClient,
}: ClientsViewProps) {
  // Filter clients
  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      (client.company_name || "").toLowerCase().includes(searchLower) ||
      (client.name || "").toLowerCase().includes(searchLower) ||
      (client.email || "").toLowerCase().includes(searchLower) ||
      client.contacts?.some(c => 
        c.name?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower)
      )
    const matchesStatus = statusFilter === "all" || client.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Helper to get primary contact info
  const getPrimaryContact = (client: Client) => {
    if (client.contacts && client.contacts.length > 0) {
      const primary = client.contacts.find(c => c.is_primary) || client.contacts[0]
      return primary
    }
    // Fallback to legacy fields
    if (client.name || client.email || client.phone) {
      return { name: client.name, email: client.email, phone: client.phone }
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
        <div className="flex flex-1 gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-neutral-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
            <option value="churned">Churned</option>
          </select>
        </div>
        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Clients Table */}
      <div className="rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden sm:table-cell">
                  Primary Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden md:table-cell">
                  Industry
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden xl:table-cell">
                  Last Contact
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    {clients.length === 0 ? "No clients yet" : "No clients match your search"}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const primaryContact = getPrimaryContact(client)
                  const contactCount = getContactCount(client)
                  
                  return (
                    <tr key={client.id} className="hover:bg-neutral-900/50 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-sm">{client.company_name || client.name || "Unnamed Client"}</p>
                          {contactCount > 0 && (
                            <p className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                              <Users className="w-3 h-3" />
                              {contactCount} contact{contactCount !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden sm:table-cell">
                        <div className="space-y-1">
                          {primaryContact ? (
                            <>
                              {primaryContact.name && (
                                <p className="text-sm text-neutral-300">{primaryContact.name}</p>
                              )}
                              {primaryContact.email && (
                                <a href={`mailto:${primaryContact.email}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-blue-400 transition-colors">
                                  <Mail className="w-3 h-3" />
                                  <span className="max-w-[180px] truncate">{primaryContact.email}</span>
                                </a>
                              )}
                              {primaryContact.phone && (
                                <a href={`tel:${primaryContact.phone}`} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-emerald-400 transition-colors">
                                  <Phone className="w-3 h-3" />
                                  <span>{primaryContact.phone}</span>
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-neutral-600">No contact info</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[client.status] || STATUS_COLORS.prospect}`}>
                          {(client.status || "prospect").replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <span className="text-sm text-neutral-400">{client.industry || "—"}</span>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        <span className="text-sm text-neutral-400">{client.assigned_to || "—"}</span>
                      </td>
                      <td className="px-4 py-4 hidden xl:table-cell">
                        <span className="text-sm text-neutral-400">{formatDate(client.last_contact_date || "")}</span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEditClient(client)}
                            className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
                          >
                            <Edit className="w-4 h-4 text-neutral-400" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
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
