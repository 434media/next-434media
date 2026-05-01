"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AdminSidebar, type SidebarUser } from "./AdminSidebar"
import { AdminTopBar } from "./AdminTopBar"
import { CommandPalette } from "./CommandPalette"

interface AdminShellProps {
  user: SidebarUser & { picture?: string }
  onProfileUpdate?: (user: { name: string; email: string; picture?: string }) => void
  children: React.ReactNode
}

const COLLAPSED_KEY = "admin:sidebar-collapsed"

export function AdminShell({ user, onProfileUpdate, children }: AdminShellProps) {
  const pathname = usePathname() ?? ""
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLLAPSED_KEY)
      if (stored === "1") setCollapsed(true)
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [collapsed, hydrated])

  // Auto-close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900">
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        <AdminSidebar
          user={user}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full">
            <AdminSidebar
              user={user}
              collapsed={false}
              onToggleCollapsed={() => setCollapsed((c) => !c)}
              isMobile
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <AdminTopBar
          user={user}
          onOpenMobileSidebar={() => setMobileOpen(true)}
          onProfileUpdate={onProfileUpdate}
        />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Cmd+K palette — global, available on every admin page */}
      <CommandPalette />
    </div>
  )
}
