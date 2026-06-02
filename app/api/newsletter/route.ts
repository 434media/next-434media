import { NextResponse } from "next/server"
import { subscribeEmail } from "@/lib/newsletter-subscribe"
import { tagsForSource } from "@/lib/mailchimp-tags"
import { requireHumanRequest } from "@/lib/botid-guard"

// 434 Media newsletter signup. Tags + Mailchimp/Firestore writes are handled by
// the shared subscribeEmail() helper (canonical tags via tagsForSource).
export async function POST(request: Request) {
  try {
    const human = await requireHumanRequest()
    if (!human.ok) return human.response

    const { email } = await request.json()
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    const result = await subscribeEmail({
      email,
      source: "434Media",
      tags: tagsForSource("email_signups", { brand: "434media" }),
    })

    return NextResponse.json(
      {
        message: "Newsletter subscription successful",
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        mailchimpEnabled: result.mailchimpEnabled,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return NextResponse.json({ error: "An error occurred while subscribing to the newsletter" }, { status: 500 })
  }
}
