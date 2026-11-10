import { NextResponse, type NextRequest } from "next/server"
import { requireFounder } from "@/lib/founder-guard"
import { readSnapshot } from "@/lib/quickbooks-server"

export const runtime = "nodejs"

const NO_STORE = { "cache-control": "private, no-store" }

// The finance snapshot (V1 item 1, Phase 1), founder only. Reads QuickBooks when the page opens, with a two-minute
// cache; `?fresh=1` re-reads. Reads only: nothing is written to QuickBooks or stored here (lib/quickbooks-server.ts).
export async function GET(req: NextRequest) {
  const auth = await requireFounder("GET /api/admin/finance")
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE })
  }
  const result = await readSnapshot(req.nextUrl.origin, { fresh: req.nextUrl.searchParams.get("fresh") === "1" })
  switch (result.state) {
    case "ok":
      return NextResponse.json({ quickbooks: { connected: true, cached: result.cached }, snapshot: result.snapshot }, { headers: NO_STORE })
    case "not_configured":
      // Names of the missing settings only, never values.
      return NextResponse.json({ quickbooks: { connected: false, configured: false, missing: result.missing } }, { headers: NO_STORE })
    case "not_connected":
      return NextResponse.json({ quickbooks: { connected: false, configured: true } }, { headers: NO_STORE })
    case "reconnect":
      return NextResponse.json({ quickbooks: { connected: false, configured: true, reconnect: true }, error: result.message }, { headers: NO_STORE })
    case "error":
      return NextResponse.json({ quickbooks: { connected: true }, error: result.message }, { status: 502, headers: NO_STORE })
  }
}
