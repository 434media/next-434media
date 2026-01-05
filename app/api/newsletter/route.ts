import { NextResponse } from "next/server"
import Airtable from "airtable"
import axios from "axios"
import crypto from "crypto"
import { checkBotId } from "botid/server"
import { saveEmailSignup } from "@/app/lib/firestore-email-signups"

const airtableBaseId = process.env.AIRTABLE_BASE_ID
const airtableApiKey = process.env.AIRTABLE_API_KEY
const mailchimpApiKey = process.env.MAILCHIMP_API_KEY
const mailchimpListId = process.env.MAILCHIMP_AUDIENCE_ID

if (!airtableBaseId || !airtableApiKey) {
  throw new Error("Airtable configuration is missing")
}

const base = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId)

const mailchimpDatacenter = mailchimpApiKey ? mailchimpApiKey.split("-").pop() : null

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    // Verify the request is not from a bot using BotID
    const verification = await checkBotId()
    if (verification.isBot) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    if (!airtableBaseId || !airtableApiKey) {
      console.error("Airtable configuration is missing")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const mailchimpEnabled = mailchimpApiKey && mailchimpListId
    if (!mailchimpEnabled) {
      console.warn("Mailchimp integration disabled - missing API key or Audience ID")
    }

    const airtablePromise = base("Email Sign Up (All Sites)").create([
      {
        fields: {
          Email: email,
          Source: "434Media",
        },
      },
    ])

    // Save to Firestore for centralized tracking
    const firestorePromise = saveEmailSignup({
      email: email.toLowerCase().trim(),
      source: "434Media",
      created_at: new Date().toISOString(),
      mailchimp_tags: ["web-434media", "newsletter-signup"],
    })

    const promises: Promise<any>[] = [airtablePromise, firestorePromise]

    if (mailchimpEnabled) {
      console.log(
        "[v0] Mailchimp API URL:",
        `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`,
      )

      const mailchimpPromise = axios.post(
        `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members`,
        {
          email_address: email,
          status: "subscribed",
          tags: ["web-434media", "newsletter-signup"],
        },
        {
          auth: {
            username: "apikey",
            password: mailchimpApiKey,
          },
          headers: {
            "Content-Type": "application/json",
          },
          validateStatus: (status) => status < 500, // Don't throw on 4xx errors
        },
      )

      promises.push(mailchimpPromise)
    }

    const results = await Promise.allSettled(promises)

    const airtableResult = results[0]
    const firestoreResult = results[1]
    const mailchimpResult = mailchimpEnabled ? results[2] : null

    const errors = []

    if (airtableResult.status === "rejected") {
      console.error("Airtable error:", airtableResult.reason)
      errors.push("Airtable subscription failed")
    }

    if (firestoreResult.status === "rejected") {
      console.error("Firestore error:", firestoreResult.reason)
      // Don't add to errors - Firestore failure shouldn't fail the whole request
    } else if (firestoreResult.status === "fulfilled" && !firestoreResult.value.success) {
      console.error("Firestore save error:", firestoreResult.value.error)
    }

    if (mailchimpEnabled && mailchimpResult && mailchimpResult.status === "rejected") {
      console.error("Mailchimp error:", mailchimpResult.reason)

      const error = mailchimpResult.reason
      if (error?.response?.data) {
        const responseData = error.response.data
        if (typeof responseData === "string" && responseData.includes("<!DOCTYPE")) {
          console.error("Mailchimp returned HTML error page - likely authentication issue")
          errors.push("Mailchimp authentication failed")
        } else if (responseData?.title === "Member Exists") {
          console.log("Email already exists in Mailchimp, updating tags")
          // Try to update existing member with tags
          try {
            const emailHash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex")
            await axios.patch(
              `https://${mailchimpDatacenter}.api.mailchimp.com/3.0/lists/${mailchimpListId}/members/${emailHash}`,
              {
                tags: ["web-434media", "newsletter-signup"],
              },
              {
                auth: {
                  username: "apikey",
                  password: mailchimpApiKey,
                },
                headers: {
                  "Content-Type": "application/json",
                },
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

    const totalServices = mailchimpEnabled ? 2 : 1
    if (errors.length < totalServices) {
      return NextResponse.json(
        {
          message: "Newsletter subscription successful",
          warnings: errors.length > 0 ? errors : undefined,
          mailchimpEnabled,
        },
        { status: 200 },
      )
    } else {
      return NextResponse.json(
        {
          error: mailchimpEnabled ? "Both services failed" : "Airtable service failed",
          details: errors,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error subscribing to newsletter:", error)
    return NextResponse.json({ error: "An error occurred while subscribing to the newsletter" }, { status: 500 })
  }
}
