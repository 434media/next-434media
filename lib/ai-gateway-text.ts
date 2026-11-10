// Text + structured-extraction generation through the Vercel AI Gateway
// (server-only). The pipeline's outbound copy + prospecting translator route
// through here instead of calling the Anthropic SDK directly, so all AI usage —
// content (lib/ai-generate.ts) and pipeline — shares one key, one billing
// surface, and one place to manage spend/observability.
//
// Models are plain gateway slugs ("anthropic/claude-…"). The default tier per
// use case is kept identical to the previous direct-Anthropic setup so output
// quality is unchanged; env overrides still win.

import { generateText, APICallError, NoObjectGeneratedError, Output } from "ai"
import type { LanguageModelUsage, ModelMessage, SystemModelMessage, Tool } from "ai"
import { z } from "zod"

// Curated model slugs for pipeline text generation. Confirmed present on
// https://ai-gateway.vercel.sh/v1/models. Env overrides preserve the prior
// behavior (TRANSLATOR_MODEL / ANTHROPIC_MODEL), now pointing at gateway slugs.
export const GATEWAY_TEXT_MODELS = {
  // Outbound lead-outreach drafts — Opus for copy quality. Opus 5 is a drop-in
  // at Opus 4.8's pricing ($5/$25 per MTok).
  outreachDraft: process.env.ANTHROPIC_MODEL || "anthropic/claude-opus-5",
  // Prospecting prompt→filters — Sonnet, a structured extraction task that
  // doesn't need Opus.
  translator: process.env.TRANSLATOR_MODEL || "anthropic/claude-sonnet-5",
  // Lead research — Perplexity Sonar, which searches the web itself on every
  // call (no tool to pass) and supports structured output. It is the only
  // model with built-in browsing on https://ai-gateway.vercel.sh/v1/models
  // (read 2026-11-10: tags web-search, structured-output; $0.25 / $2.50 per M
  // tokens plus $2.50 per 1,000 searches). It replaces
  // openai/gpt-4o-mini-search-preview, which the Gateway no longer lists
  // ("Model … not found", production smoke check, 2026-11-10). Searches are
  // priced per call — guard usage.
  research: process.env.RESEARCH_MODEL || "perplexity/sonar",
} as const

/**
 * Reasoning depth. Lower = fewer thinking tokens, less latency, less spend.
 *
 * THE TOKEN TRAP: on Claude 5 models thinking is ON BY DEFAULT, and maxTokens
 * caps thinking + visible text TOGETHER. A budget sized for the visible answer
 * alone gets eaten by thinking and the response truncates mid-sentence with
 * finishReason "length" — no error, just a cut-off email. Measured on Opus 5
 * with maxTokens 600: 499 tokens went to thinking, 101 to text, truncated.
 *
 * So: always leave headroom above the expected visible answer, and prefer a
 * low effort level over disabling thinking. (Disabling it is a documented
 * footgun on Opus 5 — it can emit tool calls as plain text that silently never
 * run, which would break the translator's forced-tool contract outright.)
 */
export type GatewayEffort = "low" | "medium" | "high" | "xhigh" | "max"

// Anthropic-specific knobs, passed through the Gateway verbatim. Non-Anthropic
// models (e.g. the research model) ignore an unknown `anthropic` key.
function effortOptions(effort?: GatewayEffort) {
  return effort ? { anthropic: { output_config: { effort } } } : undefined
}

/**
 * AI SDK 7 takes system text through `instructions` and, by default, rejects a `role: "system"` message inside
 * `messages` (the guard against a user-supplied message posing as the system prompt). Callers that build a message list
 * with their own system messages first (the content pipeline) spread this in place of `messages`: the leading system
 * messages move to `instructions`, provider options such as a cache marker intact, and the rest stay as messages. A
 * system message after the first non-system one is left where it is, so the SDK still refuses it.
 */
