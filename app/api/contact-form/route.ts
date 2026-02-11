import { NextResponse } from "next/server"
import Airtable from "airtable"
import { checkBotId } from "botid/server"
import { saveContactForm } from "@/app/lib/firestore-contact-forms"

const airtableBaseId = process.env.AIRTABLE_BASE_ID
const airtableApiKey = process.env.AIRTABLE_API_KEY

if (!airtableBaseId || !airtableApiKey) {
  throw new Error("Airtable configuration is missing")
}

const base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId)

export async function POST(request: Request) {
  try {
    const { firstName, lastName, company, email, phoneNumber, message } = await request.json()

    // Verify the request is not from a bot using BotID
    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Validate required fields
    if (!firstName || !lastName || !company || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!airtableBaseId || !airtableApiKey) {
      console.error("Airtable configuration is missing")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Create record in Airtable
    await base("434Form").create([
      {
        fields: {
          FirstName: firstName,
          LastName: lastName,
          Company: company,
          Phone: phoneNumber,
          Email: email,
          Message: message,
          Source: "434Media",
        },
      },
    ])

    // Also save to Firestore for centralized tracking
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

