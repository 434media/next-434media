import { redirect } from "next/navigation"

// /admin/review is now To do (/admin/todo; one work area, founder 2026-11-16 and 2026-11-17): the drafts are decided
// where the arrival lives, and the Decided history is a filter there. The console moved to /admin/agents. Kept as a
// redirect so old links and the watchdog's email still land in the right place.
export default function ReviewPage() {
  redirect("/admin/todo")
}
