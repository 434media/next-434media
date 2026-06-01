import { NextResponse, after } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import { generateAsset } from "@/lib/ai-generate"
import { isCuratedModel, curatedKind } from "@/lib/ai-gateway-models"
import {
  createGenerationJob,
  getGenerationJob,
  finishGenerationJob,
} from "@/lib/firestore-generation-jobs"
import { createAsset } from "@/lib/firestore-assets"

// Decoupled AI generation — does NOT create a content post. Produces an Asset
// the caller can download or attach wherever (content post, and later blog/feed).
//
// POST  { modelId, prompt, image_url?, aspect_ratio?, duration? }
//   image → synchronous: returns { asset }.
//   video → returns { jobId, status: "pending" }; generation runs in after()
//           and writes the result to the job. Client polls GET ?jobId=.
// GET   ?jobId=<id> → { status, asset?, error? }

export const runtime = "nodejs"
export const maxDuration = 300

const ALLOWED_ASPECTS = ["1:1", "4:5", "16:9", "9:16", "4:3", "3:4"] as const
type AllowedAspect = (typeof ALLOWED_ASPECTS)[number]

interface GenerateBody {
  modelId?: string
  prompt?: string
  /** Single source image (legacy; image-to-video). */
  image_url?: string
  /** Reference/input images for edit + remix (image models) or i2v source. */
  image_urls?: string[]
  aspect_ratio?: string
  duration?: number
}

async function requireAdmin() {
  const session = await getSession()
  if (!session) return { error: "Unauthorized", status: 401 as const }
  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 as const }
  }
  return { session }
}

// GET — poll a video job.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const jobId = req.nextUrl.searchParams.get("jobId")
  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 })

  const job = await getGenerationJob(jobId)
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  return NextResponse.json({
    success: true,
    status: job.status,
    asset: job.asset ?? null,
    error: job.error ?? null,
  })
}

// POST — start a generation.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin()
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

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
  // Collect reference images from either field; trim, drop empties, cap at 4.
  const sourceImageUrls = [...(body.image_urls ?? []), body.image_url ?? ""]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean)
    .slice(0, 4)
  const aspectRatio = ALLOWED_ASPECTS.includes(body.aspect_ratio?.trim() as AllowedAspect)
    ? (body.aspect_ratio!.trim() as AllowedAspect)
    : undefined
  const duration = typeof body.duration === "number" && body.duration > 0 ? body.duration : undefined

  const createdBy = auth.session.name || auth.session.email

  // ── Image: synchronous — persist to the library + return the asset. ──
  if (kind === "image") {
    const result = await generateAsset({ modelId, prompt, sourceImageUrls, aspectRatio })
    if (!result.ok) {
      const code =
        result.status === 402 ? "out_of_credits" : result.status === 429 ? "rate_limited" : undefined
      return NextResponse.json({ error: result.error, code }, { status: result.status })
    }
    // Library persistence is best-effort — never fail the generation over it.
    await createAsset({ asset: result.asset, created_by: createdBy }).catch((err) =>
      console.error("[generate-asset] library save failed:", err),
    )
    return NextResponse.json({ success: true, asset: result.asset })
  }

  // ── Video: create a job, generate after the response, client polls. ──
  let job
  try {
    job = await createGenerationJob({
      kind: "video",
      model: modelId,
      prompt,
      created_by: createdBy,
    })
  } catch (err) {
    console.error("[generate-asset] create job failed:", err)
    return NextResponse.json({ error: "Failed to start generation" }, { status: 500 })
  }

  after(async () => {
    try {
      const result = await generateAsset({ modelId, prompt, sourceImageUrls, aspectRatio, duration })
      if (result.ok) {
        // Persist to the library, then mark the job complete.
        await createAsset({ asset: result.asset, created_by: createdBy }).catch((err) =>
          console.error("[generate-asset] library save failed:", err),
        )
        await finishGenerationJob(job.id, { asset: result.asset })
      } else {
        await finishGenerationJob(job.id, { error: result.error })
      }
    } catch (err) {
      console.error(`[generate-asset] video after() failed for job ${job.id}:`, err)
      await finishGenerationJob(job.id, { error: "Generation failed" }).catch(() => {})
    }
  })

  return NextResponse.json({ success: true, jobId: job.id, status: "pending" })
}
