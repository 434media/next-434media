"use client"

import { useState, useRef, useEffect } from "react"
import { Search, Plus, Edit, Trash2, Mail, Phone, Users, Calendar, DollarSign, Tag, X, Check, ChevronDown } from "lucide-react"
import { STATUS_COLORS, formatDate, formatCurrency, BRANDS, BRAND_GOALS } from "./types"
import type { Client, Brand } from "./types"

// CRM Tag interface
interface CRMTag {
  id: string
  name: string
  color?: string
}

interface ClientsViewProps {
  clients: Client[]
  searchQuery: string
  sourceFilter: string
  brandFilter?: string
  tagFilter?: string
  availableTags?: CRMTag[]
  onSearchChange: (query: string) => void
  onSourceFilterChange: (source: string) => void
  onBrandFilterChange?: (brand: string) => void
  onTagFilterChange?: (tag: string) => void
  onCreateTag?: (name: string) => Promise<CRMTag | null>
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
  sourceFilter,
  brandFilter = "all",
  tagFilter = "all",
  availableTags = [],
  onSearchChange,
  onSourceFilterChange,
  onBrandFilterChange,
  onTagFilterChange,
  onCreateTag,
  onAddClient,
  onEditClient,
  onDeleteClient,
}: ClientsViewProps) {
  // State for tag dropdown
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [isCreatingTag, setIsCreatingTag] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])
  
  // Handle creating a new tag
  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return
    setIsCreatingTag(true)
    try {
      const tag = await onCreateTag(newTagName.trim())
      if (tag) {
        setNewTagName("")
        // Optionally filter by the new tag
        if (onTagFilterChange) {
          onTagFilterChange(tag.name)
        }
      }
    } finally {
      setIsCreatingTag(false)
    }
  }
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
    const matchesSource = sourceFilter === "all" || client.source === sourceFilter
    const matchesBrand = brandFilter === "all" || client.brand === brandFilter
    const matchesTag = tagFilter === "all" || client.tags?.includes(tagFilter)
    return matchesSearch && matchesSource && matchesBrand && matchesTag
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
          {/* Tags Filter - Custom dropdown with create option */}
          {onTagFilterChange && (
            <div className="relative" ref={tagDropdownRef}>
              <button
                type="button"
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-700 focus:outline-none focus:border-gray-400 shadow-sm min-w-[120px]"
              >
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="flex-1 text-left truncate">
                  {tagFilter === "all" ? "All Tags" : tagFilter}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showTagDropdown ? "rotate-180" : ""}`} />
              </button>
              
              {showTagDropdown && (
                <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {/* Create new tag input */}
                  {onCreateTag && (
                    <div className="p-2 border-b border-gray-100">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                          placeholder="Create new tag..."
                          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
                        />
                        <button
                          type="button"
                          onClick={handleCreateTag}
                          disabled={!newTagName.trim() || isCreatingTag}
                          className="px-2.5 py-1.5 bg-gray-900 text-white text-sm rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isCreatingTag ? "..." : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Tags list */}
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        onTagFilterChange("all")
                        setShowTagDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${tagFilter === "all" ? "bg-gray-50 font-medium" : ""}`}
                    >
                      {tagFilter === "all" && <Check className="w-4 h-4 text-gray-600" />}
                      <span className={tagFilter === "all" ? "" : "ml-6"}>All Tags</span>
                    </button>
                    {availableTags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                          onTagFilterChange(tag.name)
                          setShowTagDropdown(false)
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${tagFilter === tag.name ? "bg-gray-50 font-medium" : ""}`}
                      >
                        {tagFilter === tag.name && <Check className="w-4 h-4 text-gray-600" />}
                        <span 
                          className={`flex items-center gap-1.5 ${tagFilter === tag.name ? "" : "ml-6"}`}
                        >
                          <span 
                            className="w-2 h-2 rounded-full shrink-0" 
                            style={{ backgroundColor: tag.color || "#6b7280" }} 
                          />
                          {tag.name}
                        </span>
                      </button>
                    ))}
                    {availableTags.length === 0 && (
                      <div className="px-3 py-4 text-center text-sm text-gray-400">
                        No tags yet. Create one above.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell bg-gray-50">
                  Tags
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell bg-gray-50">
                  Platform
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell bg-gray-50">
                  Opportunity
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden xl:table-cell bg-gray-50">
                  Follow Up
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
                      {/* Company */}
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
                      {/* Primary Contact */}
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
                      {/* Tags */}
                      <td className="px-3 py-4 hidden md:table-cell">
                        {client.tags && client.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {client.tags.slice(0, 2).map((tagName, idx) => {
                              const tagInfo = availableTags.find(t => t.name === tagName)
                              const tagColor = tagInfo?.color || "#6b7280"
                              return (
                                <span 
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ 
                                    backgroundColor: `${tagColor}15`,
                                    color: tagColor,
                                  }}
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  {tagName}
                                </span>
                              )
                            })}
                            {client.tags.length > 2 && (
                              <span className="text-[10px] text-gray-400">+{client.tags.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {/* Platform */}
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
                      {/* Opportunity */}
                      <td className="px-3 py-4 hidden lg:table-cell">
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
                      {/* Follow Up */}
                      <td className="px-3 py-4 hidden xl:table-cell">
                        {client.next_followup_date ? (
                          <span className="inline-flex items-center whitespace-nowrap gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {formatDate(client.next_followup_date)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      {/* Actions */}
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
