import type { Metadata } from "next"
import { forbidden } from "next/navigation"
import RefreshWhenSignedIn from "@/components/admin/RefreshWhenSignedIn"
import { founderPageAccess } from "@/lib/founder-guard"

// The founder-only finance page (V1 item 1). Phase 0 is the lock and nothing behind it: no money data is read or shown
// until Phase 1 connects QuickBooks.
//
// The admin layout's sign-in gate runs in the browser, and a server component passed to it is still sent to the
// browser, so the guard runs here, on the server, before anything renders (lib/founder-guard.ts).
export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false },
}

export default async function FinancePage() {
  const access = await founderPageAccess("/admin/finance")
  if (access === "signed_out") return <RefreshWhenSignedIn />
  if (access === "forbidden") forbidden()

  return (
    <div className="min-h-full bg-neutral-50 px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold text-neutral-900">Finance</h1>
        <p className="mt-1 text-sm text-neutral-500">Visible to the founder only.</p>
        <div className="mt-4 rounded-lg border border-neutral-200 bg-white px-4 py-3">
          <p className="text-sm font-medium text-neutral-900">QuickBooks is not connected yet</p>
          <p className="mt-0.5 text-sm text-neutral-500">Cash, money owed, profit and the forecast appear here once the connection is made.</p>
        </div>
      </div>
    </div>
  )
}
