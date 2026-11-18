"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AdminSidebar, type SidebarUser } from "./AdminSidebar"
import { AdminTopBar } from "./AdminTopBar"
import { CommandPalette } from "./CommandPalette"
import { AskPanel, type AskStatus } from "./ask/AskPanel"

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
  // The Ask panel (V1 item 4, Ask panel slice 1): offered to whoever it is on for, and to the founder so he can find the
  // switch while it is off. Nobody else sees the button.
  const [askOpen, setAskOpen] = useState(false)
  const [askStatus, setAskStatus] = useState<AskStatus | null>(null)
  const askOffered = !!askStatus && ((askStatus.on && askStatus.permitted) || askStatus.founder)

  useEffect(() => {
    let live = true
    fetch("/api/admin/ask", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: AskStatus | null) => {
        if (live && s && typeof s.on === "boolean") setAskStatus(s)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // ⌘J / Ctrl+J opens Ask; ⌘K stays the command palette.
  useEffect(() => {
    if (!askOffered) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault()
        setAskOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [askOffered])
  const openAsk = useCallback(() => setAskOpen(true), [])
  const closeAsk = useCallback(() => setAskOpen(false), [])

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
          onAsk={askOffered ? openAsk : undefined}
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
              onAsk={askOffered ? openAsk : undefined}
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

      {/* Ask (⌘J): always mounted, so the conversation survives closing the panel and moving between admin pages */}
      <AskPanel open={askOpen} onClose={closeAsk} status={askStatus} />
    </div>
  )
}
