"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Inbox, CheckCircle2, AlertCircle } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { ContactFormsTab } from "@/components/admin/submissions/ContactFormsTab"
import { InboxResponseStrip } from "@/components/admin/submissions/InboxResponseStrip"
import { HowItWorks } from "@/components/admin/HowItWorks"
import type { Toast } from "@/components/admin/submissions/types"

// Stage 3 — /admin/inbox is the response queue for direct contact-form
// inquiries. Stage 5 will give it a dedicated identity (response-time SLA,
// "Reply via Resend"); for now it wraps the existing ContactFormsTab so the
// behavior is unchanged from the old `?tab=contact-forms` view.

export default function InboxPage() {
  const searchParams = useSearchParams()
  const initialSearch = searchParams?.get("search") ?? ""
  const [toast, setToast] = useState<Toast | null>(null)
  // Bumped by ContactFormsTab after any stat-affecting mutation (delete, reply,
  // triage, acknowledge) so the response-SLA strip re-fetches live instead of
  // only on a full page refresh.
  const [statsNonce, setStatsNonce] = useState(0)

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
                <Inbox className="w-4 h-4 text-neutral-600" />
                <h1 className="text-sm font-semibold text-neutral-800 tracking-wide">
                  INBOX
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 ml-2 text-[10px] font-medium text-neutral-500 bg-neutral-100 rounded-full">
                  direct inquiries — reply within hours
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* How it works — dismissible first-run intro; the inbox's place in
              the pipeline (inquiry → reply → lead). */}
          <HowItWorks
            className="mb-4"
            storageKey="inboxIntroDismissed"
            steps={[
              { title: "Direct inquiries land here", detail: "Messages from the site's contact form, newest first." },
              { title: "Reply within hours", detail: "Watch “Oldest waiting” — it turns red once an inquiry sits over a day." },
              { title: "Convert to a Lead", detail: "When an inquiry is real pipeline, promote it into Leads." },
            ]}
          />

          {/* Stage 5 — response-queue identity. Awaiting reply / oldest
              waiting / replied today / avg response time across the contact
              forms surface. Tone shifts (amber → red) when oldest waiting
              crosses 24h. */}
          <InboxResponseStrip refreshSignal={statsNonce} />

          <ContactFormsTab
            setToast={setToast}
            initialSearch={initialSearch}
            onChanged={() => setStatsNonce((n) => n + 1)}
          />
        </main>
      </div>
    </AdminRoleGuard>
  )
}
