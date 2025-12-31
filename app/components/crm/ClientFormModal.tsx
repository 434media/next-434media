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
  User,
  Mail,
  Phone
} from "lucide-react"
import { TEAM_MEMBERS } from "./types"

interface ContactFormData {
  id: string
  name: string
  email: string
  phone: string
  role: string
  is_primary: boolean
}

interface ClientFormData {
  company_name: string
  contacts: ContactFormData[]
  status: string
  industry: string
  assigned_to: string
  notes: string
}

interface ClientFormModalProps {
  isOpen: boolean
  isEditing: boolean
  isSaving: boolean
  formData: ClientFormData
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg max-h-[90vh] overflow-hidden bg-neutral-900 rounded-xl border border-neutral-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0">
              <h3 className="text-lg font-semibold">
                {isEditing ? "Edit Client" : "Add Client"}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Company Name - Primary Field */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) => onFormChange({ ...formData, company_name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g., Velocity TX"
                />
              </div>

              {/* Contacts Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-neutral-300">
                    Contacts ({formData.contacts.length})
                  </label>
                  <button
                    type="button"
                    onClick={addContact}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Contact
                  </button>
                </div>

                {formData.contacts.length === 0 ? (
                  <div className="p-4 text-center text-neutral-500 text-sm border border-dashed border-neutral-700 rounded-lg">
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
                          className="border border-neutral-700 rounded-lg overflow-hidden bg-neutral-800/50"
                        >
                          {/* Contact Header - Always Visible */}
                          <button
                            type="button"
                            onClick={() => toggleContact(contact.id)}
                            className="w-full flex items-center justify-between p-3 hover:bg-neutral-800 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                                <User className="w-4 h-4 text-neutral-400" />
                              </div>
                              <div className="text-left">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {contact.name || `Contact ${index + 1}`}
                                  </span>
                                  {contact.is_primary && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">
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
                                <div className="p-3 pt-0 space-y-3 border-t border-neutral-700">
                                  <div className="pt-3">
                                    <label className="block text-xs font-medium text-neutral-400 mb-1">Name *</label>
                                    <input
                                      type="text"
                                      value={contact.name}
                                      onChange={(e) => updateContact(contact.id, "name", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-sm focus:outline-none focus:border-blue-500"
                                      placeholder="Contact name"
                                    />
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-400 mb-1">Email</label>
                                      <input
                                        type="email"
                                        value={contact.email}
                                        onChange={(e) => updateContact(contact.id, "email", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="email@company.com"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-neutral-400 mb-1">Phone</label>
                                      <input
                                        type="tel"
                                        value={contact.phone}
                                        onChange={(e) => updateContact(contact.id, "phone", e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-sm focus:outline-none focus:border-blue-500"
                                        placeholder="(555) 123-4567"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-neutral-400 mb-1">Role</label>
                                    <input
                                      type="text"
                                      value={contact.role}
                                      onChange={(e) => updateContact(contact.id, "role", e.target.value)}
                                      className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-600 text-sm focus:outline-none focus:border-blue-500"
                                      placeholder="e.g., CEO, Marketing Director"
                                    />
                                  </div>

                                  <div className="flex items-center justify-between pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={contact.is_primary}
                                        onChange={(e) => updateContact(contact.id, "is_primary", e.target.checked)}
                                        className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                      />
                                      <span className="text-xs text-neutral-400">Set as primary contact</span>
                                    </label>
                                    
                                    {formData.contacts.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeContact(contact.id)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
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

              {/* Status & Industry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => onFormChange({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="churned">Churned</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1.5">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => onFormChange({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Technology"
                  />
                </div>
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Assigned To</label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => onFormChange({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select team member...</option>
                  {TEAM_MEMBERS.map((member) => (
                    <option key={member.email} value={member.name}>{member.name}</option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Additional notes about this client..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-neutral-800 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !formData.company_name}
                className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isEditing ? "Update" : "Create"}
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
