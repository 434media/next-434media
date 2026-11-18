/**
 * The Ask panel's model and monthly cap (founder, 2026-11-18, in chat: "go cheap + cap"). No imports, so the Agents
 * page can read the model it shows and examines on.
 *
 * Model: Claude Haiku 5.5 for every turn, whatever the catalog or the pin names. Checked present at
 * https://ai-gateway.vercel.sh/v1/models on 2026-11-18, list price $0.10 in and $0.50 out per million tokens (Sonnet 5.5
 * was $2 and $10). The engine has no step-up to another model, so there is none: Haiku only.
 *
 * Cap: what Ask spent this calendar month (UTC), summed from the cost records (`ai_call_costs`, kind `skill:admin-ask`),
 * at or over the cap refuses the turn before any model call. A turn already running is not stopped, so the month can
 * end a few cents over: one turn's own budget (ASK_TURN_BUDGET_USD) bounds it.
 */
export const ASK_MODEL = "anthropic/claude-haiku-5.5"

/** The default monthly cap, in US dollars. ASK_MONTHLY_CAP_USD in the environment overrides it (see askMonthlyCapUsd). */
export const ASK_MONTHLY_CAP_USD = 10

/** The cost records' kind for an Ask turn: the task kind runAskTurn gives the engine. */
export const ASK_COST_KIND = "skill:admin-ask"

/** The cap in force: ASK_MONTHLY_CAP_USD when it is a positive number, else the default, so a typo cannot lift it. */
export function askMonthlyCapUsd(env: Record<string, string | undefined> = process.env): number {
  const v = env.ASK_MONTHLY_CAP_USD
  const n = Number(v)
  return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : ASK_MONTHLY_CAP_USD
}

/** The first instant of `now`'s calendar month, UTC, as an ISO string the cost records' `at` compares against. */
export function monthStartOf(now: string): string {
  return `${now.slice(0, 7)}-01T00:00:00.000Z`
}

/** "$10" for whole dollars, "$12.50" otherwise. */
export function usd(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

export function askCapMessage(capUsd: number): string {
  return `The Ask panel reached this month's ${usd(capUsd)} limit; it resumes on the 1st.`
}

/** Ask's spend since `since`, from cost records: only Ask's kind, only from `since` on, only finite figures. */
export function askSpendOf(records: { kind?: unknown; at?: unknown; usd?: unknown }[], since: string): number {
  let total = 0
  for (const r of records) {
    if (r.kind !== ASK_COST_KIND || typeof r.at !== "string" || r.at < since) continue
    if (typeof r.usd === "number" && Number.isFinite(r.usd)) total += r.usd
  }
  return total
}
