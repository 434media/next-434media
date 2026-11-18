import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * The kill switch (V1 item 4, the proof slice). Founder only.
 * GET  → the switch as stored.
 * POST { action: "stop" }   → stops everything: nothing new runs or sends; open tasks are cancelled, and any caught
 *                             mid-send go to a person.
 * POST { action: "resume" } → clears the stop; modes and send flags stay as they were.
 * POST { intakeMode?: "off" | "proof" | "draft", intakeSends?: boolean } → sets intake's mode and its send flag.
 * POST { ask: boolean } → turns the Ask panel on or off (lib/ask/). Off at merge; a stop turns it off too.
 */
export async function GET() {
  const auth = await requireFounder("GET /api/admin/agent/controls")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { readStoredControls } = await import("@/lib/agent/review-server")
  return NextResponse.json({ controls: await readStoredControls() })
}

export async function POST(req: Request) {
  const auth = await requireFounder("POST /api/admin/agent/controls")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: { action?: unknown; intakeMode?: unknown; intakeSends?: unknown; ask?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const server = await import("@/lib/agent/review-server")
  try {
    if (body.action === "stop") {
      const out = await server.stopAgents()
      console.warn(`[POST /api/admin/agent/controls] STOP: ${out.cancelled.length} cancelled, ${out.reconcile.length} to reconcile`)
      return NextResponse.json({ stopped: true, ...out, controls: await server.readStoredControls() })
    }
    const change: { intakeMode?: "off" | "proof" | "draft"; intakeSends?: boolean; ask?: boolean; resume?: boolean } = {}
    if (body.action === "resume") change.resume = true
    if (body.intakeMode === "off" || body.intakeMode === "proof" || body.intakeMode === "draft") change.intakeMode = body.intakeMode
    if (typeof body.intakeSends === "boolean") change.intakeSends = body.intakeSends
    if (typeof body.ask === "boolean") change.ask = body.ask
    if (!Object.keys(change).length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 })
    return NextResponse.json({ controls: await server.setControls(change) })
  } catch (e) {
    console.error("[POST /api/admin/agent/controls]", e)
    return NextResponse.json({ error: "The switch could not be changed" }, { status: 500 })
  }
}
