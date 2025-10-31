import { NextResponse } from "next/server"
import { getBlogPostsFromAirtable } from "../../lib/airtable-blog"

export async function GET() {
  try {
    console.log("🔍 Testing blog posts fetch...")
    
    // Test getting all posts (no filter)
    const allPosts = await getBlogPostsFromAirtable()
    console.log(`✅ All posts: ${allPosts.length}`)
    
    // Test getting published posts
    const publishedPosts = await getBlogPostsFromAirtable({ status: "published" })
    console.log(`✅ Published posts: ${publishedPosts.length}`)
    
    return NextResponse.json({
      success: true,
      allPosts: allPosts.length,
      publishedPosts: publishedPosts.length,
      samplePost: allPosts.length > 0 ? {
        id: allPosts[0].id,
        title: allPosts[0].title,
        status: allPosts[0].status,
        category: allPosts[0].category,
        tags: allPosts[0].tags,
        published_at: allPosts[0].published_at
      } : null
    })
    
  } catch (error) {
    console.error("❌ Test error:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      details: error instanceof Error ? {
        name: error.name,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : undefined
    }, { status: 500 })
  }
}