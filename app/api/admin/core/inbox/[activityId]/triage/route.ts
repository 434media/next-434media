import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getVisibleCoreView } from "@/lib/core-model/read"
import { firestoreCoreStore, firestoreLeadPath } from "@/lib/core-model/firestore-store"
import { triageActivity } from "@/lib/core-model/service"
import { coreErrorResponse, readJson, viewerOf } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { pendingArrivals } from "@/lib/google-contacts/server"
import { TRIAGE_DECISIONS, type TriageDecision } from "@/types/core-model"

export const runtime = "nodejs"

// POST /api/admin/core/inbox/:activityId/triage { decision: "promote" | "save" | "dismiss", relationship? }
//   promote — the Person's stage moves to lead and the lead is created through the existing lead path. A personal
//             contact becomes business at that moment; only the founder can promote one;
//   save    — kept as a contact, `personal` or `business` (a phone arrival defaults to what it came with). Only the
//             founder saves a personal contact;
//   dismiss — taken out of the inbox. A Google Contacts entry that is dismissed is never stored: its waiting entry is
//             removed and the contact stays on the phone.
// Nothing is written to an old collection except the lead the existing path creates on promote.
export async function POST(request: NextRequest, ctx: { params: Promise<{ activityId: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { activityId } = await ctx.params
  const body = await readJson(request)
  const decision = body?.decision as TriageDecision
  if (!TRIAGE_DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "decision must be promote, save or dismiss" }, { status: 400 })
  }
  try {
    // The view may be up to 30 s old; triageActivity re-reads the triage record, and the record is created
    // with `create`, so an item someone else just triaged is refused (409), never triaged twice.
    const viewer = await viewerOf(auth.session)
    const view = await getVisibleCoreView(viewer)
    const activity = view.activities.find((a) => a.id === decodeURIComponent(activityId))
    if (!activity) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const relationship = body?.relationship === "personal" || body?.relationship === "business" ? body.relationship : undefined
    const result = await triageActivity(
      firestoreCoreStore,
      firestoreLeadPath,
      { activity, decision, actor: auth.session.email, founder: viewer.founder === true, relationship },
      await listIcpCohorts(),
      pendingArrivals,
    )
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/inbox/:activityId/triage", error)
  }
}
