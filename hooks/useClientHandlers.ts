"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import type {
  Client,
  Task,
  Brand,
  Disposition,
  DOC,
  ViewMode,
  Toast as ToastType,
  CurrentUser,
  ContentPost,
} from "../components/crm/types"

// Contact form shape (shared by client and opportunity forms)
export interface ContactFormEntry {
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

export interface ClientFormData {
  company_name: string
  department: string
  contacts: ContactFormEntry[]
  status: string
  next_followup_date: string
  notes: string
  source: string
  is_opportunity: boolean
  opportunity_id: string
  assigned_to: string
}

export interface OpportunityFormData {
  company_name: string
  existing_company_id: string | null
  linked_company_id: string | null
  contacts: ContactFormEntry[]
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
}

export const EMPTY_CLIENT_FORM: ClientFormData = {
  company_name: "",
  department: "",
  contacts: [],
  status: "prospect",
  next_followup_date: "",
  notes: "",
  source: "",
  is_opportunity: false,
  opportunity_id: "",
  assigned_to: "",
}

export const EMPTY_OPPORTUNITY_FORM: OpportunityFormData = {
  company_name: "",
  existing_company_id: null,
  linked_company_id: null,
  contacts: [],
  title: "",
  status: "prospect",
  brand: "",
  pitch_value: "",
  next_followup_date: "",
  assigned_to: "",
  notes: "",
  source: "",
  is_opportunity: true,
  disposition: "pitched",
  doc: "",
  web_links: [],
  docs: [],
}

// Helper to convert a Client's contacts to the form entry format
function clientContactsToForm(client: Client): ContactFormEntry[] {
  const contacts: ContactFormEntry[] = []

  if (client.contacts && client.contacts.length > 0) {
    client.contacts.forEach(c => {
      contacts.push({
        id: c.id || `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        email: c.email || "",
        phone: c.phone || "",
        role: c.role || "",
        is_primary: c.is_primary || false,
        address: c.address || "",
        city: c.city || "",
        state: c.state || "",
        zipcode: c.zipcode || "",
        date_of_birth: c.date_of_birth || "",
      })
    })
  } else if (client.name || client.email || client.phone) {
    const nameParts = (client.name || "").trim().split(/\s+/)
    contacts.push({
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      email: client.email || "",
      phone: client.phone || "",
      role: "",
      is_primary: true,
      address: "",
      city: "",
      state: "",
      zipcode: "",
      date_of_birth: "",
    })
  }

  return contacts
}

interface UseClientHandlersProps {
  clients: Client[]
  setClients: Dispatch<SetStateAction<Client[]>>
  setToast: Dispatch<SetStateAction<ToastType | null>>
  loadClients: () => Promise<void>
  loadDashboard: () => Promise<void>
  // Client form state
  editingClient: Client | null
  setEditingClient: Dispatch<SetStateAction<Client | null>>
  clientForm: ClientFormData
  setClientForm: Dispatch<SetStateAction<ClientFormData>>
  showClientForm: boolean
  setShowClientForm: Dispatch<SetStateAction<boolean>>
  // Opportunity form state
  opportunityForm: OpportunityFormData
  setOpportunityForm: Dispatch<SetStateAction<OpportunityFormData>>
  isEditingOpportunity: boolean
  setIsEditingOpportunity: Dispatch<SetStateAction<boolean>>
  showOpportunityForm: boolean
  setShowOpportunityForm: Dispatch<SetStateAction<boolean>>
  // Content post state
  contentPosts: ContentPost[]
  setContentPosts: Dispatch<SetStateAction<ContentPost[]>>
  editingContentPost: ContentPost | null
  setEditingContentPost: Dispatch<SetStateAction<ContentPost | null>>
  showContentPostForm: boolean
  setShowContentPostForm: Dispatch<SetStateAction<boolean>>
  // Linked panel
  setCurrentOpportunityForLinked: Dispatch<SetStateAction<Client | null>>
  setLinkedTasks: Dispatch<SetStateAction<Task[]>>
  setLinkedClientForPanel: Dispatch<SetStateAction<Client | null>>
  setShowLinkedTasksPanel: Dispatch<SetStateAction<boolean>>
  // Current user & view
  currentUser: CurrentUser | null
  setViewMode: Dispatch<SetStateAction<ViewMode>>
}

export function useClientHandlers({
  clients,
  setClients,
  setToast,
  loadClients,
  loadDashboard,
  editingClient,
  setEditingClient,
  clientForm,
  setClientForm,
  showClientForm,
  setShowClientForm,
  opportunityForm,
  setOpportunityForm,
  isEditingOpportunity,
  setIsEditingOpportunity,
  showOpportunityForm,
  setShowOpportunityForm,
  contentPosts,
  setContentPosts,
  editingContentPost,
  setEditingContentPost,
  showContentPostForm,
  setShowContentPostForm,
  setCurrentOpportunityForLinked,
  setLinkedTasks,
  setLinkedClientForPanel,
  setShowLinkedTasksPanel,
  currentUser,
  setViewMode,
}: UseClientHandlersProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingOpportunity, setIsSavingOpportunity] = useState(false)
  const [isSavingContentPost, setIsSavingContentPost] = useState(false)

  // Save client
  const handleSaveClient = async () => {
    if (!clientForm.company_name.trim()) {
      setToast({ message: "Client name is required", type: "error" })
      return
    }

    setIsSaving(true)
    try {
      const primaryContact = clientForm.contacts.find(c => c.is_primary) || clientForm.contacts[0]
      const primaryFullName = primaryContact ? [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") : ""

      const clientData = {
        name: primaryFullName || clientForm.company_name,
        company_name: clientForm.company_name,
        email: primaryContact?.email || "",
        phone: primaryContact?.phone || "",
        contacts: clientForm.contacts.map(c => ({
          id: c.id, first_name: c.first_name, last_name: c.last_name,
          email: c.email, phone: c.phone, role: c.role, is_primary: c.is_primary,
          address: c.address || "", city: c.city || "", state: c.state || "",
          zipcode: c.zipcode || "", date_of_birth: c.date_of_birth || "",
        })),
        status: clientForm.status,
        next_followup_date: editingClient
          ? (clientForm.next_followup_date || null)
          : (clientForm.next_followup_date || undefined),
        notes: clientForm.notes,
        source: clientForm.source || undefined,
        is_opportunity: clientForm.is_opportunity,
        opportunity_id: clientForm.opportunity_id || undefined,
        assigned_to: clientForm.assigned_to || undefined,
      }

      const method = editingClient ? "PUT" : "POST"
      const body = editingClient ? { ...clientData, id: editingClient.id } : clientData

      const response = await fetch("/api/admin/crm/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("Failed to save contact")

      setToast({ message: `Contact ${editingClient ? "updated" : "created"} successfully`, type: "success" })
      setShowClientForm(false)
      setEditingClient(null)
      setClientForm(EMPTY_CLIENT_FORM)
      loadClients()
    } catch {
      setToast({ message: "Failed to save contact", type: "error" })
    } finally {
      setIsSaving(false)
    }
  }

  // Save opportunity
  const handleSaveOpportunity = async () => {
    if (!opportunityForm.company_name.trim()) {
      setToast({ message: "Client name is required", type: "error" })
      return
    }
    if (!opportunityForm.brand) {
      setToast({ message: "Please select a platform", type: "error" })
      return
    }

    if (opportunityForm.disposition === "closed_won" && opportunityForm.doc !== "100") {
      const confirmProceed = confirm(
        "Warning: This opportunity is being set to 'Closed Won' without 100% DOC.\n\n" +
        "Opportunities must have 100% DOC to count towards Remaining and Pacing.\n\n" +
        "Do you want to proceed anyway? (The opportunity will appear in the exceptions report)"
      )
      if (!confirmProceed) return
    }

    setIsSavingOpportunity(true)
    try {
      const primaryContact = opportunityForm.contacts.find(c => c.is_primary) || opportunityForm.contacts[0]
      const primaryFullName = primaryContact ? [primaryContact.first_name, primaryContact.last_name].filter(Boolean).join(" ") : ""

      const opportunityData = {
        name: primaryFullName || opportunityForm.company_name,
        company_name: opportunityForm.company_name,
        title: opportunityForm.title || "",
        email: primaryContact?.email || "",
        phone: primaryContact?.phone || "",
        contacts: opportunityForm.contacts.map(c => ({
          id: c.id, first_name: c.first_name, last_name: c.last_name,
          email: c.email, phone: c.phone, role: c.role, is_primary: c.is_primary,
          address: c.address || "", city: c.city || "", state: c.state || "",
          zipcode: c.zipcode || "", date_of_birth: c.date_of_birth || "",
        })),
        status: opportunityForm.status,
        brand: opportunityForm.brand,
        pitch_value: opportunityForm.pitch_value ? parseFloat(opportunityForm.pitch_value) : undefined,
        next_followup_date: opportunityForm.next_followup_date || undefined,
        assigned_to: opportunityForm.assigned_to,
        notes: opportunityForm.notes,
        source: opportunityForm.source || undefined,
        is_opportunity: true,
        disposition: opportunityForm.disposition || "pitched",
        doc: opportunityForm.doc || "25",
        web_links: opportunityForm.web_links.filter(link => link.trim() !== ""),
        docs: opportunityForm.docs.filter(doc => doc.trim() !== ""),
      }

      const method = isEditingOpportunity && opportunityForm.existing_company_id ? "PUT" : "POST"
      const body = isEditingOpportunity && opportunityForm.existing_company_id
        ? { ...opportunityData, id: opportunityForm.existing_company_id }
        : opportunityData

      const response = await fetch("/api/admin/crm/clients", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("Failed to save opportunity")

      // Sync contacts to related clients with the same company name
      const companyNameLower = opportunityForm.company_name.trim().toLowerCase()
      const relatedClients = clients.filter(c => {
        const clientCompanyName = (c.company_name || c.name || "").trim().toLowerCase()
        return clientCompanyName === companyNameLower &&
          c.id !== opportunityForm.existing_company_id &&
          !c.is_opportunity
      })

      for (const relatedClient of relatedClients) {
        const existingContacts = relatedClient.contacts || []
        const existingContactMap = new Map<string, typeof existingContacts[0]>()
        existingContacts.forEach(c => {
          if (c.email) existingContactMap.set(c.email.toLowerCase(), c)
          const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ")
          if (fullName) existingContactMap.set(fullName.toLowerCase(), c)
        })

        const opportunityPrimaryContact = opportunityForm.contacts.find(c => c.is_primary)

        const mergedContacts = existingContacts.map(existingContact => {
          const existingFullName = [existingContact.first_name, existingContact.last_name].filter(Boolean).join(" ")
          const matchingOppContact = opportunityForm.contacts.find(oppC => {
            const oppFullName = [oppC.first_name, oppC.last_name].filter(Boolean).join(" ")
            const emailMatch = oppC.email && existingContact.email &&
              oppC.email.toLowerCase() === existingContact.email.toLowerCase()
            const nameMatch = oppFullName && existingFullName &&
              oppFullName.toLowerCase() === existingFullName.toLowerCase()
            return emailMatch || nameMatch
          })

          if (matchingOppContact) {
            return {
              ...existingContact,
              first_name: matchingOppContact.first_name || existingContact.first_name,
              last_name: matchingOppContact.last_name || existingContact.last_name,
              email: matchingOppContact.email || existingContact.email,
              phone: matchingOppContact.phone || existingContact.phone,
              role: matchingOppContact.role || existingContact.role,
              is_primary: matchingOppContact.is_primary,
              address: matchingOppContact.address || existingContact.address || "",
              city: matchingOppContact.city || existingContact.city || "",
              state: matchingOppContact.state || existingContact.state || "",
              zipcode: matchingOppContact.zipcode || existingContact.zipcode || "",
              date_of_birth: matchingOppContact.date_of_birth || existingContact.date_of_birth || "",
            }
          }
          if (opportunityPrimaryContact) {
            return { ...existingContact, is_primary: false }
          }
          return existingContact
        })

        const newContacts = opportunityForm.contacts.filter(oppC => {
          const emailLower = (oppC.email || "").toLowerCase()
          const oppFullName = [oppC.first_name, oppC.last_name].filter(Boolean).join(" ").toLowerCase()
          const emailExists = emailLower && existingContactMap.has(emailLower)
          const nameExists = oppFullName && existingContactMap.has(oppFullName)
          return !emailExists && !nameExists && (oppC.first_name || oppC.last_name || oppC.email)
        })

        const allContacts = [
          ...mergedContacts,
          ...newContacts.map(c => ({
            id: c.id, first_name: c.first_name, last_name: c.last_name,
            email: c.email, phone: c.phone, role: c.role, is_primary: c.is_primary,
            address: c.address || "", city: c.city || "", state: c.state || "",
            zipcode: c.zipcode || "", date_of_birth: c.date_of_birth || "",
          })),
        ]

        const pc = allContacts.find(c => c.is_primary) || allContacts[0]
        const updatePayload: Record<string, unknown> = { id: relatedClient.id, contacts: allContacts }
        if (pc) {
          const pfn = [pc.first_name, pc.last_name].filter(Boolean).join(" ")
          updatePayload.name = pfn || relatedClient.name
          updatePayload.email = pc.email || relatedClient.email
          updatePayload.phone = pc.phone || relatedClient.phone
        }
        if (opportunityForm.next_followup_date) {
          updatePayload.next_followup_date = opportunityForm.next_followup_date
        }

        try {
          await fetch("/api/admin/crm/clients", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(updatePayload),
          })
        } catch (syncErr) {
          console.error("Failed to sync to related client:", syncErr)
        }
      }

      setToast({ message: isEditingOpportunity ? "Opportunity updated successfully" : "Opportunity created successfully", type: "success" })
      setShowOpportunityForm(false)
      setIsEditingOpportunity(false)
      setOpportunityForm(EMPTY_OPPORTUNITY_FORM)
      loadClients()
      loadDashboard()
    } catch {
      setToast({ message: "Failed to save opportunity", type: "error" })
    } finally {
      setIsSavingOpportunity(false)
    }
  }

  // Delete client
  const handleDeleteClient = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client?")) return

    try {
      const response = await fetch(`/api/admin/crm/clients?id=${id}`, { method: "DELETE", credentials: "include" })
      if (!response.ok) throw new Error("Failed to delete client")
      setToast({ message: "Client deleted", type: "success" })
      loadClients()
    } catch {
      setToast({ message: "Failed to delete client", type: "error" })
    }
  }

  // Archive opportunity
  const handleArchiveOpportunity = async (clientId: string) => {
    try {
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: clientId, is_archived: true, archived_at: new Date().toISOString() }),
      })
      if (!response.ok) throw new Error("Failed to archive opportunity")

      setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_archived: true, archived_at: new Date().toISOString() } : c))
      setToast({ message: "Opportunity archived", type: "success" })
      setShowOpportunityForm(false)
      setIsEditingOpportunity(false)
    } catch {
      setToast({ message: "Failed to archive opportunity", type: "error" })
    }
  }

  // Restore archived opportunity
  const handleRestoreOpportunity = async (clientId: string) => {
    try {
      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: clientId, is_archived: false, archived_at: null }),
      })
      if (!response.ok) throw new Error("Failed to restore opportunity")

      setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_archived: false, archived_at: undefined } : c))
      setToast({ message: "Opportunity restored to active pipeline", type: "success" })
    } catch {
      setToast({ message: "Failed to restore opportunity", type: "error" })
    }
  }

  // Update client disposition via drag-and-drop in Kanban
  const handleUpdateClientDisposition = async (clientId: string, disposition: Disposition) => {
    const currentClient = clients.find(c => c.id === clientId)
    const wasClosedWon = currentClient?.disposition === "closed_won"
    const shouldAutoSetDocTo100 = disposition === "closed_won"
    const shouldAutoSetDocTo25 = wasClosedWon && disposition === "pitched" || disposition === "closed_lost"

    let docValue: DOC | undefined = undefined
    if (shouldAutoSetDocTo100) docValue = "100" as DOC
    else if (shouldAutoSetDocTo25) docValue = "25" as DOC

    try {
      const updatePayload: { id: string; disposition: Disposition; doc?: DOC } = { id: clientId, disposition }
      if (docValue) updatePayload.doc = docValue

      const response = await fetch("/api/admin/crm/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatePayload),
      })
      if (!response.ok) throw new Error("Failed to update client")

      setClients(prev =>
        prev.map(c => {
          if (c.id === clientId) {
            const updates: Partial<Client> = { disposition }
            if (docValue) updates.doc = docValue
            return { ...c, ...updates }
          }
          return c
        })
      )

      const successMessage = shouldAutoSetDocTo100
        ? "Opportunity moved to Closed Won (DOC set to 100%)"
        : shouldAutoSetDocTo25
          ? `Opportunity moved to ${disposition === "pitched" ? "Pitched" : "Closed Lost"} (DOC set to 25%)`
          : "Client moved"
      setToast({ message: successMessage, type: "success" })
    } catch {
      setToast({ message: "Failed to move client", type: "error" })
    }
  }

  // Edit client (open form)
  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    const contacts = clientContactsToForm(client)
    setClientForm({
      company_name: client.company_name || client.name || "",
      department: client.department || "",
      contacts,
      status: client.status,
      next_followup_date: client.next_followup_date || "",
      notes: client.notes || "",
      source: client.source || "",
      is_opportunity: client.is_opportunity || false,
      opportunity_id: client.opportunity_id || "",
      assigned_to: client.assigned_to || "",
    })
    setShowClientForm(true)
  }

  // Edit opportunity (open form)
  const handleEditOpportunity = (client: Client) => {
    const contacts = clientContactsToForm(client)
    setOpportunityForm({
      company_name: client.company_name || client.name || "",
      existing_company_id: client.id,
      linked_company_id: null,
      contacts,
      title: client.title || "",
      status: client.status || "prospect",
      brand: client.brand || "",
      pitch_value: client.pitch_value ? String(client.pitch_value) : "",
      next_followup_date: client.next_followup_date || "",
      assigned_to: client.assigned_to || "",
      notes: client.notes || "",
      source: client.source || "",
      is_opportunity: true,
      disposition: client.disposition || "pitched",
      doc: client.doc || "",
      web_links: client.web_links || [],
      docs: client.docs || [],
    })
    setIsEditingOpportunity(true)
    setShowOpportunityForm(true)
  }

  // Handler for stacked kanban cards
  const handleStackedItemsClick = (opportunity: Client, linkedTasksList: Task[]) => {
    handleEditOpportunity(opportunity)
    if (linkedTasksList.length > 0) {
      setCurrentOpportunityForLinked(opportunity)
      setLinkedTasks(linkedTasksList)
      setLinkedClientForPanel(null)
      setShowLinkedTasksPanel(true)
    }
  }

  // Content Post Handlers
  const handleAddContentPost = () => {
    setEditingContentPost(null)
    setShowContentPostForm(true)
  }

  const handleOpenContentPost = (post: ContentPost) => {
    setEditingContentPost(post)
    setShowContentPostForm(true)
  }

  const handleOpenContentPostFromNotification = async (postId: string) => {
    let posts = contentPosts
    if (posts.length === 0) {
      try {
        const response = await fetch("/api/admin/crm/content-posts")
        if (response.ok) {
          const data = await response.json()
          posts = data.posts || []
          setContentPosts(posts)
        }
      } catch { /* ignore */ }
    }

    let post = posts.find(p => p.id === postId)
    if (!post) {
      try {
        const response = await fetch("/api/admin/crm/content-posts")
        if (response.ok) {
          const data = await response.json()
          posts = data.posts || []
          setContentPosts(posts)
          post = posts.find(p => p.id === postId)
        }
      } catch { /* ignore */ }
    }

    if (post) {
      setViewMode("social-calendar")
      setEditingContentPost(post)
      setShowContentPostForm(true)
    } else {
      setViewMode("social-calendar")
      setToast({ message: "Could not find the content post", type: "error" })
    }
  }

  const handleSaveContentPost = async (postData: Partial<ContentPost>) => {
    setIsSavingContentPost(true)
    try {
      if (editingContentPost) {
        const response = await fetch(`/api/admin/crm/content-posts?id=${editingContentPost.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(postData),
        })
        if (!response.ok) throw new Error("Failed to update content post")
        const data = await response.json()
        setContentPosts(prev => prev.map(p => p.id === editingContentPost.id ? data.post : p))
        setToast({ message: "Content post updated successfully", type: "success" })
      } else {
        const response = await fetch("/api/admin/crm/content-posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: postData.user || "",
            date_created: new Date().toISOString(),
            platform: postData.platform,
            status: postData.status || "to_do",
            title: postData.title || "",
            date_to_post: postData.date_to_post,
            notes: postData.notes,
            thumbnail: postData.thumbnail,
            social_copy: postData.social_copy,
            links: postData.links || [],
            assets: postData.assets || [],
            tags: postData.tags,
            social_platforms: postData.social_platforms || [],
            comments: postData.comments || [],
          }),
        })
        if (!response.ok) throw new Error("Failed to create content post")
        const data = await response.json()
        setContentPosts(prev => [...prev, data.post])
        setToast({ message: "Content post created successfully", type: "success" })
      }
      setShowContentPostForm(false)
      setEditingContentPost(null)
    } catch {
      setToast({ message: `Failed to ${editingContentPost ? "update" : "create"} content post`, type: "error" })
    } finally {
      setIsSavingContentPost(false)
    }
  }

  const handleDeleteContentPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/admin/crm/content-posts?id=${postId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed to delete content post")
      setContentPosts(prev => prev.filter(p => p.id !== postId))
      setShowContentPostForm(false)
      setEditingContentPost(null)
      setToast({ message: "Content post deleted successfully", type: "success" })
    } catch {
      setToast({ message: "Failed to delete content post", type: "error" })
    }
  }

  return {
    isSaving,
    isSavingOpportunity,
    isSavingContentPost,
    handleSaveClient,
    handleSaveOpportunity,
    handleDeleteClient,
    handleArchiveOpportunity,
    handleRestoreOpportunity,
    handleUpdateClientDisposition,
    handleEditClient,
    handleEditOpportunity,
    handleStackedItemsClick,
    handleAddContentPost,
    handleOpenContentPost,
    handleOpenContentPostFromNotification,
    handleSaveContentPost,
    handleDeleteContentPost,
  }
}
