// AI Gateway model registry for in-app content generation.
//
// We curate a short allow-list (first-time-friendly; the Gateway exposes 270+
// models) but enrich label/price/availability LIVE from the Gateway models
// endpoint, so pricing and availability self-update without code changes. A
// curated model that disappears from the Gateway simply stops being offered.
//
// model id = Gateway "creator/model-name". Every id below was confirmed present
// at https://ai-gateway.vercel.sh/v1/models. The Higgsfield-specific Soul/DoP
// models are NOT here (the Gateway doesn't host them) — those route through the
// paste-URL ingest path instead. Nano Banana / GPT-Image are not on the Gateway
// either, so they likewise stay on the paste-URL path.

export type GenModelKind = "image" | "video"

interface CuratedModel {
  id: string
  label: string
  kind: GenModelKind
}

// Curated roster (the "recommended starter set"). Add verified ids here to grow
// it — confirm a new id exists via /v1/models before adding.
const CURATED: CuratedModel[] = [
  // Image
  { id: "bfl/flux-2-flex", label: "Flux 2 Flex", kind: "image" },
  { id: "google/imagen-4.0-generate-001", label: "Imagen 4", kind: "image" },
  // Video (text-to-video; image-to-video handled per-model in the generate route)
  { id: "google/veo-3.1-generate-001", label: "Veo 3.1", kind: "video" },
  { id: "klingai/kling-v3.0-t2v", label: "Kling 3.0", kind: "video" },
  { id: "bytedance/seedance-2.0", label: "Seedance 2.0", kind: "video" },
]

export interface GatewayModel {
  id: string
  label: string
  kind: GenModelKind
  /** Human-readable price hint for the dropdown, e.g. "$0.04 / image". Null when
   *  the list endpoint doesn't expose a simple flat unit price — common for
   *  video, which is priced per-second/per-token and varies by resolution. */
  priceLabel: string | null
  /** False when the curated model isn't currently offered by the Gateway. */
  available: boolean
}

interface GatewayPricing {
  image?: string
  video?: string
  request?: string
}
interface GatewayListEntry {
  id: string
  type?: string
  pricing?: GatewayPricing
}

const MODELS_URL = "https://ai-gateway.vercel.sh/v1/models"
const TTL_MS = 5 * 60 * 1000

let cache: { at: number; data: GatewayModel[] } | null = null

function priceLabelFor(entry: GatewayListEntry | undefined, kind: GenModelKind): string | null {
  const p = entry?.pricing
  if (!p) return null
  if (kind === "image" && p.image) return `$${p.image} / image`
  if (kind === "video" && p.video) return `$${p.video} / video`
  if (p.request) return `$${p.request} / request`
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
      priceLabel: priceLabelFor(entry, c.kind),
      available: live ? live.has(c.id) : true,
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
