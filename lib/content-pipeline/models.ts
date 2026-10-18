/**
 * Per-step model settings for the content pipeline, reached through the Vercel AI Gateway (one key, one billing
 * surface: CLAUDE.md "Working on the AI paths"). Each step's model is one named setting, so changing a model is a
 * one-line change here.
 *  - Text steps (research, writing, photo search): anthropic/claude-haiku-5.5 (founder, 2026-10-18, plan v8: "Haiku
 *    first … Let's lock it in and proceed"), $0.10 / $0.50 per M tokens up to 100,000 input tokens a call. It replaces
 *    nvidia/nemotron-3.5-lightning (plan v5, 2026-10-17), which put 1 of 7 drafts in Review in gate round 4.
 *  - Text fallback: meta/llama-3.3-70b, open weights, Bedrock only, 128k context, tool use but no structured output.
 *    Claude Opus 5.5 is no longer a text fallback (Gateway tokens are billed apart from any Claude plan).
 *  - Vision steps (photo pick with subject boxes, artwork check): Claude Sonnet 5.5 since gate round 1 (below).
 *  - The crop is computed in code (worker.ts zoomCrop), not by a model.
 * Every slug was checked against https://ai-gateway.vercel.sh/v1/models: the text models on 2026-10-18, the rest on
 * 2026-10-17.
 */
export const TEXT_MODEL = "anthropic/claude-haiku-5.5"
/** The fallback a step's call moves to when its model can't answer (CALL_FALLBACK), and a step's setting when it fails the gate. */
export const FALLBACK_MODELS = { text: "meta/llama-3.3-70b", vision: "anthropic/claude-sonnet-5.5" } as const
/** The founder's vision default, kept for the record and for moving a step back once its provider can serve it. */
export const SCOUT = "meta/llama-4-scout"
/**
 * Quality gate round 1 (production, 2026-10-17 18:40Z, seven runs): Scout answered 2 of 11 vision calls. Every other
 * one failed over to bedrock, which refuses the single-tool "required" choice ("This model doesn't support the
 * toolConfig.toolChoice.any field"), and went to the fallback. A step that falls short moves to its fallback (plan
 * v5, Phase 1 step 4), so photoPick and artworkCheck run on Sonnet 5.5. The text steps run on Haiku 5.5 (plan v8).
 */
export const PIPELINE_MODELS = {
  research: TEXT_MODEL,
  write: TEXT_MODEL,
  photoSearch: TEXT_MODEL,
  photoPick: FALLBACK_MODELS.vision,
  artworkCheck: FALLBACK_MODELS.vision,
} as const
export type PipelineStep = keyof typeof PIPELINE_MODELS
/**
 * Per call: when a step's model can't answer (every qualifying provider at capacity, a refused request, no tool call,
 * a truncated answer), the same call goes once to its fallback, under the same zero-retention and no-training routing,
 * and the draft's `calls` record it. Llama 3.3 70B may refuse the forced-tool steps on Bedrock, and a research pass
 * can outgrow its 128k context; when the fallback fails too, servedCall logs both reasons and the step fails with
 * them, so it is never silent.
 */
export const CALL_FALLBACK: Partial<Record<PipelineStep, string>> = { research: FALLBACK_MODELS.text, write: FALLBACK_MODELS.text, photoSearch: FALLBACK_MODELS.text, photoPick: FALLBACK_MODELS.vision, artworkCheck: FALLBACK_MODELS.vision }

/**
 * Routing per model. Nemotron 3.5 Lightning is served by three providers on the Gateway; deepinfra and fireworks
 * report zero data retention and no training, runinfra reports neither (endpoints listing, 2026-10-17). The Gateway's
 * own flags restrict routing to providers with those agreements and fail the request when none is available, and
 * `only` names the qualifying providers as well, so a provider added later never receives the prompts unreviewed.
 * Llama 4 Scout's two providers (deepinfra, bedrock) both report both. Bedrock refused a NAMED tool for Scout
 * ("doesn't support the toolConfig.toolChoice.tool field": preview, 2026-10-17); its API limits a named tool to
 * Claude 3 and Nova and states no model limit on "any", which is what the vision steps' required single tool maps to.
 * With deepinfra alone the run stopped when deepinfra was at capacity (preview, 2026-10-17), so both are allowed,
 * deepinfra first, and CALL_FALLBACK covers the case where neither can answer. Haiku 5.5 and Sonnet 5.5 are served by
 * anthropic, bedrock, claudeaws and vertexAnthropic, all reporting zero retention and no training (Haiku 2026-10-18,
 * Sonnet 2026-10-17), and get the same enforced flags. Llama 3.3 70B is served by bedrock alone, which reports both
 * (2026-10-18). Nemotron's entry stays for moving a step back to it.
 */
const ROUTING: Record<string, { order?: string[]; only: string[]; zeroDataRetention: true; disallowPromptTraining: true }> = {
  "nvidia/nemotron-3.5-lightning": { only: ["deepinfra", "fireworks"], zeroDataRetention: true, disallowPromptTraining: true },
  "meta/llama-4-scout": { order: ["deepinfra", "bedrock"], only: ["deepinfra", "bedrock"], zeroDataRetention: true, disallowPromptTraining: true },
  "anthropic/claude-sonnet-5.5": { only: ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"], zeroDataRetention: true, disallowPromptTraining: true },
  "anthropic/claude-haiku-5.5": { only: ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"], zeroDataRetention: true, disallowPromptTraining: true },
  "meta/llama-3.3-70b": { only: ["bedrock"], zeroDataRetention: true, disallowPromptTraining: true },
}
/** Output caps the provider enforces (Scout and Llama 3.3 70B on Bedrock: 8,192 completion tokens). */
const MAX_OUTPUT: Record<string, number> = { "meta/llama-4-scout": 8_192, "meta/llama-3.3-70b": 8_192 }

/**
 * Provider options for one call. Claude 5 models think by default and maxOutputTokens covers thinking plus output
 * (CLAUDE.md, "The token trap"), so Anthropic calls set effort rather than disabling thinking; other models ignore the
 * `anthropic` key. Models without an entry (a step moved to another model) keep the Gateway's default routing.
 */
export function callOptions(model: string, effort: "low" | "medium" | "high") {
  const gateway = ROUTING[model]
  return {
    ...(model.startsWith("anthropic/") ? { anthropic: { output_config: { effort } } } : {}),
    ...(gateway ? { gateway } : {}),
  }
}
export function outputBudget(model: string, wanted: number): number { return Math.min(wanted, MAX_OUTPUT[model] ?? wanted) }
