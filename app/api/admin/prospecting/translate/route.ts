import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { ApolloError } from "@/lib/prospecting/apollo"
import { translatePromptToFilters } from "@/lib/prospecting/translator"

// POST /api/admin/prospecting/translate
//
// Step 18 — translate-only. Turns a rep's free-form prompt into structured
// filters WITHOUT calling Apollo, so the rep can review + edit the derived
// filters before spending any credits (Apollo's own iterate-then-commit model).
//
// Consumes NO Apollo credits — this is pure LLM. The subsequent search call
// (with the possibly-edited filters) is where credits are spent.
//
// Body: { prompt: string }
// Returns: { success, ambiguous, prompt, reasoning, filters?, icpIndustries?, ambiguityNote? }

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

  let body: { prompt?: string }
  try {
    body = (await req.json()) as { prompt?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 })
  }

  let translation
  try {
    translation = await translatePromptToFilters(prompt)
  } catch (err) {
    return surfaceError(err)
  }

  if (translation.ambiguityNote) {
    return NextResponse.json({
      success: true,
      ambiguous: true,
      prompt,
      reasoning: translation.reasoning,
      ambiguityNote: translation.ambiguityNote,
    })
  }

  return NextResponse.json({
    success: true,
    ambiguous: false,
    prompt,
    reasoning: translation.reasoning,
    filters: translation.filters,
    icpIndustries: translation.icpIndustries ?? [],
    nicheKeyword: translation.nicheKeyword ?? "",
  })
}

/** Map translator (Anthropic) errors into clean JSON. Mirrors the search route. */
function surfaceError(err: unknown) {
  if (err instanceof ApolloError) {
    return NextResponse.json(
      { error: err.message, source: "apollo", code: err.code },
      { status: err.status === 0 ? 500 : err.status },
    )
  }
  if (err instanceof Error) {
    const anthropicMatch = err.message.match(/^(\d{3}) (\{.*\})$/s)
    if (anthropicMatch) {
      try {
        const inner = JSON.parse(anthropicMatch[2])
        const innerMessage = inner?.error?.message || inner?.message || err.message
        return NextResponse.json(
          { error: innerMessage, source: "anthropic", status: Number(anthropicMatch[1]) },
          { status: Number(anthropicMatch[1]) },
        )
      } catch {
        /* fall through */
      }
    }
    return NextResponse.json({ error: err.message, source: "anthropic" }, { status: 500 })
  }
  return NextResponse.json({ error: "Unexpected error", source: "anthropic" }, { status: 500 })
}
