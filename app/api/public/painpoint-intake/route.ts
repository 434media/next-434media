import { NextResponse } from "next/server"
import { requireHumanRequest } from "@/lib/botid-guard"
import { createPainpoint } from "@/lib/firestore-crm"
import { notifyNewPainpoint } from "@/lib/painpoint-notification"
import type { Vertical } from "@/types/crm-types"

export const runtime = "nodejs"

/**
 * POST /api/public/painpoint-intake
 *
 * Public, BotID-guarded endpoint for the Digital Canvas underwriter intake form.
 * Captures an underwriter's RAW operational problem (the squad authors the
 * sales/builder framing later during triage). Lands as a painpoint with
 * source:"public_form", status:"submitted" — surfaced in the /admin/painpoints
 * triage queue. Same-origin form; BotID is the spam guard.
 *
 * Body: { title, vertical, problemStatement, underwriterName, sponsorName,
 *         contactEmail, underwriterRole?, whoIsAffected?, currentWorkaround?,
 *         costImpact?, frequency? }
 */

const VALID_VERTICALS = [
  "cybersecurity",
  "fintech",
  "military",
  "health",
  "science",
  "education",
  "aerospace",
  "other",
]

// Linear-time, non-backtracking email check (matches the contact-form route).
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

function str(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: Request) {
  try {
    // BotID guard — block automated submissions before any work.
    const human = await requireHumanRequest()
    if (!human.ok) return human.response

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const title = str(body.title, 200)
    const vertical = str(body.vertical, 40)
    const problemStatement = str(body.problemStatement)
    const underwriterName = str(body.underwriterName, 200)
    const sponsorName = str(body.sponsorName, 200)
    const contactEmail = str(body.contactEmail, 254).toLowerCase()

    if (!title) return NextResponse.json({ error: "A short title is required" }, { status: 400 })
    if (!VALID_VERTICALS.includes(vertical))
      return NextResponse.json({ error: "Please select a valid industry" }, { status: 400 })
    if (!problemStatement)
      return NextResponse.json({ error: "Please describe the problem" }, { status: 400 })
    if (!underwriterName) return NextResponse.json({ error: "Your name is required" }, { status: 400 })
    if (!sponsorName)
      return NextResponse.json({ error: "Your organization is required" }, { status: 400 })
    if (!contactEmail || !EMAIL_RE.test(contactEmail))
      return NextResponse.json({ error: "A valid contact email is required" }, { status: 400 })

    const painpoint = await createPainpoint({
      title,
      vertical: vertical as Vertical,
      status: "submitted",
      source: "public_form",
      problemStatement,
      underwriterName,
      underwriterRole: str(body.underwriterRole, 200) || undefined,
      contactEmail,
      sponsorName,
      whoIsAffected: str(body.whoIsAffected, 500) || undefined,
      currentWorkaround: str(body.currentWorkaround) || undefined,
      costImpact: str(body.costImpact, 500) || undefined,
      frequency: str(body.frequency, 200) || undefined,
    })

    // Best-effort operator alert — never blocks the submission.
    await notifyNewPainpoint(painpoint)

    return NextResponse.json({ success: true, id: painpoint.id })
  } catch (error) {
    console.error("[Painpoint Intake] Error:", error)
    return NextResponse.json(
      { error: "An error occurred while submitting. Please try again." },
      { status: 500 },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
