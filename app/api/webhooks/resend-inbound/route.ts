import { type NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import sanitizeHtml from "sanitize-html"
import { getLeadById } from "@/lib/firestore-leads"
import { markSequenceReplied } from "@/lib/outreach-sequence"
import { getResend, OUTREACH_FROM, assertVerifiedSender } from "@/lib/resend"

export const runtime = "nodejs"

// Resend Inbound (Phase 2). Sequence sends use a per-lead reply-to
// (`reply+<leadId>@<SEQUENCE_INBOUND_DOMAIN>`); when the lead replies, Resend's
// receiving domain captures it and POSTs an `email.received` event here. We
// match the lead from the plus-address, stop its sequence + mark it engaged,
// and forward the reply to the rep so the human conversation continues.
//
// Setup (one-time, in Resend + DNS):
//   1. Add a receiving domain (e.g. inbound.send.434media.com) with the MX
//      records Resend provides.
//   2. Add a webhook for `email.received` → /api/webhooks/resend-inbound.
//   3. Set RESEND_INBOUND_WEBHOOK_SECRET (the endpoint signing secret) and
//      SEQUENCE_INBOUND_DOMAIN. Until both are set, sequences fall back to
//      reply-to = rep (Phase 1).
const SECRET_ENV = "RESEND_INBOUND_WEBHOOK_SECRET"

interface InboundEvent {
  type: string
  data?: {
    // The received email's id — the ONLY handle to its body. The webhook
    // payload itself carries metadata only (Resend does not send the body),
    // so we retrieve the content via GET /emails/receiving/{email_id}.
    email_id?: string
    from?: string | { email?: string }
    to?: Array<string | { email?: string }> | string
    subject?: string
    [k: string]: unknown
  }
}

type InboundTo = Array<string | { email?: string }> | string | undefined

function recipientEmails(to: InboundTo): string[] {
  if (!to) return []
  const arr = Array.isArray(to) ? to : [to]
  return arr.map((r) => (typeof r === "string" ? r : r?.email || "")).filter(Boolean)
}

// Pull the leadId out of our own plus-address, or return null.
//
// Deliberately not a pattern match. The question is not "does this string
// contain something shaped like reply+X@" — it is "is this recipient OUR
// address, and if so what is the leadId". Both checks that decide it are
// string equality: the local part must begin with exactly `reply+`, and the
// domain must be exactly SEQUENCE_INBOUND_DOMAIN. Substring search is what
// let `noreply+xyz@vendor.com` yield "xyz", and anchoring on a delimiter only
// closed that one class — `reply+<id>@attacker.com` still matched, because
// the domain was never checked at all, and a quoted bare address stopped
// matching because `"` was not in the delimiter set.
//
// That mattered: mail reaching the receiving domain whose `to` also carried
// `reply+<someLeadId>@anywhere.com` would stop that lead's sequence, mark it
// engaged and forward content to the rep. The svix signature does not help —
// the webhook is genuine, the header content is not ours.
//
// The one regex left is unwrapping a display name, which is a real pattern.
function leadIdFromRecipients(rcpts: string[]): string | null {
  const domain = process.env.SEQUENCE_INBOUND_DOMAIN?.trim().toLowerCase()
  // No configured domain means nothing can be verified as ours. Matching on
  // the prefix alone here would accept any sender's reply+ address.
  if (!domain) return null

  for (const r of rcpts) {
    const angle = r.match(/<([^>]*)>/)
    // A bare value may still be a comma/semicolon-separated list.
    const candidates = angle ? [angle[1]] : r.split(/[,;]/)
    for (const candidate of candidates) {
      const addr = candidate.trim().replace(/^["']|["']$/g, "").toLowerCase()
      const at = addr.lastIndexOf("@")
      if (at < 0) continue
      if (addr.slice(at + 1) !== domain) continue
      const local = addr.slice(0, at)
      if (!local.startsWith("reply+")) continue
      const leadId = local.slice("reply+".length)
      if (leadId) return leadId
    }
  }
  return null
}

// HTML→text for replies that arrive HTML-only (no plain-text part). Uses
// sanitize-html rather than hand-rolled regex so tag stripping is complete and
// entity decoding isn't double-applied. Block/break tags become newlines first
// (via a whitelisted transform), then all tags are dropped.
function htmlToText(html: string): string {
  const withBreaks = sanitizeHtml(html, {
    allowedTags: ["br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"],
    allowedAttributes: {},
    // Insert a newline marker as text where a block/break element sits, then we
    // strip the tag itself in the second pass below.
    transformTags: {
      br: () => ({ tagName: "br", attribs: {}, text: "\n" }),
      p: () => ({ tagName: "p", attribs: {}, text: "\n" }),
      div: () => ({ tagName: "div", attribs: {}, text: "\n" }),
      li: () => ({ tagName: "li", attribs: {}, text: "\n" }),
      tr: () => ({ tagName: "tr", attribs: {}, text: "\n" }),
    },
  })
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
  return text.replace(/\n{3,}/g, "\n\n").trim()
}

// Fetch the received email's body. The email.received webhook is metadata-only,
// so the reply text lives behind the Received Emails API. Best-effort: returns
// undefined (never throws) so a failed fetch degrades to a body-less timeline
// note rather than breaking the stop-sequence path. One short retry covers the
// brief window where the email isn't queryable the instant the webhook fires.
async function fetchReceivedEmailText(emailId: string): Promise<string | undefined> {
  const key = process.env.RESEND_API_KEY
  if (!key) return undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
        headers: { Authorization: `Bearer ${key}` },
      })
      if (res.ok) {
        const body = (await res.json()) as { text?: string | null; html?: string | null }
        const text = body.text?.trim() || (body.html ? htmlToText(body.html) : "")
        return text || undefined
      }
      if (res.status === 404 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200)) // not yet queryable — retry once
        continue
      }
      return undefined
    } catch {
      return undefined
    }
  }
  return undefined
}

