import { NextResponse, type NextRequest } from "next/server"
import { requireFounder } from "@/lib/founder-guard"
import { authorizeUrl, newState } from "@/lib/quickbooks"
import { qbSetup, saveConnectState } from "@/lib/quickbooks-server"

export const runtime = "nodejs"

// Connect (or reconnect) QuickBooks: the founder is sent to Intuit's consent screen. Intuit's "Connect / Reconnect URL".
export async function GET(req: NextRequest) {
  const auth = await requireFounder("GET /api/admin/finance/quickbooks/connect")
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "cache-control": "private, no-store" } })
  }
  const setup = qbSetup(req.nextUrl.origin)
  if (!setup.ok) return NextResponse.redirect(new URL("/admin/finance?quickbooks=not_configured", req.nextUrl.origin), 303)
  const state = newState()
  await saveConnectState(setup.client, state, auth.session.email, Date.now())
  return NextResponse.redirect(authorizeUrl(setup.client, state), 302)
}
