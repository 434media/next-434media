import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * POST /api/admin/agent/poli: runs Polí's rule pass once, now (V1 item 4, Polí slice 1). Founder only. The same pass
 * the `agent-sweep` cron runs every 10 minutes (lib/agent/poli-server.ts), under the same switch: `off` writes nothing,
 * `proof` only reports, `draft` raises founder-owned tasks with their ledger entries. Rules only; no model call.
 */
export async function POST() {
  const auth = await requireFounder("POST /api/admin/agent/poli")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { runPoliPassLive, summarize } = await import("@/lib/agent/poli-server")
    const r = await runPoliPassLive()
    return NextResponse.json({ message: summarize(r), mode: r.mode, raised: r.raised.length, handled: r.handled.length, held: r.held, skipped: r.skipped, note: r.note ?? null })
  } catch (e) {
    console.error("[POST /api/admin/agent/poli]", e)
    return NextResponse.json({ error: "Polí's pass could not run" }, { status: 500 })
  }
}
