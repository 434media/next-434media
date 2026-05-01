"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"

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
const MailchimpAnalytics = dynamic(() => import("../analytics-mailchimp/MailchimpAnalyticsClientPage"), {
  ssr: false,
  loading: () => <AnalyticsLoadingSkeleton />,
})
const LinkedInAnalytics = dynamic(() => import("../analytics-linkedin/LinkedInAnalyticsClientPage"), {
  ssr: false,
  loading: () => <AnalyticsLoadingSkeleton />,
})

type TabKey = "portfolio" | "ga4" | "instagram" | "mailchimp" | "linkedin"

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
  { key: "mailchimp", label: "Mailchimp", short: "Mailchimp", icon: MailchimpIcon, color: "text-yellow-500" },
  { key: "linkedin", label: "LinkedIn", short: "LinkedIn", icon: LinkedInIcon, color: "text-sky-500" },
]

export default function UnifiedAnalyticsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = (searchParams?.get("tab") as TabKey) || ("portfolio" as TabKey)
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const setTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab)
      router.replace(`?tab=${tab}`, { scroll: false })
    },
    [router],
  )

  // Preload the other tabs after mount for snappier switching.
  useEffect(() => {
    const t = setTimeout(() => {
      import("../analytics-web/AnalyticsClientPage")
      import("../analytics-instagram/InstagramAnalyticsClientPage")
      import("../analytics-mailchimp/MailchimpAnalyticsClientPage")
      import("../analytics-linkedin/LinkedInAnalyticsClientPage")
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  const ActiveComponent = useMemo(() => {
    switch (activeTab) {
      case "ga4":
        return <GA4Analytics />
      case "instagram":
        return <InstagramAnalytics />
      case "mailchimp":
        return <MailchimpAnalytics />
      case "linkedin":
        return <LinkedInAnalytics />
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
        {/* Horizontal tab bar — matches /admin/leads pattern */}
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

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}

function MailchimpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 00-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0012.7.504C12.304.159 11.817.002 11.267 0z" />
    </svg>
  )
}

function LinkedInIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" {...props}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}
