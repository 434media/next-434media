import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"

/**
 * GET /api/admin/review: the founder-review queue and the console (V1 item 4, the proof slice). Founder only. Read fresh
 * on every request; nothing here is cached.
 */
export async function GET() {
  const auth = await requireFounder("GET /api/admin/review")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { readConsole } = await import("@/lib/agent/review-server")
    return NextResponse.json(await readConsole())
  } catch (e) {
    console.error("[GET /api/admin/review]", e)
    return NextResponse.json({ error: "The queue could not be read" }, { status: 500 })
  }
}
