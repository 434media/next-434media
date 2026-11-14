import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/admin/review/[id]: the founder's decision on one draft (V1 item 4, the proof slice). Founder only.
 * Body: { decision: "approved" | "rejected", shownHash, reasonCode, reason, send?: boolean }
 *
 * The decision binds the hash he was shown: a draft that changed since is refused. A reason is required. With
 * `send: true`, an approval is sent at once ("one tap"), through every control in lib/agent/send-email.ts; in the proof
 * slice only the test sink can receive.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFounder("POST /api/admin/review/[id]")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  let body: { decision?: unknown; shownHash?: unknown; reasonCode?: unknown; reason?: unknown; send?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const decision = body.decision === "approved" || body.decision === "rejected" ? body.decision : null
  if (!decision) return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 400 })
  if (typeof body.shownHash !== "string" || typeof body.reasonCode !== "string" || typeof body.reason !== "string") {
    return NextResponse.json({ error: "shownHash, reasonCode and reason are required" }, { status: 400 })
  }
  const { decideApproval, sendApproval } = await import("@/lib/agent/review-server")
  const { ApprovalBlocked } = await import("@/lib/send-approval")
  try {
    await decideApproval({ approvalId: id, decision, shownHash: body.shownHash, reasonCode: body.reasonCode, reason: body.reason })
  } catch (e) {
    if (e instanceof ApprovalBlocked || (e as Error)?.name === "LedgerRefused" || (e as Error)?.name === "DecisionRefused") return NextResponse.json({ error: (e as Error).message }, { status: 409 })
    console.error(`[POST /api/admin/review/${id}] decide`, e)
    return NextResponse.json({ error: "The decision could not be recorded" }, { status: 500 })
  }
  if (decision !== "approved" || body.send !== true) return NextResponse.json({ decided: decision })
  try {
    const sent = await sendApproval(id)
    return NextResponse.json({ decided: decision, sent }, { status: sent.sent ? 200 : 409 })
  } catch (e) {
    console.error(`[POST /api/admin/review/${id}] send`, e)
    return NextResponse.json({ decided: decision, error: "Approved, but the send failed before it reached the provider" }, { status: 500 })
  }
}
