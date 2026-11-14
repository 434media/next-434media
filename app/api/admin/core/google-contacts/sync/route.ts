import { NextResponse, type NextRequest } from "next/server"
import { crossOriginRefusal, requireContactsOwner } from "@/lib/google-contacts/guard"
import { runSyncNow } from "@/lib/google-contacts/server"

export const runtime = "nodejs"
export const maxDuration = 300

// POST /api/admin/core/google-contacts/sync — run the sync now (the cron runs it every 15 minutes). One run at a time.
export async function POST(req: NextRequest) {
  const gate = await requireContactsOwner("POST /api/admin/core/google-contacts/sync")
  if ("response" in gate) return gate.response
  const refused = crossOriginRefusal(req, req.nextUrl.origin)
  if (refused) return refused
  const out = await runSyncNow()
  const status = out.state === "ok" ? 200 : out.state === "busy" ? 409 : out.state === "error" ? 502 : 400
  return NextResponse.json({ success: out.state === "ok", data: out }, { status })
}
