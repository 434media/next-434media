import { NextResponse, type NextRequest } from "next/server"
import { requireFounder } from "@/lib/founder-guard"
import { disconnect } from "@/lib/quickbooks"
import { clearSnapshotCache, qbDeps, qbSetup } from "@/lib/quickbooks-server"

export const runtime = "nodejs"

// Disconnect: revokes the tokens with Intuit and deletes the stored connection. A form POST from the finance page.
export async function POST(req: NextRequest) {
  const auth = await requireFounder("POST /api/admin/finance/quickbooks/disconnect")
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { "cache-control": "private, no-store" } })
  }
  // Same-origin only: the session cookie is SameSite=Lax, which a sibling subdomain's form would still carry.
  const origin = req.headers.get("origin")
  if (origin !== req.nextUrl.origin) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 })
  const setup = qbSetup(req.nextUrl.origin)
  if (!setup.ok) return NextResponse.redirect(new URL("/admin/finance?quickbooks=not_configured", req.nextUrl.origin), 303)
  await disconnect(qbDeps(setup.client))
  clearSnapshotCache()
  return NextResponse.redirect(new URL("/admin/finance?quickbooks=disconnected", req.nextUrl.origin), 303)
}
