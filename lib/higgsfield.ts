// Higgsfield API client (server-only). Async generation: submit a request to a
// model endpoint, then poll the status endpoint until completed. The secret key
// never leaves the server — routes call these helpers; the browser never talks
// to platform.higgsfield.ai directly.
//
// API contract (docs.higgsfield.ai/docs): POST {BASE}/{model_id} with
// Authorization: Key {key}:{secret} → { status, request_id, status_url }.
// Poll GET {BASE}/requests/{id}/status → same shape; when completed it carries
// images[].url or video.url. See reference_higgsfield_api memory.

const BASE = "https://platform.higgsfield.ai"

export type HiggsfieldStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "nsfw"

export interface HiggsfieldResult {
  status: HiggsfieldStatus
  request_id: string
  status_url?: string
  images?: { url: string }[]
  video?: { url: string }
}

function authHeader(): string {
  const key = process.env.HIGGSFIELD_API_KEY
  const secret = process.env.HIGGSFIELD_SECRET_KEY
  if (!key || !secret) {
    throw new Error("Missing HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET_KEY")
  }
  return `Key ${key}:${secret}`
}

// Submit a generation request. `params` is the model-specific body (e.g. t2i:
// {prompt, aspect_ratio, resolution}; i2v: {image_url, prompt, duration}).
export async function submitGeneration(
  modelId: string,
  params: Record<string, unknown>,
): Promise<HiggsfieldResult> {
  const res = await fetch(`${BASE}/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Higgsfield surfaces business errors in `detail` (e.g. "not_enough_credits"),
    // and others in message/error — check all three before the generic fallback.
    const msg =
      (data && (data.detail || data.message || data.error)) ||
      `Higgsfield returned ${res.status}`
    throw new Error(typeof msg === "string" ? msg : "Higgsfield request failed")
  }
  return data as HiggsfieldResult
}

// Recognize the "account has no API credits" signal so callers can show a clean
// out-of-credits state instead of a raw error string.
export function isOutOfCreditsError(message: string): boolean {
  return /not_enough_credits|insufficient.*credit|no.*credit/i.test(message)
}

// Poll the status of a previously-submitted request.
export async function getGenerationStatus(requestId: string): Promise<HiggsfieldResult> {
  const res = await fetch(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, {
    method: "GET",
    headers: { Authorization: authHeader(), Accept: "application/json" },
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Higgsfield status returned ${res.status}`)
  }
  return data as HiggsfieldResult
}

// Pull the first output URL from a completed result, regardless of media kind.
export function resultAssetUrl(result: HiggsfieldResult): string | null {
  if (result.video?.url) return result.video.url
  if (result.images && result.images.length > 0) return result.images[0].url
  return null
}
