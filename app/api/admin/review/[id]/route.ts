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
 * slice only the test sink can receive. After a send, the arrival leaves the People Inbox (closeArrivalAfterSend).
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
  const { decideApproval, sendApproval, closeArrivalLive } = await import("@/lib/agent/review-server")
  const { ApprovalBlocked } = await import("@/lib/send-approval")
  let approval: Awaited<ReturnType<typeof decideApproval>>
  try {
    approval = await decideApproval({ approvalId: id, decision, shownHash: body.shownHash, reasonCode: body.reasonCode, reason: body.reason })
  } catch (e) {
    if (e instanceof ApprovalBlocked || (e as Error)?.name === "LedgerRefused" || (e as Error)?.name === "DecisionRefused") return NextResponse.json({ error: (e as Error).message }, { status: 409 })
    console.error(`[POST /api/admin/review/${id}] decide`, e)
    return NextResponse.json({ error: "The decision could not be recorded" }, { status: 500 })
  }
  if (decision !== "approved" || body.send !== true) return NextResponse.json({ decided: decision })
  try {
    const sent = await sendApproval(id)
    // The reply is an Activity now (send-email.ts step 6); the arrival leaves the inbox right after, so it reads true.
    const { viewerOf } = await import("@/lib/core-model/route-helpers")
    const closed = sent.sent ? await closeArrivalLive(approval, auth.session.email, await viewerOf(auth.session)) : undefined
    return NextResponse.json({ decided: decision, sent, ...(closed ? { closed } : {}) }, { status: sent.sent ? 200 : 409 })
  } catch (e) {
    console.error(`[POST /api/admin/review/${id}] send`, e)
    return NextResponse.json({ decided: decision, error: "Approved, but the send failed before it reached the provider" }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/review/[id]: the founder's edit to a draft still waiting (one work area, 2026-11-16). Founder only.
 * Body: { shownHash, text }. The draft is re-hashed (lib/send-approval.ts reviseDraft) and the new hash returned; the
 * approval that follows must name it. Refused (409) once decided, expired, cancelled, or changed since it was shown.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFounder("PATCH /api/admin/review/[id]")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  let body: { shownHash?: unknown; text?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (typeof body.shownHash !== "string" || typeof body.text !== "string") return NextResponse.json({ error: "shownHash and text are required" }, { status: 400 })
  if (body.text.length > 8_000) return NextResponse.json({ error: "The reply is over 8,000 characters" }, { status: 400 })
  const { editDraft } = await import("@/lib/agent/review-server")
  const { reviewItem } = await import("@/lib/agent/review")
  const { ApprovalBlocked } = await import("@/lib/send-approval")
  try {
    const next = await editDraft({ approvalId: id, shownHash: body.shownHash, text: body.text })
    return NextResponse.json({ item: reviewItem(next, new Date().toISOString()) })
  } catch (e) {
    if (e instanceof ApprovalBlocked || (e as Error)?.name === "LedgerRefused") return NextResponse.json({ error: (e as Error).message }, { status: 409 })
    console.error(`[PATCH /api/admin/review/${id}]`, e)
    return NextResponse.json({ error: "The edit could not be saved" }, { status: 500 })
  }
}
