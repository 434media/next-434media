"use client"

import { useCallback } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { Lead, LeadStatus, LeadUpdateInput } from "@/types/crm-types"
import type { Toast } from "@/components/crm/types"

interface UseLeadHandlersArgs {
  leads: Lead[]
  setLeads: Dispatch<SetStateAction<Lead[]>>
  setToast: Dispatch<SetStateAction<Toast | null>>
  selectedLead: Lead | null
  setSelectedLead: Dispatch<SetStateAction<Lead | null>>
  setShowLeadDrawer: Dispatch<SetStateAction<boolean>>
}

export function useLeadHandlers({
  leads,
  setLeads,
  setToast,
  selectedLead,
  setSelectedLead,
  setShowLeadDrawer,
}: UseLeadHandlersArgs) {
  // Load all leads
  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/leads", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load leads")
      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      console.error("[loadLeads]", err)
      setToast({ message: "Failed to load leads", type: "error" })
    }
  }, [setLeads, setToast])

  // Open existing lead
  const openLead = useCallback(
    (lead: Lead) => {
      setSelectedLead(lead)
      setShowLeadDrawer(true)
    },
    [setSelectedLead, setShowLeadDrawer],
  )

  // Open empty drawer (create flow)
  const openNewLeadForm = useCallback(() => {
    setSelectedLead(null)
    setShowLeadDrawer(true)
  }, [setSelectedLead, setShowLeadDrawer])

  // Save: create or update depending on whether selectedLead has an id
  const saveLead = useCallback(
    async (patch: LeadUpdateInput): Promise<Lead | null> => {
      try {
        if (selectedLead?.id) {
          // Optimistic update
          const optimistic = { ...selectedLead, ...patch } as Lead
          const prev = leads
          setLeads(leads.map((l) => (l.id === selectedLead.id ? optimistic : l)))
          setSelectedLead(optimistic)

          const res = await fetch(`/api/admin/leads/${selectedLead.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
          if (!res.ok) {
            // Rollback
            setLeads(prev)
            setSelectedLead(selectedLead)
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "Failed to update lead")
          }
          const data = await res.json()
          // Replace optimistic with server truth (re-scored)
          setLeads((curr) => curr.map((l) => (l.id === data.lead.id ? data.lead : l)))
          setSelectedLead(data.lead)
          setToast({ message: "Lead updated", type: "success" })
          return data.lead
        } else {
          // Create
          const res = await fetch("/api/admin/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || "Failed to create lead")
          }
          const data = await res.json()
          setLeads((curr) => [data.lead, ...curr])
          setSelectedLead(data.lead)
          setToast({ message: "Lead created", type: "success" })
          return data.lead
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save lead"
        setToast({ message, type: "error" })
        return null
      }
    },
    [leads, selectedLead, setLeads, setSelectedLead, setToast],
  )

  // Quick status change from row (optimistic)
  const updateLeadStatus = useCallback(
    async (id: string, status: LeadStatus) => {
      const prev = leads
      setLeads(leads.map((l) => (l.id === id ? { ...l, status } : l)))
      try {
        const res = await fetch(`/api/admin/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) throw new Error("Update failed")
        const data = await res.json()
        setLeads((curr) => curr.map((l) => (l.id === id ? data.lead : l)))
      } catch (err) {
        console.error("[updateLeadStatus]", err)
        setLeads(prev)
        setToast({ message: "Failed to update status", type: "error" })
      }
    },
    [leads, setLeads, setToast],
  )

  // Archive (status flip — does NOT delete the row)
  const archiveLead = useCallback(
    async (id: string) => {
      await updateLeadStatus(id, "archived")
      setToast({ message: "Lead archived", type: "success" })
    },
    [updateLeadStatus, setToast],
  )

  // Generate outreach draft via Claude. Server returns the updated lead with
  // draft + draft_generated_at + (possibly) flipped status. We swap it in.
  const generateDraft = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/leads/${id}/generate-draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to generate draft")
        }
        const data = await res.json()
        setLeads((curr) => curr.map((l) => (l.id === id ? data.lead : l)))
        if (selectedLead?.id === id) setSelectedLead(data.lead)
        setToast({ message: "Draft generated", type: "success" })
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate draft"
        setToast({ message, type: "error" })
      }
    },
    [selectedLead, setLeads, setSelectedLead, setToast],
  )

  // Send outreach via Resend. Server returns the updated lead with status
  // flipped to `contacted` and follow-up scheduled. We swap it in.
  const sendOutreach = useCallback(
    async (id: string, subject: string, body?: string) => {
      try {
        const res = await fetch(`/api/admin/leads/${id}/send-outreach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, body }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Failed to send outreach")
        }
        const data = await res.json()
        setLeads((curr) => curr.map((l) => (l.id === id ? data.lead : l)))
        if (selectedLead?.id === id) setSelectedLead(data.lead)
        setToast({ message: `Sent to ${data.lead.email}`, type: "success" })
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to send outreach"
        setToast({ message, type: "error" })
        return false
      }
    },
    [selectedLead, setLeads, setSelectedLead, setToast],
  )

  // Convert lead → crm_clients. Server creates the client, stamps the link
  // on both sides, flips lead status to "converted". On 409 (already converted)
  // we surface the existing client id rather than treating as an error.
  const convertToClient = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/leads/${id}/convert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (res.status === 409) {
          setToast({
            message: `Lead already converted — opening existing client`,
            type: "success",
          })
          window.location.href = `/admin/crm?tab=clients&open=${data.clientId}`
          return
        }
        if (!res.ok) {
          throw new Error(data.error || "Failed to convert lead")
        }
        if (data.lead) {
          setLeads((curr) => curr.map((l) => (l.id === id ? data.lead : l)))
          if (selectedLead?.id === id) setSelectedLead(data.lead)
        }
        setToast({
          message: data.warning || `Converted to client — opening now`,
          type: "success",
        })
        // Hand off to the client drawer so the rep continues from the new record
        window.location.href = `/admin/crm?tab=clients&open=${data.client.id}`
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to convert lead"
        setToast({ message, type: "error" })
      }
    },
    [selectedLead, setLeads, setSelectedLead, setToast],
  )

  // Hard delete (admin-only destructive action)
  const deleteLead = useCallback(
    async (id: string) => {
      const prev = leads
      setLeads(leads.filter((l) => l.id !== id))
      try {
        const res = await fetch(`/api/admin/leads/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Delete failed")
        setToast({ message: "Lead deleted", type: "success" })
      } catch (err) {
        console.error("[deleteLead]", err)
        setLeads(prev)
        setToast({ message: "Failed to delete lead", type: "error" })
      }
    },
    [leads, setLeads, setToast],
  )

  return {
    loadLeads,
    openLead,
    openNewLeadForm,
    saveLead,
    updateLeadStatus,
    archiveLead,
    deleteLead,
    generateDraft,
    sendOutreach,
    convertToClient,
  }
}
