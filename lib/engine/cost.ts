/**
 * The cost of one model call (434 build sequence V1 item 2, Foundation A: "Cost per task recorded from day one, with
 * Gateway prices checked live and dated before any estimate is relied on"; build plan v3 pre-mortem 6; master 11.6).
 *
 * Two figures, kept apart:
 *  - `billedUsd`: what the Gateway says it charged, read from the response's provider metadata (`gateway.cost`). This
 *    is the figure that is relied on.
 *  - `listUsd`: tokens × the list price read live from https://ai-gateway.vercel.sh/v1/models, with the time the price
 *    was read (`priceCheckedAt`). An estimate, kept so a call the Gateway did not price still has a figure, and so a
 *    drift between list and billed shows up.
 *
 * Pure: no Firestore. lib/engine/cost-ledger.ts stores the records.
 */

export const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models"

/** Per-token prices in USD, as the Gateway lists them (strings there; numbers here). */
export interface ModelPrice {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  /** Tiered input/output prices (Haiku 5.5 above 100,000 input tokens), lowest tier first. */
  inputTiers?: { min: number; max?: number; cost: number }[]
  outputTiers?: { min: number; max?: number; cost: number }[]
}

export interface PriceTable {
  checkedAt: string
  prices: Map<string, ModelPrice>
}

/** The token counts of one call, in the shape every caller can produce. */
export interface CallTokens {
  input?: number
  /** Input tokens read from cache: billed at the cache-read rate, and part of `input`. */
  cacheRead?: number
  /** Input tokens written to cache: billed at the cache-write rate, and part of `input`. */
  cacheWrite?: number
  output?: number
  reasoning?: number
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN
  return Number.isFinite(n) ? n : undefined
}

function tiers(v: unknown): ModelPrice["inputTiers"] {
  if (!Array.isArray(v)) return undefined
  const out = v
    .map((t: { min?: unknown; max?: unknown; cost?: unknown }) => ({ min: num(t?.min) ?? 0, max: num(t?.max), cost: num(t?.cost) }))
    .filter((t): t is { min: number; max: number | undefined; cost: number } => t.cost !== undefined)
    .map((t) => (t.max === undefined ? { min: t.min, cost: t.cost } : { min: t.min, max: t.max, cost: t.cost }))
  return out.length ? out.sort((a, b) => a.min - b.min) : undefined
}

/** The /v1/models response as a price table. Models without a price are left out. */
export function parsePriceTable(body: unknown, checkedAt: string): PriceTable {
  const prices = new Map<string, ModelPrice>()
  const data = (body as { data?: unknown })?.data
  for (const m of Array.isArray(data) ? data : []) {
    const id = (m as { id?: unknown })?.id
    const p = (m as { pricing?: Record<string, unknown> })?.pricing
    if (typeof id !== "string" || !p || typeof p !== "object") continue
    const price: ModelPrice = {}
    const input = num(p.input), output = num(p.output), cacheRead = num(p.input_cache_read), cacheWrite = num(p.input_cache_write)
    if (input !== undefined) price.input = input
    if (output !== undefined) price.output = output
    if (cacheRead !== undefined) price.cacheRead = cacheRead
    if (cacheWrite !== undefined) price.cacheWrite = cacheWrite
    const it = tiers(p.input_tiers), ot = tiers(p.output_tiers)
    if (it) price.inputTiers = it
    if (ot) price.outputTiers = ot
    if (Object.keys(price).length) prices.set(id, price)
  }
  return { checkedAt, prices }
}

/** The per-token rate for a call of `inputTotal` input tokens: the tier that holds it, else the flat rate. */
function rate(flat: number | undefined, t: ModelPrice["inputTiers"], inputTotal: number): number | undefined {
  if (t?.length) {
    const hit = t.find((x) => inputTotal >= x.min && (x.max === undefined || inputTotal < x.max))
    if (hit) return hit.cost
  }
  return flat
}