export function withInstructions(messages: ModelMessage[]): { instructions?: SystemModelMessage[]; messages: ModelMessage[] } {
  const first = messages.findIndex((m) => m.role !== "system")
  const lead = (first === -1 ? messages : messages.slice(0, first)) as SystemModelMessage[]
  const rest = first === -1 ? [] : messages.slice(first)
  return { ...(lead.length ? { instructions: lead } : {}), messages: rest }
}

/** What one call cost in tokens, cache reads and writes included (AI SDK 7 usage details). */
export interface GatewayUsage {
  model: string
  finishReason: string
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}
function usageOf(model: string, r: { finishReason: string; usage: LanguageModelUsage }): GatewayUsage {
  return {
    model,
    finishReason: r.finishReason,
    inputTokens: r.usage.inputTokens,
    outputTokens: r.usage.outputTokens,
    reasoningTokens: r.usage.outputTokenDetails.reasoningTokens,
    cacheReadTokens: r.usage.inputTokenDetails.cacheReadTokens,
    cacheWriteTokens: r.usage.inputTokenDetails.cacheWriteTokens,
  }
}

/**
 * The system text as AI SDK 7 `instructions`. With `cache`, it goes as a message block carrying Anthropic's cache
 * marker, so the prefix is written once and read back at ~10% of the input rate. Set it only when the text is large and
 * byte-stable across calls: Sonnet needs at least 1,024 tokens and Opus 5 at least 512, and a shorter prefix silently
 * doesn't cache. Never when it interpolates per-request values, which changes the prefix every call and pays the
 * write premium with no reads. Non-Anthropic models ignore the marker.
 */
function systemInstructions(system: string | undefined, cache: boolean | undefined) {
  if (!system) return {}
  return cache
    ? {
        instructions: {
          role: "system" as const,
          content: system,
          providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } },
        },
      }
    : { instructions: system }
}

/** A finishReason of "length" means the cap cut the answer off; see THE TOKEN TRAP above. */
function truncated(what: string, maxTokens: number | undefined, reasoningTokens: number | undefined): Error {
  return new Error(
    `${what}: output truncated at the ${maxTokens ?? "default"}-token cap ` +
      `(${reasoningTokens ?? 0} tokens went to reasoning). Raise maxTokens or lower effort.`,
  )
}

export interface GatewayTextParams {
  model: string
  system?: string
  prompt: string
  maxTokens?: number
  /** Reasoning depth. Omit for the provider default (`high`). */
  effort?: GatewayEffort
  /** Mark `system` as a cacheable prefix; see systemInstructions for when that pays. */
  cacheSystem?: boolean
  /** Told what the call cost, cache reads and writes included. */
  onUsage?: (usage: GatewayUsage) => void
}

// Plain text generation. Throws on failure (the route maps it to a 502) so the
// behavior matches the previous try/catch around messages.create().
export async function generateGatewayText(params: GatewayTextParams): Promise<string> {
  const result = await generateText({
    model: params.model,
    ...systemInstructions(params.system, params.cacheSystem),
    prompt: params.prompt,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
    ...(effortOptions(params.effort) ? { providerOptions: effortOptions(params.effort)! } : {}),
  })

  // Thinking can consume the whole budget and leave the visible answer cut off
  // mid-sentence. Fail loudly instead of persisting half an email — the caller
  // maps a throw to a 502 the rep can retry.
  params.onUsage?.(usageOf(params.model, result))
  if (result.finishReason === "length") {
    throw truncated("Gateway text", params.maxTokens, result.usage.outputTokenDetails.reasoningTokens)
  }

  return result.text.trim()
}

export interface GatewayToolCallParams {
  model: string
  system?: string
  prompt: string
  maxTokens?: number
  /** Reasoning depth. Omit for the provider default (`high`). */
  effort?: GatewayEffort
  /**
   * Mark the system prompt as a cacheable prefix (e.g. the ICP doc); see
   * systemInstructions for when that pays.
   */
  cacheSystem?: boolean
  /** Told what the call cost, cache reads and writes included. */
  onUsage?: (usage: GatewayUsage) => void
  /** The single tool the model is forced to call. */
  toolName: string
  tool: Tool
}

