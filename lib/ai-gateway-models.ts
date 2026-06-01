// AI Gateway model registry for in-app content generation.
//
// We curate a short allow-list (first-time-friendly; the Gateway exposes 270+
// models) but enrich label/price/availability LIVE from the Gateway models
// endpoint, so pricing and availability self-update without code changes. A
// curated model that disappears from the Gateway simply stops being offered.
//
// model id = Gateway "creator/model-name". Every id below was confirmed present
// at https://ai-gateway.vercel.sh/v1/models. Higgsfield Soul/DoP are NOT on the
// Gateway — those route through the paste-URL ingest path instead.

export type GenModelKind = "image" | "video"

// Per-model video requirements. The Gateway's /v1/models metadata does NOT
// expose valid aspect ratios or durations (only resolution price tiers), so
// these are curated from each provider's docs. The first entry of each list is
// the default the picker snaps to. Omit the block for a model whose constraints
// haven't been verified — the UI then falls back to the global option set.
export interface VideoConstraints {
  aspectRatios: string[]
  /** Enumerated allowed durations (first = default). For fixed-set models (Veo). */
  durations?: number[]
  /** Continuous duration range in seconds, inclusive. For range models (Seedance). */
  durationRange?: { min: number; max: number; default: number }
}

interface CuratedModel {
  id: string
  label: string
  kind: GenModelKind
  /** Creator prefix — drives the provider logo + grouping. */
  provider: string
  // Some image models (e.g. Google "Nano Banana" gemini-*-image) are typed as
  // `language` on the Gateway and produce images via generateText → result.files,
  // not generateImage. The client switches paths on this flag.
  viaLanguage?: boolean
  // True when the model accepts reference/input images (edit, remix, style). For
  // image kind this enables the "Reference images" path; video models always
  // accept a single source image (image-to-video) regardless of this flag.
  supportsImageInput?: boolean
  /** One-line "good for…" hint shown on the picker card to help a first-time
   *  admin choose between unfamiliar models. */
  blurb?: string
  /** Video models only: the aspect ratios + durations this model accepts.
   *  Omitted when unverified → the picker uses the global fallback options. */
  video?: VideoConstraints
}

// Curated roster. Add verified ids here to grow it — confirm a new id exists via
// /v1/models before adding. Order = display order (first of each kind = default).
const CURATED: CuratedModel[] = [
  // Image
  { id: "openai/gpt-image-2", label: "GPT Image 2", kind: "image", provider: "openai", supportsImageInput: true, blurb: "Versatile all-rounder, great with text in images" },
  { id: "google/gemini-3-pro-image", label: "Nano Banana Pro", kind: "image", provider: "google", viaLanguage: true, supportsImageInput: true, blurb: "Highest quality edits & precise remixes" },
  { id: "google/gemini-2.5-flash-image", label: "Nano Banana", kind: "image", provider: "google", viaLanguage: true, supportsImageInput: true, blurb: "Fast, low-cost edits & remixes" },
  { id: "bfl/flux-2-flex", label: "Flux 2 Flex", kind: "image", provider: "bfl", supportsImageInput: true, blurb: "Artistic, stylized visuals" },
  { id: "xai/grok-imagine-image", label: "Grok Imagine", kind: "image", provider: "xai", supportsImageInput: true, blurb: "Quick, budget-friendly images" },
  { id: "google/imagen-4.0-generate-001", label: "Imagen 4", kind: "image", provider: "google", blurb: "Photoreal, true-to-life images" },
  // Video (text-to-video; image-to-video handled per-model in the client)
  // Veo 3.1: Gateway desc = fixed 8-second clips; Google docs = 16:9 / 9:16 only.
  { id: "google/veo-3.1-generate-001", label: "Veo 3.1", kind: "video", provider: "google", blurb: "Top-quality video with audio", video: { aspectRatios: ["16:9", "9:16"], durations: [8] } },
  { id: "klingai/kling-v3.0-t2v", label: "Kling 3.0", kind: "video", provider: "klingai", blurb: "Smooth, cinematic motion" },
  // Seedance 2.0: 4–15s output, six aspect ratios incl. 21:9 ultrawide.
  { id: "bytedance/seedance-2.0", label: "Seedance 2.0", kind: "video", provider: "bytedance", blurb: "Dynamic action & camera moves", video: { aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], durationRange: { min: 4, max: 15, default: 5 } } },
  { id: "xai/grok-imagine-video", label: "Grok Imagine", kind: "video", provider: "xai", blurb: "Fast, budget-friendly clips" },
]

