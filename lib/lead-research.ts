// Web-grounded lead research (server-only): the content pipeline's proven pattern (founder, 2026-11-10, "approve b").
//
//   1. Search: a tool loop on GATEWAY_TEXT_MODELS.research with the Gateway's Parallel search tool, which writes its
//      findings as plain notes, each fact with the URL it came from.
//   2. Extract: a separate structured-output call over those notes and the URLs the search actually returned.
//
// Two calls because structured output in the same call as the search tool makes the model answer at once from memory
// instead of searching (lib/content-pipeline/model.ts research, production, 2026-10-17). Sources are the search
// results' own URLs, never one the model typed, so what is stored as a source was really read.
//
// Searches are billed per call ($5 per 1,000 Parallel requests, up to 10 results each; Gateway docs, "Web search",
// read 2026-11-10), so a lead gets at most MAX_SEARCHES. The tool runs on the Gateway's side, so the cap is enforced
// by withdrawing it: required on the first step, offered while searches remain, gone once they are spent.
import { gateway } from "@ai-sdk/gateway"
import { generateText, isStepCount, NoObjectGeneratedError, Output, type StepResult, type Tool, type ToolSet } from "ai"
import { z } from "zod"
import { GATEWAY_TEXT_MODELS, truncated, type GatewayUsage } from "./ai-gateway-text"
import { normalizeUrl, searchResultUrls } from "./content-pipeline/model"
import { callOptions } from "./content-pipeline/models"

/** At most this many billed searches per lead. */
export const MAX_SEARCHES = 3
/** Per-step cap for the search loop: notes are short, but Claude 5 thinks first and the cap counts it (THE TOKEN TRAP). */
export const SEARCH_MAX_TOKENS = 8000
/** The extracted answer is a few hundred tokens of JSON; the rest is headroom for thinking. */
export const EXTRACT_MAX_TOKENS = 4000
/** Kept on the record: enough to show where the summary came from, without bloating the lead. */
const MAX_SOURCES = 8

export interface LeadResearchResult {
  summary: string
  fitRationale: string
  suggestedCountry?: string
  sources: { url: string; title?: string }[]
  /** Billed searches this research made (at most MAX_SEARCHES). */
  searches: number
  /** Token use of the two calls (the loop's steps summed), for the cost of a lead. */
  usage: { search: GatewayUsage; extract: GatewayUsage }
}

// The structured shape the extraction returns. Web-grounded, so values are drawn from live sources, but the caller
// MUST treat this as review-only (never auto-apply suggestedCountry to a lead; compliance depends on it).
const researchSchema = z.object({
  summary: z
    .string()
    .describe("3–4 sentence factual overview of the company: what they do, size/scale, and one recent development."),
  fitRationale: z
    .string()
    .describe("2–3 sentences on why this company might (or might not) fit a Texas/LATAM-focused media company's audiences. Be honest if it's a weak fit."),
  suggestedCountry: z
    .string()
    .optional()
    .describe("Best-guess HQ country name from the research (e.g. 'United States'). A suggestion only."),
  sourceUrls: z
    .array(z.string())
    .describe("The search-result URLs the summary rests on, best first, copied exactly from the list."),
})

/** The Parallel search tool as the pipeline wires it, kept small: up to 8 results with short excerpts per search. */
export function researchSearchTool(): Tool {
  return gateway.tools.parallelSearch({ mode: "basic", maxResults: 8, excerpts: { maxCharsPerResult: 2_000 } }) as Tool
}

const searchesIn = (steps: readonly { toolCalls: readonly unknown[] }[]) => steps.reduce((n, s) => n + s.toolCalls.length, 0)

/** Each search result's title by normalized URL, read defensively from the tool's output. */
function titlesIn(steps: readonly StepResult<ToolSet>[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const st of steps) for (const tr of st.toolResults) {
    const results = (tr.output as { results?: { url?: unknown; title?: unknown }[] } | undefined)?.results
    if (Array.isArray(results)) for (const r of results) if (typeof r.url === "string" && typeof r.title === "string") out.set(normalizeUrl(r.url), r.title)
  }
  return out
}

