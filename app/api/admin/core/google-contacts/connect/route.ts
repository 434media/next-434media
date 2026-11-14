import { NextResponse, type NextRequest } from "next/server"
import { requireContactsOwner } from "@/lib/google-contacts/guard"
import { authorizeUrl, newState } from "@/lib/google-contacts/client"
import { gcSetup, saveConnectState } from "@/lib/google-contacts/server"

export const runtime = "nodejs"

// GET /api/admin/core/google-contacts/connect — the founder (a super admin, signed in as himself) is sent to Google's
// consent screen for the contacts scope only. He signs in there with his personal Gmail.
export async function GET(req: NextRequest) {
  const gate = await requireContactsOwner("GET /api/admin/core/google-contacts/connect")
  if ("response" in gate) return gate.response
  const setup = gcSetup()
  if (!setup.ok) return NextResponse.redirect(new URL("/admin/people?google=not_configured", req.nextUrl.origin), 303)
  const state = newState()
  await saveConnectState(state, gate.session.email, Date.now())
  return NextResponse.redirect(authorizeUrl(setup.client, state), 302)
}