export async function POST(req: NextRequest) {
  const secret = process.env[SECRET_ENV]
  if (!secret) {
    console.error(`[webhooks/resend-inbound] ${SECRET_ENV} not configured — refusing`)
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const svixId = req.headers.get("svix-id")
  const svixTimestamp = req.headers.get("svix-timestamp")
  const svixSignature = req.headers.get("svix-signature")
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const rawBody = await req.text()
  let event: InboundEvent
  try {
    const wh = new Webhook(secret)
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as InboundEvent
  } catch (err) {
    console.warn("[webhooks/resend-inbound] signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // Every path below returns 200 so Resend does not retry, which means an
  // unmatched message leaves no trace unless we log it here. Recipients and the
  // parsed lead id are enough to diagnose a miss; message bodies and subjects
  // are deliberately never logged.
  if (event.type !== "email.received") {
    console.log(`[webhooks/resend-inbound] ignoring event type: ${event.type}`)
    return NextResponse.json({ received: true, skipped: event.type })
  }

  const rcpts = recipientEmails(event.data?.to)
  const leadId = leadIdFromRecipients(rcpts)
  if (!leadId) {
    console.warn(
      `[webhooks/resend-inbound] unmatched mail — no reply+<leadId> recipient. type=${event.type} recipients=${JSON.stringify(rcpts)}`,
    )
    return NextResponse.json({ received: true, skipped: "no reply+<leadId> recipient" })
  }

  try {
    const lead = await getLeadById(leadId)
    if (!lead) {
      console.warn(
        `[webhooks/resend-inbound] unmatched mail — no lead for parsed id. leadId=${leadId} recipients=${JSON.stringify(rcpts)}`,
      )
      return NextResponse.json({ received: true, skipped: "lead not found" })
    }

    // Pull the actual reply body (webhook is metadata-only) so it lands in the
    // timeline and the rep's forwarded copy.
    const replyText = event.data?.email_id
      ? await fetchReceivedEmailText(event.data.email_id)
      : undefined

    const stopped = await markSequenceReplied(lead, {
      text: replyText,
      subject: event.data?.subject,
    })

    // Forward the reply to the rep so they keep the conversation. Best-effort —
    // the stop + engage above is the critical part. Reply-to is the lead, so the
    // rep's reply goes straight back to them.
    const repEmail = lead.outreach_sequence?.enrolled_by || lead.assigned_to
    if (repEmail) {
      try {
        const from = process.env.LEAD_OUTREACH_FROM || OUTREACH_FROM
        assertVerifiedSender(from)
        const who = lead.name || lead.email
        await getResend().emails.send({
          from,
          to: repEmail,
          replyTo: lead.email,
          subject: `↩ ${who} replied — ${event.data?.subject || "(no subject)"}`,
          text: `${who} (${lead.email}) replied to the outreach sequence — it's been stopped and the lead marked engaged.\n\nReply directly to this email to respond to them.\n\n———\n${replyText || "(reply body unavailable)"}`,
        })
      } catch (err) {
        console.error("[webhooks/resend-inbound] forward failed:", err)
      }
    }

    return NextResponse.json({ received: true, leadId, sequenceStopped: stopped })
  } catch (err) {
    console.error("[webhooks/resend-inbound] handler error:", err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }
}
