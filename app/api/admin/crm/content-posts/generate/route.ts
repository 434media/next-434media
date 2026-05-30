import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createContentPost, updateContentPost } from "@/lib/firestore-crm"
import { submitGeneration, getGenerationStatus, resultAssetUrl, isOutOfCreditsError, type HiggsfieldResult } from "@/lib/higgsfield"
import { findHiggsfieldModel } from "@/lib/higgsfield-models"
import { ingestAssetFromUrl } from "@/lib/asset-ingest"
import type { Brand, ContentPost } from "@/components/crm/types"

// POST /api/admin/crm/content-posts/generate
// Body: { modelId, prompt, title?, platform?, image_url?, aspect_ratio?, resolution?, duration? }
//
// "Generate with AI" — creates an ai_drafted content post and kicks off a
// Higgsfield generation. The post appears on the Board immediately (status
// ai_drafted, generation_status pending). Completion is handled two ways,
// whichever lands first (both idempotent): the Higgsfield webhook
// (/api/webhooks/higgsfield) OR a short inline poll here for quick image jobs.
//
// Only models in the verified registry are accepted — never an arbitrary
// client-supplied model_id.

export const runtime = "nodejs"
export const maxDuration = 60

interface GenerateBody {
  modelId?: string
  prompt?: string
  title?: string
  platform?: Brand | ""
  // model-specific knobs
  image_url?: string
  aspect_ratio?: string
  resolution?: string
  duration?: number
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }

  let body: GenerateBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const model = body.modelId ? findHiggsfieldModel(body.modelId) : undefined
  if (!model || !model.verified) {
    return NextResponse.json(
      { error: "Unknown or unsupported model. Pick one from the list." },
      { status: 400 },
    )
  }
  const prompt = (body.prompt ?? "").trim()
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required" }, { status: 400 })
  }
  // Image-to-video models need a source image.
  if (model.kind === "video" && !body.image_url?.trim()) {
    return NextResponse.json(
      { error: "This model animates an image — provide an image URL" },
      { status: 400 },
    )
  }

  // Build the model-specific request body per the Higgsfield API contract.
  const params: Record<string, unknown> =
    model.kind === "image"
      ? {
          prompt,
          aspect_ratio: body.aspect_ratio || "1:1",
          resolution: body.resolution || "1080p",
        }
      : {
          image_url: body.image_url!.trim(),
          prompt,
          duration: body.duration || 5,
        }

  // Webhook target so Higgsfield can notify us on completion (production path).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://434media.com"
  const webhookUrl = `${baseUrl}/api/webhooks/higgsfield`

  // 1) Submit the generation.
  let submission
  try {
    submission = await submitGeneration(`${model.id}?hf_webhook=${encodeURIComponent(webhookUrl)}`, params)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation request failed"
    console.error("[content generate] submit failed:", message)
    // Out-of-credits is an expected operational state, not a bug — flag it so
    // the UI can show a clean "generation unavailable" message + how to fix.
    if (isOutOfCreditsError(message)) {
      return NextResponse.json(
        { error: "Higgsfield account is out of credits — add credits to generate in-app.", code: "out_of_credits" },
        { status: 402 },
      )
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // 2) Create the ai_drafted post immediately so it shows on the Board.
  const title = (body.title ?? "").trim() || `AI draft — ${prompt.slice(0, 48)}`
  let post: ContentPost
  try {
    post = await createContentPost({
      user: session.name || session.email,
      date_created: new Date().toISOString(),
      platform: body.platform || undefined,
      status: "ai_drafted",
      title,
      social_copy: undefined,
      links: [],
      assets: [],
      social_platforms: [],
      generation_status: "pending",
      generation_request_id: submission.request_id,
      generation_model: model.id,
      generation_prompt: prompt,
    })
  } catch (err) {
    console.error("[content generate] create post failed:", err)
    return NextResponse.json({ error: "Failed to create draft post" }, { status: 500 })
  }

  // 3) Best-effort short inline poll — quick image jobs often finish in seconds,
  //    so the asset is ready by the time the drawer reloads. The webhook is the
  //    fallback for slower jobs. Both attach the asset idempotently (the post is
  //    only finalized while generation_status is still "pending").
  if (submission.status === "completed") {
    await finalizeFromResult(post.id, submission, model.id, prompt)
  } else {
    // Poll up to ~5 times with backoff, staying within maxDuration.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 2500))
      try {
        const status = await getGenerationStatus(submission.request_id)
        if (status.status === "completed") {
          await finalizeFromResult(post.id, status, model.id, prompt)
          break
        }
        if (status.status === "failed" || status.status === "nsfw") {
          await updateContentPost(post.id, { generation_status: "failed" })
          break
        }
      } catch {
        // transient — let the webhook handle completion
        break
      }
    }
  }

  return NextResponse.json({ success: true, id: post.id, request_id: submission.request_id })
}

// Ingest the completed output and attach it to the post. Exported-style helper
// kept local; mirrored by the webhook receiver.
async function finalizeFromResult(
  postId: string,
  result: HiggsfieldResult,
  modelId: string,
  prompt: string,
): Promise<void> {
  const url = resultAssetUrl(result)
  if (!url) {
    await updateContentPost(postId, { generation_status: "failed" })
    return
  }
  const ingest = await ingestAssetFromUrl(url, {
    source: "higgsfield",
    prompt,
    model: modelId,
  })
  if (!ingest.ok) {
    await updateContentPost(postId, { generation_status: "failed" })
    return
  }
  await updateContentPost(postId, {
    generation_status: "completed",
    assets: [ingest.asset],
  })
}
