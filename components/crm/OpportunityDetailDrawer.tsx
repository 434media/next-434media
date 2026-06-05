"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  X,
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  Check,
  Building2,
  Target,
  Link2,
  FileText,
  Upload,
  ExternalLink,
  Archive
} from "lucide-react"
import { BRANDS, BRAND_GOALS, DISPOSITION_OPTIONS, DOC_OPTIONS } from "./types"
import type { Brand, Disposition, DOC, Client } from "./types"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { useTeamMembers } from "@/hooks/useTeamMembers"
import { Combobox } from "./Combobox"

interface ContactFormData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: string
  is_primary: boolean
  address: string
  city: string
  state: string
  zipcode: string
  date_of_birth: string
}

interface OpportunityFormData {
  company_name: string
  existing_company_id: string | null // When editing: the opportunity's ID. When creating: null (even if linked to existing company)
  linked_company_id: string | null // When creating: ID of existing company to link/inherit data from. When editing: unused
  contacts: ContactFormData[]
  title: string
  status: string
  brand: Brand | ""
  pitch_value: string
  next_followup_date: string
  assigned_to: string
  notes: string
  source: string
  is_opportunity: boolean
  disposition: Disposition | ""
  doc: DOC | ""
  web_links: string[]
  docs: string[]
  client_id?: string | null  // FK to the parent client row (for the Customer 360 jump)
}

interface OpportunityDetailDrawerProps {
  open: boolean
  isEditing?: boolean  // true when editing existing opportunity, false when creating new
  isSaving: boolean
  existingClients: Client[]
  formData: OpportunityFormData
  onFormChange: (data: OpportunityFormData) => void
  onSave: () => void
  onClose: () => void
  onArchive?: () => void  // Archive the opportunity (only shown for closed won/lost when editing)
  /** Jump to the parent client's Customer 360 (only when the opp is linked). */
  onViewCustomer360?: (clientId: string) => void
}

