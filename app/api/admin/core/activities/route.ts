import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { firestoreCoreStore } from "@/lib/core-model/firestore-store"
import { recordArrival } from "@/lib/core-model/service"
import { normalizeEmail } from "@/lib/core-model/identity"
import { coreErrorResponse, optString, readJson } from "@/lib/core-model/route-helpers"
import { listIcpCohorts } from "@/lib/firestore-icp-cohorts"
import { ACTIVITY_TYPES, CORE_SOURCES, type ActivityEmail, type ActivityType, type CoreSource } from "@/types/core-model"

export const runtime = "nodejs"

// POST /api/admin/core/activities — record a touch by hand (a note, a meeting, or an email with its full text)
// against a Person matched or created by email. Activities are written once and never edited. An email activity
// is refused without its body, sender, recipients and time: the CRM keeps the full text. Nothing here sends.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  const type = body.type as ActivityType
  if (!ACTIVITY_TYPES.includes(type) || type === "google_contact" || type === "form_submission") {
    return NextResponse.json({ error: "type must be note, meeting, email or prospect_found" }, { status: 400 })
  }
  const email = normalizeEmail(body.email)
  if (!email) return NextResponse.json({ error: "The person's email is required" }, { status: 400 })
  const rawEmail = body.envelope as Partial<ActivityEmail> | undefined
  const envelope: ActivityEmail | undefined =
    type === "email" && rawEmail
      ? {
          direction: rawEmail.direction === "sent" ? "sent" : "received",
          from: normalizeEmail(rawEmail.from),
          to: Array.isArray(rawEmail.to) ? rawEmail.to.map(normalizeEmail).filter(Boolean) : [],
          cc: Array.isArray(rawEmail.cc) ? rawEmail.cc.map(normalizeEmail).filter(Boolean) : [],
          subject: optString(rawEmail.subject, 500) ?? "",
          message_id: optString(rawEmail.message_id, 500),
        }
      : undefined
  // The body is kept whole: no length cap on the text itself.
  const text = typeof body.body === "string" ? body.body : undefined
  try {
    const result = await recordArrival(
      firestoreCoreStore,
      {
        type,
        source: (CORE_SOURCES.includes(body.source as CoreSource) ? body.source : "manual") as CoreSource,
        occurred_at: optString(body.occurred_at, 40) ?? new Date().toISOString(),
        contact: { email, name: optString(body.name, 200), company: optString(body.company, 200) },
        summary: optString(body.summary, 300) ?? envelope?.subject ?? "Note",
        body: text,
        email: envelope,
        created_by: auth.session.email,
      },
      await listIcpCohorts(),
    )
    return NextResponse.json({ success: true, data: result.activity }, { status: 201 })
  } catch (error) {
    return coreErrorResponse("POST /api/admin/core/activities", error)
  }
}
