// Shown with a 403 to every signed-in admin who is not the founder (lib/founder-guard.ts). It says no more than that
// the page is not theirs.
export default function FinanceForbidden() {
  return (
    <div className="min-h-full bg-neutral-50 px-4 sm:px-6 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold text-neutral-900">Not available</h1>
        <p className="mt-1 text-sm text-neutral-500">This page is not available to your account.</p>
      </div>
    </div>
  )
}
