import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

export const runtime = "nodejs"

/**
 * POST /api/admin/ask/undo { kind: "task" | "triage", id, taskId } — the Undo on an Ask panel change (V1 item 4, Ask
 * panel slice 1). Within two minutes, by the person who made the change or the founder, the same rule as triage undo:
 *  - task: the fields go back from the `record_edit` Activity (lib/ask/edits.ts undoTaskEdit), refused if a field
 *    changed again since;
 *  - triage: the core service's undo (lib/core-model/service.ts undoTriage), then its ledger entry.
 * Not gated on the switch: turning Ask off never takes away the Undo of a change already made.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const kind = body?.kind, id = body?.id, taskId = body?.taskId
  if ((kind !== "task" && kind !== "triage") || typeof id !== "string" || !id || id.length > 200) return NextResponse.json({ error: "kind and id are required" }, { status: 400 })
  const [{ askPersonOf, afterAskWrite }, edits, { firestoreAgentDb }] = await Promise.all([import("@/lib/ask/server"), import("@/lib/ask/edits"), import("@/lib/agent/ledger-server")])
  try {
    const { person } = await askPersonOf(auth.session)
    if (!person.actor) return NextResponse.json({ error: "Only a roster member can undo." }, { status: 403 })
    const now = new Date().toISOString()
    if (kind === "task") {
      const out = await edits.undoTaskEdit({ db: firestoreAgentDb(), activityId: id, by: person.email, founder: person.founder, actor: person.actor, now })
      await afterAskWrite()
      return NextResponse.json({ ok: true, undone: out })
    }
    if (typeof taskId !== "string" || !/^ask-[A-Za-z0-9-]{1,80}$/.test(taskId)) return NextResponse.json({ error: "taskId is required for a triage undo" }, { status: 400 })
    const [{ firestoreCoreStore, firestoreLeadPath }, { undoTriage }] = await Promise.all([import("@/lib/core-model/firestore-store"), import("@/lib/core-model/service")])
    const out = await undoTriage(firestoreCoreStore, firestoreLeadPath, { activityId: id, actor: auth.session.email, founder: person.founder })
    await edits.recordTriage(firestoreAgentDb(), { turnTaskId: taskId, activityId: id, actor: person.actor, now, undone: true }).catch((e: unknown) => {
      console.error("[POST /api/admin/ask/undo] the triage was undone but its ledger entry failed:", e instanceof Error ? e.message : e)
    })
    return NextResponse.json({ ok: true, undone: out })
  } catch (e) {
    const status = (e as { status?: unknown })?.status
    if (typeof status === "number" && status >= 400 && status < 500 && e instanceof Error) return NextResponse.json({ error: e.message }, { status })
    console.error("[POST /api/admin/ask/undo]", e)
    return NextResponse.json({ error: "The undo failed. Nothing was changed." }, { status: 500 })
  }
}
