import { Suspense } from "react"
import AnalyticsClientPage from "./AnalyticsClientPage"

export const metadata = {
  title: "Google Analytics 4 Dashboard | 434 MEDIA",
  description: "Google Analytics dashboard for 434 Media website performance and insights",
}

export default function AnalyticsPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <Suspense
        fallback={
          <div className="bg-neutral-50 flex items-center justify-center min-h-screen">
            <div className="text-neutral-600">Loading Analytics Dashboard...</div>
          </div>
        }
      >
        <AnalyticsClientPage />
      </Suspense>
    </div>
  )
}
