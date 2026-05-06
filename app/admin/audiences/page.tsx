"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
  Megaphone,
  Mail,
  Ticket,
  Users2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { CrossSourceDupesPanel } from "@/components/admin/CrossSourceDupesPanel"
import { AudiencesHeaderStrip } from "@/components/admin/submissions/AudiencesHeaderStrip"
import { EmailListsTab } from "@/components/admin/submissions/EmailListsTab"
import { EventRegistrationsTab } from "@/components/admin/submissions/EventRegistrationsTab"
import { ListsTab } from "@/components/admin/submissions/ListsTab"
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
    // Drop search/event when switching to keep URLs clean — same UX as the
    // old switchTab in /admin/submissions.
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
                  campaign cohorts — push to Mailchimp
                </span>
              </div>
            </div>

            {/* Sub-tab navigation */}
            <nav
              className="flex gap-0 -mb-px overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Audience sources"
            >
              <button
                onClick={() => switchSub("newsletter")}
                aria-current={activeSub === "newsletter" ? "page" : undefined}
                className={`relative shrink-0 px-3 sm:px-4 py-3 text-[13px] font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  activeSub === "newsletter"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Newsletter
                </span>
                {activeSub === "newsletter" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
              <button
                onClick={() => switchSub("events")}
                aria-current={activeSub === "events" ? "page" : undefined}
                className={`relative shrink-0 px-3 sm:px-4 py-3 text-[13px] font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  activeSub === "events"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Ticket className="w-3.5 h-3.5" />
                  Events
                </span>
                {activeSub === "events" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
              <button
                onClick={() => switchSub("lists")}
                aria-current={activeSub === "lists" ? "page" : undefined}
                className={`relative shrink-0 px-3 sm:px-4 py-3 text-[13px] font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  activeSub === "lists"
                    ? "text-neutral-900"
                    : "text-neutral-400 hover:text-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Users2 className="w-3.5 h-3.5" />
                  Lists
                </span>
                {activeSub === "lists" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                )}
              </button>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Stage 4 — Audiences-level rollup tiles. Total / +N in 7d /
              % in Mailchimp per source. Tiles are also a nav surface — the
              active tile mirrors the sub-tab nav state. */}
          <AudiencesHeaderStrip activeSub={activeSub} onSelectSub={switchSub} />

          {/* Cross-source dedupe panel — moved from /admin/submissions to live
              here per the Stage 3 plan. Surfaces emails appearing across the
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
