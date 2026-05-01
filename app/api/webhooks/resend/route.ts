import { type NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { incrementEngagement } from "@/lib/firestore-leads"

export const runtime = "nodejs"

// Resend signs webhooks via Svix. The signing secret comes from the Resend
// dashboard (Webhooks → your endpoint → Signing Secret) and starts with
// `whsec_`. Verifying every request is mandatory — without it, anyone
// could POST forged engagement events to inflate scores.
const SECRET_ENV = "RESEND_WEBHOOK_SECRET"

interface ResendEventBase {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    [k: string]: unknown
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env[SECRET_ENV]
  if (!secret) {
    console.error(`[webhooks/resend] ${SECRET_ENV} not configured — refusing all webhooks`)
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  // Svix headers — present on every Resend webhook
  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  // Read raw body for signature verification — must be the exact bytes,
  // not the parsed JSON object.
  const rawBody = await req.text()

  let event: ResendEventBase
  try {
    const wh = new Webhook(secret)
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ResendEventBase
  } catch (err) {
    console.warn("[webhooks/resend] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const emailId = event.data?.email_id
  if (!emailId || typeof emailId !== "string") {
    // Acknowledge so Resend doesn't retry. Some event types lack email_id.
    return NextResponse.json({ received: true, skipped: "no email_id" })
  }

  try {
    switch (event.type) {
      case "email.opened": {
        const result = await incrementEngagement(emailId, "email_opens")
        return NextResponse.json({ received: true, type: event.type, result })
      }
      case "email.clicked": {
        const result = await incrementEngagement(emailId, "email_clicks")
        return NextResponse.json({ received: true, type: event.type, result })
      }
      case "email.delivered":
      case "email.sent":
      case "email.bounced":
      case "email.complained":
      case "email.delivery_delayed":
        // Logged but not actioned in this PR. A future PR can:
        //  - email.bounced → mark lead as bad_email and surface in UI
        //  - email.complained → auto-archive (spam complaint = lost lead)
        console.log(`[webhooks/resend] ${event.type} for ${emailId}`)
        return NextResponse.json({ received: true, type: event.type })
      default:
        console.log(`[webhooks/resend] unhandled event type: ${event.type}`)
        return NextResponse.json({ received: true, type: event.type })
    }
  } catch (err) {
    console.error(`[webhooks/resend] handler error for ${event.type}:`, err)
    // Return 500 so Resend retries with backoff
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }
}
