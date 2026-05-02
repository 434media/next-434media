import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  captureLeadFromContactForm,
  captureLeadFromEmailSignup,
  captureLeadFromEventRegistration,
} from "@/lib/firestore-leads"

export const runtime = "nodejs"
export const maxDuration = 60

type ConvertSource = "email_signups" | "contact_forms" | "event_registrations"
const VALID_SOURCES: ConvertSource[] = ["email_signups", "contact_forms", "event_registrations"]
const HARD_LIMIT = 1000

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface ConvertItem {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  company?: string
  phone?: string
  message?: string
  // For email_signups + contact_forms this is the public form `source` code (e.g. "434Media", "TXMX")
  // For event_registrations this is the event slug (e.g. "txmx-tournament-2026")
  sourceSite?: string
  // Event-only context
  eventName?: string
  eventDate?: string
  // Extra tags merged onto the lead (newsletter signups primarily)
  tags?: string[]
}

interface ConvertBody {
  source?: string
  items?: ConvertItem[]
}

interface ConvertResult {
  attempted: number
  created: number
  updated: number
  failed: number
  errors: Array<{ email: string; error: string }>
}

// POST /api/admin/submissions/bulk-convert-leads
//
// body: { source, items: [{ id, email, firstName?, lastName?, company?, phone?, message?, sourceSite, eventName?, eventDate?, tags? }] }
//
// Fans the selected submissions into the `leads` collection using the existing
// captureLeadFrom* helpers. Each helper dedupes by email — a lead that already
// exists gets a tag/note refresh and counts as "updated" rather than "created".
// Per-item failures are caught and surfaced; the overall request succeeds so
// the UI can show partial results.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: ConvertBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const source = body.source as ConvertSource
  const items = Array.isArray(body.items) ? body.items : []

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `source must be one of ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    )
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "items array is empty" }, { status: 400 })
  }
  if (items.length > HARD_LIMIT) {
    return NextResponse.json(
      { error: `Max ${HARD_LIMIT} items per request` },
      { status: 400 },
    )
  }

  const result: ConvertResult = {
    attempted: items.length,
    created: 0,
    updated: 0,
    failed: 0,
    errors: [],
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const email = typeof item.email === "string" ? item.email.trim().toLowerCase() : ""
    if (!email || !email.includes("@")) {
      result.failed++
      result.errors.push({ email: email || `(item ${i})`, error: "Invalid email" })
      continue
    }

    try {
      let outcome: { leadId: string | null; created: boolean }

      if (source === "email_signups") {
        outcome = await captureLeadFromEmailSignup({
          email,
          source: item.sourceSite || "newsletter",
          tags: item.tags,
        })
      } else if (source === "contact_forms") {
        outcome = await captureLeadFromContactForm({
          firstName: item.firstName || "",
          lastName: item.lastName || "",
          company: item.company || "",
          email,
          phone: item.phone,
          message: item.message,
          source: item.sourceSite || "contact",
        })
      } else {
        // event_registrations
        outcome = await captureLeadFromEventRegistration({
          email,
          firstName: item.firstName || "",
          lastName: item.lastName || "",
          company: item.company,
          eventName: item.eventName || item.sourceSite || "Event",
          eventSlug: item.sourceSite || "event",
          eventDate: item.eventDate,
        })
      }

      if (!outcome.leadId) {
        // capture* swallowed an internal error and returned null.
        result.failed++
        result.errors.push({ email, error: "Capture returned no leadId" })
      } else if (outcome.created) {
        result.created++
      } else {
        result.updated++
      }
    } catch (err) {
      result.failed++
      result.errors.push({
        email,
        error: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  console.log(
    `[bulk-convert-leads] ${auth.session.email} converted ${source}:`,
    JSON.stringify({
      attempted: result.attempted,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
    }),
  )

  return NextResponse.json({ ok: true, result })
}
