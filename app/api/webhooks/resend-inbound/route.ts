import { type NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
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
    from?: string | { email?: string }
    to?: Array<string | { email?: string }> | string
    subject?: string
    text?: string
    [k: string]: unknown
  }
}

type InboundTo = Array<string | { email?: string }> | string | undefined

function recipientEmails(to: InboundTo): string[] {
  if (!to) return []
  const arr = Array.isArray(to) ? to : [to]
  return arr.map((r) => (typeof r === "string" ? r : r?.email || "")).filter(Boolean)
}

function leadIdFromRecipients(rcpts: string[]): string | null {
  for (const r of rcpts) {
    const m = r.match(/reply\+([^@]+)@/i)
    if (m) return m[1]
  }
  return null
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

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true, skipped: event.type })
  }

  const rcpts = recipientEmails(event.data?.to)
  const leadId = leadIdFromRecipients(rcpts)
  if (!leadId) {
    return NextResponse.json({ received: true, skipped: "no reply+<leadId> recipient" })
  }

  try {
    const lead = await getLeadById(leadId)
    if (!lead) return NextResponse.json({ received: true, skipped: "lead not found" })

    const stopped = await markSequenceReplied(lead, {
      text: event.data?.text,
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
          text: `${who} (${lead.email}) replied to the outreach sequence — it's been stopped and the lead marked engaged.\n\nReply directly to this email to respond to them.\n\n———\n${event.data?.text || "(no text body)"}`,
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
