import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSession, isAuthorizedAdmin, canSend, isCrmSuperAdmin } from "@/lib/auth"
import { getContentPostById, updateContentPost } from "@/lib/firestore-crm"
import type { ContentPostStatus, TaskComment } from "@/components/crm/types"

// POST /api/admin/crm/content-posts/[id]/publish
// Body: { published_url?: string, posted_at?: string }
//
// "Mark as posted" — the manual-assisted close of the loop. An admin posts the
// approved content natively on the platform, then records it here: status →
// "posted", stamps posted_at, and stores the live permalink. Records a comment
// in the thread for the audit trail. Real per-platform API publishing comes
// later; this makes the full produce → review → schedule → posted arc usable
// today.
//
// Any authorized admin can mark posted (it's an operational step, not an
// approval gate). The post must already be approved or scheduled.

export const runtime = "nodejs"

const POSTABLE_FROM: ContentPostStatus[] = ["approved", "scheduled"]
const URL_RE = /^https?:\/\/[^\s]+$/i

interface PublishBody {
  published_url?: string
  posted_at?: string
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isAuthorizedAdmin(session.email)) {
    return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
  }
  // Marking content posted is an outbound publish action — gate it to elevated
  // roles. Producers (intern / crm_only) can draft and submit, not publish.
  if (!canSend(session.role) && !(await isCrmSuperAdmin(session.email))) {
    return NextResponse.json(
      { error: "Forbidden: your role can draft but not publish content" },
      { status: 403 },
    )
  }

  const { id } = await ctx.params

  let body: PublishBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const publishedUrl = typeof body.published_url === "string" ? body.published_url.trim() : ""
  if (publishedUrl && !URL_RE.test(publishedUrl)) {
    return NextResponse.json(
      { error: "Published URL must start with http:// or https://" },
      { status: 400 },
    )
  }
  // Accept a caller-supplied posted_at (e.g. backdating), else stamp now.
  const postedAt =
    typeof body.posted_at === "string" && body.posted_at.trim()
      ? body.posted_at.trim()
      : new Date().toISOString()

  const post = await getContentPostById(id)
  if (!post) {
    return NextResponse.json({ error: "Content post not found" }, { status: 404 })
  }
  if (!POSTABLE_FROM.includes(post.status)) {
    return NextResponse.json(
      { error: `Only approved or scheduled posts can be marked posted (this one is "${post.status}")` },
      { status: 409 },
    )
  }

  const actorName = session.name?.trim() || session.email
  const comment: TaskComment = {
    id: crypto.randomUUID(),
    content: publishedUrl
      ? `${actorName} marked this posted — ${publishedUrl}`
      : `${actorName} marked this posted.`,
    author_name: actorName,
    author_email: session.email,
    created_at: postedAt,
    mentions: [],
  }

  try {
    await updateContentPost(id, {
      status: "posted",
      posted_at: postedAt,
      published_url: publishedUrl || undefined,
      comments: [...(post.comments ?? []), comment],
    })
  } catch (err) {
    console.error(`[content publish ${id}] update failed:`, err)
    return NextResponse.json({ error: "Failed to mark posted" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    status: "posted",
    posted_at: postedAt,
    published_url: publishedUrl || null,
  })
}
