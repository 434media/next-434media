import { NextRequest, NextResponse } from "next/server"
import { getFeedItems, getFeedItemBySlug } from "@/app/lib/firestore-feed"

/**
 * Public Feed API Endpoint
 * 
 * This endpoint provides read-only access to feed items for external sites
 * like Digital Canvas. No authentication required for reading published content.
 * 
 * Usage from Digital Canvas:
 *   fetch('https://434media.com/api/public/feed?table=THEFEED')
 *   fetch('https://434media.com/api/public/feed?table=THEFEED&slug=my-article')
 */

// Cache for 5 minutes (300 seconds)
export const revalidate = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || "THEFEED"
    const slug = searchParams.get("slug")
    const status = searchParams.get("status") || "published" // Default to published only
    const limit = searchParams.get("limit")

    // If slug is provided, return single item
    if (slug) {
      const item = await getFeedItemBySlug(slug, tableName)
      
      if (!item) {
        return NextResponse.json(
          { success: false, error: "Feed item not found" },
          { status: 404 }
        )
      }

      // Only return published items for public access
      if (item.status !== "published") {
        return NextResponse.json(
          { success: false, error: "Feed item not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: item,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
        }
      })
    }

    // Get all feed items with filters
    const items = await getFeedItems({
      tableName,
      status: status === "all" ? undefined : status,
    })

    // Apply limit if specified
    const limitedItems = limit ? items.slice(0, parseInt(limit, 10)) : items

    return NextResponse.json({
      success: true,
      data: limitedItems,
      count: limitedItems.length,
      total: items.length,
      table: tableName,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
      }
    })
  } catch (error) {
    console.error("[Public Feed API] Error:", error)
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch feed items",
      },
      { status: 500 }
    )
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
