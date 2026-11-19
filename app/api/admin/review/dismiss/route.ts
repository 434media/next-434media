import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/admin/review/dismiss: **Dismiss: spam or solicitation** (founder, 2026-11-19). Founder only.
 * Body: { activityId: "contact_forms:<formId>", approvalId?, shownHash?, reason? }
 *
 * Sends nothing. Rejects the draft, if there is one, on the hash he was shown (reason code `solicitation`), or records
 * the decision for an arrival held with no draft; marks the submission spam; records the sender so their later
 * arrivals are held with no draft; and takes the arrival out of the inbox and To do (lib/agent/review-server.ts
 * dismissSolicitation). 409 when the decision is refused (decided, expired, changed, cancelled); 200 with `warnings`
 * when the decision is recorded but a later step failed.
 */
export async function POST(req: Request) {
  const auth = await requireFounder("POST /api/admin/review/dismiss")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: { activityId?: unknown; approvalId?: unknown; shownHash?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  if (typeof body.activityId !== "string" || !body.activityId.startsWith("contact_forms:")) {
    return NextResponse.json({ error: "activityId must name a website-form arrival" }, { status: 400 })
  }
  const opt = (v: unknown) => (typeof v === "string" && v ? v : undefined)
  if (body.approvalId !== undefined && !opt(body.approvalId)) return NextResponse.json({ error: "approvalId must be a string" }, { status: 400 })
  if (opt(body.approvalId) && !opt(body.shownHash)) return NextResponse.json({ error: "shownHash is required with approvalId" }, { status: 400 })
  if (typeof body.reason === "string" && body.reason.length > 1000) return NextResponse.json({ error: "The reason is over 1,000 characters" }, { status: 400 })
  const { dismissSolicitationLive } = await import("@/lib/agent/review-server")
  const { ApprovalBlocked } = await import("@/lib/send-approval")
  const { viewerOf } = await import("@/lib/core-model/route-helpers")
  try {
    const out = await dismissSolicitationLive(
      { activityId: body.activityId, approvalId: opt(body.approvalId), shownHash: opt(body.shownHash), reason: opt(body.reason), actor: auth.session.email },
      await viewerOf(auth.session),
    )
    return NextResponse.json(out)
  } catch (e) {
    if (e instanceof ApprovalBlocked || (e as Error)?.name === "LedgerRefused" || (e as Error)?.name === "DecisionRefused") return NextResponse.json({ error: (e as Error).message }, { status: 409 })
    console.error("[POST /api/admin/review/dismiss]", e)
    return NextResponse.json({ error: "The dismissal could not be recorded" }, { status: 500 })
  }
}
