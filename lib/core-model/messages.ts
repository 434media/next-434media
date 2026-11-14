// The CRM keeps the full text (V1 item 4, founder 2026-11-12; guardrails 2026-11-14). Every message the system sends
// to, or receives from, a person outside 434 is stored in full as one Activity in `crm_activities`: body, subject,
// sender, recipients, time, channel and the provider's message id. This module is pure (no Firestore), so every rule
// below is tested directly (lib/__tests__/message-records.test.ts); lib/core-model/messages-server.ts writes it.
//
// The guardrails, each enforced here:
//   1. A broadcast is one record: the body once, plus the list of who it went to. Never one full copy per person.
//   2. An attachment is a link to the file (https), never the file.
//   3. Each message is its own small record linked to the Person by address. Nothing is appended to a Person.
//
// The ledger ("one log we own") holds IDs and hashes only; bodies live here and nowhere else.

import crypto from "crypto"
import type { ActivityContact, CoreSource, MessageAttachment, MessagePath } from "@/types/core-model"
import type { ActivityInput } from "./activity"
import { summarize, validateActivity } from "./activity"
import { normalizeEmail } from "./identity"

/** Firestore's document limit is 1 MiB. A record stays under this, leaving room for field names and indexes. */
export const MAX_RECORD_BYTES = 900_000
/** Recipients held on the record itself; a longer broadcast list continues in `crm_message_recipients` parts. */
export const RECIPIENTS_PER_RECORD = 5_000

export interface MessageInput {
  path: MessagePath
  direction: "sent" | "received"
  /** The address as sent, display name allowed ("Jesse from 434 Media <hello@…>"). */
  from: string
  to: string[]
  cc?: string[]
  replyTo?: string
  subject: string
  /** The plain text as sent or received, whole. */
  text?: string
  html?: string
  /** ISO time it was sent or received. */
  at: string
  messageId?: string
  attachments?: MessageAttachment[]
  /** Who it is about, when the counterpart is not simply the first recipient (sent) or the sender (received). */
  contact?: ActivityContact
  source?: CoreSource
  createdBy?: string
  broadcast?: { label?: string; personalized: string[] }
  redactions?: string[]
}

export interface MessageRecord {
  /** Deterministic when the provider gave an id, so recording the same message twice is a no-op. */
  id: string
  activity: ActivityInput
  /** Overflow of a long broadcast recipient list: emails only. */
  recipientParts: { id: string; activity_id: string; part: number; emails: string[] }[]
}

/** "Name <pat@example.com>" → "pat@example.com", lower-case. Empty when there is no address. */
export function addressOf(value: string | undefined): string {
  if (!value) return ""
  const angle = value.match(/<([^>]+)>/)
  return normalizeEmail(angle ? angle[1] : value)
}

function addresses(list: string[] | undefined): string[] {
  const out: string[] = []
  for (const v of list ?? []) {
    const a = addressOf(v)
    if (a && !out.includes(a)) out.push(a)
  }
  return out
}

/** Text from an HTML-only message, for the summary and the plain body. Tags dropped, entities left as they are. */
export function textFromHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
}

/** Null when the attachment is a link; otherwise why it is refused. A file's bytes are never stored. */
export function attachmentRefusal(a: unknown): string | null {
  if (!a || typeof a !== "object") return "An attachment must be a link to the file."
  const rec = a as Record<string, unknown>
  for (const key of ["content", "data", "bytes", "base64", "buffer"]) {
    if (key in rec) return `An attachment is stored as a link, never the file ("${key}" is not allowed).`
  }
  if (typeof rec.url !== "string" || !/^https:\/\/\S+$/i.test(rec.url)) return "An attachment needs an https link to the file."
  if (typeof rec.filename !== "string" || !rec.filename.trim()) return "An attachment needs its file name."
  return null
}

const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v ?? null), "utf8")

