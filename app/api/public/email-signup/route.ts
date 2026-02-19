import { NextResponse } from "next/server"
import { saveEmailSignup } from "@/lib/firestore-email-signups"
import { headers } from "next/headers"

// Valid sources that can submit emails
const VALID_SOURCES = [
  "434Media",
  "AIM",
  "SDOH",
  "TXMX",
  "VemosVamos",
  "DigitalCanvas",
  "AMPD",
  "Salute",
  "MilCity",
  // Add more sources as needed
]

// Simple API key validation for external sites
function validateApiKey(apiKey: string | null): boolean {
  const validKey = process.env.EMAIL_SIGNUP_API_KEY
  if (!validKey) {
    console.warn("[Email Signup] No API key configured, allowing all requests")
    return true
  }
  return apiKey === validKey
}

/**
 * POST /api/public/email-signup
 * 
 * Public endpoint for external websites to submit email signups
 * 
 * Request body:
 * {
 *   "email": "user@example.com",
 *   "source": "AIM",           // Required: identifier for the source website
 *   "tags": ["newsletter"],     // Optional: Mailchimp tags
 *   "pageUrl": "https://..."   // Optional: the page where signup occurred
 * }
 * 
 * Headers:
 * - x-api-key: Your API key (optional if EMAIL_SIGNUP_API_KEY not set)
 */
export async function POST(request: Request) {
  try {
    const headersList = await headers()
    const apiKey = headersList.get("x-api-key")
    
    // Validate API key if configured
    if (!validateApiKey(apiKey)) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { email, source, tags, pageUrl } = body

    // Validate email
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Limit email length to prevent ReDoS attacks before regex validation
    if (email.length > 254) {
      return NextResponse.json(
        { error: "Email address is too long" },
        { status: 400 }
      )
    }

    // Use a simple, non-backtracking email validation regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Validate source
    if (!source || typeof source !== "string") {
      return NextResponse.json(
        { error: "Source is required" },
        { status: 400 }
      )
    }

    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Valid sources: ${VALID_SOURCES.join(", ")}` },
        { status: 400 }
      )
    }

    // Get request metadata
    const userAgent = headersList.get("user-agent") || undefined
    const forwardedFor = headersList.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0].trim() || undefined

    // Save to Firestore
    const result = await saveEmailSignup({
      email: email.toLowerCase().trim(),
      source,
      created_at: new Date().toISOString(),
      mailchimp_tags: tags || [],
      page_url: pageUrl,
      ip_address: ipAddress,
      user_agent: userAgent,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save email" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Email signup saved successfully",
      id: result.id,
    })
  } catch (error) {
    console.error("[Email Signup API] Error:", error)
    return NextResponse.json(
      { error: "An error occurred while processing the request" },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS - Handle CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key",
    },
  })
}
