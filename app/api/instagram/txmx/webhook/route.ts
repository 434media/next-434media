import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Webhook verification for Instagram
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Instagram Webhook] Webhook verified successfully")
    return new Response(challenge, { status: 200 })
  } else {
    console.error("[Instagram Webhook] Webhook verification failed")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log("[Instagram Webhook] Received webhook:", JSON.stringify(body, null, 2))

    // Process Instagram webhook events
    if (body.object === "instagram") {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            console.log("[Instagram Webhook] Processing change:", change.field, change.value)

            // Handle different types of changes
            switch (change.field) {
              case "media":
                console.log("[Instagram Webhook] Media change detected")
                // Handle media updates (new posts, etc.)
                break
              case "comments":
                console.log("[Instagram Webhook] Comment change detected")
                // Handle comment updates
                break
              case "mentions":
                console.log("[Instagram Webhook] Mention detected")
                // Handle mentions
                break
              default:
                console.log("[Instagram Webhook] Unknown change type:", change.field)
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Instagram Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 })
  }
}
