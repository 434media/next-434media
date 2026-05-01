import Anthropic from "@anthropic-ai/sdk"

/**
 * Default model for outbound prospecting drafts.
 * Opus is overkill for short templated emails but produces noticeably better
 * lead-specific copy than Sonnet — the per-call cost is small relative to
 * the dollar value of a single warm response, so quality wins.
 *
 * Override via ANTHROPIC_MODEL env var if you want to A/B against Sonnet.
 */
export const DEFAULT_MODEL = "claude-opus-4-7"

let _client: Anthropic | null = null

/**
 * Lazy-init the Anthropic SDK so missing env doesn't crash module load.
 * Throws on first use if ANTHROPIC_API_KEY isn't set — fail-loud at the boundary.
 */
export function getAnthropic(): Anthropic {
  if (_client) return _client
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("Missing required env var: ANTHROPIC_API_KEY")
  _client = new Anthropic({ apiKey: key })
  return _client
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL
}
