import type { Metadata } from "next"
import { forbidden } from "next/navigation"
import RefreshWhenSignedIn from "@/components/admin/RefreshWhenSignedIn"
import { AgentsConsole } from "@/components/admin/agents/AgentsConsole"
import { founderPageAccess } from "@/lib/founder-guard"

// The Agents page (V1 item 4; one work area, founder 2026-11-16): the kill switch, intake's mode and send flag, the pin,
// the exams and the console, moved here from /admin/review. Founder only, guarded here on the server before anything
// renders; the console loads from GET /api/admin/review, which runs the same guard. Drafts are decided in "Waiting on
// you" on the People page.
export const metadata: Metadata = {
  title: "Agents",
  robots: { index: false, follow: false },
}

export default async function AgentsPage() {
  const access = await founderPageAccess("/admin/agents")
  if (access === "signed_out") return <RefreshWhenSignedIn />
  if (access === "forbidden") forbidden()
  return <AgentsConsole />
}
