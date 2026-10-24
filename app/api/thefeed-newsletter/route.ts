import { NextResponse } from "next/server"
import { subscribeEmail } from "@/lib/newsletter-subscribe"
import { tagsForSource } from "@/lib/mailchimp-tags"
import { requireHumanRequest } from "@/lib/botid-guard"

// The Feed's signup (/thefeed/[slug] footer). A Digital Canvas signup, as it was
// when the Feed lived on that site. See app/api/newsletter/route.ts for the pattern.
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
      source: "DigitalCanvas",
      tags: tagsForSource("email_signups", { brand: "digitalcanvas" }),
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
