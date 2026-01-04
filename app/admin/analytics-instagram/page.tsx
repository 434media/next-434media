import { Suspense } from "react"
import InstagramAnalyticsClientPage from "./InstagramAnalyticsClientPage"

export const metadata = {
  title: "Instagram Analytics Dashboard | TXMX Boxing",
  description: "Instagram insights dashboard for TXMX Boxing performance and engagement metrics",
}

export default function InstagramAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
          <div className="text-neutral-600">Loading Instagram Analytics Dashboard...</div>
        </div>
      }
    >
      <InstagramAnalyticsClientPage />
    </Suspense>
  )
}
