import { NextResponse } from "next/server"
import Airtable from "airtable"
import axios from "axios"
import crypto from "crypto"

const isDevelopment = process.env.NODE_ENV === "development"

const airtableBaseId = process.env.AIRTABLE_BASE_ID
const airtableApiKey = process.env.AIRTABLE_API_KEY
const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY
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
    const turnstileToken = request.headers.get("cf-turnstile-response")
    const remoteIp = request.headers.get("CF-Connecting-IP")

    if (!airtableBaseId || !airtableApiKey) {
      console.error("Airtable configuration is missing")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const mailchimpEnabled = mailchimpApiKey && mailchimpListId
    if (!mailchimpEnabled) {
      console.warn("Mailchimp integration disabled - missing API key or Audience ID")
    }

    if (!isDevelopment) {
      if (!turnstileSecretKey) {
        console.error("Turnstile secret key is not defined")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
      }

      // Verify Turnstile token
      if (turnstileToken) {
        const idempotencyKey = crypto.randomUUID()
        const turnstileVerification = await axios.post(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          new URLSearchParams({
            secret: turnstileSecretKey,
            response: turnstileToken,
            remoteip: remoteIp || "",
            idempotency_key: idempotencyKey,
          }),
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          },
        )

        if (!turnstileVerification.data.success) {
          const errorCodes = turnstileVerification.data["error-codes"] || []
          console.error("Turnstile verification failed:", errorCodes)
          return NextResponse.json({ error: "Turnstile verification failed", errorCodes }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: "Turnstile token is missing" }, { status: 400 })
      }
    }

    const airtablePromise = base("Email Sign Up (All Sites)").create([
      {
        fields: {
          Email: email,
          Source: "TXMX",
        },
      },
    ])

    const promises: Promise<any>[] = [airtablePromise]

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
          tags: ["web-txmxboxing"],
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
    const mailchimpResult = mailchimpEnabled ? results[1] : null

    const errors = []

    if (airtableResult.status === "rejected") {
      console.error("Airtable error:", airtableResult.reason)
      errors.push("Airtable subscription failed")
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
                tags: ["web-txmxboxing"],
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
