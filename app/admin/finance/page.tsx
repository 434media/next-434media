import type { Metadata } from "next"
import { forbidden } from "next/navigation"
import RefreshWhenSignedIn from "@/components/admin/RefreshWhenSignedIn"
import FinanceSnapshot from "@/components/admin/finance/FinanceSnapshot"
import { founderPageAccess } from "@/lib/founder-guard"

// The founder-only finance page (V1 item 1). Phase 1: the QuickBooks snapshot, read only. The figures load in the
// browser from GET /api/admin/finance, which runs the same guard; nothing about the books is in this server render.
//
// The admin layout's sign-in gate runs in the browser, and a server component passed to it is still sent to the
// browser, so the guard runs here, on the server, before anything renders (lib/founder-guard.ts).
export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false },
}

const NOTICES: Record<string, string> = {
  connected: "QuickBooks is connected.",
  disconnected: "QuickBooks is disconnected. Nothing from the books is kept here.",
  declined: "QuickBooks was not connected: the consent screen was declined.",
  expired: "That connection attempt expired or was started elsewhere. Connect again.",
  failed: "QuickBooks did not accept the connection. Connect again.",
  not_configured: "QuickBooks keys are not set for this deployment.",
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await founderPageAccess("/admin/finance")
  if (access === "signed_out") return <RefreshWhenSignedIn />
  if (access === "forbidden") forbidden()

  const q = (await searchParams).quickbooks
  const notice = typeof q === "string" ? NOTICES[q] ?? null : null

  return (
    <div className="min-h-full bg-neutral-50 px-4 sm:px-6 py-6">
      <div className="max-w-[1240px] mx-auto">
        <FinanceSnapshot notice={notice} subtitle="Visible to the founder only" />
      </div>
    </div>
  )
}
