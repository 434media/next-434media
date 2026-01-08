"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { 
  X, 
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
} from "lucide-react"
import { TEAM_MEMBERS } from "./types"

interface ContactFormData {
  id: string
  name: string
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
  contacts: ContactFormData[]
  status: string
  next_followup_date: string
  notes: string
  source: string
  is_opportunity: boolean
  opportunity_id: string
  assigned_to: string
}

interface ClientFormModalProps {
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  formData: ClientFormData
  opportunities: { id: string; company_name?: string; title?: string }[]
  onFormChange: (data: ClientFormData) => void
  onSave: () => void
  onClose: () => void
}

// Generate unique ID for new contacts
function generateContactId(): string {
  return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function ClientFormModal({
  isOpen,
  isEditing,
  isSaving,
  formData,
  opportunities,
  onFormChange,
  onSave,
  onClose,
}: ClientFormModalProps) {
  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set())

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
      name: "",
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg md:max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-xl border border-gray-200 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg border border-gray-200">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isEditing ? "Contact" : "New Contact"}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {isEditing ? "Update contact information" : "Add a new point of contact"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Company Name - Primary Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => onFormChange({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  placeholder="e.g., Velocity TX"
                />
              </div>

              {/* Contacts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Contacts ({formData.contacts.length})
                  </label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Contact
                  </button>
                </div>

                {formData.contacts.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm border border-dashed border-gray-300 rounded-lg bg-gray-50">
                    No contacts added yet. Click "Add Contact" to add your first contact.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.contacts.map((contact, index) => {
                      const isExpanded = expandedContacts.has(contact.id)
                      const hasContent = contact.name || contact.email || contact.phone
                      
                      return (
                        <div
                          key={contact.id}
                          className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
                        >
                          {/* Contact Header - Always Visible */}
                          <button
                            type="button"
                            onClick={() => toggleContact(contact.id)}
                            className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {contact.name || `Contact ${index + 1}`}
                                  </span>
                                  {contact.is_primary && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-600 rounded">
                                      Primary
                                    </span>
                                  )}
                                </div>
                                {hasContent && !isExpanded && (
                                  <div className="flex items-center gap-3 mt-0.5">
                                    {contact.email && (
                                      <span className="flex items-center gap-1 text-xs text-gray-500">
                                        <Mail className="w-3 h-3" />
                                        <span className="truncate max-w-[120px]">{contact.email}</span>
                                      </span>
                                    )}
                                    {contact.phone && (
                                      <span className="flex items-center gap-1 text-xs text-gray-500">
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
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
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
                                <div className="p-3 pt-0 space-y-3 border-t border-gray-200">
                                  <div className="pt-3">
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                                    <input
                                      type="text"
                                      value={contact.name}
                                      onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                      placeholder="Contact name"
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                                      <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => updateContact(contact.id, "email", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                        placeholder="email@company.com"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                                      <input
                                        type="tel"
                                        value={contact.phone}
                                        onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                        placeholder="(555) 123-4567"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                                    <input
                                      type="text"
                                      value={contact.role}
                                      onChange={(e) => updateContact(contact.id, "role", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                      placeholder="e.g., CEO, Marketing Director"
                                    />
                                  </div>

                                  {/* Date of Birth */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Date of Birth</label>
                                    <input
                                      type="date"
                                      value={contact.date_of_birth || ""}
                                      onChange={(e) => updateContact(contact.id, "date_of_birth", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                    />
                                  </div>

                                  {/* Address */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                                    <input
                                      type="text"
                                      value={contact.address || ""}
                                      onChange={(e) => updateContact(contact.id, "address", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                      placeholder="Street address"
                                    />
                                  </div>

                                  {/* City, State, Zipcode */}
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                                      <input
                                        type="text"
                                        value={contact.city || ""}
                                        onChange={(e) => updateContact(contact.id, "city", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                        placeholder="City"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                                      <input
                                        type="text"
                                        value={contact.state || ""}
                                        onChange={(e) => updateContact(contact.id, "state", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                        placeholder="State"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">Zipcode</label>
                                      <input
                                        type="text"
                                        value={contact.zipcode || ""}
                                        onChange={(e) => updateContact(contact.id, "zipcode", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
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
                                        className="w-4 h-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                                      />
                                      <span className="text-xs text-gray-600">Set as primary contact</span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
                  <select
                    value={formData.source || ""}
                    onChange={(e) => onFormChange({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Follow-up Date
                    </span>
                  </label>
                  <input
                    type="date"
                    value={formData.next_followup_date}
                    onChange={(e) => onFormChange({ ...formData, next_followup_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                  placeholder="Additional notes about this contact..."
                />
              </div>

              {/* Assignee Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Assigned To
                  </span>
                </label>
                <select
                  value={formData.assigned_to || ""}
                  onChange={(e) => onFormChange({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="">Select assignee...</option>
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member.email} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !formData.company_name}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isEditing ? "Update Contact" : "Add Contact"}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
