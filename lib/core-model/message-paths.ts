// One builder per send or receive path: what each path hands to recordMessage (lib/core-model/messages-server.ts).
// Pure, so each path's record is tested offline (lib/__tests__/message-records.test.ts). The paths are the
// inventory in the run log of 2026-11-14 ("The CRM keeps the full text").

import type { CoreSource, MessageAttachment } from "@/types/core-model"
import { CORE_SOURCES } from "@/types/core-model"
import { BROADCAST_PLACEHOLDERS, type MessageInput } from "./messages"

const coreSource = (v: unknown): CoreSource | undefined => (CORE_SOURCES.includes(v as CoreSource) ? (v as CoreSource) : undefined)

/** A single message one person at 434 sent to one person (contact-form reply, bulk acknowledgment, 1:1 outreach). */
export interface OneToOneSend {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
  html?: string
  messageId: string
  at: string
  sentBy?: string
  /** The lead's or contact's own source, when known (keeps the cold gate's reading of the person intact). */
  source?: unknown
}

function oneToOne(path: MessageInput["path"], s: OneToOneSend): MessageInput {
  return {
    path,
    direction: "sent",
    from: s.from,
    to: [s.to],
    replyTo: s.replyTo,
    subject: s.subject,
    text: s.text,
    html: s.html,
    at: s.at,
    messageId: s.messageId,
    source: coreSource(s.source),
    createdBy: s.sentBy,
  }
}

/** POST /api/admin/contact-forms/[id]/reply ("Write reply" in the People Inbox). */
export const contactFormReplyMessage = (s: OneToOneSend) => oneToOne("contact_form_reply", { ...s, source: s.source ?? "web" })
/** POST /api/admin/leads/[id]/send-outreach. */
export const leadOutreachMessage = (s: OneToOneSend) => oneToOne("lead_outreach", s)
/** An outreach-sequence step (lib/outreach-sequence.ts, runSequenceStep). */
export const sequenceStepMessage = (s: OneToOneSend) => oneToOne("outreach_sequence", { ...s, sentBy: s.sentBy ?? "system" })

/** The Received Emails API's view of an inbound message (GET /emails/receiving/{id}). */
export interface ReceivedEmail {
  id: string
  from?: string
  to?: string[]
  cc?: string[]
  subject?: string
  text?: string | null
  html?: string | null
  created_at?: string
  attachments?: Array<{ id?: string; filename?: string; content_type?: string; size?: number }>
}

/**
 * A link to an inbound attachment at the provider, never the file. Resend serves a received attachment from this
 * endpoint (authorised with the API key); the CRM keeps only the link and the file's name, type and size.
 */
export function receivedAttachmentUrl(emailId: string, attachmentId: string): string {
  return `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`
}

/** A reply that came back through the Resend inbound webhook (app/api/webhooks/resend-inbound). Kept whole, quotes included. */
export function sequenceReplyMessage(r: ReceivedEmail, fallback: { from?: string; to: string[]; subject?: string; at: string; source?: unknown }): MessageInput {
  const attachments: MessageAttachment[] = (r.attachments ?? [])
    .filter((a) => a.id)
    .map((a) => ({ filename: a.filename || "attachment", url: receivedAttachmentUrl(r.id, a.id as string), content_type: a.content_type, size: a.size }))
  return {
    path: "sequence_reply",
    direction: "received",
    from: r.from || fallback.from || "",
    to: r.to?.length ? r.to : fallback.to,
    cc: r.cc,
    subject: r.subject ?? fallback.subject ?? "",
    text: r.text ?? undefined,
    html: r.html ?? undefined,
    at: r.created_at || fallback.at,
    messageId: r.id,
    attachments,
    source: coreSource(fallback.source),
    createdBy: "system",
  }
}

/** A broadcast (lib/broadcast-send.ts): one record, the body once, every recipient who was actually sent it. */
export function broadcastMessage(b: {
  from: string
  replyTo: string
  subject: string
  /** The body rendered once with BROADCAST_PLACEHOLDERS where each person's copy differed. */
  html: string
  sentEmails: string[]
  broadcastId: string
  label?: string
  at: string
}): MessageInput {
  return {
    path: "broadcast",
    direction: "sent",
    from: b.from,
    to: b.sentEmails,
    replyTo: b.replyTo,
    subject: b.subject,
    html: b.html,
    at: b.at,
    messageId: b.broadcastId,
    source: "newsletter",
    createdBy: "system",
    broadcast: { label: b.label, personalized: [BROADCAST_PLACEHOLDERS.firstName, BROADCAST_PLACEHOLDERS.unsubscribeUrl] },
  }
}

/**
 * The stand-in for a brand-book share's link in the stored copy. The link carries a bearer token that opens the book;
 * the share record keeps only its hash (lib/brand-share-send.ts), so the stored message does not keep it either.
 */
export const shareLinkPlaceholder = (shareId: string) => `[brand book link for share ${shareId}; the token is not stored]`

/** A brand-book share (lib/brand-share-send.ts). `text` and `html` are the mail rendered with shareLinkPlaceholder. */
export function brandShareMessage(s: { from: string; to: string; replyTo: string; subject: string; text: string; html: string; messageId: string; at: string; sentBy: string }): MessageInput {
  return {
    ...oneToOne("brand_share", s),
    redactions: ["share link: its token opens the brand book and is never stored (the share keeps only its hash)"],
  }
}

/** The Lead with Ops call request sent to the partner (app/api/lead-with-ops/feedback). */
export function callRequestRecord(m: { from: string; to: string[]; cc: string[]; replyTo: string; subject: string; text: string; html: string; messageId: string; at: string }): MessageInput {
  return {
    path: "call_request",
    direction: "sent",
    from: m.from,
    to: m.to,
    cc: m.cc,
    replyTo: m.replyTo,
    subject: m.subject,
    text: m.text,
    html: m.html,
    at: m.at,
    messageId: m.messageId,
    source: "event",
    createdBy: "system",
  }
}
