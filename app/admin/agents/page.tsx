import { Suspense } from "react"
import type { Metadata } from "next"
import { forbidden } from "next/navigation"
import RefreshWhenSignedIn from "@/components/admin/RefreshWhenSignedIn"
import { AgentsConsole } from "@/components/admin/agents/AgentsConsole"
import { SkillsFrame, SkillsList } from "@/components/admin/agents/SkillsList"
import { founderPageAccess } from "@/lib/founder-guard"

// The Agents page (V1 item 4; one work area, founder 2026-11-16): the kill switch, intake's mode and send flag, the pin,
// the exams and the console, moved here from /admin/review. Founder only, guarded here on the server before anything
// renders; the console loads from GET /api/admin/review, which runs the same guard. Drafts are decided in "Waiting on
// you" on the People page. Below the console, the Skills list (founder 2026-11-19: "Approve"): the generated catalog,
// read here on the server after the guard, through the read-only GitHub App. Display only.
export const metadata: Metadata = {
  title: "Agents",
  robots: { index: false, follow: false },
}

async function Skills() {
  const { readSkillCatalog } = await import("@/lib/skills/catalog-view")
  try {
    const { skills, commit } = await readSkillCatalog()
    return <SkillsList skills={skills} commit={commit} />
  } catch (e) {
    console.error("[/admin/agents] skills catalog", e)
    return (
      <SkillsFrame>
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          The skills catalog could not be read: {e instanceof Error ? e.message : "unknown error"}
        </p>
      </SkillsFrame>
    )
  }
}

export default async function AgentsPage() {
  const access = await founderPageAccess("/admin/agents")
  if (access === "signed_out") return <RefreshWhenSignedIn />
  if (access === "forbidden") forbidden()
  return (
    <AgentsConsole
      skills={
        <Suspense fallback={<SkillsFrame><p className="text-sm text-neutral-500">Loading…</p></SkillsFrame>}>
          <Skills />
        </Suspense>
      }
    />
  )
}
