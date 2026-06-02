import { NextResponse } from "next/server"
import { checkBotId } from "botid/server"
import { subscribeEmail } from "@/lib/newsletter-subscribe"
import { tagsForSource, brandTag } from "@/lib/mailchimp-tags"

/**
 * POST — capture email in exchange for the SDOH Impact Report PDF download.
 *
 * If the visitor also opts into the newsletter we treat it as a full signup
 * (brand:sdoh + source:newsletter, subscribed). If they only want the report we
 * record them as transactional (brand:sdoh, no marketing consent). The
 * "downloaded the report" signal is preserved on the Firestore record
 * (source = "SDOH-Impact-Report"), not as a Mailchimp tag.
 */
export async function POST(request: Request) {
  try {
    const { email, subscribeToNewsletter } = await request.json()

    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    const tags = subscribeToNewsletter
      ? tagsForSource("email_signups", { brand: "sdoh" })
      : [brandTag("sdoh")]

    const result = await subscribeEmail({
      email,
      source: "SDOH-Impact-Report",
      tags,
      status: subscribeToNewsletter ? "subscribed" : "transactional",
      mergeFields: { SOURCE: "SDOH Impact Report" },
    })

    // Timestamp-based token authorizing the PDF download; expires in 5 minutes.
    const downloadToken = Buffer.from(
      JSON.stringify({ email: email.toLowerCase().trim(), exp: Date.now() + 5 * 60 * 1000 }),
    ).toString("base64")

    return NextResponse.json({
      success: true,
      downloadToken,
      message: "Email saved successfully",
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
    })
  } catch (error) {
    console.error("[SDOH Impact Report] Error:", error)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
