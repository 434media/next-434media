import { NextResponse } from "next/server"
import { saveContactForm } from "@/lib/firestore-contact-forms"
import { captureLeadFromContactForm } from "@/lib/firestore-leads"
import { notifyNewContactForm } from "@/lib/contact-form-notification"
import { requireHumanRequest } from "@/lib/botid-guard"
import { requireSecret } from "@/lib/require-secret"

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
 * - x-api-key: Your API key (EMAIL_SIGNUP_API_KEY). Required: with the setting unset in production every request is
 *   refused (503), never let through. `Authorization: Bearer <key>` is accepted too.
 */
export async function POST(request: Request) {
  try {
    // Shared API key, header only, constant-time; fails closed when unset in production.
    const denied = requireSecret(request, "EMAIL_SIGNUP_API_KEY", { where: "Contact Form Public" })
    if (denied) return denied

    // BotID guard — block automated submissions before doing any work
    const human = await requireHumanRequest()
    if (!human.ok) return human.response

    const body = await request.json()
    const { firstName, lastName, company, email, phone, message, source } = body

    // Validate required fields
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
    const createdAt = new Date().toISOString()
    const result = await saveContactForm({
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      message: message?.trim() || "",
      source,
      created_at: createdAt,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to save contact form" },
        { status: 500 }
      )
    }

    // Fan into the leads collection (dedupes by email, never throws).
    // Public form submission stays the source of truth in `contact_forms`;
    // `leads` is the upstream queue the BD team works from.
    await captureLeadFromContactForm({
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      message: message?.trim() || "",
      source,
    })

    // Best-effort admin notification — never blocks or fails the submission.
    await notifyNewContactForm({
      id: result.id,
      firstName: firstName?.trim() || "",
      lastName: lastName?.trim() || "",
      company: company?.trim() || "",
      email: email.toLowerCase().trim(),
      phone: phone?.trim() || "",
      message: message?.trim() || "",
      source,
      created_at: createdAt,
    })

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
