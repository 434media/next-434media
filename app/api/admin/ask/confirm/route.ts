import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

export const runtime = "nodejs"

/**
 * POST /api/admin/ask/confirm { taskId, kind: "opportunity" | "person", id, to, hash } — the Confirm on an Ask panel
 * stage-change card (V1 item 4, Ask panel slice 1). The change is made only when `hash` still matches the record as it
 * is now (lib/ask/confirm.ts): a card shown before someone else moved the record is refused (409) and nothing changes.
 * It goes through the existing paths: the client updater and its Won event, or the one person edit service.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: Record<string, unknown> | null
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const [{ askPersonOf, liveConfirmDeps }, { parseConfirm, confirmStageChange }] = await Promise.all([import("@/lib/ask/server"), import("@/lib/ask/confirm")])
  const input = parseConfirm(body)
  if (!input) return NextResponse.json({ error: "taskId, kind, id, to and hash are required" }, { status: 400 })
  try {
    const { person, viewer } = await askPersonOf(auth.session)
    const out = await confirmStageChange(input, person, liveConfirmDeps(auth.session, viewer))
    return NextResponse.json({ ok: true, changed: out })
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    if (typeof status === "number" && status >= 400 && status < 500 && e instanceof Error) return NextResponse.json({ error: e.message }, { status })
    console.error("[POST /api/admin/ask/confirm]", e)
    return NextResponse.json({ error: "The change could not be made." }, { status: 500 })
  }
}
