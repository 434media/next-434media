import { NextResponse } from "next/server"
import { getAimsEventByIdFromFirestore } from "@/app/lib/firestore-aims-events"

// ============================================
// PUBLIC API ENDPOINT FOR AIMSATX.COM - SINGLE EVENT
// ============================================

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

  if (ALLOWED_ORIGINS.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*"
  } else if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    headers["Access-Control-Allow-Origin"] = requestOrigin
  } else {
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

  const apiKeyHeader = request.headers.get("X-API-Key")
  if (apiKeyHeader === API_SECRET) {
    return { valid: true }
  }

  const authHeader = request.headers.get("Authorization")
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === API_SECRET) {
    return { valid: true }
  }

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

// GET - Fetch a single AIMS event by ID (public read-only access)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = request.headers.get("origin")
  const corsHeaders = getCorsHeaders(origin)

  try {
    // Validate API key if required
    const authResult = validateApiKey(request)
    if (!authResult.valid) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401, headers: corsHeaders }
      )
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Event ID is required" },
        { status: 400, headers: corsHeaders }
      )
    }

    const event = await getAimsEventByIdFromFirestore(id)

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Event not found" },
        { status: 404, headers: corsHeaders }
      )
    }

    // Transform to match aimsatx.com Event type
    const transformedEvent = {
      id: event.id,
      title: event.title,
      description: event.description || "",
      date: event.date,
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
    }

    return NextResponse.json(
      {
        success: true,
        event: transformedEvent,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error("[Public API] Error fetching event:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch event"
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: corsHeaders }
    )
  }
}
