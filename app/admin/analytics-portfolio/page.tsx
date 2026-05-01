import { Suspense } from "react"
import PortfolioAnalyticsClientPage from "./PortfolioAnalyticsClientPage"

export const metadata = {
  title: "Portfolio Analytics | 434 MEDIA",
  description: "Cross-property GA4 rollup across the 434 Media portfolio.",
}

export default function PortfolioAnalyticsPage() {
  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <Suspense
        fallback={
          <div className="bg-neutral-50 flex items-center justify-center min-h-screen">
            <div className="text-neutral-600">Loading portfolio analytics…</div>
          </div>
        }
      >
        <PortfolioAnalyticsClientPage />
      </Suspense>
    </div>
  )
}
