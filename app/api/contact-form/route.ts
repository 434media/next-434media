import { NextResponse } from "next/server"
import { checkBotId } from "botid/server"
import { saveContactForm } from "@/lib/firestore-contact-forms"

export async function POST(request: Request) {
  try {
    const { firstName, lastName, company, email, phoneNumber, message } = await request.json()

    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (!firstName || !lastName || !company || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    await saveContactForm({
      firstName,
      lastName,
      company,
      email,
      phone: phoneNumber || "",
      message: message || "",
      source: "434Media",
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({ message: "Contact form submission successful" }, { status: 200 })
  } catch (error) {
    console.error("Error submitting contact form:", error)
    return NextResponse.json({ error: "An error occurred while submitting the contact form" }, { status: 500 })
  }
}
