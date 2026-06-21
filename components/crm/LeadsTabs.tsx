"use client"

import Link from "next/link"
import { Flag, Target } from "lucide-react"
import type { ReactNode } from "react"

// Shared sticky header for the Leads section so /admin/leads and
// /admin/leads/prospect read as one workflow (find prospects → work leads)
// rather than two separate pages. Symmetric two-way nav replaces the old
// asymmetric "Find prospects" button ⇄ back-arrow. `right` is a per-page slot
// (e.g. the Apollo budget indicator on Prospect).
interface LeadsTabsProps {
  active: "leads" | "prospect"
  right?: ReactNode
}

const TABS = [
  { key: "leads", label: "Leads", href: "/admin/leads", icon: Flag },
  { key: "prospect", label: "Prospect", href: "/admin/leads/prospect", icon: Target },
] as const

export function LeadsTabs({ active, right }: LeadsTabsProps) {
  return (
    <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-neutral-200/70">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 h-14">
        <nav className="flex items-center gap-1" aria-label="Leads section">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = t.key === active
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </Link>
            )
          })}
        </nav>
        {right && <div className="flex items-center gap-2 min-w-0">{right}</div>}
      </div>
    </div>
  )
}
