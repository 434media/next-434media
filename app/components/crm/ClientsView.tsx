"use client"

import { Search, Plus, Edit, Trash2, Mail, Phone, Users, Calendar, DollarSign } from "lucide-react"
import { STATUS_COLORS, formatDate, formatCurrency, BRANDS, BRAND_GOALS } from "./types"
import type { Client, Brand } from "./types"

interface ClientsViewProps {
  clients: Client[]
  searchQuery: string
  statusFilter: string
  brandFilter?: string
  onSearchChange: (query: string) => void
  onStatusFilterChange: (status: string) => void
  onBrandFilterChange?: (brand: string) => void
  onAddClient: () => void
  onEditClient: (client: Client) => void
  onDeleteClient: (id: string) => void
}

// Get brand color
const getBrandColor = (brand?: Brand) => {
  const brandGoal = BRAND_GOALS.find(b => b.brand === brand)
  return brandGoal?.color || "#6b7280"
}

export function ClientsView({
  clients,
  searchQuery,
  statusFilter,
  brandFilter = "all",
  onSearchChange,
  onStatusFilterChange,
  onBrandFilterChange,
  onAddClient,
  onEditClient,
  onDeleteClient,
}: ClientsViewProps) {
  // Filter clients - using brand-based filtering
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
    const matchesBrand = brandFilter === "all" || client.brand === brandFilter
    return matchesSearch && matchesStatus && matchesBrand
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
        <div className="flex flex-wrap flex-1 gap-3 w-full sm:w-auto">
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
          {/* Brand Filter */}
          {onBrandFilterChange && (
            <select
              value={brandFilter}
              onChange={(e) => onBrandFilterChange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-neutral-600"
            >
              <option value="all">All Brands</option>
              {BRANDS.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          )}
          {/* Status Filter - Updated with industry-standard sales pipeline statuses */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All Status</option>
            <option value="prospect">Prospect</option>
            <option value="active">Active Client</option>
            <option value="inactive">Inactive</option>
            <option value="churned">Churned</option>
            <option value="on_hold">On Hold</option>
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

      {/* Clients Table - Updated to show Brand instead of Industry */}
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
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">
                  Pitch Value
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider hidden xl:table-cell">
                  Follow Up
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    {clients.length === 0 ? "No clients yet" : "No clients match your search"}
                  </td>
                </tr>
              ) : (
                sortedClients.map((client) => {
                  const primaryContact = getPrimaryContact(client)
                  const contactCount = getContactCount(client)
                  const brandColor = getBrandColor(client.brand)
                  
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
                        {client.brand ? (
                          <span 
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: `${brandColor}20`,
                              color: brandColor,
                              border: `1px solid ${brandColor}40`
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                            {client.brand}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell">
                        {client.pitch_value ? (
                          <span className="flex items-center gap-1 text-sm text-emerald-400">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(client.pitch_value).replace("$", "")}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 hidden xl:table-cell">
                        {client.next_followup_date ? (
                          <span className="flex items-center gap-1 text-sm text-neutral-400">
                            <Calendar className="w-3 h-3" />
                            {formatDate(client.next_followup_date)}
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-500">—</span>
                        )}
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
