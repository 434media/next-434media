import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  bulkSetSubmissionStates,
  VALID_STATES,
  type SubmissionSourceCollection,
  type SubmissionState,
} from "@/lib/firestore-submission-states"

export const runtime = "nodejs"
export const maxDuration = 30

const VALID_SOURCES: SubmissionSourceCollection[] = [
  "email_signups",
  "contact_forms",
  "event_registrations",
]

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

interface BulkUpdateBody {
  updates?: Array<{ source: string; id: string; state: string }>
}

// POST /api/admin/submissions/states/bulk
// body: { updates: [{ source, id, state }, ...] }
//
// Used by the bottom action bar to mark N selected submissions in one call.
// Validates each update; rejects the whole batch on any invalid entry.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: BulkUpdateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates = Array.isArray(body.updates) ? body.updates : []
  if (updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 })
  }
  if (updates.length > 1000) {
    return NextResponse.json({ error: "Max 1000 updates per call" }, { status: 400 })
  }

  // Validate each entry up front
  const sanitized: Array<{
    source: SubmissionSourceCollection
    sourceId: string
    state: SubmissionState
  }> = []
  for (let i = 0; i < updates.length; i++) {
    const u = updates[i]
    if (!VALID_SOURCES.includes(u.source as SubmissionSourceCollection)) {
      return NextResponse.json(
        { error: `Invalid source at index ${i}: ${u.source}` },
        { status: 400 },
      )
    }
    if (typeof u.id !== "string" || !u.id) {
      return NextResponse.json({ error: `Invalid id at index ${i}` }, { status: 400 })
    }
    if (!VALID_STATES.includes(u.state as SubmissionState)) {
      return NextResponse.json(
        { error: `Invalid state at index ${i}: ${u.state}` },
        { status: 400 },
      )
    }
    sanitized.push({
      source: u.source as SubmissionSourceCollection,
      sourceId: u.id,
      state: u.state as SubmissionState,
    })
  }

  try {
    const result = await bulkSetSubmissionStates(sanitized, auth.session.email)
    // Spread first, then `ok` last — explicit "request succeeded" boolean.
    return NextResponse.json({ ...result, ok: true })
  } catch (err) {
    console.error("[POST /submissions/states/bulk]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bulk update failed" },
      { status: 500 },
    )
  }
}
