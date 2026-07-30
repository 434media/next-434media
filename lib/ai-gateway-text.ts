// Text + structured-extraction generation through the Vercel AI Gateway
// (server-only). The pipeline's outbound copy + prospecting translator route
// through here instead of calling the Anthropic SDK directly, so all AI usage —
// content (lib/ai-generate.ts) and pipeline — shares one key, one billing
// surface, and one place to manage spend/observability.
//
// Models are plain gateway slugs ("anthropic/claude-…"). The default tier per
// use case is kept identical to the previous direct-Anthropic setup so output
// quality is unchanged; env overrides still win.

import { generateText, APICallError, Output } from "ai"
import type { Tool } from "ai"
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
  // Lead research — OpenAI's web-search-grounded model. Returns live cited
  // company context. Verified to support structured Output + a `sources[]`
  // array through the gateway. `web_search` priced per call — guard usage.
  research: process.env.RESEARCH_MODEL || "openai/gpt-4o-mini-search-preview",
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
// models (e.g. the OpenAI research model) ignore an unknown `anthropic` key.
function effortOptions(effort?: GatewayEffort) {
  return effort ? { anthropic: { output_config: { effort } } } : undefined
}

export interface GatewayTextParams {
  model: string
  system?: string
  prompt: string
  maxTokens?: number
  /** Reasoning depth. Omit for the provider default (`high`). */
  effort?: GatewayEffort
}

// Plain text generation. Throws on failure (the route maps it to a 502) so the
// behavior matches the previous try/catch around messages.create().
export async function generateGatewayText(params: GatewayTextParams): Promise<string> {
  const result = await generateText({
    model: params.model,
    ...(params.system ? { system: params.system } : {}),
    prompt: params.prompt,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
    ...(effortOptions(params.effort) ? { providerOptions: effortOptions(params.effort)! } : {}),
  })

  // Thinking can consume the whole budget and leave the visible answer cut off
  // mid-sentence. Fail loudly instead of persisting half an email — the caller
  // maps a throw to a 502 the rep can retry.
  if (result.finishReason === "length") {
    throw new Error(
      `Gateway text: output truncated at the ${params.maxTokens ?? "default"}-token cap ` +
        `(${result.usage?.reasoningTokens ?? 0} tokens went to reasoning). ` +
        `Raise maxTokens or lower effort.`,
    )
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
   * Mark the system prompt as a cacheable prefix. Set this when `system` is a
   * large, byte-stable block reused across calls (e.g. the ICP doc) — cache
   * reads bill at ~10% of input rate. Needs ≥1024 tokens on Sonnet, ≥512 on
   * Opus 5; shorter prefixes silently don't cache. Never set it when `system`
   * interpolates per-request values — that changes the prefix every call and
   * you pay the write premium forever with no reads.
   */
  cacheSystem?: boolean
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
  // Attaching cacheControl requires the system prompt to be a message block
  // rather than the plain `system` string, so the two paths differ in shape only.
  // `allowSystemInMessages` silences the SDK's prompt-injection warning: this
  // system text is a build-time constant from the repo, never user input.
  const promptShape =
    params.cacheSystem && params.system
      ? {
          allowSystemInMessages: true as const,
          messages: [
            {
              role: "system" as const,
              content: params.system,
              providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } },
            },
            { role: "user" as const, content: params.prompt },
          ],
        }
      : {
          ...(params.system ? { system: params.system } : {}),
          prompt: params.prompt,
        }

  const result = await generateText({
    model: params.model,
    ...promptShape,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
    ...(effortOptions(params.effort) ? { providerOptions: effortOptions(params.effort)! } : {}),
    tools: { [params.toolName]: params.tool },
    toolChoice: { type: "tool", toolName: params.toolName },
  })

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
export async function generateGatewayResearch(params: {
  system: string
  prompt: string
}): Promise<GatewayResearchResult> {
  const result = await generateText({
    model: GATEWAY_TEXT_MODELS.research,
    system: params.system,
    prompt: params.prompt,
    experimental_output: Output.object({ schema: researchSchema }),
  })

  const out = result.experimental_output
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
