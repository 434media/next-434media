import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { ApolloError, enrichPersonById } from "@/lib/prospecting/apollo"
import type { ApolloSearchFilters } from "@/lib/prospecting/apollo"
import { scoreCandidate } from "@/lib/prospecting/scorer"

// POST /api/admin/prospecting/reveal
//
// Per-row reveal — Apollo's search endpoint masks contact data (no last name,
// email, or firmographics) on every plan. This spends ONE enrichment credit to
// reveal a single candidate by Apollo person id (/people/match), then re-scores
// the now-complete record so the tray shows the real fit.
//
// Body: { personId: string, filters?: ApolloSearchFilters }
// Returns: { success, revealed, candidate? }

export const runtime = "nodejs"
export const maxDuration = 30

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { personId?: string; filters?: ApolloSearchFilters }
  try {
    body = (await req.json()) as { personId?: string; filters?: ApolloSearchFilters }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const personId = typeof body.personId === "string" ? body.personId.trim() : ""
  if (!personId) {
    return NextResponse.json({ error: "personId is required" }, { status: 400 })
  }
  const filters = body.filters && typeof body.filters === "object" ? body.filters : {}

  let enriched
  try {
    enriched = await enrichPersonById(personId, {
      userEmail: auth.session.email,
      prompt: "(reveal)",
    })
  } catch (err) {
    if (err instanceof ApolloError) {
      return NextResponse.json(
        { error: err.message, source: "apollo", code: err.code },
        { status: err.status === 0 ? 500 : err.status },
      )
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reveal failed", source: "apollo" },
      { status: 500 },
    )
  }

  if (!enriched) {
    // Apollo had no match — nothing to reveal, no credit charged.
    return NextResponse.json({ success: true, revealed: false })
  }

  // Re-score against the same search filters now that firmographics are real.
  const candidate = scoreCandidate(enriched, filters)
  return NextResponse.json({ success: true, revealed: true, candidate })
}
