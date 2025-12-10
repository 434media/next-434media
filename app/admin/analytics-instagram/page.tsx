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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
          <div className="text-white">Loading Instagram Analytics Dashboard...</div>
        </div>
      }
    >
      <InstagramAnalyticsClientPage />
    </Suspense>
  )
}
