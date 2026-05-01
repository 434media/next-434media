import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createLead, getLeads } from "@/lib/firestore-leads"
import type { LeadCreateInput, LeadSource } from "@/types/crm-types"

export const runtime = "nodejs"

const VALID_SOURCES: LeadSource[] = ["event", "web", "manual", "newsletter", "referral"]

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET /api/admin/leads — list all leads (sorted by created_at desc).
// Filtering by status/priority/source is done client-side for now; the dataset
// is small enough that adding query params here is premature optimization.
export async function GET() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const leads = await getLeads()
    return NextResponse.json({ success: true, leads })
  } catch (err) {
    console.error("[GET /api/admin/leads]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load leads" },
      { status: 500 },
    )
  }
}

// POST /api/admin/leads — manual lead creation from the admin UI.
// Public form handlers should call createLead() directly, not this route.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Required fields per schema
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const company = typeof body.company === "string" ? body.company.trim() : ""
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const sourceRaw = typeof body.source === "string" ? body.source : "manual"

  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 })
  if (!company) return NextResponse.json({ error: "company is required" }, { status: 400 })
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 })
  if (!VALID_SOURCES.includes(sourceRaw as LeadSource)) {
    return NextResponse.json(
      { error: `source must be one of ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    )
  }

  const input: LeadCreateInput = {
    name,
    company,
    email,
    source: sourceRaw as LeadSource,
    title: typeof body.title === "string" ? body.title : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    linkedin: typeof body.linkedin === "string" ? body.linkedin : undefined,
    industry: typeof body.industry === "string" ? body.industry : undefined,
    location: typeof body.location === "string" ? body.location : undefined,
    platform:
      typeof body.platform === "string"
        ? (body.platform as LeadCreateInput["platform"])
        : undefined,
    assigned_to:
      typeof body.assigned_to === "string" ? body.assigned_to : auth.session.name || undefined,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    next_followup_date:
      typeof body.next_followup_date === "string" ? body.next_followup_date : undefined,
    created_by: auth.session.email,
  }

  try {
    const lead = await createLead(input)
    return NextResponse.json({ success: true, lead }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/admin/leads]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create lead" },
      { status: 500 },
    )
  }
}
