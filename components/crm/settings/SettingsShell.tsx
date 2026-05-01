"use client"

import { ShieldCheck } from "lucide-react"
import { TeamMembersTab } from "./TeamMembersTab"
import type { CurrentUser } from "../types"

interface SettingsShellProps {
  currentUser: CurrentUser
}

export function SettingsShell({ currentUser }: SettingsShellProps) {
  return (
    <div className="min-h-full bg-neutral-50 text-neutral-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 max-w-5xl">
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

        <TeamMembersTab currentUser={currentUser} />
      </div>
    </div>
  )
}
