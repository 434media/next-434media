import { NextResponse } from "next/server"
import { requireSuperAdmin } from "../../content-pipeline/auth"
import type { GatewayUsage } from "@/lib/ai-gateway-text"
import type { ModelCall } from "@/lib/content-pipeline/model"
import type { OutboundCohort } from "@/lib/sor/types.generated"
import type { Lead } from "@/types/crm-types"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * POST /api/admin/engine/smoke: the engine's live check (434 build sequence V1 item 2). Each AI path runs its real code
 * once through the AI Gateway on invented inputs, and the answer reports what was served: finish reason, tokens, cache
 * reads and writes, and a short sample. It reads no database, so it runs on a preview, which has none; it stores nothing
 * and sends nothing. The paths that read a record first (a lead, the ICP cohorts, a brand profile) are given an invented
 * one: the translator takes invented cohort rows (as its tests do), the drafts an invented lead, and the content
 * pipeline the committed fixture profile with an offline search tool, so no web search is billed. Spends a few cents of
 * Gateway credit a run, hence super-admins only. Re-run it after any change to `ai`, `@ai-sdk/gateway` or a model slug.
 */
export async function POST() {
  const auth = await requireSuperAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const checks = await Promise.all([translator(), outreachDraft(), leadResearch(), contentPipeline(), images()])
  const results = checks.flat()
  const ok = results.every(r => r.ok)
  console.info("[POST /api/admin/engine/smoke]", JSON.stringify({ ok, results: results.map(r => ({ path: r.path, ok: r.ok })) }))
  return NextResponse.json({ ok, ranAt: new Date().toISOString(), results })
}

interface Check { path: string; ok: boolean; ms: number; detail?: unknown; error?: string }
async function timed(path: string, fn: () => Promise<unknown>): Promise<Check> {
  const t = Date.now()
  try {
    const detail = await fn()
    return { path, ok: true, ms: Date.now() - t, detail }
  } catch (err) {
    console.error(`[POST /api/admin/engine/smoke] ${path}`, err)
    return { path, ok: false, ms: Date.now() - t, error: err instanceof Error ? err.message.slice(0, 400) : String(err) }
  }
}

// Invented rows, the shape of icp_cohorts (as lib/__tests__/icp-cohorts.test.ts builds them).
const cohort = (over: Partial<OutboundCohort>): OutboundCohort => ({
  key: "cohort-x", letter: "A", name: "X", objective: "o", target_profile: [], qualification_signals: [],
  proof: [] as unknown as OutboundCohort["proof"], first_pitch: "pitch text", signer: "434",
  match: { industries: [], size: null }, ...over,
} as OutboundCohort)
const COHORTS = [
  cohort({ key: "cohort-a", letter: "A", name: "Aero", match: { industries: ["defense_aerospace", "advanced_manufacturing"], size: null } as OutboundCohort["match"] }),
  cohort({ key: "cohort-b", letter: "B", name: "Health", match: { industries: ["healthcare_life_sciences"], size: null } as OutboundCohort["match"] }),
]

/** Prospecting translator, twice: the second call should read the ICP prefix from cache. */
async function translator(): Promise<Check[]> {
  const { translatePromptToFilters } = await import("@/lib/prospecting/translator")
  const run = (n: number) => timed(`translator #${n}`, async () => {
    let usage: GatewayUsage | undefined
    const r = await translatePromptToFilters("Hospital systems in Texas with 500 to 5,000 employees", { cohorts: COHORTS, onUsage: u => { usage = u } })
    return { usage, filters: Object.keys(r.filters ?? {}), reasoning: r.reasoning.slice(0, 160) }
  })
  return [await run(1), await run(2)]
}

/** Outreach draft (generate-draft and the sequence's from-scratch steps), twice: the second should read the system prefix from cache. */
async function outreachDraft(): Promise<Check[]> {
  const [{ generateGatewayText, GATEWAY_TEXT_MODELS }, { buildLeadOutreachPrompt }] = await Promise.all([import("@/lib/ai-gateway-text"), import("@/lib/lead-prompt")])
  const lead = { id: "smoke", name: "Ana Example", title: "Marketing Director", company: "Example Health", industry: "Healthcare", location: "San Antonio, TX", source: "website", tags: [] } as unknown as Lead
  const run = (n: number, step?: 1 | 2 | 3) => timed(`outreach draft #${n}${step ? ` (sequence step ${step})` : ""}`, async () => {
    const { system, prompt } = buildLeadOutreachPrompt({ lead, repName: "Smoke Test", ...(step ? { step } : {}) })
    let usage: GatewayUsage | undefined
    const text = await generateGatewayText({ model: GATEWAY_TEXT_MODELS.outreachDraft, maxTokens: 2000, effort: "low", cacheSystem: true, system, prompt, onUsage: u => { usage = u } })
    if (!text) throw new Error("empty draft")
    return { usage, words: text.split(/\s+/).length, opening: text.slice(0, 120) }
  })
  return [await run(1), await run(2, 1)]
}

