import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeadById } from "@/lib/firestore-leads"
import { getDb } from "@/lib/firebase-admin"
import { generateGatewayResearch, GATEWAY_TEXT_MODELS, APICallError } from "@/lib/ai-gateway-text"
import { BRAND_CONTEXT } from "@/lib/lead-prompt"
import { CRM_COLLECTIONS, type LeadResearch } from "@/types/crm-types"
import { FieldValue } from "firebase-admin/firestore"
import crypto from "crypto"

export const runtime = "nodejs"
export const maxDuration = 60

// POST /api/admin/leads/[id]/research
//
// Web-grounded "Research & qualify" for a single, existing lead. Calls the AI
// Gateway search model to produce a cited company summary + ICP-fit rationale +
// a SUGGESTED HQ country, then writes it to the lead's REVIEW-ONLY `research`
// field (never to canonical fields like location/status). The rep reviews it in
// the drawer and decides what, if anything, to apply.
//
// Why review-only: the model is web-grounded but can still be wrong, and the
// EU/UK/CA compliance gate depends on accurate country data — so the country is
// a suggestion a human confirms, not an auto-applied value.

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Need a company (or at least a name) to research meaningfully.
  if (!lead.company && !lead.name) {
    return NextResponse.json(
      { error: "Lead has no company or name to research." },
      { status: 400 },
    )
  }

  const system = `You are a B2B research analyst for 434 Media. Research the company below using current web sources and assess fit for 434's audiences. Be factual and cite sources. If you can't verify something, say so rather than guessing.

${BRAND_CONTEXT}`

  const prompt = `Research this company and assess fit:

Company: ${lead.company || "(unknown)"}
Contact: ${lead.name || "(unknown)"}${lead.title ? `, ${lead.title}` : ""}
Known location: ${lead.location || "(unknown)"}
Known industry: ${lead.industry || "(unknown)"}

Provide:
1. A factual company summary (what they do, size/scale, one recent development).
2. An honest fit rationale for 434 Media's audiences — name the strongest sub-brand fit, or say if it's a weak fit.
3. Your best read of their HQ country.`

  let research: LeadResearch
  try {
    const result = await generateGatewayResearch({ system, prompt })
    research = {
      summary: result.summary,
      fitRationale: result.fitRationale,
      suggestedCountry: result.suggestedCountry,
      sources: result.sources,
      generatedAt: new Date().toISOString(),
      model: GATEWAY_TEXT_MODELS.research,
      generatedBy: auth.session.email,
    }
  } catch (err) {
    const status = APICallError.isInstance(err) && err.statusCode === 402 ? 402 : 502
    console.error(`[POST /api/admin/leads/${id}/research] gateway error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Research failed", code: status === 402 ? "out_of_credits" : undefined },
      { status },
    )
  }

  // Persist to the review-only field + log an activity event. Does NOT touch
  // canonical fields and does NOT re-score (so it stays a side-channel write).
  try {
    const db = getDb()
    await db.collection(CRM_COLLECTIONS.LEADS).doc(id).update({
      research,
      activity: FieldValue.arrayUnion({
        id: crypto.randomUUID(),
        type: "researched",
        at: research.generatedAt,
        actor: auth.session.email,
        detail: research.suggestedCountry
          ? `AI research added · suggested country: ${research.suggestedCountry}`
          : "AI research added",
      }),
    })
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/research] persist error:`, err)
    return NextResponse.json({ error: "Research generated but failed to save" }, { status: 500 })
  }

  // Return the freshly-read lead so the drawer updates in place.
  const updated = await getLeadById(id)
  return NextResponse.json({ success: true, lead: updated, research })
}