const usageOf = (model: string, r: { finishReason: string; usage: { inputTokens?: number; outputTokens?: number; inputTokenDetails: { cacheReadTokens?: number; cacheWriteTokens?: number }; outputTokenDetails: { reasoningTokens?: number } } }): GatewayUsage => ({
  model, finishReason: r.finishReason, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens,
  reasoningTokens: r.usage.outputTokenDetails.reasoningTokens, cacheReadTokens: r.usage.inputTokenDetails.cacheReadTokens, cacheWriteTokens: r.usage.inputTokenDetails.cacheWriteTokens,
})

/**
 * Research a real company or person already in our system. Throws on failure (the route maps it to 502). NOT for
 * discovery, only enriching known leads. `searchTool` is for tests; production uses the Gateway's Parallel search.
 */
export async function generateLeadResearch(params: { system: string; prompt: string; searchTool?: Tool }): Promise<LeadResearchResult> {
  const model = GATEWAY_TEXT_MODELS.research
  const tools = { web_search: params.searchTool ?? researchSearchTool() }

  const searched = await generateText({
    model,
    tools,
    // The tool loop resends each step, so the Gateway's automatic caching pays here; the routing keeps zero retention.
    providerOptions: callOptions(model, "low", { loop: true }),
    maxOutputTokens: SEARCH_MAX_TOKENS,
    stopWhen: isStepCount(MAX_SEARCHES + 1),
    prepareStep: ({ stepNumber, steps }) =>
      stepNumber === 0 ? { toolChoice: "required" as const }
        : searchesIn(steps) >= MAX_SEARCHES ? { toolChoice: "none" as const, activeTools: [] }
        : {},
    instructions: `${params.system}\n\nSearch the web first (at most ${MAX_SEARCHES} searches); never rely on memory. Then write plain notes: each fact you found, with the exact URL it came from as it appears in the search results.`,
    prompt: params.prompt,
  })
  if (searched.finishReason === "length") throw truncated("Lead research (search)", SEARCH_MAX_TOKENS, searched.usage.outputTokenDetails.reasoningTokens)
  const searches = searchesIn(searched.steps)
  const urls = searchResultUrls(searched.steps)
  const titles = titlesIn(searched.steps)

  let extracted
  try {
    extracted = await generateText({
      model,
      providerOptions: callOptions(model, "low"),
      maxOutputTokens: EXTRACT_MAX_TOKENS,
      output: Output.object({ schema: researchSchema }),
      instructions: `${params.system}\n\nFrom the research notes and the search-result URLs below, fill in the research. Use only what the notes state. For sourceUrls, copy URLs exactly from the list.`,
      prompt: `${params.prompt}\n\nNOTES:\n${searched.text.slice(0, 12_000) || "(none)"}\n\nSEARCH-RESULT URLS:\n${urls.slice(0, 40).join("\n") || "(none)"}`,
    })
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err) && err.finishReason === "length") throw truncated("Lead research (extract)", EXTRACT_MAX_TOKENS, err.usage?.outputTokenDetails.reasoningTokens)
    throw err
  }
  if (extracted.finishReason === "length") throw truncated("Lead research (extract)", EXTRACT_MAX_TOKENS, extracted.usage.outputTokenDetails.reasoningTokens)
  const out = extracted.output

  // Only URLs the search returned count: the model's picks first, then the rest of what was read.
  const returned = new Map(urls.map((u) => [normalizeUrl(u), u]))
  const cited = (out.sourceUrls ?? []).map((u) => returned.get(normalizeUrl(u))).filter((u): u is string => !!u)
  const sources = [...new Set([...cited, ...urls])]
    .slice(0, MAX_SOURCES)
    .map((url) => ({ url, ...(titles.get(normalizeUrl(url)) ? { title: titles.get(normalizeUrl(url)) } : {}) }))

  const usage = { search: usageOf(model, searched), extract: usageOf(model, extracted) }
  console.info("[lead-research]", JSON.stringify({ model, searches, steps: searched.steps.length, resultUrls: urls.length, cited: cited.length, usage }))
  return {
    summary: out.summary,
    fitRationale: out.fitRationale,
    suggestedCountry: out.suggestedCountry?.trim() || undefined,
    sources,
    searches,
    usage,
  }
}
