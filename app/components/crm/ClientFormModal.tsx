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
  Mail,
  Phone,
  DollarSign,
  Calendar,
  UserPlus,
  UserMinus,
  Check,
  Pencil,
  Settings
} from "lucide-react"
import { TEAM_MEMBERS, BRANDS, BRAND_GOALS, DISPOSITION_OPTIONS, DOC_OPTIONS } from "./types"
import type { Brand, TeamMember, Disposition, DOC } from "./types"

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
  brand: Brand | ""
  pitch_value: string
  next_followup_date: string
  assigned_to: string
  notes: string
  source: string
  is_opportunity: boolean
  disposition: Disposition | ""
  doc: DOC | ""
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
  
  // State for team member management
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showManageMembers, setShowManageMembers] = useState(false)
  const [newMemberName, setNewMemberName] = useState("")
  const [newMemberEmail, setNewMemberEmail] = useState("")
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [memberError, setMemberError] = useState("")
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false)
  
  // State for editing existing team members
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null)
  const [editMemberName, setEditMemberName] = useState("")
  const [editMemberEmail, setEditMemberEmail] = useState("")
  const [isSavingMember, setIsSavingMember] = useState(false)

  // Fetch team members from Firestore
  const fetchTeamMembers = useCallback(async () => {
    setIsLoadingMembers(true)
    try {
      const response = await fetch("/api/admin/team-members")
      const data = await response.json()
      if (data.success && data.data.length > 0) {
        setTeamMembers(data.data.filter((m: TeamMember) => m.isActive))
      } else {
        // Fallback to default TEAM_MEMBERS
        setTeamMembers(TEAM_MEMBERS.map((m, i) => ({
          id: `default-${i}`,
          name: m.name,
          email: m.email,
          isActive: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })))
      }
    } catch {
      // Fallback to default TEAM_MEMBERS
      setTeamMembers(TEAM_MEMBERS.map((m, i) => ({
        id: `default-${i}`,
        name: m.name,
        email: m.email,
        isActive: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })))
    } finally {
      setIsLoadingMembers(false)
    }
  }, [])

  // Fetch team members when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers()
    }
  }, [isOpen, fetchTeamMembers])

  // Add new team member
  const handleAddMember = async () => {
    if (!newMemberName.trim()) {
      setMemberError("Name is required")
      return
    }
    
    setIsAddingMember(true)
    setMemberError("")
    
    try {
      const response = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
        }),
      })
      
      const data = await response.json()
      
      if (data.success) {
        setTeamMembers(prev => [...prev, data.data])
        onFormChange({ ...formData, assigned_to: data.data.name })
        setNewMemberName("")
        setNewMemberEmail("")
        setShowAddMember(false)
      } else {
        setMemberError(data.error || "Failed to add member")
      }
    } catch {
      setMemberError("Failed to add member")
    } finally {
      setIsAddingMember(false)
    }
  }

  // Delete team member
  const handleDeleteMember = async (member: TeamMember) => {
    if (!confirm(`Remove ${member.name} from the team? This will hide them from future assignments.`)) {
      return
    }
    
    try {
      const response = await fetch(`/api/admin/team-members?id=${member.id}`, {
        method: "DELETE",
      })
      
      const data = await response.json()
      
      if (data.success) {
        setTeamMembers(prev => prev.filter(m => m.id !== member.id))
        if (formData.assigned_to === member.name) {
          onFormChange({ ...formData, assigned_to: "" })
        }
      }
    } catch (error) {
      console.error("Failed to delete member:", error)
    }
  }

  // Start editing a team member
  const handleStartEdit = (member: TeamMember) => {
    setEditingMemberId(member.id)
    setEditMemberName(member.name)
    setEditMemberEmail(member.email)
    setMemberError("")
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMemberId(null)
    setEditMemberName("")
    setEditMemberEmail("")
    setMemberError("")
  }

  // Save edited team member
  const handleSaveMember = async (memberId: string) => {
    if (!editMemberName.trim()) {
      setMemberError("Name is required")
      return
    }

    setIsSavingMember(true)
    setMemberError("")

    try {
      const response = await fetch("/api/admin/team-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: memberId,
          name: editMemberName.trim(),
          email: editMemberEmail.trim(),
        }),
      })

      const data = await response.json()

      if (data.success) {
        const oldMember = teamMembers.find(m => m.id === memberId)
        setTeamMembers(prev =>
          prev.map(m =>
            m.id === memberId
              ? { ...m, name: editMemberName.trim(), email: editMemberEmail.trim() }
              : m
          )
        )
        if (oldMember && formData.assigned_to === oldMember.name) {
          onFormChange({ ...formData, assigned_to: editMemberName.trim() })
        }
        handleCancelEdit()
      } else {
        setMemberError(data.error || "Failed to update member")
      }
    } catch {
      setMemberError("Failed to update member")
    } finally {
      setIsSavingMember(false)
    }
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
            className="w-full max-w-lg max-h-[90vh] overflow-hidden bg-white rounded-xl border border-gray-200 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditing ? "Edit Client" : "Add Client"}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
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

              {/* Source & Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
                  <select
                    value={formData.source || ""}
                    onChange={(e) => onFormChange({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="">Select source...</option>
                    <option value="web">Web</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="event">Event</option>
                    <option value="inbound_call">Inbound Call</option>
                    <option value="referral">Referral</option>
                    <option value="warm_intro">Warm Intro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Platform *</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => onFormChange({ ...formData, brand: e.target.value as Brand | "" })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Pitch Value
                    </span>
                  </label>
                  <input
                    type="number"
                    value={formData.pitch_value}
                    onChange={(e) => onFormChange({ ...formData, pitch_value: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="e.g., 50000"
                  />
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
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Assigned To & Opportunity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Assigned To</label>
                  <div className="relative">
                    {/* Custom dropdown button */}
                    <button
                      type="button"
                      onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white flex items-center justify-between"
                  >
                    <span className={formData.assigned_to ? "text-gray-900" : "text-gray-400"}>
                      {formData.assigned_to || "Select team member..."}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAssigneeDropdown ? "rotate-180" : ""}`} />
                  </button>
                  
                  {/* Dropdown menu */}
                  <AnimatePresence>
                    {showAssigneeDropdown && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                      >
                        <div className="max-h-64 overflow-y-auto">
                          {/* Unassigned option */}
                          <button
                            type="button"
                            onClick={() => {
                              onFormChange({ ...formData, assigned_to: "Unassigned" })
                              setShowAssigneeDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between"
                          >
                            <span className="text-gray-500">Unassigned</span>
                            {formData.assigned_to === "Unassigned" && <Check className="w-4 h-4 text-blue-600" />}
                          </button>
                          
                          <div className="border-t border-gray-100" />
                          
                          {/* Team members */}
                          {isLoadingMembers ? (
                            <div className="px-3 py-4 text-center">
                              <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" />
                            </div>
                          ) : (
                            <>
                              {teamMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center justify-between hover:bg-gray-50 group"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onFormChange({ ...formData, assigned_to: member.name })
                                      setShowAssigneeDropdown(false)
                                    }}
                                    className="flex-1 px-3 py-2 text-left text-sm flex items-center justify-between"
                                  >
                                    <div>
                                      <span className="text-gray-900">{member.name}</span>
                                      {member.email && (
                                        <span className="text-gray-400 text-xs ml-2">{member.email}</span>
                                      )}
                                    </div>
                                    {formData.assigned_to === member.name && <Check className="w-4 h-4 text-blue-600" />}
                                  </button>
                                  {!member.id.startsWith("default-") && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteMember(member)
                                      }}
                                      className="px-2 py-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                                      title={`Remove ${member.name}`}
                                    >
                                      <UserMinus className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                          
                          <div className="border-t border-gray-100" />
                          
                          {/* Add new member button */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddMember(true)
                              setShowAssigneeDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            Add new team member
                          </button>
                          
                          {/* Manage members button */}
                          <button
                            type="button"
                            onClick={() => {
                              setShowManageMembers(true)
                              setShowAssigneeDropdown(false)
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" />
                            Manage team members
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {/* Click outside to close dropdown */}
                  {showAssigneeDropdown && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAssigneeDropdown(false)}
                    />
                  )}
                </div>
              </div>

              {/* Opportunity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Opportunity</label>
                <select
                  value={formData.is_opportunity ? "yes" : "no"}
                  onChange={(e) => onFormChange({ 
                    ...formData, 
                    is_opportunity: e.target.value === "yes",
                    // Set default disposition when enabling opportunity
                    disposition: e.target.value === "yes" && !formData.disposition ? "open" : formData.disposition
                  })}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              {/* Disposition & DOC - Only show when is_opportunity is true */}
              <AnimatePresence>
                {formData.is_opportunity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Disposition */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Disposition <span className="text-gray-400 font-normal">(Pipeline Stage)</span>
                      </label>
                      <select
                        value={formData.disposition || "open"}
                        onChange={(e) => onFormChange({ ...formData, disposition: e.target.value as Disposition })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        {DISPOSITION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* DOC (Degree of Confidence) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        DOC <span className="text-gray-400 font-normal">(Degree of Confidence)</span>
                      </label>
                      <select
                        value={formData.doc || ""}
                        onChange={(e) => onFormChange({ ...formData, doc: e.target.value as DOC })}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                      >
                        <option value="">Select probability...</option>
                        {DOC_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Used for pacing calculations in dashboard
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
                
              {/* Add new member form */}
                <AnimatePresence>
                  {showAddMember && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-blue-900">Add New Team Member</h4>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddMember(false)
                            setNewMemberName("")
                            setNewMemberEmail("")
                            setMemberError("")
                          }}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          placeholder="Full name (required)"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="email"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          placeholder="Email (optional)"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-blue-200 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                        />
                        {memberError && (
                          <p className="text-xs text-red-600">{memberError}</p>
                        )}
                        <button
                          type="button"
                          onClick={handleAddMember}
                          disabled={isAddingMember || !newMemberName.trim()}
                          className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isAddingMember ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              Add Team Member
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Team Management Panel */}
                <AnimatePresence>
                  {showManageMembers && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Manage Team Members
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setShowManageMembers(false)
                            handleCancelEdit()
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {memberError && showManageMembers && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                          {memberError}
                        </div>
                      )}
                      
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {isLoadingMembers ? (
                          <div className="py-4 text-center">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
                            <p className="text-xs text-gray-500 mt-2">Loading team members...</p>
                          </div>
                        ) : teamMembers.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No team members yet. Add one using the dropdown above.
                          </p>
                        ) : (
                          teamMembers.map((member) => (
                            <div
                              key={member.id}
                              className="p-3 bg-white border border-gray-200 rounded-lg"
                            >
                              {editingMemberId === member.id ? (
                                // Edit mode
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editMemberName}
                                    onChange={(e) => setEditMemberName(e.target.value)}
                                    placeholder="Full name"
                                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                  />
                                  <input
                                    type="email"
                                    value={editMemberEmail}
                                    onChange={(e) => setEditMemberEmail(e.target.value)}
                                    placeholder="Email address"
                                    className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMember(member.id)}
                                      disabled={isSavingMember || !editMemberName.trim()}
                                      className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                      {isSavingMember ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Check className="w-3 h-3" />
                                      )}
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEdit}
                                      className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-300"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // View mode
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {member.name}
                                    </p>
                                    {member.email && (
                                      <p className="text-xs text-gray-500 truncate">
                                        {member.email}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    {!member.id.startsWith("default-") && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleStartEdit(member)}
                                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                          title="Edit member"
                                        >
                                          <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteMember(member)}
                                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Remove member"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </>
                                    )}
                                    {member.id.startsWith("default-") && (
                                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                        Default
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Add new member shortcut */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowManageMembers(false)
                          setShowAddMember(true)
                        }}
                        className="w-full mt-3 px-3 py-2 border border-dashed border-gray-300 text-gray-500 text-sm rounded-lg hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add new team member
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => onFormChange({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
                  placeholder="Additional notes about this client..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 flex-shrink-0 bg-gray-50">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !formData.company_name}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
