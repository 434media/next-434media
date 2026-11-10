import { NextResponse, type NextRequest } from "next/server"
import { requireFounder } from "@/lib/founder-guard"
import { completeConnect, QbError } from "@/lib/quickbooks"
import { clearSnapshotCache, qbDeps, qbSetup, takeConnectState } from "@/lib/quickbooks-server"

export const runtime = "nodejs"

// Intuit's redirect after consent: the state is consumed once, must be unexpired and started by the same founder,
// then the code is exchanged and the sealed tokens stored. Every outcome lands on the finance page with a short code.
export async function GET(req: NextRequest) {
  const auth = await requireFounder("GET /api/admin/finance/quickbooks/callback")
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "cache-control": "private, no-store" } })
  }
  const back = (code: string) => NextResponse.redirect(new URL(`/admin/finance?quickbooks=${code}`, req.nextUrl.origin), 303)
  const setup = qbSetup(req.nextUrl.origin)
  if (!setup.ok) return back("not_configured")
  const q = req.nextUrl.searchParams
  const pending = await takeConnectState(setup.client, q.get("state") || "", Date.now())
  if (q.get("error")) return back("declined")
  if (!pending || pending.by !== auth.session.email) return back("expired")
  try {
    await completeConnect(qbDeps(setup.client), { code: q.get("code") || "", realmId: q.get("realmId") || "", by: auth.session.email })
  } catch (err) {
    console.error(`[quickbooks] connect failed: ${err instanceof QbError ? err.code : err instanceof Error ? err.name : "error"}`)
    return back("failed")
  }
  clearSnapshotCache()
  return back("connected")
}