// Generate unique ID for new contacts
function generateContactId(): string {
  return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function OpportunityDetailDrawer({
  open,
  isEditing = false,
  isSaving,
  existingClients,
  formData,
  onFormChange,
  onSave,
  onClose,
  onArchive,
  onViewCustomer360,
}: OpportunityDetailDrawerProps) {
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())

  // State for web links and file upload
  const [newLink, setNewLink] = useState("")
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  
  // Assignable roster (read-only) — shared with the other drawers. Management
  // lives in CRM Settings → Team members.
  const { members: teamMembers, isLoading: isLoadingMembers } = useTeamMembers(open)

  // Get unique company names from existing clients
  // Use case-insensitive comparison to prevent duplicates like "HEB" and "HEB "
  const uniqueCompanies = existingClients
    .filter(client => client.company_name || client.name)
    .reduce((acc, client) => {
      const name = (client.company_name || client.name || "").trim()
      const nameLower = name.toLowerCase()
      // Check if we already have this company (case-insensitive)
      if (!acc.find(c => c.name.toLowerCase() === nameLower)) {
        acc.push({ id: client.id, name })
      }
      return acc
    }, [] as { id: string; name: string }[])
    .sort((a, b) => a.name.localeCompare(b.name))

  // The parent client this opportunity is linked to (via the client_id FK) —
  // powers the "jump to Customer 360" affordance when editing an existing deal.
  const linkedClient = formData.client_id
    ? existingClients.find((c) => c.id === formData.client_id) ?? null
    : null

  // Handle adding a new link
  const handleAddLink = () => {
    if (newLink.trim()) {
      onFormChange({ ...formData, web_links: [...formData.web_links, newLink.trim()] })
      setNewLink("")
    }
  }

  // Handle removing a link
  const handleRemoveLink = (index: number) => {
    const newLinks = formData.web_links.filter((_, i) => i !== index)
    onFormChange({ ...formData, web_links: newLinks })
  }

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setIsUploadingFile(true)
    setUploadError(null)
    const uploadedUrls: string[] = []
    const errors: string[] = []
    
    // Allowed file types (same as server)
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain", "text/csv"
    ]
    const maxSize = 50 * 1024 * 1024 // 50MB
    
    for (const file of Array.from(files)) {
      // Client-side validation for better UX
      if (!allowedTypes.includes(file.type)) {
        errors.push(`"${file.name}": File type not supported. Use images, PDF, DOC, XLS, or TXT.`)
        continue
      }
      
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
        errors.push(`"${file.name}": File too large (${sizeMB}MB). Maximum size is 50MB.`)
        continue
      }
      
      try {
        const formDataUpload = new FormData()
        formDataUpload.append("file", file)
        formDataUpload.append("folder", "crm-opportunities")
        
        const response = await fetch("/api/upload/crm", {
          method: "POST",
          credentials: "include",
          body: formDataUpload,
        })
        
        if (response.ok) {
          const data = await response.json()
          uploadedUrls.push(data.url)
        } else {
          // Parse error message from server
          const data = await response.json().catch(() => ({}))
          let errorMsg = data.error || `Upload failed`
          
          // Add status code context for debugging
          if (response.status === 401) {
            errorMsg = `"${file.name}": Unauthorized - please sign in again`
          } else if (response.status === 413) {
            errorMsg = `"${file.name}": File too large. Maximum size is 50MB.`
          } else if (response.status >= 500) {
            errorMsg = `"${file.name}": Server error - please try again later`
          } else {
            errorMsg = `"${file.name}": ${errorMsg}`
          }
          errors.push(errorMsg)
        }
      } catch (err) {
        console.error(`Failed to upload file ${file.name}:`, err)
        // Network or other errors
        const errorMsg = err instanceof Error ? err.message : "Network error"
        if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
          errors.push(`"${file.name}": Network error - check your connection`)
        } else {
          errors.push(`"${file.name}": ${errorMsg}`)
        }
      }
    }
    
    // Add all successfully uploaded URLs
    if (uploadedUrls.length > 0) {
      onFormChange({ ...formData, docs: [...formData.docs, ...uploadedUrls] })
    }
    
    // Show errors if any (using in-modal error display instead of alert)
    if (errors.length > 0) {
      setUploadError(errors.join('\n'))
      // Auto-clear error after 10 seconds
      setTimeout(() => setUploadError(null), 10000)
    }
    
    setIsUploadingFile(false)
    // Reset the input
    e.target.value = ""
  }

  // Toggle contact expansion
  const toggleContact = (contactId: string) => {
    const newExpanded = new Set(expandedContacts)
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId)
    } else {
      newExpanded.add(contactId)
    }
    setExpandedContacts(newExpanded)
  }

  // Add a new contact
  const addContact = () => {
    const newContact: ContactFormData = {
      id: generateContactId(),
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      role: "",
      is_primary: formData.contacts.length === 0,
      address: "",
      city: "",
      state: "",
      zipcode: "",
      date_of_birth: "",
    }
    const newContacts = [...formData.contacts, newContact]
    onFormChange({ ...formData, contacts: newContacts })
    setExpandedContacts(new Set([...expandedContacts, newContact.id]))
  }

  // Remove a contact
  const removeContact = (contactId: string) => {
    const newContacts = formData.contacts.filter(c => c.id !== contactId)
    if (newContacts.length > 0 && !newContacts.some(c => c.is_primary)) {
      newContacts[0].is_primary = true
    }
    onFormChange({ ...formData, contacts: newContacts })
  }

  // Update a contact field
  const updateContact = (contactId: string, field: keyof ContactFormData, value: string | boolean) => {
    const newContacts = formData.contacts.map(c => {
      if (c.id === contactId) {
        return { ...c, [field]: value }
      }
      if (field === "is_primary" && value === true) {
        return { ...c, is_primary: false }
      }
      return c
    })
    onFormChange({ ...formData, contacts: newContacts })
  }

  // Handle selecting an existing company (for NEW opportunities only - inherits company data)
  // When editing an existing opportunity, this function is not used
  const handleSelectCompany = (company: { id: string; name: string } | null) => {
    if (company) {
      // Find the client data to pre-populate some fields
      const existingClient = existingClients.find(c => c.id === company.id)
      onFormChange({
        ...formData,
        company_name: company.name,
        // Use linked_company_id for inheriting data, NOT existing_company_id
        // This allows creating NEW opportunities for existing companies
        linked_company_id: company.id,
        // Pre-populate brand if available
        brand: existingClient?.brand || formData.brand,
        // Pre-populate contacts if available (but don't share - copy them)
        contacts: existingClient?.contacts?.map(c => ({
          id: generateContactId(), // Generate NEW IDs so contacts are independent
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          role: c.role || "",
          is_primary: c.is_primary || false,
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
          zipcode: c.zipcode || "",
          date_of_birth: c.date_of_birth || "",
        })) || formData.contacts,
      })
    } else {
      // Creating new company
      onFormChange({
        ...formData,
        linked_company_id: null,
      })
    }
  }

  const drawerTitle = isEditing
    ? formData.company_name || "Opportunity"
    : "New Opportunity"
  const drawerSubtitle = isEditing
    ? "Get that money and close that business"
    : "Add a new opportunity"
  const showArchive =
    isEditing &&
    !!onArchive &&
    (formData.disposition === "closed_won" || formData.disposition === "closed_lost")

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      width="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div>
            {showArchive && (
              <button
                type="button"
                onClick={onArchive}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                title="Archive this opportunity"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !formData.company_name || !formData.brand}
              className="inline-flex items-center gap-2 h-9 px-4 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? "Saving…" : "Creating…"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? "Save changes" : "Create opportunity"}
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        {/* Mono header strip — flat eyebrow + neutral icon tile */}
        <div className="flex items-center gap-3 -mx-4 -mt-4 px-4 py-3 border-b border-neutral-100">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-neutral-100 text-neutral-700 shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Opportunity</p>
            <p className="text-[11px] text-neutral-400">
              {isEditing ? "Edit details, contacts, and close-out fields" : "Add a new deal to the pipeline"}
            </p>
          </div>
        </div>

        {/* Linked client → jump to the full Customer 360 (only for saved, linked deals) */}
        {linkedClient && onViewCustomer360 && (
          <button
            type="button"
            onClick={() => onViewCustomer360(linkedClient.id)}
            className="w-full flex items-center justify-between gap-3 rounded-md border border-neutral-200/70 bg-neutral-50 px-3 py-2.5 text-left hover:bg-neutral-100 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 text-[13px] text-neutral-600">
              <Building2 className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="truncate">
                Client: <span className="font-medium text-neutral-900">{linkedClient.company_name || linkedClient.name}</span>
              </span>
            </span>
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-medium text-neutral-500">
              Customer 360
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Client Name - Dropdown with search */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-neutral-500" />
                    Client Name *
                  </span>
                </label>
                <Combobox
                  ariaLabel="Client / company"
                  searchable
                  placeholder="Select or create client…"
                  searchPlaceholder="Search or type new client name…"
                  emptyText="No existing clients. Type to create one."
                  triggerLabel={formData.company_name}
                  value={formData.linked_company_id || formData.existing_company_id || ""}
                  onChange={(val, opt) => handleSelectCompany(opt ? { id: opt.value, name: opt.label } : null)}
                  onCreateNew={(query) =>
                    onFormChange({
                      ...formData,
                      company_name: query,
                      existing_company_id: null,
                      linked_company_id: null,
                      contacts: [],
                    })
                  }
                  createNewLabel={(q) => `Create new: ${q}`}
                  options={uniqueCompanies.map((c) => ({ value: c.id, label: c.name }))}
                />
                {formData.linked_company_id && !isEditing && (
                  <p className="text-xs text-neutral-700 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Linked to existing client (will create new opportunity)
                  </p>
                )}
              </div>

              {/* Title Field */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-neutral-500" />
                    Opportunity Title *
                  </span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => onFormChange({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                  placeholder="Enter opportunity title..."
                />
              </div>

              {/* Contacts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-700">
                    Contacts ({formData.contacts.length})
                  </label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-neutral-700 border border-neutral-200/70 hover:border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Contact
                  </button>
                </div>

                {formData.contacts.length === 0 ? (
                  <div className="p-4 text-center text-neutral-400 text-sm border border-dashed border-neutral-300 rounded-lg bg-neutral-50">
                    No contacts yet — use the Add contact button above to add the first one.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.contacts.map((contact, index) => {
                      const isExpanded = expandedContacts.has(contact.id)
                      const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ")
                      const hasContent = fullName || contact.email || contact.phone
                      
                      return (
                        <div
                          key={contact.id}
                          className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50"
                        >
                          {/* Contact Header */}
                          <button
                            type="button"
                            onClick={() => toggleContact(contact.id)}
                            className="w-full flex items-center justify-between p-3 hover:bg-neutral-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-neutral-500" />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-neutral-900">
                                    {fullName || `Contact ${index + 1}`}
                                  </span>
                                  {contact.is_primary && (
                                    <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-neutral-100 text-neutral-700">
                                      <span className="inline-block h-1 w-1 rounded-full bg-neutral-900" aria-hidden="true" />
                                      Primary
                                    </span>
                                  )}
                                </div>
                                {hasContent && !isExpanded && (
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {contact.email && (
                                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                                        <Mail className="w-3 h-3" />
                                        <span className="truncate max-w-[120px]">{contact.email}</span>
                                      </span>
                                    )}
                                    {contact.phone && (
                                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                                        <Phone className="w-3 h-3" />
                                        {contact.phone}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-neutral-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-neutral-400" />
                              )}
                            </div>
                          </button>

                          {/* Contact Details - Expandable */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3 pt-0 space-y-3 border-t border-neutral-200">
                                  <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
                                      <input
                                        type="text"
                                        value={contact.first_name}
                                        onChange={(e) => updateContact(contact.id, "first_name", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="First name"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name *</label>
                                      <input
                                        type="text"
                                        value={contact.last_name}
                                        onChange={(e) => updateContact(contact.id, "last_name", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="Last name"
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
                                      <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => updateContact(contact.id, "email", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="email@company.com"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
                                      <input
                                        type="tel"
                                        value={contact.phone}
                                        onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="(555) 123-4567"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Role</label>
                                    <input
                                      type="text"
                                      value={contact.role}
                                      onChange={(e) => updateContact(contact.id, "role", e.target.value)}
                                      className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                      placeholder="e.g., CEO, Marketing Director"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
                                    <input
                                      type="date"
                                      value={contact.date_of_birth || ""}
                                      onChange={(e) => updateContact(contact.id, "date_of_birth", e.target.value)}
                                      className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
                                    <input
                                      type="text"
                                      value={contact.address || ""}
                                      onChange={(e) => updateContact(contact.id, "address", e.target.value)}
                                      className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                      placeholder="Street address"
                                    />
                                  </div>

                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
                                      <input
                                        type="text"
                                        value={contact.city || ""}
                                        onChange={(e) => updateContact(contact.id, "city", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="City"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
                                      <input
                                        type="text"
                                        value={contact.state || ""}
                                        onChange={(e) => updateContact(contact.id, "state", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="State"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-600 mb-1">Zipcode</label>
                                      <input
                                        type="text"
                                        value={contact.zipcode || ""}
                                        onChange={(e) => updateContact(contact.id, "zipcode", e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                        placeholder="Zipcode"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={contact.is_primary}
                                        onChange={(e) => updateContact(contact.id, "is_primary", e.target.checked)}
                                        className="w-4 h-4 rounded border-neutral-300 bg-white text-neutral-900 focus:ring-neutral-400 focus:ring-offset-0"
                                      />
                                      <span className="text-xs text-neutral-600">Set as primary contact</span>
                                    </label>
                                    
                                    {formData.contacts.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeContact(contact.id)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Source & Platform */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Source</label>
                  <select
                    value={formData.source || ""}
                    onChange={(e) => onFormChange({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  >
                    <option value="">Select source...</option>
                    <option value="existing">Existing</option>
                    <option value="web">Web</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="event">Event</option>
                    <option value="inbound_call">Inbound Call</option>
                    <option value="referral">Referral</option>
                    <option value="warm_intro">Warm Intro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Platform *</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => onFormChange({ ...formData, brand: e.target.value as Brand | "" })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  >
                    <option value="">Select platform...</option>
                    {BRANDS.map((brand) => {
                      const brandGoal = BRAND_GOALS.find(b => b.brand === brand)
                      return (
                        <option key={brand} value={brand}>
                          {brand} {brandGoal ? `(${brandGoal.description})` : ""}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* Pitch Value & Follow-up Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-neutral-400" />
                      Pitch Value
                    </span>
                  </label>
                  <input
                    type="number"
                    value={formData.pitch_value}
                    onChange={(e) => onFormChange({ ...formData, pitch_value: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                    placeholder="e.g., 50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-neutral-400" />
                      Follow-up Date
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formData.next_followup_date}
                    onChange={(e) => onFormChange({ ...formData, next_followup_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Assigned To</label>
                <Combobox
                  ariaLabel="Assigned to"
                  searchable
                  placeholder={isLoadingMembers ? "Loading team…" : "Select team member…"}
                  searchPlaceholder="Search team members…"
                  emptyText="No team members"
                  value={formData.assigned_to || ""}
                  onChange={(val) => onFormChange({ ...formData, assigned_to: val })}
                  options={[
                    { value: "Unassigned", label: "Unassigned" },
                    ...teamMembers.map((m) => ({ value: m.name, label: m.name, sublabel: m.email || undefined })),
                  ]}
                />
              </div>

              {/* Disposition & DOC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Disposition <span className="text-neutral-400 font-normal">(Stage)</span>
                  </label>
                  <select
                    value={formData.disposition || "pitched"}
                    onChange={(e) => onFormChange({ ...formData, disposition: e.target.value as Disposition })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  >
                    {DISPOSITION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    DOC <span className="text-neutral-400 font-normal">(Confidence)</span>
                  </label>
                  <select
                    value={formData.doc || ""}
                    onChange={(e) => onFormChange({ ...formData, doc: e.target.value as DOC })}
                    className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  >
                    <option value="">Select probability...</option>
                    {DOC_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Web Links + Attachments — detail-only (hidden while creating a new deal) */}
              {isEditing && (
              <>
              <div className="pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  <Link2 className="w-4 h-4 inline mr-2" />
                  Web Links
                </label>
                <div className="space-y-2">
                  {formData.web_links.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                      <ExternalLink className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <a 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-neutral-900 hover:text-neutral-700 truncate flex-1"
                      >
                        {link}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRemoveLink(index)}
                        className="p-1 rounded hover:bg-neutral-200 transition-colors"
                      >
                        <X className="w-4 h-4 text-neutral-400" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddLink())}
                      placeholder="Add a link (https://...)"
                      className="flex-1 px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!newLink.trim()}
                      className="px-3 py-2 bg-neutral-200 hover:bg-neutral-300 rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4 text-neutral-700" />
                    </button>
                  </div>
                </div>
              </div>

              {/* File Attachments Section */}
              <div className="pt-4 border-t border-neutral-200">
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  <Upload className="w-4 h-4 inline mr-2" />
                  Attachments
                </label>
                
                {/* Existing Attachments */}
                {formData.docs.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {formData.docs.map((doc, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                        <FileText className={`w-4 h-4 flex-shrink-0 ${doc.startsWith("/uploads/") ? "text-emerald-600" : "text-neutral-900"}`} />
                        <a 
                          href={doc} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-neutral-900 hover:text-neutral-700 truncate flex-1"
                        >
                          {doc.startsWith("/uploads/") 
                            ? (doc.split("/").pop()?.split("-").slice(1).join("-") || doc)
                            : doc
                          }
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            const newDocs = formData.docs.filter((_, i) => i !== index)
                            onFormChange({ ...formData, docs: newDocs })
                          }}
                          className="p-1 rounded hover:bg-neutral-200 transition-colors"
                        >
                          <X className="w-4 h-4 text-neutral-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button */}
                <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-neutral-300 hover:border-neutral-400 bg-neutral-50 cursor-pointer transition-colors">
                  {isUploadingFile ? (
                    <>
                      <Loader2 className="w-5 h-5 text-neutral-400 animate-spin" />
                      <span className="text-sm text-neutral-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-neutral-400" />
                      <span className="text-sm text-neutral-500">
                        Drop a file or click to upload
                      </span>
                    </>
                  )}
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploadingFile}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    className="hidden"
                    multiple
                  />
                </label>
                
                {/* Upload Error Display */}
                {uploadError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-700">Upload Failed</p>
                        <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap font-sans">{uploadError}</pre>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadError(null)}
                        className="p-1 rounded hover:bg-red-100 transition-colors"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-neutral-500 mt-2">
                  Supports images, PDF, DOC, XLS, TXT (max 50MB per file)
                </p>
              </div>
              </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 resize-y min-h-[100px] max-h-[300px]"
                  placeholder="Additional notes about this opportunity..."
                />
              </div>
      </div>
    </DetailDrawer>
  )
}
