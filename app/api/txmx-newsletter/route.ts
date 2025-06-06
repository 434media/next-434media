import { type NextRequest, NextResponse } from "next/server"

// Convert to Edge Function
export const runtime = "edge"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    const turnstileToken = request.headers.get("cf-turnstile-response")
    const remoteIp = request.headers.get("CF-Connecting-IP")

    // Verify environment variables
    const airtableBaseId = process.env.AIRTABLE_BASE_ID
    const airtableApiKey = process.env.AIRTABLE_API_KEY
    const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY

    if (!airtableBaseId || !airtableApiKey) {
      console.error("Airtable configuration is missing")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Verify Turnstile token in production
    if (process.env.NODE_ENV !== "development") {
      if (!turnstileSecretKey) {
        console.error("Turnstile secret key is not defined")
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
      }

      if (!turnstileToken) {
        return NextResponse.json({ error: "Turnstile token is missing" }, { status: 400 })
      }

      // Verify Turnstile token
      const turnstileVerification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret: turnstileSecretKey,
          response: turnstileToken,
          remoteip: remoteIp || "",
        }),
      })

      const verificationResult = await turnstileVerification.json()

      if (!verificationResult.success) {
        const errorCodes = verificationResult["error-codes"] || []
        console.error("Turnstile verification failed:", errorCodes)
        return NextResponse.json({ error: "Turnstile verification failed", errorCodes }, { status: 400 })
      }
    }

    // Create record in Airtable using REST API
    const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/434Newsletter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${airtableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Email: email,
              Source: "TXMX",
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error("Airtable API error:", error)
      return NextResponse.json({ error: "Failed to subscribe to newsletter" }, { status: 500 })
    }

    return NextResponse.json({ message: "TXMX newsletter subscription successful" }, { status: 200 })
  } catch (error) {
    console.error("Error subscribing to TXMX newsletter:", error)
    return NextResponse.json({ error: "An error occurred while subscribing to the newsletter" }, { status: 500 })
  }
}
