import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getStatesForSubmissions,
  setSubmissionState,
  VALID_STATES,
  type SubmissionSourceCollection,
  type SubmissionState,
} from "@/lib/firestore-submission-states"

export const runtime = "nodejs"

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

// GET /api/admin/submissions/states?source=email_signups&ids=a,b,c
// Returns { states: { [id]: state } } — only entries that have been set.
// Missing ids implicitly default to "new" client-side.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const source = request.nextUrl.searchParams.get("source") as SubmissionSourceCollection | null
  const idsParam = request.nextUrl.searchParams.get("ids") ?? ""
  const ids = idsParam.split(",").filter(Boolean)

  if (!source || !VALID_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `source must be one of ${VALID_SOURCES.join(", ")}` },
      { status: 400 },
    )
  }
  if (ids.length === 0) {
    return NextResponse.json({ success: true, states: {} })
  }

  try {
    const map = await getStatesForSubmissions(source, ids)
    const states: Record<string, SubmissionState> = {}
    for (const [id, state] of map.entries()) {
      states[id] = state
    }
    return NextResponse.json({ success: true, states })
  } catch (err) {
    console.error("[GET /submissions/states]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load states" },
      { status: 500 },
    )
  }
}

// POST /api/admin/submissions/states  body: { source, id, state }
// Single state write — used when a user changes one row's state inline.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { source?: string; id?: string; state?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const source = body.source as SubmissionSourceCollection
  const id = typeof body.id === "string" ? body.id : ""
  const state = body.state as SubmissionState

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 })
  }
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 })
  }
  if (!VALID_STATES.includes(state)) {
    return NextResponse.json(
      { error: `state must be one of ${VALID_STATES.join(", ")}` },
      { status: 400 },
    )
  }

  try {
    await setSubmissionState(source, id, state, auth.session.email)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[POST /submissions/states]", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to set state" },
      { status: 500 },
    )
  }
}
