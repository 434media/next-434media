"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Megaphone, CheckCircle2, AlertCircle } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { CrossSourceDupesPanel } from "@/components/admin/CrossSourceDupesPanel"
import { AudiencesHeaderStrip } from "@/components/admin/submissions/AudiencesHeaderStrip"
import { EmailListsTab } from "@/components/admin/submissions/EmailListsTab"
import { EventRegistrationsTab } from "@/components/admin/submissions/EventRegistrationsTab"
import { ListsTab } from "@/components/admin/submissions/ListsTab"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { Toast } from "@/components/admin/submissions/types"

// Stage 3 — /admin/audiences groups the three campaign-feeder surfaces
// (Newsletter, Events, Lists) under one route with sub-tab navigation.
// These three share an operational flow: import → push to Mailchimp →
// engagement signals → promote to Lead. The Inbox surface lives separately
// at /admin/inbox because contact forms have a different response cadence.
//
// Sub-tabs are driven by `?sub=newsletter|events|lists`; default is
// `newsletter` since it has the highest volume.

type SubTab = "newsletter" | "events" | "lists"

const VALID_SUBS = new Set<SubTab>(["newsletter", "events", "lists"])

export default function AudiencesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const subParam = searchParams?.get("sub") as SubTab | null
  const initialSub: SubTab = subParam && VALID_SUBS.has(subParam) ? subParam : "newsletter"
  const initialSearch = searchParams?.get("search") ?? ""
  const initialEvent = searchParams?.get("event") ?? ""

  const [activeSub, setActiveSub] = useState<SubTab>(initialSub)
  const [toast, setToast] = useState<Toast | null>(null)

  const switchSub = (next: SubTab) => {
    setActiveSub(next)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("sub", next)
    // Drop search/event when switching to keep URLs clean.
    params.delete("search")
    params.delete("event")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Sync activeSub when URL changes (back/forward nav, deep links)
  useEffect(() => {
    if (subParam && VALID_SUBS.has(subParam) && subParam !== activeSub) {
      setActiveSub(subParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subParam])

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-dvh bg-neutral-50 text-neutral-900">
        {/* Toast — pinned to top edge on mobile, top-right on sm+ */}
        {toast && (
          <div className="fixed top-[max(env(safe-area-inset-top),0.75rem)] inset-x-3 sm:inset-x-auto sm:top-20 sm:right-4 z-50 animate-in fade-in slide-in-from-top-2 flex justify-center sm:block">
            <div
              role="status"
              className={`flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium w-full sm:w-auto sm:max-w-sm ${
                toast.type === "success"
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span className="flex-1 wrap-break-word">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 grid h-7 w-7 place-items-center rounded-full hover:bg-white/15 text-lg leading-none shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-neutral-600" />
                <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                  AUDIENCES
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full">
                  contacts to email — sync to Mailchimp, promote to leads
                </span>
              </div>
            </div>
            {/* Source switcher lives in the AudiencesHeaderStrip below (segmented
                control with per-source counts) — no separate tab row here. */}
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* How it works — dismissible first-run intro; narrates this page's
              place in the pipeline (contacts → Mailchimp → leads). */}
          <HowItWorks
            className="mb-4"
            storageKey="audiencesIntroDismissed"
            steps={[
              { title: "Three sources", detail: "Newsletter signups, event registrants, and partner-shared lists — all in one place." },
              { title: "Sync to Mailchimp", detail: "Keep contacts reachable so they can receive your campaigns." },
              { title: "Promote to Leads", detail: "Turn an engaged contact into worked sales pipeline." },
            ]}
          />

          {/* Source switcher — segmented control with per-source totals, plus
              the active source's secondary KPIs (+this week / % in Mailchimp).
              This is the page's only nav for Newsletter / Events / Lists. */}
          <AudiencesHeaderStrip activeSub={activeSub} onSelectSub={switchSub} />

          {/* Cross-source dedupe panel — surfaces emails appearing across the
              three audience sources (and Inbox) so dupes can be merged into a
              single Lead in one click. Hidden when there are no dupes. */}
          <CrossSourceDupesPanel
            onToast={(message, type) => setToast({ message, type })}
          />

          {activeSub === "newsletter" ? (
            <EmailListsTab setToast={setToast} initialSearch={initialSearch} />
          ) : activeSub === "events" ? (
            <EventRegistrationsTab
              setToast={setToast}
              initialSearch={initialSearch}
              initialEvent={initialEvent}
            />
          ) : (
            <ListsTab setToast={setToast} initialSearch={initialSearch} />
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
