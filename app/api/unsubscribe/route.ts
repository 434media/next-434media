import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { verifyUnsubscribe } from "@/lib/unsubscribe-token"
import { addSuppression } from "@/lib/firestore-suppression"
import { getDefaultAudienceId } from "@/lib/mailchimp-config"

export const runtime = "nodejs"

// Public unsubscribe endpoint for broadcasts. Verifies the signed token, records
// the suppression, and writes the opt-out back to Mailchimp so consent is
// single-sourced. Supports GET (footer link → confirmation page) and POST
// (List-Unsubscribe-Post one-click from Gmail/Apple Mail).

async function unsubscribeFromMailchimp(email: string): Promise<void> {
  try {
    const apiKey = process.env.MAILCHIMP_API_KEY
    const audienceId = getDefaultAudienceId()
    if (!apiKey || !audienceId) return
    const dc = apiKey.split("-").pop()
    const hash = crypto.createHash("md5").update(email.toLowerCase().trim()).digest("hex")
    await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${audienceId}/members/${hash}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "unsubscribed" }),
    })
  } catch {
    /* best-effort — suppression already recorded locally */
  }
}

async function process(email: string, token: string): Promise<boolean> {
  if (!verifyUnsubscribe(email, token)) return false
  await addSuppression(email, "unsubscribe-link")
  await unsubscribeFromMailchimp(email)
  return true
}

function confirmationPage(ok: boolean, email: string): NextResponse {
  const heading = ok ? "You&rsquo;re unsubscribed" : "Link not valid"
  const detail = ok
    ? `${email} will no longer receive 434 Media broadcasts.`
    : "This unsubscribe link is invalid or has expired."
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Unsubscribe</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#041C32;background:#fff;">
  <div style="max-width:480px;margin:80px auto;padding:0 24px;text-align:center;">
    <h2 style="font-size:20px;margin:0 0 8px;">${heading}</h2>
    <p style="color:#6F7883;font-size:14px;line-height:1.6;margin:0;">${detail}</p>
  </div>
</body></html>`
  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("e") || "").toLowerCase().trim()
  const token = req.nextUrl.searchParams.get("t") || ""
  const ok = await process(email, token)
  return confirmationPage(ok, email)
}

export async function POST(req: NextRequest) {
  // One-click (List-Unsubscribe-Post). Params come on the query string.
  const email = (req.nextUrl.searchParams.get("e") || "").toLowerCase().trim()
  const token = req.nextUrl.searchParams.get("t") || ""
  const ok = await process(email, token)
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 })
}
