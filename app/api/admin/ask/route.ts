import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * The Ask panel (V1 item 4, Ask panel slice 1; founder approval 2026-11-18). Signed-in admins only; then the switch on
 * the Agents page and the person's own `admin-ask` permission decide (lib/ask/policy.ts).
 *
 * GET  → { on, permitted, founder }: whether the panel may run for this person, for the sidebar button.
 * POST { question: string, history?: { role, content }[], page?: string, selected?: { kind, id, ref?, name } } → one turn
 *   (lib/ask/run.ts); `selected` is the task or opportunity open on screen, which "this" means:
 *   200 { ok: true, taskId, answer, edits: [{ kind, id, label, undoUntil }], proposals: [{ …, hash, label }], choices? }
 *   200 { ok: false, code, message, link? } for a refusal the panel shows as an answer (money, sends, off, the cap);
 *   502 when the run failed upstream.
 * Nothing of the conversation is stored: the panel sends it back with each question, bounded.
 */
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const [{ askPersonOf }, { readAgentControls, askOn }] = await Promise.all([import("@/lib/ask/server"), import("@/lib/agent/controls")])
  const { person } = await askPersonOf(auth.session)
  return NextResponse.json({ on: askOn(await readAgentControls()), permitted: person.permitted && person.actor !== null, founder: person.founder })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const question = typeof body?.question === "string" ? body.question : ""
  if (!question.trim()) return NextResponse.json({ error: "Ask a question" }, { status: 400 })
  const page = typeof body.page === "string" && /^\/admin[\w/-]{0,80}$/.test(body.page) ? body.page : undefined
  const [{ askPersonOf, liveAskDeps, afterAskWrite }, { runAskTurn }, { boundedHistory, askSelectionOf }] = await Promise.all([
    import("@/lib/ask/server"),
    import("@/lib/ask/run"),
    import("@/lib/ask/policy"),
  ])
  try {
    const { person, viewer } = await askPersonOf(auth.session)
    const out = await runAskTurn({ question, history: boundedHistory(body.history), page, selected: askSelectionOf(body.selected) }, person, liveAskDeps(auth.session, viewer))
    if (out.ok && out.edits.length) await afterAskWrite()
    if (!out.ok && (out.code === "run-error" || out.code === "skill-unreadable")) return NextResponse.json(out, { status: 502 })
    return NextResponse.json(out)
  } catch (e) {
    console.error("[POST /api/admin/ask]", e)
    return NextResponse.json({ ok: false, code: "error", message: "Ask could not run. Nothing was changed." }, { status: 500 })
  }
}
