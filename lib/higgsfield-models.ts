// Higgsfield model registry — the allow-list of models the 434media API key can
// generate with. Client-safe (pure data, no secrets/server imports): the drawer
// imports it to render the picker, and the generate route imports it to validate
// the requested model_id (never accept an arbitrary model_id from the client).
//
// `id` is the Higgsfield model_id = the POST endpoint path
// (https://platform.higgsfield.ai/{id}). Only models with a CONFIRMED id are
// `verified: true` and shown in the picker. To add the rest: open the model in
// the Higgsfield gallery → Playground → copy the model_id from its curl example
// → add an entry and flip verified. See reference_higgsfield_api memory.
//
// The key's roster (cloud.higgsfield.ai gallery): Soul family (t2i) + DoP family
// (i2v) + Soul ID. Nano Banana / Seedance / Kling / Veo are NOT on the API —
// those stay local; operators generate them locally and paste the URL (ingest).

export type HiggsfieldModelKind = "image" | "video"

export interface HiggsfieldModel {
  /** model_id = endpoint path under https://platform.higgsfield.ai/ */
  id: string
  label: string
  kind: HiggsfieldModelKind
  category: string
  /** Only verified (confirmed model_id) models are offered in the picker. */
  verified: boolean
}

export const HIGGSFIELD_MODELS: HiggsfieldModel[] = [
  // ── Confirmed from docs (safe to call) ──
  {
    id: "higgsfield-ai/soul/standard",
    label: "Soul Standard",
    kind: "image",
    category: "Text to Image",
    verified: true,
  },
  {
    id: "higgsfield-ai/dop/standard",
    label: "DoP Standard",
    kind: "video",
    category: "Image to Video",
    verified: true,
  },

  // ── On the account but model_id not yet confirmed. Read each one's exact
  //    model_id from its Playground curl in the gallery, then flip verified. ──
  { id: "higgsfield-ai/soul-v2/standard", label: "Soul V2 Standard", kind: "image", category: "Text to Image", verified: false },
  { id: "higgsfield-ai/soul/cinema", label: "Soul Cinema", kind: "image", category: "Text to Image", verified: false },
  { id: "higgsfield-ai/soul/character", label: "Soul Character", kind: "image", category: "Text to Image", verified: false },
  { id: "higgsfield-ai/soul/reference", label: "Soul Reference", kind: "image", category: "Text to Image", verified: false },
  { id: "higgsfield-ai/popcorn/auto", label: "Popcorn Auto", kind: "image", category: "Text to Image", verified: false },
  { id: "higgsfield-ai/dop/lite", label: "DoP Lite", kind: "video", category: "Image to Video", verified: false },
  { id: "higgsfield-ai/dop/turbo", label: "DoP Turbo", kind: "video", category: "Image to Video", verified: false },
]

/** Models offered in the in-app picker (confirmed model_id only). */
export const GENERATABLE_MODELS = HIGGSFIELD_MODELS.filter((m) => m.verified)

export function findHiggsfieldModel(id: string): HiggsfieldModel | undefined {
  return HIGGSFIELD_MODELS.find((m) => m.id === id)
}
