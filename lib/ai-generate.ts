// AI Gateway generation client (server-only). Generates images/video through
// the Vercel AI Gateway (one key, many providers), writes the returned bytes
// straight into Vercel Blob, and returns a structured Asset.
//
// Replaces the Higgsfield REST client. Unlike Higgsfield (submit → poll → fetch
// URL), the Gateway returns raw bytes inline:
//   - image: experimental_generateImage → result.images[0].{uint8ArrayData, mediaType}
//   - video: experimental_generateVideo → result.videos[0].{uint8Array}  (mp4)
// Bytes go directly to Blob — no fetch-from-URL hop, no SSRF surface.
//
// Field names verified against a live Imagen 4 call (AI SDK v6): images use
// `uint8ArrayData`/`mediaType`; videos use `uint8Array` (per Gateway video docs).

import { experimental_generateImage as generateImage, experimental_generateVideo as generateVideo } from "ai"
import { createGateway } from "@ai-sdk/gateway"
import { put } from "@vercel/blob"
import { Agent } from "undici"
import crypto from "crypto"
import type { Asset } from "@/components/crm/types"
import { curatedKind } from "@/lib/ai-gateway-models"

// Video generation can take several minutes; the default Undici fetch enforces
// a 5-minute timeout. A custom gateway instance with a longer agent timeout
// avoids premature aborts. Used only for video.
const videoGateway = createGateway({
  fetch: (url, init) =>
    fetch(url, {
      ...init,
      // dispatcher is an undici extension to RequestInit, not in DOM lib types
      dispatcher: new Agent({
        headersTimeout: 15 * 60 * 1000,
        bodyTimeout: 15 * 60 * 1000,
      }),
    } as RequestInit),
})

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

function blobName(ext: string): string {
  return `content-posts/${crypto.randomUUID()}.${ext}`
}

function extFromMediaType(mediaType: string, fallback: string): string {
  const sub = mediaType.split("/")[1]
  if (!sub) return fallback
  return sub.replace("quicktime", "mov").replace("jpeg", "jpg")
}

// Generate an image and store it. modelId must be a curated image model.
async function runImage(
  modelId: string,
  prompt: string,
): Promise<GenerateOutcome> {
  const result = await generateImage({ model: modelId, prompt, n: 1 })
  const img = result.images?.[0]
  if (!img?.uint8Array) {
    return { ok: false, status: 502, error: "No image returned by the model" }
  }
  const mediaType = img.mediaType || "image/png"
  const blob = await put(blobName(extFromMediaType(mediaType, "png")), Buffer.from(img.uint8Array), {
    access: "public",
    addRandomSuffix: false,
    contentType: mediaType,
  })
  return {
    ok: true,
    asset: { url: blob.url, kind: "image", source: "ai_gateway", model: modelId, prompt },
  }
}

// Generate a video and store it. For image-to-video, pass sourceImageUrl.
async function runVideo(
  modelId: string,
  prompt: string,
  sourceImageUrl?: string,
): Promise<GenerateOutcome> {
  const result = await generateVideo({
    model: videoGateway.video(modelId),
    // image-to-video uses the { image, text } prompt form; text-to-video a string
    prompt: sourceImageUrl ? { image: sourceImageUrl, text: prompt } : prompt,
  })
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

// Public entry — routes to image or video based on the curated model's kind.
// Never throws; returns a typed outcome so the route can map errors cleanly.
export async function generateAsset(opts: {
  modelId: string
  prompt: string
  sourceImageUrl?: string
}): Promise<GenerateOutcome> {
  const kind = curatedKind(opts.modelId)
  if (!kind) {
    return { ok: false, status: 400, error: "Unknown or unsupported model" }
  }
  try {
    return kind === "image"
      ? await runImage(opts.modelId, opts.prompt)
      : await runVideo(opts.modelId, opts.prompt, opts.sourceImageUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed"
    // Surface insufficient-credit / billing as a distinct status so the UI can
    // show a clean "generation unavailable" state.
    if (/credit|quota|insufficient|payment|billing/i.test(message)) {
      return { ok: false, status: 402, error: message }
    }
    return { ok: false, status: 502, error: message }
  }
}
