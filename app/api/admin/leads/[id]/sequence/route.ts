import { type NextRequest, NextResponse } from "next/server"
import { requireSendCapable } from "@/lib/auth"
import { generateGatewayText, GATEWAY_TEXT_MODELS } from "@/lib/ai-gateway-text"
import { buildLeadOutreachPrompt } from "@/lib/lead-prompt"
import { getLeadById, updateLead, appendLeadActivity } from "@/lib/firestore-leads"
import { runSequenceStep } from "@/lib/outreach-sequence"
import type { Lead, OutreachSequence, OutreachSequenceStep } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 60

// Default subjects — the rep edits these in the confirm step.
function defaultSubject(n: 1 | 2 | 3, lead: Lead): string {
  const co = lead.company || "434 Media"
  if (n === 1) return `434 Media × ${lead.company || "your team"}`
  if (n === 2) return `Following up — ${co}`
  return `One last note`
}

const todayIso = () => new Date().toISOString().split("T")[0]

// POST /api/admin/leads/[id]/sequence
// Body: { action: "draft" | "enroll" | "pause" | "resume" | "stop", steps?: [...] }
//
//  draft  — generate the 3 step drafts for the rep to review (no persist)
//  enroll — store the rep-confirmed 3 steps, activate, and send step 1 now
//  pause/resume/stop — manage an active sequence
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSendCapable()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: { action?: string; steps?: Array<{ n: number; subject?: string; body?: string }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const action = body.action

  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // ── draft: generate the 3 step bodies for review (no persist) ──
  if (action === "draft") {
    const repName = auth.session.name || undefined
    try {
      const steps = await Promise.all(
        ([1, 2, 3] as const).map(async (n) => {
          const { prompt, system } = buildLeadOutreachPrompt({ lead, repName, step: n })
          const text = await generateGatewayText({
            model: GATEWAY_TEXT_MODELS.outreachDraft,
            maxTokens: 600,
            system,
            prompt,
          })
          return { n, subject: defaultSubject(n, lead), body: (text || "").trim() }
        }),
      )
      return NextResponse.json({ success: true, steps })
    } catch (err) {
      console.error(`[sequence draft ${id}]`, err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to draft sequence" },
        { status: 502 },
      )
    }
  }

  // ── enroll: persist confirmed steps, activate, send step 1 ──
  if (action === "enroll") {
    if (lead.status === "converted" || lead.status === "archived") {
      return NextResponse.json({ error: `Cannot enroll a ${lead.status} lead` }, { status: 400 })
    }
    if (!lead.email) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 })
    }
    const input = Array.isArray(body.steps) ? body.steps : []
    if (input.length !== 3) {
      return NextResponse.json({ error: "Exactly 3 steps are required" }, { status: 400 })
    }
    const steps: OutreachSequenceStep[] = []
    for (const n of [1, 2, 3] as const) {
      const s = input.find((x) => x.n === n)
      const subject = (s?.subject || "").trim()
      const text = (s?.body || "").trim()
      if (!subject || !text) {
        return NextResponse.json({ error: `Step ${n} needs a subject and body` }, { status: 400 })
      }
      steps.push({ n, subject, body: text })
    }

    const sequence: OutreachSequence = {
      status: "active",
      steps,
      next_step: 1,
      next_send_at: todayIso(),
      enrolled_at: new Date().toISOString(),
      enrolled_by: auth.session.email,
    }

    try {
      const enrolled = await updateLead(id, { outreach_sequence: sequence })
      await appendLeadActivity(id, {
        type: "note",
        actor: auth.session.email,
        detail: "Enrolled in 3-email outreach sequence",
      }).catch(() => {})
      // Send step 1 immediately; the cron handles steps 2 and 3.
      const result = await runSequenceStep(enrolled)
      const updated = await getLeadById(id)
      return NextResponse.json({ success: true, lead: updated, firstStep: result })
    } catch (err) {
      console.error(`[sequence enroll ${id}]`, err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to enroll sequence" },
        { status: 500 },
      )
    }
  }

  // ── pause / resume / stop ──
  if (action === "pause" || action === "resume" || action === "stop") {
    const seq = lead.outreach_sequence
    if (!seq) return NextResponse.json({ error: "Lead has no sequence" }, { status: 400 })
    const next: OutreachSequence =
      action === "pause"
        ? { ...seq, status: "paused" }
        : action === "resume"
          ? { ...seq, status: "active" }
          : { ...seq, status: "stopped", stopped_reason: "manual", next_step: null, next_send_at: undefined }
    const updated = await updateLead(id, { outreach_sequence: next })
    await appendLeadActivity(id, {
      type: "note",
      actor: auth.session.email,
      detail: `Outreach sequence ${action === "stop" ? "stopped" : action + "d"}`,
    }).catch(() => {})
    return NextResponse.json({ success: true, lead: updated })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
