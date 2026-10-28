import { NextResponse } from "next/server"
import { requireFounder } from "@/lib/founder-guard"

export const runtime = "nodejs"

// The finance API (V1 item 1), founder only. Phase 0 proves the gate and returns no money data: Phase 1 adds the
// QuickBooks snapshot behind the same requireFounder call.
export async function GET() {
  const auth = await requireFounder("GET /api/admin/finance")
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "cache-control": "private, no-store" } })
  }
  return NextResponse.json({ quickbooks: { connected: false } }, { headers: { "cache-control": "private, no-store" } })
}
