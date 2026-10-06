import { NextResponse } from "next/server"
import { saveContactForm } from "@/lib/firestore-contact-forms"
import { notifyNewContactForm } from "@/lib/contact-form-notification"
import { requireHumanRequest } from "@/lib/botid-guard"
import { BUDGET_RANGES, ORGANIZATION_TYPES, REQUEST_OPTIONS, isOneOf } from "@/lib/start-a-production"

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "")

export async function POST(request: Request) {
  try {
    // BotID guard — block automated submissions before doing any work
    const human = await requireHumanRequest()
    if (!human.ok) return human.response

    const body = await request.json()
    const firstName = text(body.firstName)
    const lastName = text(body.lastName)
    const company = text(body.company)
    const email = text(body.email)
    const phoneNumber = text(body.phoneNumber)
    const message = text(body.message)
    // "Start a production" intake fields (master 9.5)
    const role = text(body.role)
    const timeline = text(body.timeline)
    const referralSource = text(body.referralSource)
    const { organizationType, requestType, budgetRange } = body

    if (!firstName || !lastName || !company || !email || !role || !message || !timeline || !referralSource) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (
      !isOneOf(ORGANIZATION_TYPES, organizationType) ||
      !isOneOf(REQUEST_OPTIONS, requestType) ||
      !isOneOf(BUDGET_RANGES, budgetRange)
    ) {
      return NextResponse.json({ error: "Invalid selection" }, { status: 400 })
    }

    const submission = {
      firstName,
      lastName,
      company,
      email,
      phone: phoneNumber,
      message,
      role,
      organizationType,
      requestType,
      timeline,
      budgetRange,
      referralSource,
      source: "434Media",
      created_at: new Date().toISOString(),
    }
    const result = await saveContactForm(submission)

    // Best-effort admin notification — never blocks or fails the submission.
    if (result.success) {
      await notifyNewContactForm({ id: result.id, ...submission })
    }

    return NextResponse.json({ message: "Contact form submission successful" }, { status: 200 })
  } catch (error) {
    console.error("Error submitting contact form:", error)
    return NextResponse.json({ error: "An error occurred while submitting the contact form" }, { status: 500 })
  }
}