export interface GatewayModel {
  id: string
  label: string
  kind: GenModelKind
  provider: string
  viaLanguage: boolean
  supportsImageInput: boolean
  /** One-line "good for…" hint for the picker card. */
  blurb: string | null
  /** Human-readable price hint for the picker, e.g. "$0.04 / image" or
   *  "from $0.10 / sec". Null when the list endpoint exposes only token-based
   *  pricing (e.g. GPT Image) that has no clean per-asset unit price. */
  priceLabel: string | null
  /** False when the curated model isn't currently offered by the Gateway. */
  available: boolean
  /** Video models: accepted aspect ratios + durations (null = use global options). */
  video: VideoConstraints | null
}

// The Gateway exposes several pricing shapes depending on the model. We read the
// ones that map to a clean per-asset price and ignore token-only pricing.
interface GatewayPricing {
  image?: string
  video?: string
  request?: string
  image_dimension_quality_pricing?: Array<{ size?: string; cost?: string }>
  video_duration_pricing?: Array<{ cost_per_second?: string }>
}
interface GatewayListEntry {
  id: string
  type?: string
  pricing?: GatewayPricing
}

const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models"
const TTL_MS = 5 * 60 * 1000

let cache: { at: number; data: GatewayModel[] } | null = null

// Trim a string-encoded dollar amount to a tidy display value.
function fmtUsd(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  const fixed = n < 0.01 ? n.toFixed(4) : n.toFixed(2)
  // Drop trailing zeros (0.040 → 0.04, 0.10 → 0.1) but keep at least one decimal.
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")
}

function priceLabelFor(entry: GatewayListEntry | undefined, kind: GenModelKind): string | null {
  const p = entry?.pricing
  if (!p) return null

  if (kind === "image") {
    if (p.image) return `$${fmtUsd(p.image)} / image`
    const dim = p.image_dimension_quality_pricing
    if (dim && dim.length > 0) {
      const def = dim.find((d) => d.size === "default") ?? dim[0]
      if (def?.cost) return `$${fmtUsd(def.cost)} / image`
    }
    return null // token-based (e.g. GPT Image) — no clean per-image unit price
  }

  if (p.video) return `$${fmtUsd(p.video)} / video`
  const dur = p.video_duration_pricing
  if (dur && dur.length > 0) {
    const costs = dur.map((d) => Number(d.cost_per_second)).filter((n) => Number.isFinite(n))
    if (costs.length > 0) return `from $${fmtUsd(String(Math.min(...costs)))} / sec`
  }
  if (p.request) return `$${fmtUsd(p.request)} / request`
  return null
}

// Curated roster enriched with live availability + pricing from the Gateway.
// Falls back to the un-enriched curated list (available=true, no price) if the
// Gateway list can't be fetched — generation can still be attempted, and the
// route surfaces any real error cleanly.
export async function getGatewayModels(): Promise<GatewayModel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  let live: Map<string, GatewayListEntry> | null = null
  try {
    const res = await fetch(MODELS_URL, { cache: "no-store" })
    if (res.ok) {
      const body = (await res.json()) as { data: GatewayListEntry[] }
      live = new Map(body.data.map((m) => [m.id, m]))
    }
  } catch {
    // fall through to un-enriched curated list
  }

  const models: GatewayModel[] = CURATED.map((c) => {
    const entry = live?.get(c.id)
    return {
      id: c.id,
      label: c.label,
      kind: c.kind,
      provider: c.provider,
      viaLanguage: !!c.viaLanguage,
      supportsImageInput: !!c.supportsImageInput,
      blurb: c.blurb ?? null,
      priceLabel: priceLabelFor(entry, c.kind),
      available: live ? live.has(c.id) : true,
      video: c.video ?? null,
    }
  })

  cache = { at: Date.now(), data: models }
  return models
}

// Server-side guard: only ids in the curated allow-list may be generated, so a
// client can never request an arbitrary Gateway model id.
export function isCuratedModel(id: string): boolean {
  return CURATED.some((c) => c.id === id)
}

export function curatedKind(id: string): GenModelKind | null {
  return CURATED.find((c) => c.id === id)?.kind ?? null
}

// Full curated entry (kind + viaLanguage + capabilities) — used by the
// generation client to pick the right SDK path.
export function curatedModel(id: string): Readonly<CuratedModel> | null {
  return CURATED.find((c) => c.id === id) ?? null
}

// Video aspect/duration constraints for a model, or null if unconstrained.
// Single source of truth shared by the picker (UI) and the route (backstop).
export function videoConstraints(id: string): VideoConstraints | null {
  return curatedModel(id)?.video ?? null
}
