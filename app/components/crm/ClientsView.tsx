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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 shadow-sm"
            />
          </div>
          {/* Platform Filter */}
          {onBrandFilterChange && (
            <select
              value={brandFilter}
              onChange={(e) => onBrandFilterChange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 shadow-sm"
            >
              <option value="all">All Platforms</option>
              {BRANDS.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          )}
          {/* Status Filter - Updated with industry-standard sales pipeline statuses */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 shadow-sm"
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
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Clients Table - Updated to show Platform instead of Brand */}
      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell bg-gray-50">
                  Primary Contact
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Source
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell bg-gray-50">
                  Platform
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell bg-gray-50">
                  Follow Up
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell bg-gray-50">
                  Opportunity
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {clients.length === 0 ? "No clients yet" : "No clients match your search"}
                  </td>
                </tr>
              ) : (
                sortedClients.map((client) => {
                  const primaryContact = getPrimaryContact(client)
                  const contactCount = getContactCount(client)
                  const brandColor = getBrandColor(client.brand)
                  
                  return (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{client.company_name || client.name || "Unnamed Client"}</p>
                          {contactCount > 0 && (
                            <p className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
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
                                <p className="text-sm text-gray-700">{primaryContact.name}</p>
                              )}
                              {primaryContact.email && (
                                <a href={`mailto:${primaryContact.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
                                  <Mail className="w-3 h-3" />
                                  <span className="max-w-[180px] truncate">{primaryContact.email}</span>
                                </a>
                              )}
                              {primaryContact.phone && (
                                <a href={`tel:${primaryContact.phone}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 transition-colors">
                                  <Phone className="w-3 h-3" />
                                  <span>{primaryContact.phone}</span>
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">No contact info</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        {client.source ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {client.source.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 hidden md:table-cell">
                        {client.brand ? (
                          <span 
                            className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ 
                              backgroundColor: `${brandColor}15`,
                              color: brandColor,
                              border: `1px solid ${brandColor}30`
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                            {client.brand}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 hidden lg:table-cell">
                        {client.next_followup_date ? (
                          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {formatDate(client.next_followup_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-4 hidden xl:table-cell">
                        {client.is_opportunity ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onEditClient(client)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Edit className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
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
