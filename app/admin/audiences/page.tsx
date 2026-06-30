"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Megaphone, CheckCircle2, AlertCircle } from "lucide-react"
import { AdminRoleGuard, useAdminAccess } from "@/components/AdminRoleGuard"
import { CrossSourceDupesPanel } from "@/components/admin/CrossSourceDupesPanel"
import { AudiencesHeaderStrip } from "@/components/admin/submissions/AudiencesHeaderStrip"
import { EmailListsTab } from "@/components/admin/submissions/EmailListsTab"
import { EventRegistrationsTab } from "@/components/admin/submissions/EventRegistrationsTab"
import { ListsTab } from "@/components/admin/submissions/ListsTab"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { Toast } from "@/components/admin/submissions/types"

// Stage 3 — /admin/audiences groups the three campaign-feeder surfaces
// (Newsletter, Events, Lists) under one route with sub-tab navigation.
// These three share an operational flow: collect → opt-ins auto-sync to
// Mailchimp (cold/partner lists don't) → promote to Lead. The Inbox surface
// lives separately at /admin/inbox because contact forms have a different
// response cadence.
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
  // QA: interns view Marketing read-only — destructive actions (delete / promote
  // / backfill) are blocked in the child tabs.
  const { user } = useAdminAccess(["full_admin", "intern"])
  const readOnly = user?.role === "intern"
  // Bumped by the active sub-tab after a mutation (delete / promote) so the
  // header strip's per-source counts re-fetch live instead of only on refresh.
  const [stripNonce, setStripNonce] = useState(0)
  const bumpStrip = () => setStripNonce((n) => n + 1)

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
    <AdminRoleGuard allowedRoles={["full_admin", "intern"]}>
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
                {/* Pipeline explainer lives in the dismissible "How it works"
                    panel below — no need to also restate it here. */}
              </div>
            </div>
            {/* Source switcher lives in the AudiencesHeaderStrip below (segmented
                control with per-source counts) — no separate tab row here. */}
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* How it works — dismissible first-run intro; narrates this page's
              place in the pipeline (collect → opt-ins auto-sync → leads). */}
          <HowItWorks
            className="mb-4"
            storageKey="audiencesIntroDismissed"
            steps={[
              { title: "Three sources", detail: "Newsletter signups, event registrants, and partner lists — all in one place." },
              { title: "Opt-ins auto-sync", detail: "Anyone who consented flows to Mailchimp automatically, tagged and ready for campaigns. No manual step." },
              { title: "Promote to Leads", detail: "Work a contact 1:1 in the sales pipeline — and how cold/partner lists get reached, since they're not emailed via Mailchimp." },
            ]}
          />

          {/* Source switcher — segmented control with per-source totals, plus
              the active source's secondary KPIs (+this week / subscribed /
              to-push). This is the page's only nav for Newsletter / Events / Lists. */}
          {readOnly && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
              <span className="font-semibold">Read-only.</span> You can browse audiences; deleting, promoting, and backfilling are disabled.
            </div>
          )}

          <AudiencesHeaderStrip activeSub={activeSub} onSelectSub={switchSub} refreshSignal={stripNonce} />

          {/* Cross-source dedupe panel — surfaces emails appearing across the
              three audience sources (and Inbox) so dupes can be merged into a
              single Lead in one click. Hidden when there are no dupes. */}
          <CrossSourceDupesPanel
            onToast={(message, type) => setToast({ message, type })}
            readOnly={readOnly}
          />

          {activeSub === "newsletter" ? (
            <EmailListsTab setToast={setToast} initialSearch={initialSearch} onChanged={bumpStrip} readOnly={readOnly} />
          ) : activeSub === "events" ? (
            <EventRegistrationsTab
              setToast={setToast}
              initialSearch={initialSearch}
              initialEvent={initialEvent}
              onChanged={bumpStrip}
              readOnly={readOnly}
            />
          ) : (
            <ListsTab setToast={setToast} initialSearch={initialSearch} onChanged={bumpStrip} readOnly={readOnly} />
          )}
        </main>
      </div>
    </AdminRoleGuard>
  )
}
