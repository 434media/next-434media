import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { deleteLead, getLeadById, updateLead } from "@/lib/firestore-leads"
import type { LeadUpdateInput } from "@/types/crm-types"

export const runtime = "nodejs"

const VALID_STATUSES = new Set([
  "new",
  "ready",
  "contacted",
  "engaged",
  "converted",
  "archived",
])

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/leads/[id]
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params
  try {
    const lead = await getLeadById(id)
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    return NextResponse.json({ success: true, lead })
  } catch (err) {
    console.error(`[GET /api/admin/leads/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load lead" },
      { status: 500 },
    )
  }
}

// PATCH /api/admin/leads/[id] — partial update. Server re-scores on every write.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Validate status if provided
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: `status must be one of ${[...VALID_STATUSES].join(", ")}` },
        { status: 400 },
      )
    }
  }

  // Whitelist updatable fields. Anything not on this list is ignored —
  // protects score, priority, breakdown, engagement counters, conversion
  // metadata, and timestamps from being client-set.
  const ALLOWED: Array<keyof LeadUpdateInput> = [
    "name",
    "company",
    "title",
    "email",
    "phone",
    "linkedin",
    "source",
    "industry",
    "location",
    "platform",
    "status",
    "assigned_to",
    "outreach_draft",
    "draft_generated_at",
    "last_contacted_at",
    "next_followup_date",
    "tags",
    "notes",
  ]
  const patch: LeadUpdateInput = {}
  for (const key of ALLOWED) {
    if (key in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(patch as any)[key] = body[key]
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No updatable fields supplied" }, { status: 400 })
  }

  try {
    const lead = await updateLead(id, patch)
    return NextResponse.json({ success: true, lead })
  } catch (err) {
    console.error(`[PATCH /api/admin/leads/${id}]`, err)
    const status = err instanceof Error && err.message.includes("not found") ? 404 : 500
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update lead" },
      { status },
    )
  }
}

// DELETE /api/admin/leads/[id]
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params
  try {
    const existing = await getLeadById(id)
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    await deleteLead(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(`[DELETE /api/admin/leads/${id}]`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete lead" },
      { status: 500 },
    )
  }
}