/**
 * List-price estimate in USD, or undefined when the model has no price or the call has no token counts. Cache reads
 * and writes are charged at their own rates and the rest of the input at the input rate; output (which includes
 * reasoning on Claude 5) at the output rate.
 */
export function listCostUsd(price: ModelPrice | undefined, t: CallTokens): number | undefined {
  if (!price || (t.input === undefined && t.output === undefined)) return undefined
  const inputTotal = t.input ?? 0
  const inRate = rate(price.input, price.inputTiers, inputTotal)
  const outRate = rate(price.output, price.outputTiers, inputTotal)
  const cacheRead = Math.min(t.cacheRead ?? 0, inputTotal)
  const cacheWrite = Math.min(t.cacheWrite ?? 0, inputTotal - cacheRead)
  const plain = inputTotal - cacheRead - cacheWrite
  let usd = 0
  if (plain) { if (inRate === undefined) return undefined; usd += plain * inRate }
  if (cacheRead) usd += cacheRead * (price.cacheRead ?? inRate ?? 0)
  if (cacheWrite) usd += cacheWrite * (price.cacheWrite ?? inRate ?? 0)
  if (t.output) { if (outRate === undefined) return undefined; usd += t.output * outRate }
  return round(usd)
}

/** What the Gateway reports it charged, from a response's provider metadata; undefined when it reports nothing. */
export function billedCostUsd(providerMetadata: unknown): number | undefined {
  const c = (providerMetadata as { gateway?: { cost?: unknown } } | undefined)?.gateway?.cost
  const n = num(c)
  return n === undefined ? undefined : round(n)
}

/** Token counts from an AI SDK usage object: the provider-level nested shape or the flat result shape. */
export function tokensOf(usage: unknown): CallTokens {
  const u = (usage ?? {}) as Record<string, unknown>
  const inT = u.inputTokens, outT = u.outputTokens
  if (inT && typeof inT === "object") {
    const i = inT as Record<string, unknown>, o = (outT ?? {}) as Record<string, unknown>
    return clean({ input: num(i.total), cacheRead: num(i.cacheRead), cacheWrite: num(i.cacheWrite), output: num(o.total), reasoning: num(o.reasoning) })
  }
  const id = (u.inputTokenDetails ?? {}) as Record<string, unknown>, od = (u.outputTokenDetails ?? {}) as Record<string, unknown>
  return clean({ input: num(inT), cacheRead: num(id.cacheReadTokens), cacheWrite: num(id.cacheWriteTokens), output: num(outT), reasoning: num(od.reasoningTokens) })
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
}

/** Dollars to a millionth of a cent: enough for Haiku's per-token prices, short enough to read. */
const round = (usd: number) => Math.round(usd * 1e8) / 1e8

/** UTC calendar day of an instant, the budget's day. */
export const dayOf = (at: Date) => at.toISOString().slice(0, 10)

let cached: { table: PriceTable; at: number } | null = null
const PRICE_TTL_MS = 60 * 60_000

/**
 * The live price table, read at most hourly per server instance. Never throws: when the Gateway does not answer, the
 * last table read is used, or none, and the call is recorded without a list estimate rather than not at all.
 */
export async function livePrices(now = Date.now(), fetcher: typeof fetch = fetch): Promise<PriceTable | null> {
  if (cached && now - cached.at < PRICE_TTL_MS) return cached.table
  try {
    const res = await fetcher(GATEWAY_MODELS_URL, { signal: AbortSignal.timeout(5_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const table = parsePriceTable(await res.json(), new Date(now).toISOString())
    cached = { table, at: now }
    return table
  } catch (e) {
    console.warn(`[engine:cost] Gateway price list unavailable (${(e as Error).message}); recording without a list estimate`)
    return cached?.table ?? null
  }
}

/** For tests. */
export function resetPriceCache(): void {
  cached = null
}
