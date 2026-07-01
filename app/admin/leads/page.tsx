"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { Toast, LeadsView, LeadDetailDrawer } from "@/components/crm"
import { LeadsTabs } from "@/components/crm/LeadsTabs"
import type { Toast as ToastType } from "@/components/crm/types"
import { useLeadHandlers } from "@/hooks/useLeadHandlers"
import type { Lead } from "@/types/crm-types"

type LeadView = "priority" | "all" | "followup" | "sequence"

const VALID_VIEWS = new Set<LeadView>(["priority", "all", "followup", "sequence"])

export default function LeadsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const viewParam = searchParams?.get("view") as LeadView | null
  const initialView: LeadView = viewParam && VALID_VIEWS.has(viewParam) ? viewParam : "priority"
  const initialSearch = searchParams?.get("search") ?? ""

  const [leads, setLeads] = useState<Lead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<ToastType | null>(null)

  const [showLeadDrawer, setShowLeadDrawer] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  // Which tab the drawer lands on for the next open. Reset to "details" on a
  // normal row open; set to "outreach" when a sequence badge is clicked.
  const [leadInitialTab, setLeadInitialTab] = useState<"details" | "outreach" | "activity">("details")
  const [leadView, setLeadView] = useState<LeadView>(initialView)
  const [leadSearch, setLeadSearch] = useState(initialSearch)
  const [isSavingLead, setIsSavingLead] = useState(false)
  // Current admin's display name — powers the "Assigned to me" filter.
  const [currentUserName, setCurrentUserName] = useState<string>("")

  const {
    loadLeads,
    openLead,
    openNewLeadForm,
    saveLead,
    archiveLead,
    deleteLead,
    generateDraft,
    sendOutreach,
    sequenceAction,
    convertToClient,
    bulkUpdate,
    researchLead,
  } = useLeadHandlers({
    leads,
    setLeads,
    setToast,
    selectedLead,
    setSelectedLead,
    setShowLeadDrawer,
  })

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    loadLeads().finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Resolve the current admin's name once (for the "Assigned to me" filter).
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.user) return
        setCurrentUserName(data.user.name || "")
      })
      .catch(() => {
        /* non-fatal — filter just won't offer "mine" */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sync ?view= → leadView (back/forward nav)
  useEffect(() => {
    if (viewParam && VALID_VIEWS.has(viewParam) && viewParam !== leadView) {
      setLeadView(viewParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam])

  const handleViewChange = (next: LeadView) => {
    setLeadView(next)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("view", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // ?new=lead → open empty create drawer (command palette quick action).
  // Strip the param so re-renders don't reopen it after the user closes.
  const newParam = searchParams?.get("new") ?? null
  useEffect(() => {
    if (!newParam) return
    if (newParam === "lead") {
      openNewLeadForm()
    }
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.delete("new")
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newParam])

  // ?openLead=<id> — deep-link open a specific lead drawer.
  const openLeadId = searchParams?.get("openLead") ?? null
  useEffect(() => {
    if (!openLeadId) {
      if (showLeadDrawer) {
        setShowLeadDrawer(false)
        setSelectedLead(null)
      }
      return
    }
    if (leads.length === 0) return
    const target = leads.find((l) => l.id === openLeadId)
    if (!target) return
    if (selectedLead?.id === openLeadId && showLeadDrawer) return
    openLead(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLeadId, leads])

  const closeLeadDrawer = () => {
    setShowLeadDrawer(false)
    setSelectedLead(null)
    if (searchParams?.get("openLead")) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("openLead")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }

  // Keep ?openLead= in sync when the drawer opens via direct interaction
  useEffect(() => {
    if (!showLeadDrawer || !selectedLead?.id) return
    if (searchParams?.get("openLead") === selectedLead.id) return
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("openLead", selectedLead.id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLeadDrawer, selectedLead?.id])

  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        <Toast toast={toast} />

        <LeadsTabs active="leads" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-medium">Loading leads...</span>
              </div>
            </div>
          ) : (
            <LeadsView
              leads={leads}
              view={leadView}
              searchQuery={leadSearch}
              onViewChange={handleViewChange}
              onSearchChange={setLeadSearch}
              onRefresh={loadLeads}
              onOpenLead={(lead) => {
                setLeadInitialTab("details")
                openLead(lead)
              }}
              onOpenLeadOutreach={(lead) => {
                setLeadInitialTab("outreach")
                openLead(lead)
              }}
              onCreateLead={openNewLeadForm}
              onBulkUpdate={bulkUpdate}
              currentUserName={currentUserName}
            />
          )}
        </div>

        <LeadDetailDrawer
          open={showLeadDrawer}
          lead={selectedLead}
          isSaving={isSavingLead}
          initialTab={leadInitialTab}
          onClose={closeLeadDrawer}
          onSave={async (patch) => {
            setIsSavingLead(true)
            try {
              return await saveLead(patch)
            } finally {
              setIsSavingLead(false)
            }
          }}
          onArchive={archiveLead}
          onDelete={deleteLead}
          onGenerateDraft={generateDraft}
          onSendOutreach={sendOutreach}
          onSequenceAction={sequenceAction}
          onConvertToClient={convertToClient}
          onResearch={researchLead}
        />
      </div>
    </AdminRoleGuard>
  )
}
