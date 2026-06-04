"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Loader2,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Mail,
  Phone,
  Calendar,
  Target,
  ChevronRight,
} from "lucide-react"
import { Customer360Panel } from "./Customer360Panel"
import { DetailDrawer } from "@/components/admin/DetailDrawer"
import { useTeamMembers } from "@/hooks/useTeamMembers"

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

interface ClientFormData {
  company_name: string
  department: string  // For large clients with multiple departments
  contacts: ContactFormData[]
  status: string
  next_followup_date: string
  notes: string
  source: string
  is_opportunity: boolean
  opportunity_id: string
  assigned_to: string
}

interface ClientDetailDrawerProps {
  open: boolean
  isEditing: boolean
  isSaving: boolean
  formData: ClientFormData
  /** This client's opportunities (scoped + with stage/value) — powers the
      pipeline strip and the Customer 360 jump. */
  opportunities: { id: string; name: string; stage: string; value: number }[]
  onFormChange: (data: ClientFormData) => void
  onSave: () => void
  onClose: () => void
  /** Destructive — only shown when editing an existing client. Confirms before firing. */
  onDelete?: (id: string) => void | Promise<void>
  /** When set (and isEditing is true), enables the "360 view" tab. */
  clientId?: string | null
}

// Generate unique ID for new contacts
function generateContactId(): string {
  return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function fmtCurrency(value: number): string {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

export function ClientDetailDrawer({
  open,
  isEditing,
  isSaving,
  formData,
  opportunities,
  onFormChange,
  onSave,
  onClose,
  onDelete,
  clientId,
}: ClientDetailDrawerProps) {
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<"edit" | "360">("edit")
  const showCustomer360Tab = isEditing && !!clientId

  // This client's pipeline at a glance — surfaced in the edit tab so the form
  // isn't blind to the commercial relationship. Full detail lives in 360.
  const openOpps = opportunities.filter((o) => o.stage !== "closed_won" && o.stage !== "closed_lost")
  const wonOpps = opportunities.filter((o) => o.stage === "closed_won")
  const openValue = openOpps.reduce((sum, o) => sum + (o.value || 0), 0)
  const showPipelineStrip = showCustomer360Tab && opportunities.length > 0

  // Assignable roster (read-only) — shared with the other drawers. Management
  // lives in CRM Settings → Team members.
  const { members: teamMembers, isLoading: isLoadingMembers } = useTeamMembers(open)

  // Reset to edit tab whenever the drawer opens for a new client
  useEffect(() => {
    if (open) setActiveTab("edit")
  }, [open, clientId])

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
      is_primary: formData.contacts.length === 0, // First contact is primary
      address: "",
      city: "",
      state: "",
      zipcode: "",
      date_of_birth: "",
    }
    const newContacts = [...formData.contacts, newContact]
    onFormChange({ ...formData, contacts: newContacts })
    // Auto-expand the new contact
    setExpandedContacts(new Set([...expandedContacts, newContact.id]))
  }

  // Remove a contact
  const removeContact = (contactId: string) => {
    const newContacts = formData.contacts.filter(c => c.id !== contactId)
    // If we removed the primary contact, make the first remaining one primary
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
      // If setting a new primary, unset others
      if (field === "is_primary" && value === true) {
        return { ...c, is_primary: false }
      }
      return c
    })
    onFormChange({ ...formData, contacts: newContacts })
  }

  const drawerTitle = isEditing
    ? formData.company_name || "Client"
    : "New Client"
  const drawerSubtitle = isEditing
    ? formData.department || "Update client information"
    : "Add a new client"

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
            {isEditing && onDelete && clientId && (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Permanently delete ${formData.company_name || "this client"}? This cannot be undone.`)) return
                  await onDelete(clientId)
                  onClose()
                }}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
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
              disabled={isSaving || !formData.company_name}
              className="inline-flex items-center gap-2 h-9 px-4 bg-neutral-900 text-white rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? "Save changes" : "Add client"}
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      {showCustomer360Tab && (
        <div className="flex border-b border-neutral-200 bg-white px-4 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setActiveTab("edit")}
            className={`px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "edit"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Edit details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("360")}
            className={`px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "360"
                ? "border-neutral-900 text-neutral-900"
                : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Customer 360
          </button>
        </div>
      )}

      {/* Customer 360 Tab */}
      {showCustomer360Tab && activeTab === "360" && (
        <div className="p-4 bg-neutral-50">
          <Customer360Panel clientId={clientId!} />
        </div>
      )}

      {/* Scrollable Content (edit tab) */}
      <div className={`p-4 space-y-5 ${showCustomer360Tab && activeTab !== "edit" ? "hidden" : ""}`}>
        {/* Pipeline strip — this client's deals at a glance; jumps to Customer 360 */}
        {showPipelineStrip && (
          <button
            type="button"
            onClick={() => setActiveTab("360")}
            className="w-full flex items-center justify-between gap-3 rounded-md border border-neutral-200/70 bg-neutral-50 px-3 py-2.5 text-left hover:bg-neutral-100 transition-colors"
          >
            <span className="flex items-center gap-2 min-w-0 text-[13px] text-neutral-600">
              <Target className="w-4 h-4 text-sky-500 shrink-0" />
              {openOpps.length > 0 && (
                <span>
                  <span className="font-semibold text-neutral-900">{openOpps.length}</span> open
                  {openValue > 0 && (
                    <> · <span className="font-semibold text-neutral-900 tabular-nums">{fmtCurrency(openValue)}</span></>
                  )}
                </span>
              )}
              {openOpps.length > 0 && wonOpps.length > 0 && <span className="text-neutral-300">·</span>}
              {wonOpps.length > 0 && (
                <span className="font-semibold text-emerald-600">{wonOpps.length} won</span>
              )}
              {openOpps.length === 0 && wonOpps.length === 0 && <span>Opportunities</span>}
            </span>
            <span className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-medium text-neutral-500">
              Customer 360
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        )}

        {/* Client Name - Primary Field */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => onFormChange({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                  placeholder="e.g., Velocity TX"
                />
              </div>

              {/* Department - For large clients with multiple departments */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Department <span className="text-neutral-400 font-normal">(optional - for large clients)</span>
                </label>
                <input
                  type="text"
                  value={formData.department || ""}
                  onChange={(e) => onFormChange({ ...formData, department: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400"
                  placeholder="e.g., Marketing, HR, IT, Sales..."
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Use this for large organizations with multiple departments or divisions that need different admins.
                </p>
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
                    Add contact
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
                          className="rounded-md border border-neutral-200/70 bg-white overflow-hidden"
                        >
                          {/* Contact Header - Always Visible */}
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

                                  {/* Date of Birth */}
                                  <div>
                                    <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
                                    <input
                                      type="date"
                                      value={contact.date_of_birth || ""}
                                      onChange={(e) => updateContact(contact.id, "date_of_birth", e.target.value)}
                                      className="w-full px-3 py-2 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                                    />
                                  </div>

                                  {/* Address */}
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

                                  {/* City, State, Zipcode */}
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

              {/* Source & Follow-up Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Source</label>
                  <select
                    value={formData.source || ""}
                    onChange={(e) => onFormChange({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
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
                    className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-neutral-400 resize-y min-h-30 max-h-75"
                  placeholder="Additional notes about this client..."
                />
              </div>

              {/* Assignee Dropdown */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-neutral-400" />
                    Assigned To
                  </span>
                </label>
                <select
                  value={formData.assigned_to || ""}
                  onChange={(e) => onFormChange({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-md bg-white border border-neutral-200/70 text-sm text-neutral-900 focus:outline-none focus:border-neutral-400"
                  disabled={isLoadingMembers}
                >
                  <option value="">{isLoadingMembers ? "Loading..." : "Select assignee..."}</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

    </DetailDrawer>
  )
}
