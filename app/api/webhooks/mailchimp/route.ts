import { type NextRequest, NextResponse } from "next/server"
import { captureLeadFromEmailSignup } from "@/lib/firestore-leads"
import { secretMatches } from "@/lib/secret-compare"
import { addSuppressions } from "@/lib/firestore-suppression"
import { getDefaultAudienceId } from "@/lib/mailchimp-config"
import { mailchimpWebhookAction } from "@/lib/mailchimp-webhook"

export const runtime = "nodejs"

/**
 * Mailchimp doesn't sign webhooks the way Resend/Stripe do. Their guidance is
 * to put a hard-to-guess secret in the URL itself: e.g.
 *   https://434media.com/api/webhooks/mailchimp?secret=<random>
 *
 * We compare against MAILCHIMP_WEBHOOK_SECRET in env. Without a match → 401.
 * Without a configured secret on the server → 500 (refuse all, never default-open).
 *
 * Mailchimp will also call this endpoint with a GET to verify the URL when you
 * register the webhook. We answer GET with 200 OK so the registration succeeds.
 *
 * An unsubscribe, a cleaned address (hard bounce or abuse report) or an email change in the 434 Media audience adds a
 * suppression (email_suppression) at once, so the hourly push skips the address and no surface emails it (founder,
 * 2026-11-21). This route only adds suppressions; it never clears one or subscribes anyone (lib/mailchimp-webhook.ts).
 */
const SECRET_PARAM = "secret"
const SECRET_ENV = "MAILCHIMP_WEBHOOK_SECRET"

function authorize(req: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env[SECRET_ENV]
  if (!expected) {
    return { ok: false, status: 500, error: `${SECRET_ENV} not configured` }
  }
  const url = new URL(req.url)
  const provided = url.searchParams.get(SECRET_PARAM)
  // Constant time. The secret stays in the query: Mailchimp webhooks cannot send a custom header.
  if (!secretMatches(provided, expected)) {
    return { ok: false, status: 401, error: "Invalid or missing secret" }
  }
  return { ok: true }
}

// Mailchimp's URL-verification ping. Just answer 200.
export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (!auth.ok) {
    if (auth.status === 500) console.error(`[webhooks/mailchimp] ${auth.error}`)
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  // Mailchimp posts application/x-www-form-urlencoded with bracketed keys like:
  //   type=subscribe
  //   data[email]=foo@bar.com
  //   data[merges][FNAME]=Jesse
  //   data[merges][LNAME]=Hernandez
  //   data[list_id]=abc123
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (err) {
    console.warn("[webhooks/mailchimp] body parse failed:", err)
    return NextResponse.json({ error: "Invalid form body" }, { status: 400 })
  }

  const type = formData.get("type")
  const fields: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (typeof v === "string") fields[k] = v
  const action = mailchimpWebhookAction(fields, getDefaultAudienceId())

  if (action.kind === "suppress") {
    try {
      const added = await addSuppressions([action.email], action.reason)
      // No address in the log: the reason and whether it was new are enough to trace the event.
      console.log(`[webhooks/mailchimp] ${type}: ${added ? "suppressed" : "already suppressed"} (${action.reason})`)
      return NextResponse.json({ ok: true, type, action: added ? "suppressed" : "already_suppressed" })
    } catch (err) {
      // Mailchimp counts a non-200 as a failed delivery. The write is idempotent if the event comes again.
      console.error("[POST /api/webhooks/mailchimp] suppression write failed:", err)
      return NextResponse.json({ error: "Could not record the suppression" }, { status: 500 })
    }
  }
  if (action.kind === "ignore") {
    console.log(`[webhooks/mailchimp] received ${type}, no-op (${action.why})`)
    return NextResponse.json({ ok: true, type, action: "no-op" })
  }

  // subscribe: fan into leads, as before. Never clears a suppression.
  const email = formData.get("data[email]")
  if (typeof email !== "string" || !email.trim()) {
    return NextResponse.json({ ok: true, action: "no-op", reason: "no email" })
  }

  const fname = (formData.get("data[merges][FNAME]") as string) ?? ""
  const lname = (formData.get("data[merges][LNAME]") as string) ?? ""
  const fullName = `${fname} ${lname}`.trim()

  // Mailchimp sends the audience id in `data[list_id]`. We use it as the
  // source tag so each newsletter audience gets its own filter chip.
  const listId = (formData.get("data[list_id]") as string) ?? "mailchimp"

  // captureLeadFromEmailSignup dedupes by lowercased email and never throws.
  // Source code "newsletter" maps via inferPlatform — list_id appears as a tag.
  const result = await captureLeadFromEmailSignup({
    email: email.trim(),
    source: listId,
    tags: fullName ? [`mc:${listId}`, `name:${fullName}`] : [`mc:${listId}`],
  })

  return NextResponse.json({ ok: true, type, ...result })
}
