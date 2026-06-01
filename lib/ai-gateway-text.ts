// Text + structured-extraction generation through the Vercel AI Gateway
// (server-only). The pipeline's outbound copy + prospecting translator route
// through here instead of calling the Anthropic SDK directly, so all AI usage —
// content (lib/ai-generate.ts) and pipeline — shares one key, one billing
// surface, and one place to manage spend/observability.
//
// Models are plain gateway slugs ("anthropic/claude-…"). The default tier per
// use case is kept identical to the previous direct-Anthropic setup so output
// quality is unchanged; env overrides still win.

import { generateText, APICallError } from "ai"
import type { Tool } from "ai"

// Curated model slugs for pipeline text generation. Confirmed present on
// https://ai-gateway.vercel.sh/v1/models. Env overrides preserve the prior
// behavior (TRANSLATOR_MODEL / ANTHROPIC_MODEL), now pointing at gateway slugs.
export const GATEWAY_TEXT_MODELS = {
  // Outbound lead-outreach drafts — Opus for copy quality (was claude-opus-4-7).
  outreachDraft: process.env.ANTHROPIC_MODEL || "anthropic/claude-opus-4.8",
  // Prospecting prompt→filters — Sonnet, a structured extraction task that
  // doesn't need Opus (was claude-sonnet-4-6).
  translator: process.env.TRANSLATOR_MODEL || "anthropic/claude-sonnet-4.6",
} as const

export interface GatewayTextParams {
  model: string
  system?: string
  prompt: string
  maxTokens?: number
}

// Plain text generation. Throws on failure (the route maps it to a 502) so the
// behavior matches the previous try/catch around messages.create().
export async function generateGatewayText(params: GatewayTextParams): Promise<string> {
  const result = await generateText({
    model: params.model,
    ...(params.system ? { system: params.system } : {}),
    prompt: params.prompt,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
  })
  return result.text.trim()
}

export interface GatewayToolCallParams {
  model: string
  system?: string
  prompt: string
  maxTokens?: number
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
    ...(params.system ? { system: params.system } : {}),
    prompt: params.prompt,
    ...(params.maxTokens ? { maxOutputTokens: params.maxTokens } : {}),
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

// Re-exported so callers can classify gateway/provider HTTP errors (e.g. 402
// billing) without importing from "ai" directly.
export { APICallError }
