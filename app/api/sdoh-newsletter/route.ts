import { NextResponse } from "next/server"
import axios from "axios"
import crypto from "crypto"
import { checkBotId } from "botid/server"
import { saveEmailSignup } from "@/lib/firestore-email-signups"

const mailchimpApiKey = process.env.MAILCHIMP_API_KEY
const mailchimpListId = process.env.MAILCHIMP_AUDIENCE_ID
const mailchimpDatacenter = mailchimpApiKey ? mailchimpApiKey.split("-").pop() : null

const SOURCE = "SDOH"
const TAGS = ["web-434sdoh", "newsletter-signup"]

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const mailchimpEnabled = !!(mailchimpApiKey && mailchimpListId)
    if (!mailchimpEnabled) {
      console.warn("Mailchimp integration disabled - missing API key or Audience ID")
    }

    const firestorePromise = saveEmailSignup({
      email: email.toLowerCase().trim(),
      source: SOURCE,
      created_at: new Date().toISOString(),
      mailchimp_tags: TAGS,
    })

    const promises: Promise<unknown>[] = [firestorePromise]

    if (mailchimpEnabled) {
      const mailchimpPromise = axios.post(
        `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`,
        {
          email_address: email,
          status: "subscribed",
          tags: TAGS,
        },
        {
          auth: { username: "apikey", password: mailchimpApiKey! },
          headers: { "Content-Type": "application/json" },
          validateStatus: (status) => status < 500,
        },
      )
      promises.push(mailchimpPromise)
    }

    const results = await Promise.allSettled(promises)
    const firestoreResult = results[0]
    const mailchimpResult = mailchimpEnabled ? results[1] : null

    const errors: string[] = []

    if (firestoreResult.status === "rejected") {
      console.error("Firestore error:", firestoreResult.reason)
    } else if (firestoreResult.status === "fulfilled") {
      const value = firestoreResult.value as { success?: boolean; error?: string }
      if (value && value.success === false) {
        console.error("Firestore save error:", value.error)
      }
    }

    if (mailchimpEnabled && mailchimpResult && mailchimpResult.status === "rejected") {
      console.error("Mailchimp error:", mailchimpResult.reason)
      const error = mailchimpResult.reason as { response?: { data?: unknown } }
      if (error?.response?.data) {
        const responseData = error.response.data as { title?: string } | string
        if (typeof responseData === "string" && responseData.includes("<!DOCTYPE")) {
          console.error("Mailchimp returned HTML error page - likely authentication issue")
          errors.push("Mailchimp authentication failed")
        } else if (typeof responseData === "object" && responseData?.title === "Member Exists") {
          try {
            const emailHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex")
            await axios.patch(
              `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members/${emailHash}`,
              { tags: TAGS },
              {
                auth: { username: "apikey", password: mailchimpApiKey! },
                headers: { "Content-Type": "application/json" },
              },
            )
          } catch (updateError) {
            console.error("Failed to update existing Mailchimp member:", updateError)
            errors.push("Mailchimp update failed")
          }
        } else {
          errors.push("Mailchimp subscription failed")
        }
      } else {
        errors.push("Mailchimp subscription failed")
      }
    }

    return NextResponse.json(
      {
        message: "Newsletter subscription successful",
        warnings: errors.length > 0 ? errors : undefined,
        mailchimpEnabled,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return NextResponse.json({ error: "An error occurred while subscribing to the newsletter" }, { status: 500 })
  }
}
