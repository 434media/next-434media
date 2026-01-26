import { type NextRequest, NextResponse } from "next/server"
import { getSession, isWorkspaceEmail } from "@/app/lib/auth"
import { 
  getBlogPostsFromFirestore, 
  createBlogPostInFirestore
} from "@/app/lib/firestore-blog"
import type { CreateBlogPostData, BlogFilters } from "@/app/types/blog-types"

// Check if user is authenticated and has workspace email
async function requireAdmin() {
  try {
    const session = await getSession()
    
    if (!session) {
      console.log("[Blog API] No session found - user not authenticated")
      return { error: "Unauthorized - Please sign in to access this resource", status: 401 }
    }
    
    if (!isWorkspaceEmail(session.email)) {
      console.log("[Blog API] Non-workspace email attempted access:", session.email)
      return { error: "Forbidden: Workspace email required", status: 403 }
    }
    
    return { session }
  } catch (error: any) {
    console.error("[Blog API] Error checking admin session:", error?.message)
    return { error: "Authentication error - Please sign in again", status: 401 }
  }
}

// GET - Fetch all blog posts (supports both admin and public access)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeAll = searchParams.get("includeAll") === "true"
    
    // For admin access (includeAll), check authentication
    if (includeAll) {
      const authResult = await requireAdmin()
      if ("error" in authResult) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        )
      }
    }
    
    // Build filters
    const filters: BlogFilters = {}
    
    // Only show published posts for public access
    if (!includeAll) {
      filters.status = "published"
    }
    
    // Apply other filters
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")
    const search = searchParams.get("search")
    const limit = searchParams.get("limit")
    
    if (category) filters.category = category
    if (tag) filters.tag = tag
    if (search) filters.search = search
    if (limit) filters.limit = parseInt(limit, 10)

    const posts = await getBlogPostsFromFirestore(filters, includeAll)
    
    return NextResponse.json({ 
      posts,
      count: posts.length
    })
  } catch (error: any) {
    console.error("[Blog API] Error fetching blog posts:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack?.split('\n').slice(0, 3).join('\n')
    })
    return NextResponse.json(
      { error: "Failed to fetch blog posts. Please try again." },
      { status: 500 }
    )
  }
}

// POST - Create a new blog post (admin only)
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
    if (!body.title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }
    
    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      )
    }

    // Prepare post data
    const postData: CreateBlogPostData = {
      title: body.title.trim(),
      content: body.content,
      excerpt: body.excerpt?.trim() || undefined,
      featured_image: body.featured_image || undefined,
      meta_description: body.meta_description?.trim() || undefined,
      category: body.category || "Technology",
      tags: Array.isArray(body.tags) ? body.tags : [],
      status: body.status || "draft",
      author: body.author || authResult.session.name || "434 Media",
    }

    const newPost = await createBlogPostInFirestore(postData)
    
    return NextResponse.json({ 
      success: true, 
      post: newPost,
      message: "Blog post created successfully"
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating blog post:", error)
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 }
    )
  }
}
