import { NextResponse } from "next/server"
import axios from "axios"
import { checkBotId } from "botid/server"
import { saveEmailSignup } from "@/lib/firestore-email-signups"

const mailchimpApiKey = process.env.MAILCHIMP_API_KEY
const mailchimpListId = process.env.MAILCHIMP_AUDIENCE_ID
const mailchimpDatacenter = mailchimpApiKey ? mailchimpApiKey.split("-").pop() : null

/**
 * POST - Save email and return download authorization
 * 
 * Captures email before allowing PDF download.
 * Tags: web-sdoh, web-newsletter, sdoh-impact-report
 */
export async function POST(request: Request) {
  try {
    const { email, subscribeToNewsletter } = await request.json()

    // Verify the request is not from a bot
    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Validate email
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()
    
    // Define tags based on subscription preference
    const baseTags = ["web-sdoh", "sdoh-impact-report"]
    const tags = subscribeToNewsletter 
      ? [...baseTags, "web-newsletter"]
      : baseTags

    // Save to Firestore
    const firestorePromise = saveEmailSignup({
      email: normalizedEmail,
      source: "SDOH-Impact-Report",
      created_at: new Date().toISOString(),
      mailchimp_tags: tags,
    })

    const promises: Promise<any>[] = [firestorePromise]

    // Add to Mailchimp if configured
    const mailchimpEnabled = mailchimpApiKey && mailchimpListId
    if (mailchimpEnabled) {
      const mailchimpPromise = axios.post(
        `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`,
        {
          email_address: normalizedEmail,
          status: subscribeToNewsletter ? "subscribed" : "transactional",
          tags: tags,
          merge_fields: {
            SOURCE: "SDOH Impact Report",
          },
        },
        {
          auth: {
            username: "apikey",
            password: mailchimpApiKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
          validateStatus: (status) => status < 500,
        },
      )

      promises.push(mailchimpPromise)
    }

    const results = await Promise.allSettled(promises)

    const firestoreResult = results[0]
    const mailchimpResult = mailchimpEnabled ? results[1] : null

    // Log results
    if (firestoreResult.status === "rejected") {
      console.error("[SDOH Impact Report] Firestore error:", firestoreResult.reason)
    } else {
      console.log("[SDOH Impact Report] Saved to Firestore:", normalizedEmail)
    }

    if (mailchimpResult && mailchimpResult.status === "rejected") {
      console.error("[SDOH Impact Report] Mailchimp error:", mailchimpResult.reason)
    } else if (mailchimpResult && mailchimpResult.status === "fulfilled") {
      const response = mailchimpResult.value
      if (response.status >= 400) {
        console.warn("[SDOH Impact Report] Mailchimp warning:", response.data?.title || "Unknown error")
      } else {
        console.log("[SDOH Impact Report] Added to Mailchimp:", normalizedEmail, "Tags:", tags)
      }
    }

    // Return success with download authorization token
    // This is a simple timestamp-based token that expires in 5 minutes
    const downloadToken = Buffer.from(
      JSON.stringify({
        email: normalizedEmail,
        exp: Date.now() + 5 * 60 * 1000, // 5 minutes
      })
    ).toString("base64")

    return NextResponse.json({
      success: true,
      downloadToken,
      message: "Email saved successfully",
    })

  } catch (error) {
    console.error("[SDOH Impact Report] Error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}
