import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin, canSend, isCrmSuperAdmin } from "@/lib/auth"
import {
  getContentPosts,
  getContentPostById,
  createContentPost,
  updateContentPost,
  deleteContentPost,
} from "@/lib/firestore-crm"
import { notifyContentNeedsApproval } from "@/lib/content-approval-notification"

// Check admin access
async function requireAdmin() {
  const session = await getSession()

  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }

  if (!isAuthorizedAdmin(session.email)) {
    return { error: "Forbidden: Admin access required", status: 403 }
  }

  return { session }
}

// GET - Fetch content posts
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    // Get single post by ID
    if (id) {
      const post = await getContentPostById(id)
      if (!post) {
        return NextResponse.json(
          { error: "Content post not found" },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, post })
    }

    // Get all posts
    const posts = await getContentPosts()
    return NextResponse.json({ success: true, posts })
  } catch (error) {
    console.error("Error fetching content posts:", error)
    return NextResponse.json(
      { error: "Failed to fetch content posts" },
      { status: 500 }
    )
  }
}

// POST - Create a new content post
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.title || !body.user) {
      return NextResponse.json(
        { error: "Title and user are required" },
        { status: 400 }
      )
    }

    const postData = {
      user: body.user,
      date_created: body.date_created || new Date().toISOString(),
      platform: body.platform || undefined,
      status: body.status || "to_do",
      title: body.title,
      date_to_post: body.date_to_post || undefined,
      notes: body.notes || undefined,
      thumbnail: body.thumbnail || undefined,
      social_copy: body.social_copy || undefined,
      links: body.links || [],
      assets: body.assets || [],
      tags: body.tags || undefined,
      social_platforms: body.social_platforms || [],
      comments: body.comments || [],
    }

    const post = await createContentPost(postData)

    // Created straight into Review → alert the reviewers (best-effort).
    if (post.status === "needs_approval") {
      await notifyContentNeedsApproval(post)
    }

    return NextResponse.json({ success: true, post }, { status: 201 })
  } catch (error) {
    console.error("Error creating content post:", error)
    return NextResponse.json(
      { error: "Failed to create content post" },
      { status: 500 }
    )
  }
}

// PUT - Update a content post
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Capture the prior status so we can tell when a post *enters* Review (vs.
    // an edit to one already there) — the email should fire only on entry.
    const existing = await getContentPostById(id)
    const prevStatus = existing?.status

    // Producers (intern / crm_only) may edit drafts and submit for review, but
    // moving a post INTO an approved/scheduled/posted state is an operator
    // action — gate those transitions by role. Editing a post already in such a
    // state (status unchanged) stays allowed.
    const RESTRICTED_STATUSES = ["approved", "rejected", "scheduled", "posted"]
    if (
      body.status &&
      body.status !== prevStatus &&
      RESTRICTED_STATUSES.includes(body.status) &&
      !canSend(authResult.session.role) &&
      !(await isCrmSuperAdmin(authResult.session.email))
    ) {
      return NextResponse.json(
        { error: "Forbidden: your role can edit drafts but not approve, schedule, or publish content" },
        { status: 403 }
      )
    }

    const updates = {
      user: body.user,
      platform: body.platform,
      status: body.status,
      title: body.title,
      date_to_post: body.date_to_post,
      notes: body.notes,
      thumbnail: body.thumbnail,
      social_copy: body.social_copy,
      links: body.links,
      assets: body.assets,
      tags: body.tags,
      social_platforms: body.social_platforms,
      comments: body.comments,
    }

    // Remove undefined values
    Object.keys(updates).forEach(key => {
      if (updates[key as keyof typeof updates] === undefined) {
        delete updates[key as keyof typeof updates]
      }
    })

    const post = await updateContentPost(id, updates)

    // Entered Review (from any other status) → alert the reviewers. Covers the
    // drawer status dropdown, the Board drag-to-Review, and re-submission after
    // a rejection. Best-effort; never fails the save.
    if (post.status === "needs_approval" && prevStatus !== "needs_approval") {
      await notifyContentNeedsApproval(post)
    }

    return NextResponse.json({ success: true, post })
  } catch (error) {
    console.error("Error updating content post:", error)
    return NextResponse.json(
      { error: "Failed to update content post" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a content post
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Post ID is required" },
        { status: 400 }
      )
    }

    await deleteContentPost(id)

    return NextResponse.json({ success: true, message: "Content post deleted" })
  } catch (error) {
    console.error("Error deleting content post:", error)
    return NextResponse.json(
      { error: "Failed to delete content post" },
      { status: 500 }
    )
  }
}
