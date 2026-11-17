import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"

/**
 * GET /api/admin/review/waiting: "Waiting on you" on the People page (one work area, 2026-11-16), a view over the
 * approval records with the arrival each draft answers. Founder only, as every draft is his to decide. Read fresh.
 */
export async function GET() {
  const auth = await requireFounder("GET /api/admin/review/waiting")
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const { readWaiting } = await import("@/lib/agent/review-server")
    const { viewerOf } = await import("@/lib/core-model/route-helpers")
    return NextResponse.json(await readWaiting(await viewerOf(auth.session)))
  } catch (e) {
    console.error("[GET /api/admin/review/waiting]", e)
    return NextResponse.json({ error: "Waiting on you could not be read" }, { status: 500 })
  }
}
