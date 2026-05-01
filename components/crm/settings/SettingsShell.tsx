"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { ShieldCheck, Users, Target } from "lucide-react"
import { TeamMembersTab } from "./TeamMembersTab"
import { GoalsTab } from "./GoalsTab"
import type { CurrentUser } from "../types"

interface SettingsShellProps {
  currentUser: CurrentUser
}

type TabKey = "team" | "goals"
const VALID_TABS = new Set<TabKey>(["team", "goals"])

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "team", label: "Team members", icon: Users },
  { key: "goals", label: "Goals", icon: Target },
]

export function SettingsShell({ currentUser }: SettingsShellProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const initialTab = (searchParams?.get("tab") as TabKey) ?? "team"
  const [activeTab, setActiveTab] = useState<TabKey>(VALID_TABS.has(initialTab) ? initialTab : "team")

  // Keep ?tab= in sync with state, and react to back/forward URL changes.
  useEffect(() => {
    const urlTab = searchParams?.get("tab") as TabKey | null
    if (urlTab && VALID_TABS.has(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const switchTab = (next: TabKey) => {
    setActiveTab(next)
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("tab", next)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-5xl">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">CRM Settings</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl">
            Configuration that used to require a developer. Changes here are visible immediately to
            everyone on the CRM.
          </p>
        </header>

        {/* Tab nav */}
        <div className="flex gap-1 border-b border-neutral-200 mb-6">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => switchTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  active
                    ? "text-neutral-900 border-neutral-900"
                    : "text-neutral-500 border-transparent hover:text-neutral-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {activeTab === "team" && <TeamMembersTab currentUser={currentUser} />}
        {activeTab === "goals" && <GoalsTab />}
      </div>
    </div>
  )
}
