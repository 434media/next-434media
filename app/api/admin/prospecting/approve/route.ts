import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { captureLeadFromProspecting } from "@/lib/firestore-leads"
import type { ScoredPerson } from "@/lib/prospecting/scorer"
import { isExcludedJurisdiction } from "@/lib/prospecting/scorer"

// POST /api/admin/prospecting/approve
//
// Stage 5 — turn approved prospecting candidates into Leads.
//
// Body: { prompt: string, candidates: ScoredPerson[] }
//
// For each candidate:
//   - Skip if score === -1 (hard-excluded by ICP — never approvable)
//   - Skip if no email present (Free-plan obfuscation makes dedup impossible
//     because the lead model's primary key is email)
//   - Otherwise, capture via captureLeadFromProspecting() — handles dedup,
//     backfills missing fields on existing leads, tags with the prompt for
//     traceability
//
// Returns per-candidate outcomes so the UI can surface partial successes
// (e.g. "5 created, 2 updated, 3 skipped: no email").

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_CANDIDATES = 50 // matches Stage 0 per-prompt result cap

interface ApproveBody {
  prompt: string
  candidates: ScoredPerson[]
}

interface ApprovalResult {
  apolloPersonId: string
  email: string | null
  leadId: string | null
  status: "created" | "updated" | "skipped" | "failed"
  reason?: string
}

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

  let body: Partial<ApproveBody>
  try {
    body = (await req.json()) as Partial<ApproveBody>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const candidates = Array.isArray(body.candidates) ? body.candidates : []

  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No candidates provided" }, { status: 400 })
  }
  if (candidates.length > MAX_CANDIDATES) {
    return NextResponse.json(
      {
        error: `Approve up to ${MAX_CANDIDATES} candidates per request. Split larger batches.`,
      },
      { status: 400 },
    )
  }

  const results: ApprovalResult[] = []

  for (const candidate of candidates) {
    const personId = candidate.person?.id ?? ""
    const email = (candidate.person?.email ?? "").trim().toLowerCase() || null

    // Hard-excluded → never approvable (ICP rule).
    if (candidate.score === -1) {
      results.push({
        apolloPersonId: personId,
        email,
        leadId: null,
        status: "skipped",
        reason: candidate.excluded || "Excluded by ICP filter",
      })
      continue
    }

    // Defense-in-depth — even if the scorer let this through (e.g. country
    // field was empty when the candidate was scored but is populated now,
    // or the request bypassed the UI), block EU/CA contacts at the
    // approval boundary. Single source of truth for the jurisdiction list
    // is `EXCLUDED_COUNTRIES` in `lib/prospecting/scorer.ts`.
    const jurisdiction = isExcludedJurisdiction(candidate.person)
    if (jurisdiction.excluded) {
      results.push({
        apolloPersonId: personId,
        email,
        leadId: null,
        status: "skipped",
        reason: `Excluded: contact in ${jurisdiction.country} — 434media does not pursue EU/Canadian contacts (GDPR / CASL).`,
      })
      continue
    }

    // No email → can't dedupe → can't create. Most common on Free plan
    // where email is masked. Surface as `skipped` with a clear reason so
    // reps know to upgrade or run an enrichment pass before approving.
    if (!email) {
      results.push({
        apolloPersonId: personId,
        email: null,
        leadId: null,
        status: "skipped",
        reason: "No email available (Apollo Free plan masks email until upgrade or enrichment)",
      })
      continue
    }

    const person = candidate.person
    const result = await captureLeadFromProspecting({
      email,
      firstName: person.first_name || "",
      lastName: person.last_name || undefined,
      title: person.title || undefined,
      company: person.organization?.name || "",
      linkedin: person.linkedin_url || undefined,
      city: person.city || person.organization?.city || undefined,
      state: person.state || person.organization?.state || undefined,
      industry: person.organization?.industry || undefined,
      employeeCount: person.organization?.estimated_num_employees ?? undefined,
      annualRevenue: person.organization?.annual_revenue ?? undefined,
      prompt,
      apolloPersonId: personId || undefined,
      fitScore: candidate.score,
      approvedBy: auth.session.email,
    })

    if (!result.leadId) {
      results.push({
        apolloPersonId: personId,
        email,
        leadId: null,
        status: "failed",
        reason: "Lead capture errored — see server logs",
      })
      continue
    }

    results.push({
      apolloPersonId: personId,
      email,
      leadId: result.leadId,
      status: result.created ? "created" : "updated",
    })
  }

  const created = results.filter((r) => r.status === "created").length
  const updated = results.filter((r) => r.status === "updated").length
  const skipped = results.filter((r) => r.status === "skipped").length
  const failed = results.filter((r) => r.status === "failed").length

  return NextResponse.json({
    success: true,
    submitted: candidates.length,
    created,
    updated,
    skipped,
    failed,
    results,
  })
}