// Forced single-tool extraction — the AI SDK equivalent of Anthropic's
// `tool_choice: { type: "tool", name }`. Returns the validated tool input. The
// caller supplies a `tool({ inputSchema: z.object(...) })` so the result is
// typed + schema-checked. Throws if the model somehow returns no tool call
// (shouldn't happen with toolChoice forced).
export async function generateGatewayToolCall<TInput = unknown>(
  params: GatewayToolCallParams,
): Promise<TInput> {
  const result = await generateText({
    model: params.model,
    ...systemInstructions(params.system, params.cacheSystem),
    prompt: params.prompt,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
    ...(effortOptions(params.effort) ? { providerOptions: effortOptions(params.effort)! } : {}),
    tools: { [params.toolName]: params.tool },
    toolChoice: { type: "tool", toolName: params.toolName },
  })

  // A forced tool call that the cap cut off never gets here: AI SDK 7 throws a
  // ToolChoiceViolationError itself when the required tool was not called.
  params.onUsage?.(usageOf(params.model, result))
  const call = result.toolCalls.find((c) => c.toolName === params.toolName)
  if (!call) {
    throw new Error(
      `Gateway tool call: model did not call "${params.toolName}" (this should not happen with toolChoice forced)`,
    )
  }
  return call.input as TInput
}

// ── Lead research (web-grounded) ───────────────────────────────────────────

export interface GatewayResearchResult {
  summary: string
  fitRationale: string
  suggestedCountry?: string
  sources: { url: string; title?: string }[]
}

// The structured shape the research model returns. Web-grounded, so values are
// drawn from live sources — but the caller MUST treat this as review-only
// (never auto-apply suggestedCountry to a lead; compliance depends on it).
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
})

// Run web-grounded research on a real company/person already in our system.
// Returns a structured result + the cited sources the model used. Throws on
// failure (route maps to 502). NOT for discovery — only enriching known leads.
/**
 * The research answer is a short JSON object (a few hundred tokens). The cap
 * leaves wide headroom because Sonar is a reasoning model and, as on Claude 5,
 * reasoning counts against it (THE TOKEN TRAP above); unused headroom is free.
 */
export const RESEARCH_MAX_TOKENS = 4000

export async function generateGatewayResearch(params: {
  system: string
  prompt: string
}): Promise<GatewayResearchResult> {
  // A cut-off answer is half a JSON object. AI SDK 7 refuses it itself
  // (NoObjectGeneratedError); name the cause, as the other wrappers do.
  let result
  try {
    result = await generateText({
      model: GATEWAY_TEXT_MODELS.research,
      instructions: params.system,
      prompt: params.prompt,
      maxOutputTokens: RESEARCH_MAX_TOKENS,
      output: Output.object({ schema: researchSchema }),
    })
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err) && err.finishReason === "length") {
      throw truncated("Gateway research", RESEARCH_MAX_TOKENS, err.usage?.outputTokenDetails.reasoningTokens)
    }
    throw err
  }
  if (result.finishReason === "length") {
    throw truncated("Gateway research", RESEARCH_MAX_TOKENS, result.usage.outputTokenDetails.reasoningTokens)
  }

  const out = result.output
  const sources = (result.sources ?? [])
    .filter((s): s is Extract<typeof s, { url: string }> => "url" in s && typeof s.url === "string")
    .map((s) => ({ url: s.url, title: "title" in s && typeof s.title === "string" ? s.title : undefined }))
    // De-dupe by url; cap to keep the stored record lean.
    .filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i)
    .slice(0, 8)

  return {
    summary: out.summary,
    fitRationale: out.fitRationale,
    suggestedCountry: out.suggestedCountry?.trim() || undefined,
    sources,
  }
}

// Re-exported so callers can classify gateway/provider HTTP errors (e.g. 402
// billing) without importing from "ai" directly.
export { APICallError }
