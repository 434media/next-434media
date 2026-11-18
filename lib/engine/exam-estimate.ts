/**
 * What an exam run is likely to cost, shown before it runs (founder, 2026-11-18). A list-price estimate from the
 * Gateway's live prices, sized from the intake exam's measured runs (434-context run log 2026-11-17-1541): each case
 * read 240k–730k input tokens across its steps, and a 10-case suite cost $2.62–$2.73 on Sonnet 5.5 and $5.37 on Opus
 * 5.5. The model below (six steps a case, 30,000 input and 1,600 output tokens a step) gives $4.56 and $9.12 for those
 * two runs: above what they cost, on purpose, since the estimate decides whether to ask twice.
 */
import { listCostUsd, type ModelPrice } from "./cost"

/** The exam's default model: the cheapest that runs the engine (Ask's model; lib/ask/limits.ts). */
export const EXAM_DEFAULT_MODEL = "anthropic/claude-haiku-5.5"

export const EXAM_STEPS_PER_CASE = 6
export const EXAM_STEP_TOKENS = { input: 30_000, output: 1_600 } as const

/** The estimate in US dollars, or null when the model has no price on the Gateway's list. */
export function examEstimateUsd(price: ModelPrice | undefined, cases: number): number | null {
  const step = listCostUsd(price, { ...EXAM_STEP_TOKENS })
  if (step === undefined) return null
  return Math.round(step * EXAM_STEPS_PER_CASE * Math.max(0, cases) * 100) / 100
}

/**
 * The smoke test's estimate: a fixed set of calls on invented inputs (app/api/admin/engine/smoke): two translator
 * calls, two outreach drafts, lead research with up to three billed searches, two content-pipeline steps and two
 * images. At list prices on 2026-11-18 that is about $0.25; rounded up.
 */
export const SMOKE_ESTIMATE_USD = 0.3
