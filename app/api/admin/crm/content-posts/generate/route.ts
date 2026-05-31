import { NextResponse, after } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { createContentPost, updateContentPost } from "@/lib/firestore-crm"
import { generateAsset } from "@/lib/ai-generate"
import { isCuratedModel, curatedKind } from "@/lib/ai-gateway-models"
import type { Brand, ContentPost } from "@/components/crm/types"

// POST /api/admin/crm/content-posts/generate
// Body: { modelId, prompt, title?, platform?, image_url? }
//
// "Generate with AI" via Vercel AI Gateway. Creates an ai_drafted post and
// attaches the generated asset.
//   - Image: synchronous — generate + attach before responding (seconds).
//   - Video: can take minutes, so the post is created immediately (pending) and
//     the generation runs in an after() callback that attaches the asset and
//     flips generation_status. The Board shows the pending draft right away.
//
// Only curated registry models are accepted — never an arbitrary client id.

export const runtime = "nodejs"
// Generous ceiling so the after() video work has room (bounded by plan limit).
export const maxDuration = 300

interface GenerateBody {
  modelId?: string
  prompt?: string
  title?: string
  platform?: Brand | ""
  image_url?: string // optional source image for image-to-video models
  aspect_ratio?: string // "{w}:{h}" — image + video
  duration?: number // seconds — video only
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

  const modelId = body.modelId ?? ""
  const kind = curatedKind(modelId)
  if (!isCuratedModel(modelId) || !kind) {
    return NextResponse.json(
      { error: "Unknown or unsupported model. Pick one from the list." },
      { status: 400 },
    )
  }
  const prompt = (body.prompt ?? "").trim()
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required" }, { status: 400 })
  }
  const sourceImageUrl = body.image_url?.trim() || undefined
  // Validate against the offered set; ignore anything else so a bad value can't
  // reach the model. Typed as the AI SDK's `${number}:${number}` literal.
  const ALLOWED_ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const
  const aspectRatio = ALLOWED_ASPECTS.includes(body.aspect_ratio?.trim() as (typeof ALLOWED_ASPECTS)[number])
    ? (body.aspect_ratio!.trim() as (typeof ALLOWED_ASPECTS)[number])
    : undefined
  const duration = typeof body.duration === "number" && body.duration > 0 ? body.duration : undefined

  // Create the ai_drafted post immediately so it appears on the Board.
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
      generation_model: modelId,
      generation_prompt: prompt,
    })
  } catch (err) {
    console.error("[content generate] create post failed:", err)
    return NextResponse.json({ error: "Failed to create draft post" }, { status: 500 })
  }

  // ── Image: synchronous — attach before responding. ──
  if (kind === "image") {
    const result = await generateAsset({ modelId, prompt, sourceImageUrl, aspectRatio })
    if (!result.ok) {
      await updateContentPost(post.id, { generation_status: "failed" }).catch(() => {})
      const code = result.status === 402 ? "out_of_credits" : undefined
      return NextResponse.json({ error: result.error, code, id: post.id }, { status: result.status })
    }
    await updateContentPost(post.id, {
      generation_status: "completed",
      assets: [result.asset],
    })
    return NextResponse.json({ success: true, id: post.id, status: "completed" })
  }

  // ── Video: run after the response (can take minutes). ──
  after(async () => {
    try {
      const result = await generateAsset({ modelId, prompt, sourceImageUrl, aspectRatio, duration })
      if (!result.ok) {
        await updateContentPost(post.id, { generation_status: "failed" })
        return
      }
      await updateContentPost(post.id, {
        generation_status: "completed",
        assets: [result.asset],
      })
    } catch (err) {
      console.error(`[content generate] video after() failed for ${post.id}:`, err)
      await updateContentPost(post.id, { generation_status: "failed" }).catch(() => {})
    }
  })

  return NextResponse.json({ success: true, id: post.id, status: "pending" })
}
