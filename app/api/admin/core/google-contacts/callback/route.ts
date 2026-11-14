import { NextResponse, type NextRequest } from "next/server"
import { requireContactsOwner } from "@/lib/google-contacts/guard"
import { completeConnect, GcError } from "@/lib/google-contacts/client"
import { gcDeps, gcSetup, takeConnectState } from "@/lib/google-contacts/server"

export const runtime = "nodejs"

// Google's redirect after consent: the state is consumed once, must be unexpired and started by the same founder,
// then the code is exchanged, the grant is checked to be the contacts scope alone, and the sealed token is stored.
// Every outcome lands on the People page with a short code.
export async function GET(req: NextRequest) {
  const gate = await requireContactsOwner("GET /api/admin/core/google-contacts/callback")
  if ("response" in gate) return gate.response
  const back = (code: string) => NextResponse.redirect(new URL(`/admin/people?google=${code}`, req.nextUrl.origin), 303)
  const setup = gcSetup()
  if (!setup.ok) return back("not_configured")
  const q = req.nextUrl.searchParams
  const pending = await takeConnectState(q.get("state") || "", Date.now())
  if (q.get("error")) return back("declined")
  if (!pending || pending.by !== gate.session.email) return back("expired")
  try {
    await completeConnect(gcDeps(setup.client), { code: q.get("code") || "", by: gate.session.email })
  } catch (err) {
    console.error(`[google-contacts] connect failed: ${err instanceof GcError ? err.code : err instanceof Error ? err.name : "error"}`)
    return back(err instanceof GcError && err.code === "scope" ? "scope" : "failed")
  }
  return back("connected")
}
