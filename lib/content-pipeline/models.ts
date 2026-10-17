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
export const PIPELINE_MODELS = {
  research: "nvidia/nemotron-3.5-lightning",
  write: "nvidia/nemotron-3.5-lightning",
  photoSearch: "nvidia/nemotron-3.5-lightning",
  photoPick: "meta/llama-4-scout",
  artworkCheck: "meta/llama-4-scout",
} as const
export type PipelineStep = keyof typeof PIPELINE_MODELS

/** The fallback a step moves to when it fails the quality gate (Phase 1b records which, if any). */
export const FALLBACK_MODELS = { text: "anthropic/claude-opus-5.5", vision: "anthropic/claude-sonnet-5.5" } as const

/**
 * Routing per model. Nemotron 3.5 Lightning is served by three providers on the Gateway; deepinfra and fireworks
 * report zero data retention and no training, runinfra reports neither (endpoints listing, 2026-10-17). The Gateway's
 * own flags restrict routing to providers with those agreements and fail the request when none is available, and
 * `only` names the qualifying providers as well, so a provider added later never receives the prompts unreviewed.
 * Llama 4 Scout's two providers (bedrock, deepinfra) both report both, but Bedrock refuses a required tool call for
 * this model ("doesn't support the toolConfig.toolChoice.tool field": preview live check, 2026-10-17), and the vision
 * steps answer through one required tool, so Scout goes to deepinfra only. Anthropic fallbacks keep their default routing.
 */
const ROUTING: Record<string, { only: string[]; zeroDataRetention: true; disallowPromptTraining: true }> = {
  "nvidia/nemotron-3.5-lightning": { only: ["deepinfra", "fireworks"], zeroDataRetention: true, disallowPromptTraining: true },
  "meta/llama-4-scout": { only: ["deepinfra"], zeroDataRetention: true, disallowPromptTraining: true },
}
/** Output caps the provider enforces (Scout: 8,192 completion tokens). */
const MAX_OUTPUT: Record<string, number> = { "meta/llama-4-scout": 8_192 }

/**
 * Provider options for one call. Claude 5 models think by default and maxOutputTokens covers thinking plus output
 * (CLAUDE.md, "The token trap"), so Anthropic calls set effort rather than disabling thinking; other models ignore the
 * `anthropic` key.
 */
export function callOptions(model: string, effort: "low" | "medium" | "high") {
  const gateway = ROUTING[model]
  return {
    ...(model.startsWith("anthropic/") ? { anthropic: { output_config: { effort } } } : {}),
    ...(gateway ? { gateway } : {}),
  }
}
export function outputBudget(model: string, wanted: number): number { return Math.min(wanted, MAX_OUTPUT[model] ?? wanted) }