/**
 * Build the one record for a message. Throws when the message cannot be stored as the rules require (no body, no
 * recipient, an attachment that is not a link): the caller logs it, since the message has already gone out.
 */
export function buildMessageRecord(m: MessageInput): MessageRecord {
  const from = addressOf(m.from)
  const to = addresses(m.to)
  const cc = addresses(m.cc)
  const attachments = (m.attachments ?? []).map((a) => {
    const why = attachmentRefusal(a)
    if (why) throw new Error(why)
    return { filename: a.filename, url: a.url, content_type: a.content_type, size: a.size }
  })
  let html = m.html && m.html.trim() ? m.html : undefined
  const text = m.text && m.text.trim() ? m.text : html ? textFromHtml(html) : ""
  const redactions = [...(m.redactions ?? [])]

  // A record must fit one document. The HTML part goes first (the text is the message); the text is never cut.
  if (html && bytes(text) + bytes(html) > MAX_RECORD_BYTES) {
    html = undefined
    redactions.push("html part omitted: too large for one record; the plain text is kept whole")
  }
  if (bytes(text) > MAX_RECORD_BYTES) throw new Error("The message text is larger than one record can hold.")

  const isBroadcast = Boolean(m.broadcast)
  const heldTo = isBroadcast ? to.slice(0, RECIPIENTS_PER_RECORD) : to
  const overflow = isBroadcast ? to.slice(RECIPIENTS_PER_RECORD) : []

  const id = m.messageId
    ? `email:${m.path}:${crypto.createHash("sha256").update(m.messageId).digest("hex").slice(0, 32)}`
    : `email:${m.path}:${crypto.randomUUID()}`

  // The counterpart: who the record is linked to. A sent 1:1 message is linked to its first recipient; a received
  // one to its sender. A broadcast is linked to no single person: it is found through its recipient list.
  const counterpart = isBroadcast ? undefined : m.direction === "sent" ? to[0] : from
  const contact: ActivityContact = m.contact ? { ...m.contact } : counterpart ? { email: counterpart } : {}
  if (contact.email) contact.email = normalizeEmail(contact.email)

  const activity: ActivityInput = {
    type: "email",
    source: m.source ?? "manual",
    channel: "email",
    occurred_at: m.at,
    contact,
    summary: summarize(
      `${isBroadcast ? `Broadcast to ${to.length}` : m.direction === "sent" ? "Sent" : "Received"}: ${m.subject.trim() || "(no subject)"}`,
      "(no subject)",
    ),
    body: text,
    email: {
      direction: m.direction,
      from,
      to: heldTo,
      cc,
      subject: m.subject,
      message_id: m.messageId,
      provider: "resend",
      reply_to: m.replyTo ? addressOf(m.replyTo) || undefined : undefined,
      path: m.path,
      html,
      attachments: attachments.length ? attachments : undefined,
      broadcast: m.broadcast
        ? {
            label: m.broadcast.label,
            recipient_count: to.length,
            recipient_parts: Math.ceil(overflow.length / RECIPIENTS_PER_RECORD),
            personalized: m.broadcast.personalized,
          }
        : undefined,
      redactions: redactions.length ? redactions : undefined,
    },
    created_by: m.createdBy,
  }

  const why = validateActivity(activity)
  if (why) throw new Error(why)

  const recipientParts: MessageRecord["recipientParts"] = []
  for (let i = 0; i < overflow.length; i += RECIPIENTS_PER_RECORD) {
    const part = recipientParts.length + 1
    recipientParts.push({ id: `${id}~${part}`, activity_id: id, part, emails: overflow.slice(i, i + RECIPIENTS_PER_RECORD) })
  }
  return { id, activity, recipientParts }
}

/** Placeholders a broadcast's stored body carries where each person's copy differed. */
export const BROADCAST_PLACEHOLDERS = {
  firstName: "{{first_name}}",
  unsubscribeUrl: "{{unsubscribe_url}}",
} as const
