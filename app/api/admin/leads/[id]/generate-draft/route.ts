import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getAnthropic, getModel } from "@/lib/anthropic"
import { buildLeadOutreachPrompt } from "@/lib/lead-prompt"
import { getLeadById, updateLead } from "@/lib/firestore-leads"

export const runtime = "nodejs"
export const maxDuration = 60

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// POST /api/admin/leads/[id]/generate-draft
// Body: optional { repName?: string } — defaults to the session user's name
//
// Calls Claude to draft a personalized outbound email. Writes the draft and
// `draft_generated_at` back to the lead. Auto-flips status `new` → `ready`
// since we now have something to send.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Optional rep name from body, falls back to session user
  let repName = auth.session.name || undefined
  try {
    const body = (await req.json().catch(() => ({}))) as { repName?: string }
    if (typeof body.repName === "string" && body.repName.trim()) {
      repName = body.repName.trim()
    }
  } catch {
    // body is optional — empty/non-JSON is fine
  }

  const { prompt, system } = buildLeadOutreachPrompt({ lead, repName })

  let draft: string
  try {
    const message = await getAnthropic().messages.create({
      model: getModel(),
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: prompt }],
    })
    const block = message.content[0]
    draft = block && block.type === "text" ? block.text.trim() : ""
    if (!draft) {
      throw new Error("Claude returned an empty draft")
    }
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/generate-draft] Claude error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate draft" },
      { status: 502 },
    )
  }

  // Persist draft + timestamp; auto-promote `new` → `ready` so the leads
  // queue surfaces it as actionable. Other statuses are preserved.
  try {
    const updated = await updateLead(id, {
      outreach_draft: draft,
      draft_generated_at: new Date().toISOString(),
      status: lead.status === "new" ? "ready" : lead.status,
    })
    return NextResponse.json({ success: true, lead: updated, draft })
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/generate-draft] persist error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save draft" },
      { status: 500 },
    )
  }
}
