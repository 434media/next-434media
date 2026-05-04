import { redirect } from "next/navigation"

export default function MhthRedirect() {
  // MHTH 2026 has concluded. Registrations are surfaced under Submissions.
  redirect("/admin/submissions?tab=events&event=MoreHumanThanHuman2026")
}
