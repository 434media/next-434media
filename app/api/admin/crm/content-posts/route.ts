import { type NextRequest, NextResponse } from "next/server"
import { getSession, isAuthorizedAdmin } from "@/lib/auth"
import {
  getContentPosts,
  getContentPostById,
  createContentPost,
  updateContentPost,
  deleteContentPost,
} from "@/lib/firestore-crm"

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
