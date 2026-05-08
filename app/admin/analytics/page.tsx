"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { InstagramIcon } from "@/components/icons/InstagramIcon"

// Loading skeleton — uses min-h-full (not min-h-screen) so it lives inside the
// AdminShell scroll container without forcing a viewport-tall reflow.
const AnalyticsLoadingSkeleton = () => (
  <div className="bg-neutral-50 w-full min-h-full animate-pulse">
    <div className="bg-white border-b border-neutral-200 p-4">
      <div className="h-8 bg-neutral-200 rounded w-48 mb-2"></div>
      <div className="h-4 bg-neutral-100 rounded w-32"></div>
    </div>
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white rounded-lg border border-neutral-200"></div>
        ))}
      </div>
      <div className="h-64 bg-white rounded-lg border border-neutral-200"></div>
    </div>
  </div>
)

const PortfolioAnalytics = dynamic(() => import("../analytics-portfolio/PortfolioAnalyticsClientPage"), {
  ssr: false,
  loading: () => <AnalyticsLoadingSkeleton />,
})
const GA4Analytics = dynamic(() => import("../analytics-web/AnalyticsClientPage"), {
  ssr: false,
  loading: () => <AnalyticsLoadingSkeleton />,
})
const InstagramAnalytics = dynamic(() => import("../analytics-instagram/InstagramAnalyticsClientPage"), {
  ssr: false,
  loading: () => <AnalyticsLoadingSkeleton />,
})

type TabKey = "portfolio" | "ga4" | "instagram"

interface TabConfig {
  key: TabKey
  label: string
  short: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
  color: string
}

const tabs: TabConfig[] = [
  { key: "portfolio", label: "Portfolio", short: "Portfolio", icon: PortfolioIcon, color: "text-teal-500" },
  { key: "ga4", label: "Google Analytics", short: "GA4", icon: GA4Icon, color: "text-emerald-500" },
  { key: "instagram", label: "Instagram", short: "Instagram", icon: InstagramIcon, color: "text-pink-500" },
]

const VALID_TABS = new Set<TabKey>(["portfolio", "ga4", "instagram"])

export default function UnifiedAnalyticsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Derive activeTab from URL rather than holding it in state — that way
  // `router.push("?tab=instagram")` from a child (e.g. portfolio drawer drill)
  // actually triggers a tab switch via re-render, instead of leaving state stale.
  const tabParam = searchParams?.get("tab") as TabKey | null
  const activeTab: TabKey = tabParam && VALID_TABS.has(tabParam) ? tabParam : "portfolio"

  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const setTab = useCallback(
    (tab: TabKey) => {
      router.replace(`?tab=${tab}`, { scroll: false })
    },
    [router],
  )

  // Preload the other tabs after mount for snappier switching.
  useEffect(() => {
    const t = setTimeout(() => {
      import("../analytics-web/AnalyticsClientPage")
      import("../analytics-instagram/InstagramAnalyticsClientPage")
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  const ActiveComponent = useMemo(() => {
    switch (activeTab) {
      case "ga4":
        return <GA4Analytics />
      case "instagram":
        return <InstagramAnalytics />
      case "portfolio":
      default:
        return <PortfolioAnalytics />
    }
  }, [activeTab])

  if (!mounted) {
    return (
      <div className="min-h-full flex items-center justify-center text-neutral-500 py-16">
        Loading…
      </div>
    )
  }

  return (
    <AdminRoleGuard allowedRoles={["full_admin"]}>
      <div className="min-h-full bg-neutral-50 text-neutral-900">
        {/* Horizontal tab bar — matches the /admin/audiences pattern */}
        <div className="bg-white border-b border-neutral-200">
          <div className="px-3 sm:px-4 lg:px-6">
            <nav
              className="flex gap-0 -mb-px overflow-x-auto"
              role="tablist"
              aria-label="Analytics source"
            >
              {tabs.map((t) => {
                const Icon = t.icon
                const active = activeTab === t.key
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors whitespace-nowrap ${
                      active
                        ? "text-neutral-900"
                        : "text-neutral-400 hover:text-neutral-700"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${t.color}`} />
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.short}</span>
                    {active && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 rounded-full" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Active analytics page */}
        <div>{ActiveComponent}</div>
      </div>
    </AdminRoleGuard>
  )
}

// --- Icons (kept local to avoid cross-import side effects) ---
function PortfolioIcon(props: React.SVGProps<SVGSVGElement>) {
  // Stacked layers — signals "rollup across multiple sources"
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M12 2 1 8.5 12 15l11-6.5L12 2zM3 13.5 12 19l9-5.5M3 18l9 5.5L21 18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}


