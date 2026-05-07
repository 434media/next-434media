import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  searchByFilters,
  ApolloError,
  getCreditsUsedThisProcess,
} from "@/lib/prospecting/apollo"
import { translatePromptToFilters } from "@/lib/prospecting/translator"
import {
  scoreCandidates,
  DEFAULT_FIT_THRESHOLD,
} from "@/lib/prospecting/scorer"

// POST /api/admin/prospecting/search
//
// Stage 4 — orchestrator that chains the three pieces built in Stages 1–3:
//   1. Translate the rep's free-form prompt → ApolloSearchFilters (LLM)
//   2. Search Apollo with those filters (1 credit per result)
//   3. Score each candidate against the ICP (pure function)
//
// If the translator flags the prompt as ambiguous (e.g. "CBG" could be
// cannabis or consumer brand goods), we return early WITHOUT calling Apollo
// — burning credits on a query the rep needs to clarify is wasteful.
//
// Auth-gated to admins. The actual approval-into-leads-queue flow lives in
// Stage 5; this route returns scored candidates only.

export const runtime = "nodejs"
export const maxDuration = 60

const PER_PAGE_DEFAULT = 25
const PER_PAGE_MAX = 50 // Stage 0 cap; controls cost per query.

interface SearchRequestBody {
  prompt: string
  perPage?: number
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

  let body: Partial<SearchRequestBody>
  try {
    body = (await req.json()) as Partial<SearchRequestBody>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }

  // Cap per_page — protects against accidentally requesting 1000 results
  // and burning a month of credits in one click.
  const requestedPerPage = typeof body.perPage === "number" ? body.perPage : PER_PAGE_DEFAULT
  const perPage = Math.max(1, Math.min(PER_PAGE_MAX, requestedPerPage))

  // ── 1. Translate ──
  let translation
  try {
    translation = await translatePromptToFilters(prompt)
  } catch (err) {
    return surfaceError(err, "anthropic")
  }

  // ── 1a. Bail early on ambiguous prompts (no Apollo credits burned) ──
  if (translation.ambiguityNote) {
    return NextResponse.json({
      success: true,
      ambiguous: true,
      prompt,
      reasoning: translation.reasoning,
      ambiguityNote: translation.ambiguityNote,
    })
  }

  // ── 2. Search Apollo ──
  const filters = { ...translation.filters, per_page: perPage, page: 1 }
  let searchResult
  try {
    searchResult = await searchByFilters(filters)
  } catch (err) {
    return surfaceError(err, "apollo")
  }

  // ── 3. Score ──
  const candidates = scoreCandidates(searchResult.people, filters)

  return NextResponse.json({
    success: true,
    ambiguous: false,
    prompt,
    reasoning: translation.reasoning,
    filters,
    candidates,
    page: searchResult.page,
    perPage: searchResult.perPage,
    totalEntries: searchResult.totalEntries,
    threshold: DEFAULT_FIT_THRESHOLD,
    creditsUsedThisProcess: getCreditsUsedThisProcess(),
  })
}

/**
 * Map errors from translator (Anthropic) or wrapper (Apollo) into clean
 * JSON responses with structured codes the UI can branch on. Mirrors the
 * pretty-print pattern in the test endpoint.
 */
function surfaceError(err: unknown, defaultSource: "anthropic" | "apollo") {
  if (err instanceof ApolloError) {
    return NextResponse.json(
      {
        error: err.message,
        source: "apollo",
        code: err.code,
        apolloStatus: err.status,
      },
      { status: err.status === 0 ? 500 : err.status },
    )
  }
  if (err instanceof Error) {
    // Anthropic SDK throws "<status> {json}" — extract the inner message.
    const anthropicMatch = err.message.match(/^(\d{3}) (\{.*\})$/s)
    if (anthropicMatch) {
      try {
        const inner = JSON.parse(anthropicMatch[2])
        const innerMessage =
          inner?.error?.message || inner?.message || err.message
        return NextResponse.json(
          {
            error: innerMessage,
            source: "anthropic",
            status: Number(anthropicMatch[1]),
          },
          { status: Number(anthropicMatch[1]) },
        )
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json(
      { error: err.message, source: defaultSource },
      { status: 500 },
    )
  }
  return NextResponse.json(
    { error: "Unexpected error", source: defaultSource },
    { status: 500 },
  )
}
