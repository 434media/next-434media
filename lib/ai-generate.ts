// AI Gateway generation client (server-only). Generates images/video through
// the Vercel AI Gateway (one key, many providers), writes the returned bytes
// straight into Vercel Blob, and returns a structured Asset.
//
// Three generation paths:
//   - image (dedicated):  generateImage → result.images[0].{uint8Array, mediaType}
//   - image (language):   generateText  → result.files[] (Nano Banana family;
//                         Gateway types these as `language`, image is a file output)
//   - video:              experimental_generateVideo → result.videos[0].uint8Array (mp4)
// Bytes go directly to Blob — no fetch-from-URL hop, no SSRF surface.
//
// `generateImage`/`generateText` are stable AI SDK v6 exports; video remains
// experimental. Field names (uint8Array / mediaType) verified against a live call.

import {
  generateImage,
  generateText,
  experimental_generateVideo as generateVideo,
  NoImageGeneratedError,
  NoVideoGeneratedError,
  APICallError,
  RetryError,
} from "ai"
import {
  GatewayError,
  GatewayResponseError,
  GatewayRateLimitError,
  GatewayAuthenticationError,
  GatewayModelNotFoundError,
} from "@ai-sdk/gateway"
import { put } from "@vercel/blob"
import crypto from "crypto"
import type { Asset } from "@/components/crm/types"
import { curatedModel } from "@/lib/ai-gateway-models"

// Video generation can take minutes. We pass an abortSignal timeout and, per the
// AI SDK docs, a provider-keyed pollTimeoutMs (default polling is ~5 min). The
// route runs video in an after() callback, so this never blocks the response.
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export interface GenerateResult {
  ok: true
  asset: Asset
}
export interface GenerateError {
  ok: false
  status: number
  error: string
}
export type GenerateOutcome = GenerateResult | GenerateError

// The AI SDK types aspectRatio as the template-literal `${number}:${number}`.
type AspectRatio = `${number}:${number}`

export interface GenerateParams {
  modelId: string
  prompt: string
  /** Reference/input images for edit + remix (image models) or as the source
   *  for image-to-video (video models use the first one). */
  sourceImageUrls?: string[]
  /** Image + video: "{w}:{h}", e.g. "16:9". Ignored by the language-image path. */
  aspectRatio?: AspectRatio
  /** Video only: clip length in seconds. */
  duration?: number
}

function blobName(ext: string): string {
  return `content-posts/${crypto.randomUUID()}.${ext}`
}

// Providers don't error on unsupported params (e.g. an aspectRatio/duration a
// model doesn't honor) — they silently drop them and report via `warnings`.
// Surface those in logs so dropped settings are debuggable instead of invisible.
function logWarnings(modelId: string, warnings: unknown): void {
  if (Array.isArray(warnings) && warnings.length > 0) {
    console.warn("[ai-generate] model warnings:", modelId, JSON.stringify(warnings))
  }
}

function extFromMediaType(mediaType: string, fallback: string): string {
  const sub = mediaType.split("/")[1]
  if (!sub) return fallback
  return sub.replace("quicktime", "mov").replace("jpeg", "jpg")
}

async function storeImage(
  bytes: Uint8Array,
  mediaType: string,
  modelId: string,
  prompt: string,
): Promise<GenerateResult> {
  const blob = await put(blobName(extFromMediaType(mediaType, "png")), Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    contentType: mediaType,
  })
  return {
    ok: true,
    asset: { url: blob.url, kind: "image", source: "ai_gateway", model: modelId, prompt },
  }
}

// Dedicated image model (GPT Image, Flux, Grok, Imagen): generateImage. When
// reference images are supplied, use the object prompt form so the model edits/
// remixes them instead of generating from scratch.
async function runImage(
  modelId: string,
  prompt: string,
  aspectRatio?: AspectRatio,
  images?: string[],
): Promise<GenerateOutcome> {
  const result = await generateImage({
    model: modelId,
    prompt: images && images.length > 0 ? { text: prompt, images } : prompt,
    n: 1,
    ...(aspectRatio ? { aspectRatio } : {}),
  })
  logWarnings(modelId, result.warnings)
  const img = result.images?.[0]
  if (!img?.uint8Array) {
    return { ok: false, status: 502, error: "No image returned by the model" }
  }
  return storeImage(img.uint8Array, img.mediaType || "image/png", modelId, prompt)
}

