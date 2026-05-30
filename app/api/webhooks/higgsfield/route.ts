import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  getContentPostByGenerationRequestId,
  updateContentPost,
} from "@/lib/firestore-crm"
import { resultAssetUrl, type HiggsfieldResult } from "@/lib/higgsfield"
import { ingestAssetFromUrl } from "@/lib/asset-ingest"

// POST /api/webhooks/higgsfield
// Higgsfield calls this when a generation reaches a final status (completed /
// failed / nsfw) — enabled via ?hf_webhook= on the submit request. On
// completion, ingest the output into Blob and attach it to the matching post.
//
// Idempotent: only acts while the post's generation_status is still "pending",
// so a webhook + the generate route's inline poll can't double-attach.
//
// Higgsfield's docs don't define a webhook signature scheme; we match on the
// request_id (an unguessable UUID we issued) and only ever update a post that
// already references it — so a forged call can't create or hijack posts.

export const runtime = "nodejs"

export async function POST(req: NextRequest): Promise<NextResponse> {
  let event: HiggsfieldResult
  try {
    event = (await req.json()) as HiggsfieldResult
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const requestId = event.request_id
  if (!requestId) {
    return NextResponse.json({ received: true, skipped: "no request_id" })
  }

  const post = await getContentPostByGenerationRequestId(requestId)
  if (!post) {
    // Unknown request — ack so Higgsfield stops retrying.
    return NextResponse.json({ received: true, skipped: "no matching post" })
  }
  // Already finalized (e.g. the inline poll won the race) — no-op.
  if (post.generation_status !== "pending") {
    return NextResponse.json({ received: true, skipped: "already finalized" })
  }

  if (event.status === "failed" || event.status === "nsfw") {
    await updateContentPost(post.id, { generation_status: "failed" })
    return NextResponse.json({ received: true, status: "failed" })
  }

  if (event.status !== "completed") {
    // Non-final status — nothing to do yet.
    return NextResponse.json({ received: true, status: event.status })
  }

  const url = resultAssetUrl(event)
  if (!url) {
    await updateContentPost(post.id, { generation_status: "failed" })
    return NextResponse.json({ received: true, status: "failed", reason: "no asset url" })
  }

  const ingest = await ingestAssetFromUrl(url, {
    source: "higgsfield",
    prompt: post.generation_prompt,
    model: post.generation_model,
    higgsfieldJobId: requestId,
  })
  if (!ingest.ok) {
    await updateContentPost(post.id, { generation_status: "failed" })
    return NextResponse.json({ received: true, status: "failed", reason: ingest.error })
  }

  await updateContentPost(post.id, {
    generation_status: "completed",
    assets: [...(post.assets ?? []), ingest.asset],
  })
  return NextResponse.json({ received: true, status: "completed" })
}
