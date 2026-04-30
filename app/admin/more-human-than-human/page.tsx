import { redirect } from "next/navigation"

export default function MhthRedirect() {
  // MHTH 2026 has concluded. Registrations are surfaced under Leads & Registrations.
  redirect("/admin/leads?tab=events&event=MoreHumanThanHuman2026")
}
