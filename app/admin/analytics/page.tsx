"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { motion } from "motion/react"

// Re-use existing client pages (do NOT modify their internal logic)
const GA4Analytics = dynamic(() => import("../analytics-web/AnalyticsClientPage"), { ssr: false })
const InstagramAnalytics = dynamic(() => import("../analytics-instagram/InstagramAnalyticsClientPage"), {
  ssr: false,
})
const MailchimpAnalytics = dynamic(() => import("../analytics-mailchimp/MailchimpAnalyticsClientPage"), {
  ssr: false,
})

type TabKey = "ga4" | "instagram" | "mailchimp"

interface TabConfig {
  key: TabKey
  label: string
  icon: React.FC<React.SVGProps<SVGSVGElement>>
  description: string
  color: string // tailwind class for icon accent
}

const tabs: TabConfig[] = [
  {
    key: "ga4",
    label: "Google Analytics",
    icon: GA4Icon,
    description: "Website traffic & engagement (GA4)",
    color: "text-emerald-400",
  },
  {
    key: "instagram",
    label: "Instagram Insights",
    icon: InstagramIcon,
    description: "Meta / Instagram performance",
    color: "text-pink-400",
  },
  {
    key: "mailchimp",
    label: "Mailchimp Analytics",
    icon: MailchimpIcon,
    description: "Email campaigns & subscribers",
    color: "text-yellow-400",
  },
]


