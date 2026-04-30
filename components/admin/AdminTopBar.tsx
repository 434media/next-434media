"use client"

import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { AdminUserMenu } from "@/components/AdminUserMenu"

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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function AdminTopBar({ user, onOpenMobileSidebar, onProfileUpdate }: AdminTopBarProps) {
  const pathname = usePathname() ?? "/admin"
  const label = getPageLabel(pathname)

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

      <div className="shrink-0">
        <AdminUserMenu user={user} greeting={getGreeting()} onProfileUpdate={onProfileUpdate} />
      </div>
    </header>
  )
}
