import { NextRequest, NextResponse } from "next/server"
import { getFeedItems, getFeedItemBySlug } from "@/lib/firestore-feed"
import { requireSecret } from "@/lib/require-secret"

/**
 * Public Feed API Endpoint
 * 
 * This endpoint provides read-only access to feed items for external sites
 * like Digital Canvas. Supports optional API key authentication.
 * 
 * Usage from Digital Canvas:
 *   fetch('https://434media.com/api/public/feed?table=THEFEED', {
 *     headers: { 'X-API-Key': 'your-api-key' }
 *   })
 *   fetch('https://434media.com/api/public/feed?table=THEFEED&slug=my-article')
 * 
 * Security:
 *   - API key (header only) required when FEED_API_REQUIRE_KEY=true; fails closed if FEED_API_SECRET is unset
 *   - Origin restriction when PUBLIC_FEED_ALLOWED_ORIGINS is set
 *   - Rate limiting via Vercel's built-in protection
 */

// Force dynamic rendering to ensure fresh data from Firestore
// The response still includes Cache-Control headers for CDN caching
export const dynamic = 'force-dynamic'

// Allowed origins for CORS (comma-separated in env var)
const ALLOWED_ORIGINS = process.env.FEED_API_ALLOWED_ORIGINS
  ? process.env.FEED_API_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['*'] // Default to all origins if not configured

// API key for protected access. With FEED_API_REQUIRE_KEY=true every request must carry FEED_API_SECRET in a header
// (x-api-key or Authorization: Bearer); if the secret is then unset in production, every request is refused rather than
// let through. Without the flag the feed is a public read of published items.
const REQUIRE_API_KEY = process.env.FEED_API_REQUIRE_KEY === 'true'

// Validate origin against allow-list
function isAllowedOrigin(origin: string | null): boolean {
  if (ALLOWED_ORIGINS.includes('*')) return true
  if (!origin) return false
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed === '*') return true
    // Exact match
    if (origin === allowed) return true
    // Wildcard subdomain match: *.example.com should match sub.example.com
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2) // Remove '*.' prefix
      // Must match exactly as a subdomain suffix (with dot boundary)
      return origin.endsWith(domain) && origin[origin.length - domain.length - 1] === '.'
    }
    return false
  })
}

// Get CORS origin header
function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin')
  if (ALLOWED_ORIGINS.includes('*')) return '*'
  if (origin && isAllowedOrigin(origin)) return origin
  return ALLOWED_ORIGINS[0] || '*'
}

export async function GET(request: NextRequest) {
  try {
    // Check origin restriction
    const origin = request.headers.get('origin')
    if (!isAllowedOrigin(origin) && ALLOWED_ORIGINS[0] !== '*') {
      return NextResponse.json(
        { success: false, error: "Origin not allowed" },
        { status: 403 }
      )
    }

    // Check API key if required
    if (REQUIRE_API_KEY) {
      const denied = requireSecret(request, "FEED_API_SECRET", { where: "Public Feed API", headers: { 'WWW-Authenticate': 'Bearer' } })
      if (denied) return denied
    }

    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || "THEFEED"
    const slug = searchParams.get("slug")
    const limit = searchParams.get("limit")
    const fresh = searchParams.get("fresh") === "true" // Bypass cache when ?fresh=true

    const corsOrigin = getCorsOrigin(request)
    
    // Shorter cache for faster content updates
    // fresh=true: no caching at all
    // normal: 60s CDN cache with 2min stale-while-revalidate
    const cacheControl = fresh 
      ? 'no-cache, no-store, must-revalidate'
      : 'public, s-maxage=60, stale-while-revalidate=120'

    // If slug is provided, return single item
    if (slug) {
      const item = await getFeedItemBySlug(slug, tableName, { status: "published" })
      
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
          'Cache-Control': cacheControl,
          'Access-Control-Allow-Origin': corsOrigin,
        }
      })
    }

    // Get all feed items with filters
    const items = await getFeedItems({
      tableName,
      // Published only: this is a public read, so `?status=` (which used to reach drafts) is ignored.
      status: "published",
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
        'Cache-Control': cacheControl,
        'Access-Control-Allow-Origin': corsOrigin,
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
export async function OPTIONS(request: NextRequest) {
  const corsOrigin = getCorsOrigin(request)
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    },
  })
}
