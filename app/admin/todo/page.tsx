"use client"

import { AdminRoleGuard } from "@/components/AdminRoleGuard"
import { PeopleWorkspace } from "@/components/admin/people/PeopleWorkspace"

// /admin/todo — To do: everything waiting on the viewer, drafts to approve and arrivals to decide (founder, 2026-11-17:
// its own page, first in the sidebar and the first screen after sign-in). A view over the approval records and the
// People Inbox, never a store of its own (one work area, build sequence V1 item 4). Display Standard §3.14 (Provisional).

export default function TodoPage() {
  return (
    <AdminRoleGuard allowedRoles={["full_admin", "crm_only", "intern"]}>
      <PeopleWorkspace view="todo" />
    </AdminRoleGuard>
  )
}
