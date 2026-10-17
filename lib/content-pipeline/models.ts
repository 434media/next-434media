/**
 * Per-step model settings for the content pipeline, reached through the Vercel AI Gateway (one key, one billing
 * surface: CLAUDE.md "Working on the AI paths"). Each step's model is one named setting, so changing a model is a
 * one-line change here. Defaults set by the founder, 2026-10-17 (build plan v5, Phase 1 step 3):
 *  - text steps (research, writing, photo search): nvidia/nemotron-3.5-lightning, $0.05 / $0.20 per M tokens;
 *  - vision steps (photo pick with subject boxes, artwork check): meta/llama-4-scout, $0.17 / $0.66 per M tokens;
 *  - the crop is computed in code (worker.ts zoomCrop), not by a model;
 *  - fallback: today's models, Claude Opus 5.5 for writing and Sonnet 5.5 for vision.
 * Every slug was checked against https://ai-gateway.vercel.sh/v1/models on 2026-10-17.
 */
/** The fallback a step moves to when it fails the quality gate (Phase 1b records which, if any). */
export const FALLBACK_MODELS = { text: "anthropic/claude-opus-5.5", vision: "anthropic/claude-sonnet-5.5" } as const
/** The founder's vision default, kept for the record and for moving a step back once its provider can serve it. */
export const SCOUT = "meta/llama-4-scout"
/**
 * Quality gate round 1 (production, 2026-10-17 18:40Z, seven runs): Scout answered 2 of 11 vision calls. Every other
 * one failed over to bedrock, which refuses the single-tool "required" choice ("This model doesn't support the
 * toolConfig.toolChoice.any field"), and went to the fallback. A step that falls short moves to its fallback (plan
 * v5, Phase 1 step 4), so photoPick and artworkCheck run on Sonnet 5.5; the text steps stay on Nemotron.
 */
export const PIPELINE_MODELS = {
  research: "nvidia/nemotron-3.5-lightning",
  write: "nvidia/nemotron-3.5-lightning",
  photoSearch: "nvidia/nemotron-3.5-lightning",
  photoPick: FALLBACK_MODELS.vision,
  artworkCheck: FALLBACK_MODELS.vision,
} as const
export type PipelineStep = keyof typeof PIPELINE_MODELS
/**
 * Per call: when a vision step's model can't answer (every qualifying provider at capacity, a refused request, no
 * tool call), the same call goes once to the vision fallback, under the same zero-retention and no-training routing,
 * and the draft's `calls` record it. Text steps have two qualifying Nemotron providers and no automatic fallback.
 */
export const CALL_FALLBACK: Partial<Record<PipelineStep, string>> = { photoPick: FALLBACK_MODELS.vision, artworkCheck: FALLBACK_MODELS.vision }

/**
 * Routing per model. Nemotron 3.5 Lightning is served by three providers on the Gateway; deepinfra and fireworks
 * report zero data retention and no training, runinfra reports neither (endpoints listing, 2026-10-17). The Gateway's
 * own flags restrict routing to providers with those agreements and fail the request when none is available, and
 * `only` names the qualifying providers as well, so a provider added later never receives the prompts unreviewed.
 * Llama 4 Scout's two providers (deepinfra, bedrock) both report both. Bedrock refused a NAMED tool for Scout
 * ("doesn't support the toolConfig.toolChoice.tool field": preview, 2026-10-17); its API limits a named tool to
 * Claude 3 and Nova and states no model limit on "any", which is what the vision steps' required single tool maps to.
 * With deepinfra alone the run stopped when deepinfra was at capacity (preview, 2026-10-17), so both are allowed,
 * deepinfra first, and CALL_FALLBACK covers the case where neither can answer. The Anthropic fallbacks are served by
 * anthropic, bedrock, claudeaws and vertexAnthropic, all reporting zero retention and no training (2026-10-17), and
 * get the same enforced flags.
 */
const ROUTING: Record<string, { order?: string[]; only: string[]; zeroDataRetention: true; disallowPromptTraining: true }> = {
  "nvidia/nemotron-3.5-lightning": { only: ["deepinfra", "fireworks"], zeroDataRetention: true, disallowPromptTraining: true },
  "meta/llama-4-scout": { order: ["deepinfra", "bedrock"], only: ["deepinfra", "bedrock"], zeroDataRetention: true, disallowPromptTraining: true },
  "anthropic/claude-sonnet-5.5": { only: ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"], zeroDataRetention: true, disallowPromptTraining: true },
  "anthropic/claude-opus-5.5": { only: ["anthropic", "bedrock", "claudeaws", "vertexAnthropic"], zeroDataRetention: true, disallowPromptTraining: true },
}
/** Output caps the provider enforces (Scout: 8,192 completion tokens). */
const MAX_OUTPUT: Record<string, number> = { "meta/llama-4-scout": 8_192 }

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
