"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { LogOut, User, ChevronDown } from "lucide-react"
import { ProfileEditDrawer } from "./ProfileEditDrawer"

interface AdminUser {
  email: string
  name: string
  picture?: string
}

interface UserMenuProps {
  user: AdminUser
  onProfileUpdate?: (user: AdminUser) => void
}

export function UserMenu({ user, onProfileUpdate }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" })
    } catch (err) {
      console.error("Failed to logout:", err)
    } finally {
      window.location.href = "/admin"
    }
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || "?"

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Account menu for ${user.name}`}
          className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md hover:bg-neutral-100 transition-colors"
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover border border-neutral-200"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-semibold flex items-center justify-center">
              {initial}
            </div>
          )}
          <ChevronDown className={`w-3 h-3 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-11 w-64 bg-white rounded-xl shadow-2xl border border-neutral-200 overflow-hidden z-50"
              role="menu"
            >
              {/* Identity */}
              <div className="px-4 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover border border-neutral-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-neutral-900 text-white text-sm font-semibold flex items-center justify-center">
                      {initial}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{user.name}</p>
                    <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setOpen(false)
                    setDrawerOpen(true)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  role="menuitem"
                >
                  <User className="w-4 h-4 text-neutral-400" />
                  Edit profile
                </button>
              </div>

              <div className="border-t border-neutral-100 py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfileEditDrawer
        open={drawerOpen}
        user={user}
        onClose={() => setDrawerOpen(false)}
        onProfileUpdate={onProfileUpdate}
      />
    </>
  )
}
