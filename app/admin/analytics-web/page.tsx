import { Suspense } from "react"
import AnalyticsClientPage from "./AnalyticsClientPage"

export const metadata = {
  title: "Google Analytics 4 Dashboard | 434 MEDIA",
  description: "Google Analytics dashboard for 434 Media website performance and insights",
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-900 flex items-center justify-center">
          <div className="text-white">Loading Analytics Dashboard...</div>
        </div>
      }
    >
      <AnalyticsClientPage />
    </Suspense>
  )
}
