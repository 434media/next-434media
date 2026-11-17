import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { firestoreCoreStore, firestoreLeadPath } from "@/lib/core-model/firestore-store"
import { undoTriage } from "@/lib/core-model/service"
import { coreErrorResponse, viewerOf } from "@/lib/core-model/route-helpers"

export const runtime = "nodejs"

// POST /api/admin/core/inbox/:activityId/triage/undo — the Undo on the triage toast (founder, 2026-11-16). Within a
// short window, by the person who decided (or the founder): the activity returns to the inbox, the Person's stage and
// relationship go back, and a lead the triage created through the lead path is removed. A lead that already existed
// is left alone. The service decides every refusal (lib/core-model/service.ts undoTriage).
export async function POST(_request: NextRequest, ctx: { params: Promise<{ activityId: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { activityId } = await ctx.params
  try {
    const viewer = await viewerOf(auth.session)
    const result = await undoTriage(firestoreCoreStore, firestoreLeadPath, {
      activityId: decodeURIComponent(activityId),
      actor: auth.session.email,
      founder: viewer.founder === true,
    })
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/inbox/:activityId/triage/undo", error)
  }
}
