"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Rocket,
  Inbox,
  BarChart3,
  Layers,
  ClipboardList,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  Home,
  Settings,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type AdminRole = "crm_super_admin" | "full_admin" | "crm_only"

// Hardcoded super-admin fallback — kept in sync with lib/auth.ts CRM_SUPER_ADMIN_FALLBACK.
// Used so the sidebar can render the Settings entry without an async Firestore lookup.
const SUPER_ADMIN_EMAILS = ["marcos@434media.com", "jesse@434media.com"]

export interface SidebarUser {
  email: string
  name: string
  role?: AdminRole
}

interface SidebarItemBase {
  id: string
  label: string
  icon: LucideIcon
  roles: AdminRole[]
}

interface SidebarLink extends SidebarItemBase {
  href: string
  matchPrefix?: string
  children?: never
}

interface SidebarGroup extends SidebarItemBase {
  href?: never
  matchPrefix: string
  children: { id: string; label: string; href: string; matchPrefix?: string }[]
}

type SidebarEntry = SidebarLink | SidebarGroup

const SIDEBAR_ITEMS: SidebarEntry[] = [
  {
    id: "crm",
    label: "CRM",
    icon: Rocket,
    href: "/admin/crm",
    matchPrefix: "/admin/crm",
    roles: ["full_admin", "crm_only"],
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/admin/analytics",
    matchPrefix: "/admin/analytics",
    roles: ["full_admin"],
  },
  {
    id: "submissions",
    label: "Submissions",
    icon: Inbox,
    href: "/admin/leads",
    matchPrefix: "/admin/leads",
    roles: ["full_admin"],
  },
  {
    id: "content",
    label: "Content",
    icon: Layers,
    matchPrefix: "/admin/feed-form|/admin/blog",
    roles: ["full_admin"],
    children: [
      { id: "feed", label: "Feed", href: "/admin/feed-form", matchPrefix: "/admin/feed-form" },
      { id: "blog", label: "Blog", href: "/admin/blog", matchPrefix: "/admin/blog" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    icon: ClipboardList,
    href: "/admin/project-management",
    matchPrefix: "/admin/project-management",
    roles: ["full_admin"],
  },
  {
    id: "sops",
    label: "SOPs",
    icon: FileText,
    href: "/admin/sops",
    matchPrefix: "/admin/sops",
    roles: ["full_admin"],
  },
]

// Footer-pinned items render below "Back to site" — for configuration surfaces
// that aren't part of daily navigation. Same role-gating rules as primary items.
const FOOTER_ITEMS: SidebarLink[] = [
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/admin/crm/settings",
    matchPrefix: "/admin/crm/settings",
    roles: ["crm_super_admin"],
  },
]

function isActive(pathname: string, matchPrefix: string): boolean {
  return matchPrefix.split("|").some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

interface AdminSidebarProps {
  user: SidebarUser
  collapsed: boolean
  onToggleCollapsed: () => void
  /** Mobile: full overlay sidebar; otherwise a fixed rail */
  isMobile?: boolean
  onNavigate?: () => void
}

export function AdminSidebar({
  user,
  collapsed,
  onToggleCollapsed,
  isMobile,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname() ?? ""
  // Effective role: session role takes precedence; super-admin fallback ensures
  // Marcos and Jesse always see Settings even before their session role is upgraded.
  const baseRole: AdminRole = user.role ?? "crm_only"
  const effectiveRole: AdminRole =
    SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()) ? "crm_super_admin" : baseRole
  const role = effectiveRole
  // Super-admins see everything full_admins see, plus super-admin-only items.
  const grantedRoles: AdminRole[] =
    role === "crm_super_admin" ? ["crm_super_admin", "full_admin", "crm_only"] : [role]
  const items = SIDEBAR_ITEMS.filter((i) => i.roles.some((r) => grantedRoles.includes(r)))
  const footerItems = FOOTER_ITEMS.filter((i) => i.roles.some((r) => grantedRoles.includes(r)))

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const out: Record<string, boolean> = {}
    for (const item of items) {
      if ("children" in item && item.children) {
        out[item.id] = isActive(pathname, item.matchPrefix)
      }
    }
    return out
  })

  const showLabels = isMobile || !collapsed

  return (
    <aside
      className={`flex flex-col h-full bg-white border-r border-neutral-200 transition-[width] duration-150 ${
        isMobile ? "w-64" : collapsed ? "w-14" : "w-56"
      }`}
    >
      {/* Brand row */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-neutral-200 shrink-0">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-neutral-900 font-ggx88 text-sm tracking-wide"
          onClick={onNavigate}
        >
          <span className="w-7 h-7 rounded-md bg-neutral-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
            434
          </span>
          {showLabels && <span className="truncate">ADMIN</span>}
        </Link>
        {!isMobile && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const matchPrefix = "matchPrefix" in item && item.matchPrefix ? item.matchPrefix : item.href ?? ""
          const active = isActive(pathname, matchPrefix)

          if ("children" in item && item.children) {
            const isOpen = openGroups[item.id] ?? active
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed && !isMobile) {
                      onToggleCollapsed()
                      setOpenGroups((s) => ({ ...s, [item.id]: true }))
                      return
                    }
                    setOpenGroups((s) => ({ ...s, [item.id]: !isOpen }))
                  }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-neutral-100 text-neutral-900"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
                  }`}
                  title={!showLabels ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {showLabels && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${
                          isOpen ? "rotate-0" : "-rotate-90"
                        }`}
                      />
                    </>
                  )}
                </button>
                {showLabels && isOpen && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = isActive(pathname, child.matchPrefix ?? child.href)
                      return (
                        <Link
                          key={child.id}
                          href={child.href}
                          onClick={onNavigate}
                          className={`flex items-center px-2 py-1 rounded-md text-[12px] transition-colors ${
                            childActive
                              ? "bg-neutral-100 text-neutral-900 font-semibold"
                              : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                          }`}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={onNavigate}
              title={!showLabels ? item.label : undefined}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                active
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {showLabels && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer-pinned items (configuration surfaces) */}
      {footerItems.length > 0 && (
        <div className="px-2 pt-2 pb-1 border-t border-neutral-200 space-y-0.5">
          {footerItems.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item.matchPrefix ?? item.href)
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                title={!showLabels ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {showLabels && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </div>
      )}

      {/* Back to public site */}
      <div className="px-2 pb-2 pt-1">
        <Link
          href="/"
          onClick={onNavigate}
          title={!showLabels ? "Back to site" : undefined}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[12px] font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          <Home className="w-4 h-4 shrink-0" />
          {showLabels && (
            <>
              <span className="flex-1 truncate">Back to site</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-neutral-300" />
            </>
          )}
        </Link>
      </div>

      {/* User identity footer */}
      {showLabels && (
        <div className="px-3 py-2 border-t border-neutral-200 text-[10px] text-neutral-400">
          <span className="block truncate">{user.email}</span>
          <span className="uppercase tracking-wider">{role.replace("_", " ")}</span>
        </div>
      )}
    </aside>
  )
}

