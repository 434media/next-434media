import { redirect } from "next/navigation"

export default function MhthRedirect() {
  // MHTH 2026 has concluded. Registrations are surfaced under Audiences > Events.
  redirect("/admin/audiences?sub=events&event=MoreHumanThanHuman2026")
}