// Multimodal language model that outputs an image (Nano Banana): generateText,
// then pull the first image file from result.files. Reference images are passed
// as image content parts on the user message (edit / remix).
async function runLanguageImage(
  modelId: string,
  prompt: string,
  images?: string[],
): Promise<GenerateOutcome> {
  const result = images && images.length > 0
    ? await generateText({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...images.map((image) => ({ type: "image" as const, image })),
            ],
          },
        ],
      })
    : await generateText({ model: modelId, prompt })
  logWarnings(modelId, result.warnings)
  const file = result.files?.find((f) => f.mediaType?.startsWith("image/"))
  if (!file?.uint8Array) {
    return { ok: false, status: 502, error: "No image returned by the model" }
  }
  return storeImage(file.uint8Array, file.mediaType || "image/png", modelId, prompt)
}

// Video model. For image-to-video, pass sourceImageUrl.
async function runVideo(
  modelId: string,
  prompt: string,
  sourceImageUrl?: string,
  aspectRatio?: AspectRatio,
  duration?: number,
): Promise<GenerateOutcome> {
  // Provider key for pollTimeoutMs = the model id's creator prefix (e.g. "google").
  const provider = modelId.split("/")[0]
  const result = await generateVideo({
    // Plain string model id routes through the default AI Gateway provider.
    model: modelId,
    // image-to-video uses the { image, text } prompt form; text-to-video a string
    prompt: sourceImageUrl ? { image: sourceImageUrl, text: prompt } : prompt,
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(duration ? { duration } : {}),
    // No SDK retries. The Gateway rate-limits video to 1 request/minute on
    // balances under $100, so an immediate retry always re-hits the same wall —
    // it just wastes ~minutes and buries the real cause in a RetryError. We
    // surface the quota error cleanly instead (see classifyGenerationError).
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(VIDEO_TIMEOUT_MS),
    providerOptions: { [provider]: { pollTimeoutMs: VIDEO_TIMEOUT_MS } },
  })
  logWarnings(modelId, result.warnings)
  const vid = result.videos?.[0]
  if (!vid?.uint8Array) {
    return { ok: false, status: 502, error: "No video returned by the model" }
  }
  const blob = await put(blobName("mp4"), Buffer.from(vid.uint8Array), {
    access: "public",
    addRandomSuffix: false,
    contentType: "video/mp4",
  })
  return {
    ok: true,
    asset: { url: blob.url, kind: "video", source: "ai_gateway", model: modelId, prompt },
  }
}

// Public entry — routes to the right path based on the curated model. Never
// throws; returns a typed outcome so the route can map errors cleanly.
export async function generateAsset(opts: GenerateParams): Promise<GenerateOutcome> {
  const model = curatedModel(opts.modelId)
  if (!model) {
    return { ok: false, status: 400, error: "Unknown or unsupported model" }
  }
  try {
    const images = opts.sourceImageUrls?.filter(Boolean)
    if (model.kind === "video") {
      // Video models take a single source image (image-to-video).
      return await runVideo(opts.modelId, opts.prompt, images?.[0], opts.aspectRatio, opts.duration)
    }
    return model.viaLanguage
      ? await runLanguageImage(opts.modelId, opts.prompt, images)
      : await runImage(opts.modelId, opts.prompt, opts.aspectRatio, images)
  } catch (err) {
    return classifyGenerationError(err)
  }
}

