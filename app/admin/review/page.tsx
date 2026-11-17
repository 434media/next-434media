import { redirect } from "next/navigation"

// /admin/review is now "Waiting on you", the first tab of the People page (one work area, founder 2026-11-16): the
// drafts are decided where the arrival lives, and the Decided history is a filter there. The console moved to
// /admin/agents. Kept as a redirect so old links and the watchdog's email still land in the right place.
export default function ReviewPage() {
  redirect("/admin/people?tab=waiting")
}
