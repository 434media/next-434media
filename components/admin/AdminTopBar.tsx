"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Menu, Search } from "lucide-react"
import { NotificationsPopover } from "./NotificationsPopover"
import { UserMenu } from "./UserMenu"

interface AdminUser {
  email: string
  name: string
  picture?: string
}

interface AdminTopBarProps {
  user: AdminUser
  onOpenMobileSidebar: () => void
  onProfileUpdate?: (user: AdminUser) => void
}

const ROUTE_LABELS: Array<{ match: string | RegExp; label: string }> = [
  { match: "/admin/crm", label: "CRM" },
  { match: "/admin/leads", label: "Leads & Registrations" },
  { match: "/admin/analytics-web", label: "Analytics · Web" },
  { match: "/admin/analytics-instagram", label: "Analytics · Instagram" },
  { match: "/admin/analytics-mailchimp", label: "Analytics · Mailchimp" },
  { match: "/admin/analytics-linkedin", label: "Analytics · LinkedIn" },
  { match: "/admin/analytics", label: "Analytics" },
  { match: "/admin/feed-form", label: "Content · Feed" },
  { match: "/admin/blog", label: "Content · Blog" },
  { match: "/admin/project-management", label: "Project Management" },
  { match: "/admin/sops", label: "SOPs" },
  { match: "/admin/events", label: "Events" },
  { match: "/admin/more-human-than-human", label: "MHTH 2026" },
  { match: "/admin", label: "Admin" },
]

function getPageLabel(pathname: string): string {
  for (const entry of ROUTE_LABELS) {
    if (typeof entry.match === "string") {
      if (pathname === entry.match || pathname.startsWith(`${entry.match}/`)) return entry.label
    } else if (entry.match.test(pathname)) {
      return entry.label
    }
  }
  return "Admin"
}

export function AdminTopBar({ user, onOpenMobileSidebar, onProfileUpdate }: AdminTopBarProps) {
  const pathname = usePathname() ?? "/admin"
  const label = getPageLabel(pathname)
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform))
  }, [])

  // Synthesize a Cmd+K keypress so the global handler in CommandPalette opens it.
  // Avoids a parent-child binding contract while keeping the click affordance.
  const triggerCommandPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: isMac, ctrlKey: !isMac, bubbles: true }),
    )
  }

  return (
    <header className="h-14 shrink-0 border-b border-neutral-200 bg-white flex items-center justify-between px-3 sm:px-5 gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          aria-label="Open navigation"
          className="md:hidden p-1.5 rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="font-ggx88 text-[15px] sm:text-base text-neutral-900 tracking-wide truncate">
          {label}
        </h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={triggerCommandPalette}
          aria-label="Open command palette"
          title={`Open command palette (${isMac ? "⌘" : "Ctrl"}+K)`}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200 transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 bg-neutral-50 border border-neutral-200 rounded">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>

        {/* Mobile-only icon search trigger */}
        <button
          type="button"
          onClick={triggerCommandPalette}
          aria-label="Open command palette"
          className="sm:hidden p-2 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
        >
          <Search className="w-4 h-4" />
        </button>

        <NotificationsPopover />
        <UserMenu user={user} onProfileUpdate={onProfileUpdate} />
      </div>
    </header>
  )
}
