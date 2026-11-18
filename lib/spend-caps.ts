/**
 * Monthly spend caps for the paid AI paths (founder, 2026-11-18: no paid AI job that can be done free, unless moving it
 * breaks the system). The Ask panel's cap (lib/ask/limits.ts) is the pattern; this is the same rule for three more
 * paths, in one place:
 *
 *  - engine exams and smoke tests: $5 a month (app/api/admin/engine/exam, engine/smoke);
 *  - image and video generation: $10 a month (app/api/admin/crm/generate-asset);
 *  - intake reply drafts: $5 a month (lib/agent/intake.ts).
 *
 * What a path spent this calendar month (UTC) is summed from the cost records (`ai_call_costs`) by their `kind`. At or
 * over the cap, the path refuses before any model call; when the spend cannot be read it refuses too (fails closed). A
 * run already going is not stopped, so a month can end over by one run: the estimate shown before it bounds that.
 *
 * No imports beyond lib/ask/limits.ts (itself import-free), so client components can read the caps and the wording.
 */
import { monthStartOf, usd } from "./ask/limits"

export { monthStartOf, usd }

export type SpendCapId = "engine-exam" | "asset-generate" | "intake"

export interface SpendCap {
  /** What the person reads: "Engine exams", "Image and video", "Intake drafts". */
  label: string
  /** The default monthly cap, in US dollars. */
  defaultUsd: number
  /** The environment variable that overrides it (a positive number only, so a typo cannot lift it). */
  envVar: string
  /** The cost records' kinds that count against it. */
  kinds: readonly string[]
}

/** The cost-record kinds the paths below write (lib/engine/task-context.ts `kind`). */
export const EXAM_COST_KIND = "engine-exam"
export const SMOKE_COST_KIND = "engine-smoke"
export const ASSET_COST_KIND = "asset-generate"
/** Intake's runs are recorded as `skill:<name>` (lib/agent/intake.ts). */
export const INTAKE_COST_KIND = "skill:434-intake-qualification"

export const SPEND_CAPS: Record<SpendCapId, SpendCap> = {
  "engine-exam": { label: "Engine exams", defaultUsd: 5, envVar: "ENGINE_EXAM_MONTHLY_CAP_USD", kinds: [EXAM_COST_KIND, SMOKE_COST_KIND] },
  "asset-generate": { label: "Image and video", defaultUsd: 10, envVar: "ASSET_GENERATE_MONTHLY_CAP_USD", kinds: [ASSET_COST_KIND] },
  intake: { label: "Intake drafts", defaultUsd: 5, envVar: "INTAKE_MONTHLY_CAP_USD", kinds: [INTAKE_COST_KIND] },
}

/** An exam estimated over this asks a second time before it runs. */
export const EXAM_CONFIRM_OVER_USD = 1

/** The cap in force: the override when it is a positive number, else the default. */
export function monthlyCapUsd(id: SpendCapId, env: Record<string, string | undefined> = process.env): number {
  const cap = SPEND_CAPS[id]
  const v = env[cap.envVar]
  const n = Number(v)
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : cap.defaultUsd
}

/** A path's spend since `since`: only its kinds, only from `since` on, only finite figures. */
export function spendOf(records: { kind?: unknown; at?: unknown; usd?: unknown }[], id: SpendCapId, since: string): number {
  const kinds = SPEND_CAPS[id].kinds
  let total = 0
  for (const r of records) {
    if (typeof r.kind !== "string" || !kinds.includes(r.kind) || typeof r.at !== "string" || r.at < since) continue
    if (typeof r.usd === "number" && Number.isFinite(r.usd)) total += r.usd
  }
  return total
}

export function capMessage(id: SpendCapId, capUsd: number): string {
  return `${SPEND_CAPS[id].label} reached this month's ${usd(capUsd)} limit; it resumes on the 1st.`
}

export const CAP_UNREADABLE_MESSAGE = "This month's spend could not be checked, so nothing ran. Try again."

export type CapDecision =
  | { ok: true; spentUsd: number; capUsd: number }
  | { ok: false; code: "monthly-cap" | "cap-unreadable"; message: string; spentUsd: number | null; capUsd: number }

/** At or over the cap refuses; a spend that could not be read (null) refuses too. */
export function capDecision(id: SpendCapId, spentUsd: number | null, capUsd: number): CapDecision {
  if (spentUsd === null || !Number.isFinite(spentUsd)) return { ok: false, code: "cap-unreadable", message: CAP_UNREADABLE_MESSAGE, spentUsd: null, capUsd }
  if (spentUsd >= capUsd) return { ok: false, code: "monthly-cap", message: capMessage(id, capUsd), spentUsd, capUsd }
  return { ok: true, spentUsd, capUsd }
}

/** "This month: $1.20 of $5", or "unavailable" when the spend could not be read. */
export function monthLine(spentUsd: number | null, capUsd: number): string {
  return `This month: ${spentUsd === null ? "unavailable" : `$${spentUsd.toFixed(2)}`} of ${usd(capUsd)}`
}
