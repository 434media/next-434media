import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { getLeadById, updateLead } from "@/lib/firestore-leads"
import { createClient } from "@/lib/firestore-crm"
import type { ClientContact, ClientRecord, ClientStatus } from "@/types/crm-types"

export const runtime = "nodejs"

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// POST /api/admin/leads/[id]/convert
// Body: { initialStatus?: ClientStatus, isOpportunity?: boolean }
//
// Creates a crm_clients record from the lead and stamps the conversion link
// on both sides:
//   - lead.converted_to_client_id  → the new client's id
//   - client.notes contains a "Converted from lead {id}" preamble for audit
//
// Idempotent guard: if the lead already has a converted_to_client_id, returns
// 409 with the existing client id rather than creating a duplicate.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { id } = await ctx.params

  const lead = await getLeadById(id)
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  if (lead.converted_to_client_id) {
    return NextResponse.json(
      {
        error: "Lead already converted",
        clientId: lead.converted_to_client_id,
      },
      { status: 409 },
    )
  }

  let body: { initialStatus?: ClientStatus; isOpportunity?: boolean }
  try {
    body = await req.json().catch(() => ({}))
  } catch {
    body = {}
  }

  // Build the contact array from the lead's name/email/phone
  const nameParts = (lead.name || "").trim().split(/\s+/)
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || ""
  const contact: ClientContact = {
    id: `contact_${Date.now()}`,
    first_name: firstName,
    last_name: lastName,
    name: lead.name || lead.email,
    email: lead.email,
    phone: lead.phone,
    is_primary: true,
  }

  const conversionPreamble = `Converted from lead ${lead.id} on ${new Date().toISOString().split("T")[0]} by ${auth.session.email}.`
  const combinedNotes = lead.notes
    ? `${conversionPreamble}\n\n${lead.notes}`
    : conversionPreamble

  // Build the client record. We use the lead's company as the company_name
  // and the lead's name as the primary `name` field on the client record.
  // is_opportunity defaults true when the lead was actually `engaged` —
  // those are warm enough to enter the pipeline immediately.
  const isOpp =
    typeof body.isOpportunity === "boolean"
      ? body.isOpportunity
      : lead.status === "engaged"

  const newClient: Omit<ClientRecord, "id" | "created_at" | "updated_at"> = {
    name: lead.name || lead.email,
    company_name: lead.company || undefined,
    title: undefined,
    email: lead.email,
    phone: lead.phone,
    contacts: [contact],
    industry: lead.industry,
    status: body.initialStatus ?? "prospect",
    lead_source: lead.source,
    assigned_to: lead.assigned_to || auth.session.name || undefined,
    next_followup_date: lead.next_followup_date,
    notes: combinedNotes,
    is_opportunity: isOpp,
    disposition: isOpp ? "pitched" : undefined,
  }

  let createdClient: ClientRecord
  try {
    createdClient = await createClient(newClient)
  } catch (err) {
    console.error(`[POST /api/admin/leads/${id}/convert] createClient error:`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create client" },
      { status: 500 },
    )
  }

  // Stamp the conversion link on the lead. Status flips to `converted`.
  // Failure here means we have an orphan client without a back-link — log and
  // return success-with-warning so the rep doesn't double-convert.
  let updatedLead
  try {
    updatedLead = await updateLead(id, {
      status: "converted",
      converted_to_client_id: createdClient.id,
      converted_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error(
      `[POST /api/admin/leads/${id}/convert] updateLead failed (client ${createdClient.id} created but lead not stamped):`,
      err,
    )
    return NextResponse.json(
      {
        success: true,
        warning:
          "Client created but lead conversion link failed to save. Refresh and check the lead.",
        client: createdClient,
      },
      { status: 200 },
    )
  }

  return NextResponse.json({ success: true, client: createdClient, lead: updatedLead })
}
