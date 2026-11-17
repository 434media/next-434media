import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/admin/review/[id]/send: sends a draft already approved (a scheduled one whose time has come, or one whose
 * send was stopped by the kill switch before it was claimed). Founder only. Every control in lib/agent/send-email.ts
 * applies; an approval that was used, expired, changed or stopped after its intent never sends. After a send, the
 * arrival leaves the People Inbox.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireFounder("POST /api/admin/review/[id]/send")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await ctx.params
  try {
    const { sendApproval, closeArrivalLive, readApproval } = await import("@/lib/agent/review-server")
    const sent = await sendApproval(id)
    // As on Approve and send: the arrival leaves the People Inbox once its reply has gone.
    let closed
    if (sent.sent) {
      const approval = await readApproval(id)
      const { viewerOf } = await import("@/lib/core-model/route-helpers")
      if (approval) closed = await closeArrivalLive(approval, auth.session.email, await viewerOf(auth.session))
    }
    return NextResponse.json({ sent, ...(closed ? { closed } : {}) }, { status: sent.sent ? 200 : 409 })
  } catch (e) {
    console.error(`[POST /api/admin/review/${id}/send]`, e)
    return NextResponse.json({ error: "The send could not be started" }, { status: 500 })
  }
}
