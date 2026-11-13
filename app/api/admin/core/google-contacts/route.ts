import { NextResponse, type NextRequest } from "next/server"
import { crossOriginRefusal, requireContactsOwner } from "@/lib/google-contacts/guard"
import { setWriteBack, syncStatus } from "@/lib/google-contacts/server"
import { readJson } from "@/lib/core-model/route-helpers"

export const runtime = "nodejs"

// GET /api/admin/core/google-contacts — the sync's status for the founder: configured, connected, phase, the
// write-back switch, the last run and how many edits wait for write-back. Anyone else gets 401/403 (the People page
// uses that to leave the panel out).
export async function GET() {
  const gate = await requireContactsOwner("GET /api/admin/core/google-contacts")
  if ("response" in gate) return gate.response
  try {
    return NextResponse.json({ success: true, data: await syncStatus() }, { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    console.error("[GET /api/admin/core/google-contacts]", error instanceof Error ? error.name : "error")
    return NextResponse.json({ error: "Failed to read the sync status" }, { status: 500 })
  }
}

// PATCH /api/admin/core/google-contacts { write_back: boolean } — the write-back switch. Off by default; the founder
// turns it on once the import and inbox have run cleanly (spec: "write-back ships switched off").
export async function PATCH(req: NextRequest) {
  const gate = await requireContactsOwner("PATCH /api/admin/core/google-contacts")
  if ("response" in gate) return gate.response
  const refused = crossOriginRefusal(req, req.nextUrl.origin)
  if (refused) return refused
  const body = await readJson(req)
  if (typeof body?.write_back !== "boolean") return NextResponse.json({ error: "write_back must be true or false" }, { status: 400 })
  await setWriteBack(body.write_back, gate.session.email)
  console.info(`[google-contacts] write-back switched ${body.write_back ? "on" : "off"} by ${gate.session.email}`)
  return NextResponse.json({ success: true, data: await syncStatus() })
}
