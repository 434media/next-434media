import { NextResponse } from "next/server"
import { saveContactForm } from "@/lib/firestore-contact-forms"
import { notifyNewContactForm } from "@/lib/contact-form-notification"
import { requireHumanRequest } from "@/lib/botid-guard"

export async function POST(request: Request) {
  try {
    // BotID guard — block automated submissions before doing any work
    const human = await requireHumanRequest()
    if (!human.ok) return human.response

    const { firstName, lastName, company, email, phoneNumber, message } = await request.json()

    if (!firstName || !lastName || !company || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const createdAt = new Date().toISOString()
    const result = await saveContactForm({
      firstName,
      lastName,
      company,
      email,
      phone: phoneNumber || "",
      message: message || "",
      source: "434Media",
      created_at: createdAt,
    })

    // Best-effort admin notification — never blocks or fails the submission.
    if (result.success) {
      await notifyNewContactForm({
        id: result.id,
        firstName,
        lastName,
        company,
        email,
        phone: phoneNumber || "",
        message: message || "",
        source: "434Media",
        created_at: createdAt,
      })
    }

    return NextResponse.json({ message: "Contact form submission successful" }, { status: 200 })
  } catch (error) {
    console.error("Error submitting contact form:", error)
    return NextResponse.json({ error: "An error occurred while submitting the contact form" }, { status: 500 })
  }
}
