"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { SettingsShell } from "@/components/crm/settings/SettingsShell"
import type { CurrentUser } from "@/components/crm/types"

export default function CrmSettingsPage() {
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((body) => {
        if (body?.authenticated && body?.user) setUser(body.user as CurrentUser)
      })
      .catch(() => {})
  }, [])

  return (
    <AdminRoleGuard allowedRoles={["crm_super_admin"]}>
      {user ? (
        <SettingsShell currentUser={user} />
      ) : (
        <div className="flex items-center justify-center py-16 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading…
        </div>
      )}
    </AdminRoleGuard>
  )
}
