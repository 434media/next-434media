import { NextResponse } from "next/server"
import { getAimsEventsFromFirestore, markPastAimsEventsInFirestore } from "@/lib/firestore-aims-events"

// ============================================
// PUBLIC API ENDPOINT FOR AIMSATX.COM
// ============================================
// This endpoint provides read-only access to AIMS events from Firestore
// Intended for use by the aimsatx.com website to fetch events

// Configuration from environment variables
const REQUIRE_API_KEY = process.env.EVENTS_API_REQUIRE_KEY === "true"
const API_SECRET = process.env.EVENTS_API_SECRET
const ALLOWED_ORIGINS = process.env.EVENTS_API_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) || ["*"]

// Get CORS headers based on request origin
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
  }

  // Check if origin is allowed
  if (ALLOWED_ORIGINS.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*"
  } else if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin
  } else {
    // Default to first allowed origin (will be blocked by browser if mismatch)
    headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGINS[0] || "*"
  }

  return headers
}

// Validate API key from request
function validateApiKey(request: Request): { valid: boolean; error?: string } {
  if (!REQUIRE_API_KEY) {
    return { valid: true }
  }

  if (!API_SECRET) {
    console.error("[Events API] EVENTS_API_SECRET not configured but EVENTS_API_REQUIRE_KEY is true")
    return { valid: false, error: "API not properly configured" }
  }

  // Check X-API-Key header first
  const apiKeyHeader = request.headers.get("X-API-Key")
  if (apiKeyHeader === API_SECRET) {
    return { valid: true }
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === API_SECRET) {
    return { valid: true }
  }

  // Check query parameter as fallback
  const { searchParams } = new URL(request.url)
  const apiKeyParam = searchParams.get("api_key")
  if (apiKeyParam === API_SECRET) {
    return { valid: true }
  }

  return { valid: false, error: "Invalid or missing API key" }
}

// Handle OPTIONS preflight requests
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  })
}

// GET - Fetch all AIMS events (public read-only access)
export async function GET(request: Request) {
  const origin = request.headers.get("origin")
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Validate API key if required
    const authResult = validateApiKey(request)
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: authResult.error, events: [], count: 0 },
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filter = searchParams.get("filter") // "upcoming", "past", or "all" (default)
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined

    // Mark past events automatically (non-blocking background task)
    markPastAimsEventsInFirestore().catch((err) =>
      console.error("[Public API] Error marking past events:", err)
    )

    // Fetch all events from Firestore
    const events = await getAimsEventsFromFirestore()

    // Transform to match aimsatx.com Event type
    let transformedEvents = events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description || "",
      date: event.date, // YYYY-MM-DD format
      time: event.time || "",
      location: event.location || "",
      organizer: event.organizer || "AIMS ATX",
      category: event.category || "other",
      attendees: event.attendees,
      price: event.price || "",
      url: event.url || "",
      source: event.source || "manual",
      image: event.image || "",
      tags: event.tags || "",
      isPast: event.isPast || false,
      created_at: event.created_at || new Date().toISOString(),
      updated_at: event.updated_at || new Date().toISOString(),
    }))

    // Apply filter
    if (filter === "upcoming") {
      transformedEvents = transformedEvents.filter((e) => !e.isPast)
    } else if (filter === "past") {
      transformedEvents = transformedEvents.filter((e) => e.isPast)
    }

    // Sort: upcoming events by date ascending, past events by date descending
    transformedEvents.sort((a, b) => {
      const dateA = new Date(a.date).getTime()
      const dateB = new Date(b.date).getTime()
      
      // If comparing upcoming to past, upcoming comes first
      if (!a.isPast && b.isPast) return -1
      if (a.isPast && !b.isPast) return 1
      
      // Same status: upcoming sorted ascending, past sorted descending
      if (!a.isPast) {
        return dateA - dateB // Nearest upcoming first
      } else {
        return dateB - dateA // Most recent past first
      }
    })

    // Apply limit if specified
    if (limit && limit > 0) {
      transformedEvents = transformedEvents.slice(0, limit)
    }

    return NextResponse.json(
      {
        success: true,
        events: transformedEvents,
        count: transformedEvents.length,
        timestamp: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[Public API] Error fetching events:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch events"
    return NextResponse.json(
      { 
        success: false, 
        error: message,
        events: [],
        count: 0,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}
