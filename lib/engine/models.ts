/**
 * The engine's model allow-list (434 build sequence V1 item 2, Foundation A: "Model restriction at the Gateway, before
 * the call"). Every language model the site calls by name goes through the guarded default provider
 * (lib/engine/guard.ts), which refuses a slug that is not listed here before any request leaves for the Gateway. An
 * environment override (ANTHROPIC_MODEL, TRANSLATOR_MODEL, RESEARCH_MODEL) that names an unlisted model is refused the
 * same way, so a stray variable cannot move spend to a model nobody chose.
 *
 * This is the code half. The Gateway half is the team's model allow-list in the Vercel dashboard (AI Gateway →
 * Settings), a founder setting: with both, a model has to be chosen twice to be called.
 *
 * Every slug was checked present at https://ai-gateway.vercel.sh/v1/models on 2026-11-11 (506 models listed). Adding a
 * model: check it there, add it here with the date, and say which caller uses it.
 */
export const ENGINE_LANGUAGE_MODELS: Record<string, { usedBy: string; checked: string }> = {
  "anthropic/claude-opus-5": { usedBy: "outreach drafts (lib/ai-gateway-text.ts)", checked: "2026-11-11" },
  "anthropic/claude-sonnet-5": { usedBy: "prospecting translator (lib/ai-gateway-text.ts)", checked: "2026-11-11" },
  "anthropic/claude-sonnet-5.5": { usedBy: "lead research; content pipeline vision steps and fallback", checked: "2026-11-11" },
  "anthropic/claude-haiku-5.5": { usedBy: "content pipeline text steps (lib/content-pipeline/models.ts)", checked: "2026-11-11" },
  "meta/llama-3.3-70b": { usedBy: "content pipeline text fallback", checked: "2026-11-11" },
  "meta/llama-4-scout": { usedBy: "content pipeline, kept for moving a vision step back", checked: "2026-11-11" },
  "nvidia/nemotron-3.5-lightning": { usedBy: "content pipeline, kept for moving a text step back", checked: "2026-11-11" },
  "google/gemini-3.1-flash-lite-image": { usedBy: "image generation through generateText (lib/ai-gateway-models.ts); engine smoke", checked: "2026-11-11" },
  "google/gemini-3-pro-image": { usedBy: "image generation through generateText (lib/ai-gateway-models.ts)", checked: "2026-11-11" },
}

export class ModelNotAllowedError extends Error {
  constructor(readonly model: string) {
    super(`Model "${model}" is not on the engine's allow-list (lib/engine/models.ts); the call was not made`)
    this.name = "ModelNotAllowedError"
  }
}

export function modelAllowed(model: string, list: Record<string, unknown> = ENGINE_LANGUAGE_MODELS): boolean {
  return Object.prototype.hasOwnProperty.call(list, model)
}

export function assertModelAllowed(model: string, list: Record<string, unknown> = ENGINE_LANGUAGE_MODELS): void {
  if (!modelAllowed(model, list)) throw new ModelNotAllowedError(model)
}
