"use client"

import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { PeopleWorkspace } from "@/components/admin/people/PeopleWorkspace"

// /admin/people — the core data model's first surface (V1 item 4): the Inbox (every arrival not yet triaged, as
// a view of activities), People (one per email) and Organizations (one per domain, with fit and grade). The old
// /admin/inbox was retired 2026-11-17 and redirects here. Display Standard §3.14 (Provisional).

export default function PeoplePage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <PeopleWorkspace />
    </AdminRoleGuard>
  )
}
