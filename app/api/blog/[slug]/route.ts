import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { 
  getBlogPostByIdFromFirestore,
  getBlogPostBySlugFromFirestore,
  updateBlogPostInFirestore, 
  deleteBlogPostFromFirestore
} from "@/app/lib/firestore-blog"
import type { UpdateBlogPostData } from "@/app/types/blog-types"

// Check if user is authenticated and has workspace email
async function requireAdmin() {
  const session = await getSession()
  
  if (!session) {
    return { error: "Unauthorized", status: 401 }
  }
  
  if (!isWorkspaceEmail(session.email)) {
    return { error: "Forbidden: Workspace email required", status: 403 }
  }
  
  return { session }
}

// GET - Fetch a specific blog post (public for published, admin for drafts)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    
    // First try to get by slug (published posts)
    let post = await getBlogPostBySlugFromFirestore(slug)
    
    // If not found by slug, try by ID (for admin access)
    if (!post) {
      post = await getBlogPostByIdFromFirestore(slug)
      
      // If found by ID but it's a draft, require admin access
      if (post && post.status === "draft") {
        const authResult = await requireAdmin()
        if ("error" in authResult) {
          return NextResponse.json(
            { error: "Post not found" },
            { status: 404 }
          )
        }
      }
    }
    
    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error("Error fetching blog post:", error)
    return NextResponse.json(
      { error: "Failed to fetch blog post" },
      { status: 500 }
    )
  }
}

// PATCH - Update a blog post (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { slug } = await params
    const body = await request.json()
    
    // Validate fields if provided
    if (body.title !== undefined && !body.title?.trim()) {
      return NextResponse.json(
        { error: "Title cannot be empty" },
        { status: 400 }
      )
    }
    
    if (body.content !== undefined && !body.content?.trim()) {
      return NextResponse.json(
        { error: "Content cannot be empty" },
        { status: 400 }
      )
    }

    // Try to find the post by ID first (more common for admin edits)
    let post = await getBlogPostByIdFromFirestore(slug)
    
    // If not found by ID, try by slug
    if (!post) {
      post = await getBlogPostBySlugFromFirestore(slug)
    }
    
    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    // Prepare update data
    const updates: UpdateBlogPostData = {
      id: post.id
    }
    
    if (body.title !== undefined) updates.title = body.title.trim()
    if (body.content !== undefined) updates.content = body.content
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt.trim()
    if (body.featured_image !== undefined) updates.featured_image = body.featured_image
    if (body.meta_description !== undefined) updates.meta_description = body.meta_description.trim()
    if (body.category !== undefined) updates.category = body.category
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.status !== undefined) updates.status = body.status
    if (body.author !== undefined) updates.author = body.author

    const updatedPost = await updateBlogPostInFirestore(post.id, updates)
    
    return NextResponse.json({ 
      success: true, 
      post: updatedPost,
      message: "Blog post updated successfully"
    })
  } catch (error) {
    console.error("Error updating blog post:", error)
    return NextResponse.json(
      { error: "Failed to update blog post" },
      { status: 500 }
    )
  }
}

// DELETE - Delete a blog post (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const authResult = await requireAdmin()
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { slug } = await params
    
    // Try to find the post by ID first
    let post = await getBlogPostByIdFromFirestore(slug)
    
    // If not found by ID, try by slug
    if (!post) {
      post = await getBlogPostBySlugFromFirestore(slug)
    }
    
    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    await deleteBlogPostFromFirestore(post.id)
    
    return NextResponse.json({ 
      success: true, 
      message: "Blog post deleted successfully"
    })
  } catch (error) {
    console.error("Error deleting blog post:", error)
    return NextResponse.json(
      { error: "Failed to delete blog post" },
      { status: 500 }
    )
  }
}
