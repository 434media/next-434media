import type React from "react"
import AdminPortalLayout from "@/components/admin/AdminPortalLayout"

// The admin portal renders per request, as it always has. It used to inherit
// that from the root layout, which read cookies and headers; the root no longer
// does (2b fix 9), so it is stated here. Several admin pages call
// useSearchParams() with no Suspense boundary, which cannot be prerendered.
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminPortalLayout>{children}</AdminPortalLayout>
}
