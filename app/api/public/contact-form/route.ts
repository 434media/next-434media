import { NextResponse } from "next/server"
import { saveContactForm } from "@/app/lib/firestore-contact-forms"
import { headers } from "next/headers"

// Valid sources that can submit contact forms
const VALID_SOURCES = [
  "434Media",
  "AIM",
  "VemosVamos",
  "DigitalCanvas",
  "SATechDay",
  "AMPD",
  "Salute",
  "MilCity",
  "TXMX",
  // Add more sources as needed
]

// Simple API key validation for external sites
function validateApiKey(apiKey: string | null): boolean {
  const validKey = process.env.EMAIL_SIGNUP_API_KEY
  if (!validKey) {
    console.warn("[Contact Form Public] No API key configured, allowing all requests")
    return true
  }
  return apiKey === validKey
}

/**
 * POST /api/public/contact-form
 *
 * Public endpoint for external websites to submit contact form data
 *
 * Request body:
 * {
 *   "firstName": "John",
 *   "lastName": "Doe",
 *   "company": "Acme Inc",
 *   "email": "john@example.com",
 *   "phone": "555-1234",          // Optional
 *   "message": "Hello...",        // Optional
 *   "source": "DigitalCanvas"     // Required: identifier for the source website
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
    const { firstName, lastName, company, email, phone, message, source } = body

    // Validate required fields
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

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

    if (!firstName || typeof firstName !== "string") {
      return NextResponse.json(
        { error: "First name is required" },
        { status: 400 }
      )
    }

    // Save to Firestore
    const result = await saveContactForm({
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      message: message?.trim() || "",
      source,
      created_at: new Date().toISOString(),
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save contact form" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Contact form submission saved successfully",
      id: result.id,
    })
  } catch (error) {
    console.error("[Contact Form Public API] Error:", error)
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
