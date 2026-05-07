import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  searchByFilters,
  enrichByEmail,
  getCreditsUsedThisProcess,
  ApolloError,
  type ApolloSearchFilters,
} from "@/lib/prospecting/apollo"
import { translatePromptToFilters } from "@/lib/prospecting/translator"

// POST /api/admin/prospecting/test
//
// Stages 1 + 2 — verification endpoint for the Apollo wrapper and the LLM
// prompt translator. Admin-only. Lets us run integration tests without a UI
// before Stage 4 builds the real prospecting surface.
//
// Body shapes:
//   { mode: "search",    filters: ApolloSearchFilters }       — Apollo search (1 credit per result)
//   { mode: "enrich",    email: string }                      — Apollo enrichment (1 credit on match)
//   { mode: "translate", prompt: string }                     — LLM-only, no Apollo credits used
//
// Returns the wrapper's / translator's response or a structured error
// indicating which failure mode hit.
//
// This route will be DELETED in Stage 4 once the real prospecting endpoint
// (POST /api/admin/prospecting/search) lands. Safe to remove.

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

interface SearchBody {
  mode: "search"
  filters: ApolloSearchFilters
}

interface EnrichBody {
  mode: "enrich"
  email: string
}

interface TranslateBody {
  mode: "translate"
  prompt: string
}

type TestBody = SearchBody | EnrichBody | TranslateBody

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: Partial<TestBody>
  try {
    body = (await req.json()) as Partial<TestBody>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    if (body.mode === "search") {
      const filters = body.filters ?? {}
      const result = await searchByFilters(filters)
      return NextResponse.json({
        success: true,
        result: {
          peopleCount: result.people.length,
          totalEntries: result.totalEntries,
          page: result.page,
          perPage: result.perPage,
          // Sample first person to show shape — full payloads can be huge
          samplePerson: result.people[0] ?? null,
        },
        creditsUsedThisProcess: getCreditsUsedThisProcess(),
      })
    }

    if (body.mode === "enrich") {
      const email = typeof body.email === "string" ? body.email : ""
      if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 })
      }
      const person = await enrichByEmail(email)
      return NextResponse.json({
        success: true,
        matched: person !== null,
        person,
        creditsUsedThisProcess: getCreditsUsedThisProcess(),
      })
    }

    if (body.mode === "translate") {
      const prompt = typeof body.prompt === "string" ? body.prompt : ""
      if (!prompt.trim()) {
        return NextResponse.json({ error: "prompt is required" }, { status: 400 })
      }
      const result = await translatePromptToFilters(prompt)
      return NextResponse.json({
        success: true,
        filters: result.filters,
        reasoning: result.reasoning,
        ambiguityNote: result.ambiguityNote,
        // No Apollo credits used by translation — LLM only
        creditsUsedThisProcess: getCreditsUsedThisProcess(),
      })
    }

    return NextResponse.json(
      { error: "mode must be 'search', 'enrich', or 'translate'" },
      { status: 400 },
    )
  } catch (err) {
    if (err instanceof ApolloError) {
      // Surface the structured error code so callers can branch on it
      // (e.g. distinguish "upgrade your plan" from "you typo'd the key").
      return NextResponse.json(
        {
          error: err.message,
          code: err.code,
          apolloStatus: err.status,
        },
        { status: err.status === 0 ? 500 : err.status },
      )
    }
    // Pretty-print Anthropic SDK errors — the SDK throws errors whose
    // .message field stringifies "<status> <json>" (e.g. credit-balance
    // rejections). Pull the inner message + flag the source so dev-tools
    // output is readable rather than a wall of escaped JSON.
    if (err instanceof Error) {
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
          // Fall through to generic handling
        }
      }
    }
    console.error("[POST /api/admin/prospecting/test] unexpected:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    )
  }
}
