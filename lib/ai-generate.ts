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
} from "ai"
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
  sourceImageUrl?: string
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
    console.warn(`[ai-generate] ${modelId} warnings:`, JSON.stringify(warnings))
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

// Dedicated image model (Flux, Imagen): generateImage.
async function runImage(
  modelId: string,
  prompt: string,
  aspectRatio?: AspectRatio,
): Promise<GenerateOutcome> {
  const result = await generateImage({
    model: modelId,
    prompt,
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
// then pull the first image file from result.files.
async function runLanguageImage(
  modelId: string,
  prompt: string,
): Promise<GenerateOutcome> {
  const result = await generateText({ model: modelId, prompt })
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
    if (model.kind === "video") {
      return await runVideo(opts.modelId, opts.prompt, opts.sourceImageUrl, opts.aspectRatio, opts.duration)
    }
    return model.viaLanguage
      ? await runLanguageImage(opts.modelId, opts.prompt)
      : await runImage(opts.modelId, opts.prompt, opts.aspectRatio)
  } catch (err) {
    return classifyGenerationError(err)
  }
}

// Map a generation error to a typed outcome. Uses the AI SDK's typed error
// classes (more reliable than string matching) and falls back to a message
// regex only when no class matches.
function classifyGenerationError(err: unknown): GenerateError {
  // Provider/HTTP error — carries a real status code (402 = billing, 429 =
  // rate/quota). Prefer this over guessing from the message.
  if (APICallError.isInstance(err)) {
    const status = err.statusCode
    if (status === 402 || status === 429) {
      return { ok: false, status: 402, error: err.message }
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

  // Fallback: classify billing/quota from the message text.
  const message = err instanceof Error ? err.message : "Generation failed"
  if (/credit|quota|insufficient|payment|billing/i.test(message)) {
    return { ok: false, status: 402, error: message }
  }
  return { ok: false, status: 502, error: message }
}