/** Lead research: the web-grounded model with structured output (AI SDK 7 `output`). */
async function leadResearch(): Promise<Check[]> {
  const { generateGatewayResearch } = await import("@/lib/ai-gateway-text")
  return [await timed("lead research", async () => {
    const r = await generateGatewayResearch({
      system: "You research a company for a media company's sales team. Be factual and brief.",
      prompt: "Company: Vercel Inc. (vercel.com). Summarize what they do.",
    })
    return { summaryChars: r.summary.length, sources: r.sources.length, suggestedCountry: r.suggestedCountry ?? null }
  })]
}

/** Content pipeline on the fixture profile: research (a tool loop with Gateway caching) and fact extraction (a forced tool). */
async function contentPipeline(): Promise<Check[]> {
  const [{ createMcuAi }, { PIPELINE_MODELS }, { withProfile }, { loadProfile }, fixture, { tool }, { z }] = await Promise.all([
    import("@/lib/content-pipeline/model"), import("@/lib/content-pipeline/models"), import("@/lib/content-pipeline/brand"),
    import("@/lib/content-pipeline/profile"), import("@/lib/__tests__/fixtures/brand-profile.fixture.json"), import("ai"), import("zod"),
  ])
  const active = { profile: loadProfile("milcity", { milcity: (fixture as { profile: unknown }).profile } as Parameters<typeof loadProfile>[1]), versionId: "fixture@v0" }
  // Offline search: two invented results, so the loop runs its steps without a billed web search.
  const results = [
    { url: "https://example.com/news/widget-contract", title: "Example Corp wins a widget contract", excerpt: "Example Corp announced on November 3 that it won a contract to deliver 40 widgets to a test range in Texas." },
    { url: "https://example.org/press/widget-test", title: "Widget completes field test", excerpt: "The widget completed its first field test in October, Example Corp said." },
  ]
  const searchTools = { web_search: tool({ description: "Search the web.", inputSchema: z.object({ objective: z.string().optional(), search_queries: z.array(z.string()).optional() }), execute: async () => ({ results }) }) }
  const calls: ModelCall[] = []
  const ai = createMcuAi({ models: PIPELINE_MODELS, searchTools, onCall: c => calls.push(c) })
  const kind = active.profile.requestKinds[0].kind
  return [
    await timed("content pipeline: research (tool loop)", () => withProfile(active, async () => {
      const r = await ai.research({ kind, count: 1, today: new Date().toISOString().slice(0, 10), recentTitles: [], seeds: null })
      return { candidates: r.candidates.map(c => c.primaryUrl), calls: calls.filter(c => c.step === "research") }
    })),
    await timed("content pipeline: extract facts (forced tool)", () => withProfile(active, async () => {
      const before = calls.length
      if (!ai.extractFacts) throw new Error("extractFacts missing")
      const r = await ai.extractFacts({ story: { sourceTitle: results[0].title, primaryUrl: results[0].url, publisher: "Example Corp", sourceText: results.map(x => x.excerpt).join("\n\n") } as never })
      return { facts: r.facts.length, calls: calls.slice(before) }
    })),
  ]
}

/** Asset generation, both image routes lib/ai-generate.ts takes (generateImage, and a language model's image file), not stored. */
async function images(): Promise<Check[]> {
  const { generateImage, generateText } = await import("ai")
  return [
    await timed("asset: image model (generateImage)", async () => {
      const r = await generateImage({ model: "bfl/flux-2-klein-9b", prompt: "A plain blue square", n: 1, aspectRatio: "1:1" })
      return { bytes: r.images[0]?.uint8Array.length ?? 0, mediaType: r.images[0]?.mediaType }
    }),
    await timed("asset: language image (generateText files)", async () => {
      const r = await generateText({ model: "google/gemini-3.1-flash-lite-image", prompt: "Draw a plain blue square." })
      const f = r.files.find(x => x.mediaType?.startsWith("image/"))
      if (!f) throw new Error("no image file returned")
      return { bytes: f.uint8Array.length, mediaType: f.mediaType }
    }),
  ]
}
