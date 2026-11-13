import { type NextRequest, NextResponse } from "next/server"
import { requireFullAdmin } from "@/lib/auth"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { mergePeople } from "@/lib/core-model/service"
import { coreErrorResponse, optString, readJson } from "@/lib/core-model/route-helpers"

export const runtime = "nodejs"

// POST /api/admin/core/people/:id/merge { absorb_id } — the only way two People become one (spec rule 1): an
// explicit action by a full admin, logged in crm_merges. The absorbed Person is kept, marked merged_into, never
// deleted; its emails point at the kept Person; a withdrawal of consent on either side holds.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFullAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  const body = await readJson(request)
  const absorbId = optString(body?.absorb_id, 200)
  if (!absorbId) return NextResponse.json({ error: "absorb_id is required" }, { status: 400 })
  try {
    const kept = await mergePeople(firestoreCoreStore, decodeURIComponent(id), absorbId, auth.session.email)
    return NextResponse.json({ success: true, data: kept })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/people/:id/merge", error)
  }
}
