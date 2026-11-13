import { NextResponse, type NextRequest } from "next/server"
import { crossOriginRefusal, requireContactsOwner } from "@/lib/google-contacts/guard"
import { disconnect } from "@/lib/google-contacts/client"
import { gcDeps, gcSetup, setWriteBack } from "@/lib/google-contacts/server"

export const runtime = "nodejs"

// POST /api/admin/core/google-contacts/disconnect — revokes the token with Google and deletes the stored one, and
// switches write-back off. People already saved stay; nothing in Google is touched.
export async function POST(req: NextRequest) {
  const gate = await requireContactsOwner("POST /api/admin/core/google-contacts/disconnect")
  if ("response" in gate) return gate.response
  const refused = crossOriginRefusal(req, req.nextUrl.origin)
  if (refused) return refused
  const setup = gcSetup()
  if (!setup.ok) return NextResponse.json({ error: "Not configured" }, { status: 400 })
  const { revoked } = await disconnect(gcDeps(setup.client))
  await setWriteBack(false, gate.session.email)
  return NextResponse.json({ success: true, data: { revoked } })
}
