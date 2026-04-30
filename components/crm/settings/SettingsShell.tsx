"use client"

import { useState } from "react"
import { Users, Database, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { TeamMembersTab } from "./TeamMembersTab"
import { DataExportsTab } from "./DataExportsTab"
import type { CurrentUser } from "../types"

type TabId = "team-members" | "data-exports"

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon; description: string }> = [
  {
    id: "team-members",
    label: "Team Members",
    icon: Users,
    description: "Manage who has access and at what level. Super-admin only.",
  },
  {
    id: "data-exports",
    label: "Data & Migrations",
    icon: Database,
    description: "Run the unified-tasks migration and other one-off data operations.",
  },
]

interface SettingsShellProps {
  currentUser: CurrentUser
}

export function SettingsShell({ currentUser }: SettingsShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>("team-members")

  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-6xl">
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-violet-600" />
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">CRM Settings</h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-violet-50 text-violet-700 border border-violet-200 uppercase tracking-wider">
              Super Admin
            </span>
          </div>
          <p className="text-[13px] text-neutral-500 leading-relaxed max-w-2xl">
            Configuration that used to require a developer. Changes here are visible immediately to
            everyone on the CRM.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          {/* Left rail */}
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors text-left whitespace-nowrap ${
                    active
                      ? "bg-neutral-900 text-white"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Right pane */}
          <main className="min-w-0">
            {activeTab === "team-members" && <TeamMembersTab currentUser={currentUser} />}
            {activeTab === "data-exports" && <DataExportsTab currentUser={currentUser} />}
          </main>
        </div>
      </div>
    </div>
  )
}