export default function UnifiedAnalyticsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const initialTab = (searchParams?.get("tab") as TabKey) || ("ga4" as TabKey)
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Keep URL in sync (no full reload)
  const setTab = useCallback(
    (tab: TabKey) => {
      setActiveTab(tab)
      router.replace(`?tab=${tab}`, { scroll: false })
    },
    [router],
  )

  // Preload other tabs after mount for faster switching
  useEffect(() => {
    const t = setTimeout(() => {
      // Trigger dynamic import preloads (no-ops if already loaded)
      import("../analytics-instagram/InstagramAnalyticsClientPage")
      import("../analytics-mailchimp/MailchimpAnalyticsClientPage")
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  const ActiveComponent = useMemo(() => {
    switch (activeTab) {
      case "instagram":
        return <InstagramAnalytics />
      case "mailchimp":
        return <MailchimpAnalytics />
      case "ga4":
      default:
        return <GA4Analytics />
    }
  }, [activeTab])

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading Unified Analytics...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-neutral-900">
      {/* Mobile Tab Bar - Fixed at bottom on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-black border-t border-white/10 safe-area-pb">
        <nav className="flex justify-around py-1.5">
          {tabs.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  active ? "text-white" : "text-white/50"
                }`}
              >
                <span className={`p-1.5 rounded-lg ${active ? "bg-white/10" : ""}`}>
                  <Icon className={`w-5 h-5 ${t.color}`} />
                </span>
                <span className="text-[9px] font-medium">{t.label.split(" ")[0]}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex">
        {/* Sidebar - Desktop only, not fixed so footer shows */}
        <aside className="hidden md:flex pt-16 flex-col w-20 lg:w-64 border-r border-neutral-200 bg-black min-h-screen flex-shrink-0">
          <div className="p-4 lg:px-6 lg:py-6 flex flex-col gap-6 sticky top-16">
            <div className="space-y-1">
              <h2 className="hidden lg:block text-sm uppercase tracking-wider text-white/60 font-medium">Analytics</h2>
              <p className="hidden lg:block text-xs text-white/40 leading-relaxed">Unified dashboards for web, social, and email.</p>
            </div>
            <nav className="flex flex-col gap-2">
              {tabs.map((t) => {
                const Icon = t.icon
                const active = activeTab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`group relative flex items-center justify-center lg:justify-start gap-3 rounded-xl px-2 lg:px-3 py-2.5 lg:py-2.5 text-sm transition-colors ${
                      active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                    title={t.label}
                  >
                    <span
                      className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                        active ? "bg-white/10" : "bg-white/5 group-hover:bg-white/10"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${t.color}`} />
                    </span>
                    <span className="hidden lg:flex flex-col text-left leading-tight">
                      <span className="font-medium text-sm">{t.label}</span>
                      <span className="text-[11px] text-white/40">{t.description}</span>
                    </span>
                    {active && (
                      <motion.span
                        layoutId="active-indicator"
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-gradient-to-b from-emerald-400 to-emerald-600"
                      />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 pb-16 md:pb-0 overflow-x-hidden">
          {/* Animating tab transitions */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="overflow-x-hidden"
          >
            {ActiveComponent}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

// --- Icons (copied from existing admin page to avoid cross-import side effects) ---
function GA4Icon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" {...props}>
      <path d="M22.84 2.998v17.999a2.983 2.983 0 01-2.967 2.998 2.98 2.98 0 01-.368-.02 3.06 3.06 0 01-2.61-3.1V3.12A3.06 3.06 0 0119.51.02a2.983 2.983 0 013.329 2.978zM4.133 18.055a2.973 2.973 0 100 5.945 2.973 2.973 0 000-5.945zm7.872-9.01h-.05a3.06 3.06 0 00-2.892 3.126v7.985c0 2.167.954 3.482 2.35 3.763a2.978 2.978 0 003.57-2.927v-8.959a2.983 2.983 0 00-2.978-2.988z" />
    </svg>
  )
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" {...props}>
      <path d="M7.03.084c-1.277.06-2.149.264-2.91.563a5.874 5.874 0 00-2.124 1.388 5.878 5.878 0 00-1.38 2.127C.321 4.926.12 5.8.064 7.076.008 8.354-.005 8.764.001 12.023c.007 3.259.021 3.667.083 4.947.061 1.277.264 2.149.563 2.911.308.789.72 1.457 1.388 2.123a5.872 5.872 0 002.129 1.38c.763.295 1.636.496 2.913.552 1.278.056 1.689.069 4.947.063 3.257-.007 3.668-.021 4.947-.082 1.28-.06 2.147-.265 2.91-.563a5.881 5.881 0 002.123-1.388 5.881 5.881 0 001.38-2.129c.295-.763.496-1.636.551-2.912.056-1.28.07-1.69.063-4.948-.006-3.258-.02-3.667-.081-4.947-.06-1.28-.264-2.148-.564-2.911a5.892 5.892 0 00-1.387-2.123 5.857 5.857 0 00-2.128-1.38C19.074.322 18.202.12 16.924.066 15.647.009 15.236-.006 11.977 0 8.718.008 8.31.021 7.03.084m.14 21.693c-1.17-.05-1.805-.245-2.228-.408a3.736 3.736 0 01-1.382-.895 3.695 3.695 0 01-.9-1.378c-.165-.423-.363-1.058-.417-2.228-.06-1.264-.072-1.644-.08-4.848-.006-3.204.006-3.583.061-4.848.05-1.169.246-1.805.408-2.228.216-.561.477-.96.895-1.382a3.705 3.705 0 011.379-.9c.423-.165 1.057-.361 2.227-.417 1.265-.06 1.644-.072 4.848-.08 3.203-.006 3.583.006 4.85.062 1.168.05 1.804.244 2.227.408.56.216.96.475 1.382.895.421.42.681.817.9 1.378.165.422.362 1.056.417 2.227.06 1.265.074 1.645.08 4.848.005 3.203-.006 3.583-.061 4.848-.051 1.17-.245 1.805-.408 2.23-.216.56-.477.96-.896 1.38a3.705 3.705 0 01-1.378.9c-.422.165-1.058.362-2.226.418-1.266.06-1.645.072-4.85.079-3.204.007-3.582-.006-4.848-.06m9.783-16.192a1.44 1.44 0 101.437-1.442 1.44 1.44 0 00-1.437 1.442M5.839 12.012a6.161 6.161 0 1012.323-.024 6.162 6.162 0 00-12.323.024M8 12.008A4 4 0 1112.008 16 4 4 0 018 12.008" />
    </svg>
  )
}

function MailchimpIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white" {...props}>
      <path d="M11.267 0C6.791-.015-1.82 10.246 1.397 12.964l.79.669a3.88 3.88 0 00-.22 1.792c.084.84.518 1.644 1.22 2.266.666.59 1.542.964 2.392.964 1.406 3.24 4.62 5.228 8.386 5.34 4.04.12 7.433-1.776 8.854-5.182.093-.24.488-1.316.488-2.267 0-.956-.54-1.352-.885-1.352-.01-.037-.078-.286-.172-.586-.093-.3-.19-.51-.19-.51.375-.563.382-1.065.332-1.35-.053-.353-.2-.653-.496-.964-.296-.311-.902-.63-1.753-.868l-.446-.124c-.002-.019-.024-1.053-.043-1.497-.014-.32-.042-.822-.197-1.315-.186-.668-.508-1.253-.911-1.627 1.112-1.152 1.806-2.422 1.804-3.511-.003-2.095-2.576-2.729-5.746-1.416l-.672.285A678.22 678.22 0 0012.7.504C12.304.159 11.817.002 11.267 0zm.073.873c.166 0 .322.019.465.058.297.084 1.28 1.224 1.28 1.224s-1.826 1.013-3.52 2.426c-2.28 1.757-4.005 4.311-5.037 7.082-.811.158-1.526.618-1.963 1.253-.261-.218-.748-.64-.834-.804-.698-1.326.761-3.902 1.781-5.357C5.834 3.44 9.37.867 11.34.873zm3.286 3.273c.04-.002.06.05.028.074-.143.11-.299.26-.413.414a.04.04 0 00.031.064c.659.004 1.587.235 2.192.574.041.023.012.103-.034.092-.915-.21-2.414-.369-3.97.01-1.39.34-2.45.863-3.224 1.426-.04.028-.086-.023-.055-.06.896-1.035 1.999-1.935 2.987-2.44.034-.018.07.019.052.052-.079.143-.23.447-.278.678-.007.035.032.063.062.042.615-.42 1.684-.868 2.622-.926zm3.023 3.205l.056.001a.896.896 0 01.456.146c.534.355.61 1.216.638 1.845.015.36.059 1.229.074 1.478.034.571.184.651.487.751.17.057.33.098.563.164.706.198 1.125.4 1.39.658.157.162.23.333.253.497.083.608-.472 1.36-1.942 2.041-1.607.746-3.557.935-4.904.785l-.471-.053c-1.078-.145-1.693 1.247-1.046 2.201.417.615 1.552 1.015 2.688 1.015 2.604 0 4.605-1.111 5.35-2.072a.987.987 0 00.06-.085c.036-.055.006-.085-.04-.054-.608.416-3.31 2.069-6.2 1.571 0 0-.351-.057-.672-.182-.255-.1-.788-.344-.853-.891 2.333.72 3.801.039 3.801.039a.072.072 0 00.042-.072.067.067 0 00-.074-.06s-1.911.283-3.718-.378c.197-.64.72-.408 1.51-.345a11.045 11.045 0 003.647-.394c.818-.234 1.892-.697 2.727-1.356.281.618.38 1.299.38 1.299s.219-.04.4.073c.173.106.299.326.213.895-.176 1.063-.628 1.926-1.387 2.72a5.714 5.714 0 01-1.666 1.244c-.34.18-.704.334-1.087.46-2.863.935-5.794-.093-6.739-2.3a3.545 3.545 0 01-.189-.522c-.403-1.455-.06-3.2 1.008-4.299.065-.07.132-.153.132-.256 0-.087-.055-.179-.102-.243-.374-.543-1.669-1.466-1.409-3.254.187-1.284 1.31-2.189 2.357-2.135.089.004.177.01.266.015.453.027.85.085 1.223.1.625.028 1.187-.063 1.853-.618.225-.187.405-.35.71-.401.028-.005.092-.028.215-.028zm.022 2.18a.42.42 0 00-.06.005c-.335.054-.347.468-.228 1.04.068.32.187.595.32.765.175-.02.343-.022.498 0 .089-.205.104-.557.024-.942-.112-.535-.261-.872-.554-.868zm-3.66 1.546a1.724 1.724 0 00-1.016.326c-.16.117-.311.28-.29.378.008.032.031.056.088.063.131.015.592-.217 1.122-.25.374-.023.684.094.923.2.239.104.386.173.443.113.037-.038.026-.11-.031-.204-.118-.192-.36-.387-.618-.497a1.601 1.601 0 00-.621-.129zm4.082.81c-.171-.003-.313.186-.317.42-.004.236.131.43.303.432.172.003.314-.185.318-.42.004-.236-.132-.429-.304-.432zm-3.58.172c-.05 0-.102.002-.155.008-.311.05-.483.152-.593.247-.094.082-.152.173-.152.237a.075.075 0 00.075.076c.07 0 .228-.063.228-.063a1.98 1.98 0 011.001-.104c.157.018.23.027.265-.026.01-.016.022-.049-.01-.1-.063-.103-.311-.269-.66-.275zm2.26.4c-.127 0-.235.051-.283.148-.075.154.035.363.246.466.21.104.443.063.52-.09.075-.155-.035-.364-.246-.467a.542.542 0 00-.237-.058zm-11.635.024c.048 0 .098 0 .149.003.73.04 1.806.6 2.052 2.19.217 1.41-.128 2.843-1.449 3.069-.123.02-.248.029-.374.026-1.22-.033-2.539-1.132-2.67-2.435-.145-1.44.591-2.548 1.894-2.811.117-.024.252-.04.398-.042zm-.07.927a1.144 1.144 0 00-.847.364c-.38.418-.439.988-.366 1.19.027.073.07.094.1.098.064.008.16-.039.22-.2a1.2 1.2 0 00.017-.052 1.58 1.58 0 01.157-.37.689.689 0 01.955-.199c.266.174.369.5.255.81-.058.161-.154.469-.133.721.043.511.357.717.64.738.274.01.466-.143.515-.256.029-.067.005-.107-.011-.125-.043-.053-.113-.037-.18-.021a.638.638 0 01-.16.022.347.347 0 01-.294-.148c-.078-.12-.073-.3.013-.504.011-.028.025-.058.04-.092.138-.308.368-.825.11-1.317-.195-.37-.513-.602-.894-.65a1.135 1.135 0 00-.138-.01z" />
    </svg>
  )
}