// Map a generation error to a typed outcome. Uses the AI SDK's typed error
// classes (more reliable than string matching) and falls back to a message
// regex only when no class matches.
function classifyGenerationError(err: unknown): GenerateError {
  // Unwrap RetryError → the real last cause. The SDK wraps retried failures as
  // "Failed after N attempts…", which buries the actual provider error.
  if (RetryError.isInstance(err)) {
    return classifyGenerationError(err.lastError)
  }

  // AI Gateway errors are their own class tree (they extend Error, NOT
  // APICallError), so without this branch they fall through to the opaque
  // message fallback. Handle them first — and crucially UNMASK
  // GatewayResponseError: the gateway emits a generic "Invalid error response
  // format: Gateway request failed" whenever it can't fit the upstream
  // provider's error body into its own schema, hiding the real cause on
  // .response / .validationError. Log those so the actual failure is visible.
  if (GatewayError.isInstance(err)) {
    const status = err.statusCode || 0
    if (GatewayResponseError.isInstance(err)) {
      console.error("[ai-generate] gateway could not parse the provider's response:", {
        statusCode: err.statusCode,
        response: err.response,
        validationError: err.validationError?.message,
      })
    } else {
      console.error("[ai-generate] gateway error:", err.name, err.statusCode, err.message)
    }

    if (GatewayAuthenticationError.isInstance(err)) {
      return { ok: false, status: 401, error: "AI Gateway authentication failed — check AI_GATEWAY_API_KEY." }
    }
    if (GatewayRateLimitError.isInstance(err) || status === 429) {
      return {
        ok: false,
        status: 429,
        error: "Rate limit reached — the Gateway allows 1 video per minute on this plan. Wait a minute and try again, or add credits to raise the limit.",
      }
    }
    if (GatewayModelNotFoundError.isInstance(err)) {
      return { ok: false, status: 404, error: "This model isn't available on the AI Gateway right now. Pick another model." }
    }
    if (status === 402) {
      return { ok: false, status: 402, error: "The AI Gateway account is out of credits. Add credits in the Vercel dashboard." }
    }
    if (GatewayResponseError.isInstance(err)) {
      // Surface whatever the provider actually returned, if it's human-readable.
      const raw =
        typeof err.response === "string"
          ? err.response
          : err.response
            ? JSON.stringify(err.response)
            : ""
      const detail = raw && raw !== "{}" ? ` (provider said: ${raw.slice(0, 300)})` : ""
      return {
        ok: false,
        status: status >= 400 ? status : 502,
        error: `The video provider returned a response the Gateway couldn't read${detail}. This usually means the generation timed out or the request was rejected — try again, shorten the clip, or pick another video model.`,
      }
    }
    return { ok: false, status: status >= 400 ? status : 502, error: err.message }
  }

  // Provider/HTTP error — carries a real status code. Distinguish a temporary
  // rate-limit (429, or a quota message) from true credit exhaustion (402):
  // they need different user guidance ("wait a minute" vs "add credits").
  if (APICallError.isInstance(err)) {
    const status = err.statusCode
    const msg = err.message || ""
    // Gateway video quota = 1/min under $100; it reports as a rate-limit but the
    // message also mentions credits, so match on the per-minute/quota wording.
    const isRateLimit = status === 429 || /per minute|rate limit|quota of \d+ request/i.test(msg)
    if (isRateLimit) {
      return {
        ok: false,
        status: 429,
        error: "Rate limit reached — the Gateway allows 1 video per minute on this plan. Wait a minute and try again, or add credits to raise the limit.",
      }
    }
    if (status === 402 || /insufficient|add credits|top up|balance/i.test(msg)) {
      return {
        ok: false,
        status: 402,
        error: "The AI Gateway account is out of credits. Add credits in the Vercel dashboard.",
      }
    }
    return { ok: false, status: status && status >= 400 ? status : 502, error: err.message }
  }

  // Model ran but produced nothing usable. `cause` carries the underlying
  // reason for logging/debugging. (Checked separately so TS keeps each error's
  // type — an `||` would narrow the shared binding to `never`.)
  if (NoImageGeneratedError.isInstance(err)) {
    console.error("[ai-generate] no image generated:", err.cause ?? err.message)
    return { ok: false, status: 502, error: "The model didn't return any media. Try again or pick another model." }
  }
  if (NoVideoGeneratedError.isInstance(err)) {
    console.error("[ai-generate] no video generated:", err.cause ?? err.message)
    return { ok: false, status: 502, error: "The model didn't return any media. Try again or pick another model." }
  }

  // Fallback: classify from the message text when no typed class matched.
  const message = err instanceof Error ? err.message : "Generation failed"
  if (/per minute|rate limit|quota of \d+ request/i.test(message)) {
    return {
      ok: false,
      status: 429,
      error: "Rate limit reached — the Gateway allows 1 video per minute on this plan. Wait a minute and try again, or add credits to raise the limit.",
    }
  }
  if (/credit|insufficient|payment|billing|top up|balance/i.test(message)) {
    return { ok: false, status: 402, error: "The AI Gateway account is out of credits. Add credits in the Vercel dashboard." }
  }
  return { ok: false, status: 502, error: message }
}
