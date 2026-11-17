/**
 * Offline. "The CRM keeps the full text" (V1 item 4, founder 2026-11-12; guardrails 2026-11-14): every message the
 * system sends to, or receives from, a person outside 434 is one Activity holding the whole message. Checked here:
 *   1. each send and receive path writes exactly one message record, with the full body;
 *   2. a broadcast to N people is one record with N recipients, never N copies (guardrail 1);
 *   3. an attachment is stored as a link, never the file (guardrail 2);
 *   4. each message is its own record and the Person document is unchanged, in content and size (guardrail 3);
 *   5. visibility holds: sent mail stays out of the inbox, and a private person is never shown in a recipient list.
 * The brand-book share's record is checked in brand-share.test.ts, against its own send path.
 *
 * Run: tsx --test lib/__tests__/message-records.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Activity } from "../../types/core-model"
import { MAX_RECORD_BYTES, RECIPIENTS_PER_RECORD, attachmentRefusal, buildMessageRecord, type MessageInput } from "../core-model/messages"
import { recordMessage, type MessageSink } from "../core-model/messages-server"
import {
  broadcastMessage,
  callRequestRecord,
  contactFormReplyMessage,
  leadOutreachMessage,
  sequenceReplyMessage,
  sequenceStepMessage,
} from "../core-model/message-paths"
import { assembleCoreView, inboxOf, onPersonTimeline } from "../core-model/assemble"
import { filterViewFor } from "../core-model/view-filter"
import { ensurePerson } from "../core-model/service"
import { AT, MemoryStore } from "./helpers/core-memory-store"

const ROOT = join(__dirname, "..", "..")
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8")

/** An in-memory sink with Firestore's write-once `create`. */
function fakeSink() {
  const activities = new Map<string, MessageInput | unknown>()
  const parts: { id: string; emails: string[] }[] = []
  const sink: MessageSink = {
    async createActivity(id, activity) {
      if (activities.has(id)) return false
      activities.set(id, JSON.parse(JSON.stringify(activity)))
      return true
    },
    async createRecipientPart(part) {
      parts.push({ id: part.id, emails: part.emails })
    },
  }
  return { sink, activities, parts }
}

const LONG_BODY = `Hi Dana,\n\n${"We would love to talk about the June production. ".repeat(400)}\n\nBest,\nJesse`
const ONE_TO_ONE = {
  from: "Jesse Hernandez from 434 Media <hello@send.434media.com>",
  to: "Dana@Example.com",
  replyTo: "jesse@434media.com",
  subject: "Your inquiry",
  text: LONG_BODY,
  messageId: "re_123",
  at: "2026-11-14T15:00:00.000Z",
  sentBy: "jesse@434media.com",
}

// ── 1. One record per message, full body ───────────────────────────────────────────────────────────────────────

const PATHS: [string, MessageInput][] = [
  ["contact-form reply", contactFormReplyMessage(ONE_TO_ONE)],
  ["1:1 send-outreach", leadOutreachMessage({ ...ONE_TO_ONE, source: "prospected" })],
  ["outreach-sequence step", sequenceStepMessage({ ...ONE_TO_ONE, source: "prospected" })],
  [
    "call request to a partner",
    callRequestRecord({ from: "Digital Canvas <vip@send.434media.com>", to: ["dana@example.com"], cc: ["partner2@example.com"], replyTo: "vip@434media.com", subject: "Call request", text: LONG_BODY, html: "<p>x</p>", messageId: "re_123", at: ONE_TO_ONE.at }),
  ],
]

for (const [name, input] of PATHS) {
  test(`${name}: writes exactly one record holding the whole message`, async () => {
    const { sink, activities, parts } = fakeSink()
    const out = await recordMessage(input, sink)
    assert.equal(out.recorded, true)
    assert.equal(activities.size, 1, "exactly one record")
    assert.equal(parts.length, 0)
    const a = [...activities.values()][0] as Activity
    assert.equal(a.type, "email")
    assert.equal(a.channel, "email")
    assert.equal(a.body, LONG_BODY, "the body is stored whole, never truncated")
    assert.equal(a.email?.direction, "sent")
    assert.equal(a.email?.message_id, "re_123")
    assert.equal(a.email?.provider, "resend")
    assert.ok(a.email?.subject)
    assert.ok(a.email?.from.endsWith("@send.434media.com"))
    assert.equal(a.email?.to[0], "dana@example.com", "recipients are normalized addresses")
    assert.equal(a.occurred_at, ONE_TO_ONE.at)
    assert.equal(a.contact.email, "dana@example.com", "linked to the Person by address")
  })
}

test("recording the same provider message twice writes one record (a retried sequence step)", async () => {
  const { sink, activities } = fakeSink()
  const input = sequenceStepMessage(ONE_TO_ONE)
  const first = await recordMessage(input, sink)
  const second = await recordMessage(input, sink)
  assert.equal(activities.size, 1)
  assert.deepEqual([first.recorded, second.recorded], [true, true])
  assert.equal((second as { duplicate: boolean }).duplicate, true)
})

test("an inbound reply is kept whole: quoted lines, HTML and the sender, not the lead timeline's 1,500-character excerpt", async () => {
  const text = `Yes, let's talk Tuesday.\n\nOn Mon, Nov 9, 434 Media wrote:\n> ${"quoted original ".repeat(200)}`
  const input = sequenceReplyMessage(
    { id: "in_9", from: "Dana <dana@example.com>", to: ["reply+lead1@inbound.send.434media.com"], subject: "Re: hello", text, html: "<p>Yes</p>", created_at: "2026-11-14T16:00:00.000Z" },
    { to: [], at: "x" },
  )
  const { sink, activities } = fakeSink()
  await recordMessage(input, sink)
  const a = [...activities.values()][0] as Activity
  assert.equal(activities.size, 1)
  assert.equal(a.body, text)
  assert.ok(a.body!.length > 1500)
  assert.equal(a.email?.direction, "received")
  assert.equal(a.email?.html, "<p>Yes</p>")
  assert.equal(a.contact.email, "dana@example.com", "a received message is linked to its sender")
})

test("a message that cannot be stored is refused and logged, never thrown into the send path", async () => {
  const { sink, activities } = fakeSink()
  const out = await recordMessage({ ...contactFormReplyMessage(ONE_TO_ONE), text: "  " }, sink)
  assert.equal(out.recorded, false)
  assert.equal(activities.size, 0)
})

test("an HTML-only message keeps its HTML and a plain-text body derived from it", () => {
  const rec = buildMessageRecord({ ...contactFormReplyMessage(ONE_TO_ONE), text: undefined, html: "<p>Hello <b>Dana</b></p><p>Second</p>" })
  assert.equal(rec.activity.email?.html, "<p>Hello <b>Dana</b></p><p>Second</p>")
  assert.match(rec.activity.body!, /Hello\s+Dana\s*\n\s*Second/)
})

test("a record fits one document: an oversized HTML part is left out and said so; the text is never cut", () => {
  const big = "x".repeat(MAX_RECORD_BYTES)
  const rec = buildMessageRecord({ ...contactFormReplyMessage(ONE_TO_ONE), html: big })
  assert.equal(rec.activity.email?.html, undefined)
  assert.equal(rec.activity.body, LONG_BODY)
  assert.ok(rec.activity.email?.redactions?.some((r) => r.startsWith("html part omitted")))
})

// ── 2. A broadcast is one record ───────────────────────────────────────────────────────────────────────────────

const recipients = (n: number) => Array.from({ length: n }, (_, i) => `person${i}@example.com`)
const BROADCAST_HTML = "<p>Hi {{first_name}},</p><p>Join us.</p><a href=\"{{unsubscribe_url}}\">Unsubscribe</a>"

test("a broadcast to N people writes one record with N recipients, not N copies", async () => {
  const { sink, activities, parts } = fakeSink()
  const N = 250
  await recordMessage(
    broadcastMessage({ from: "Digital Canvas | 434 Media <vip@send.434media.com>", replyTo: "VIP@434media.com", subject: "Lead with Ops", html: BROADCAST_HTML, sentEmails: recipients(N), broadcastId: "lead-with-ops-invite-1", label: "lead-with-ops-invite", at: AT }),
    sink,
  )
  assert.equal(activities.size, 1, "one record for the whole broadcast")
  assert.equal(parts.length, 0)
  const a = [...activities.values()][0] as Activity
  assert.equal(a.email?.to.length, N)
  assert.equal(a.email?.broadcast?.recipient_count, N)
  assert.equal(a.email?.html, BROADCAST_HTML, "the body is stored once")
  assert.deepEqual(a.email?.broadcast?.personalized, ["{{first_name}}", "{{unsubscribe_url}}"])
  assert.equal(a.contact.email, undefined, "linked to no single person")
  // The body appears once in the record, not once per recipient.
  assert.equal(JSON.stringify(a).split("Join us.").length - 1, 2, "once in the HTML and once in the derived text")
})

test("a very long broadcast list continues in recipient parts: emails only, the body still once", async () => {
  const { sink, activities, parts } = fakeSink()
  const N = RECIPIENTS_PER_RECORD * 2 + 7
  await recordMessage(
    broadcastMessage({ from: "x <vip@send.434media.com>", replyTo: "VIP@434media.com", subject: "s", html: BROADCAST_HTML, sentEmails: recipients(N), broadcastId: "b-2", at: AT }),
    sink,
  )
  assert.equal(activities.size, 1)
  const a = [...activities.values()][0] as Activity
  assert.equal(a.email?.to.length, RECIPIENTS_PER_RECORD)
  assert.equal(a.email?.broadcast?.recipient_count, N)
  assert.equal(a.email?.broadcast?.recipient_parts, 2)
  assert.deepEqual(parts.map((p) => p.emails.length), [RECIPIENTS_PER_RECORD, 7])
  assert.equal(JSON.stringify(parts).includes("Join us."), false, "the parts never carry the body")
  assert.ok(Buffer.byteLength(JSON.stringify(a)) < MAX_RECORD_BYTES)
})

test("broadcast-send records once, after the loop, from the emails that actually sent", () => {
  const src = read("lib/broadcast-send.ts")
  assert.equal((src.match(/recordMessage\(/g) ?? []).length, 1)
  assert.ok(src.indexOf("recordMessage(") > src.lastIndexOf("for (const c of chunk)"), "after the send loop, not inside it")
  assert.match(src, /sentEmails,\n\s+broadcastId/)
})

// ── 3. Attachments are links ───────────────────────────────────────────────────────────────────────────────────

test("an inbound attachment is stored as a link to the file, never the file", async () => {
  const input = sequenceReplyMessage(
    { id: "in_10", from: "dana@example.com", to: ["reply+l@x.example"], subject: "Deck", text: "Attached.", attachments: [{ id: "att_1", filename: "deck.pdf", content_type: "application/pdf", size: 2_400_000 }] },
    { to: [], at: AT },
  )
  const { sink, activities } = fakeSink()
  await recordMessage(input, sink)
  const a = [...activities.values()][0] as Activity
  assert.deepEqual(a.email?.attachments, [
    { filename: "deck.pdf", url: "https://api.resend.com/emails/receiving/in_10/attachments/att_1", content_type: "application/pdf", size: 2_400_000 },
  ])
  assert.ok(Buffer.byteLength(JSON.stringify(a)) < 4_000, "a 2.4 MB attachment adds a link, not megabytes")
})

test("an attachment carrying the file's bytes, or no https link, is refused", async () => {
  assert.match(attachmentRefusal({ filename: "a.pdf", url: "https://x.example/a.pdf", content: "JVBERi0..." })!, /link, never the file/)
  assert.match(attachmentRefusal({ filename: "a.pdf", url: "data:application/pdf;base64,JVBER" })!, /https link/)
  assert.equal(attachmentRefusal({ filename: "a.pdf", url: "https://x.example/a.pdf" }), null)
  const { sink, activities } = fakeSink()
  const out = await recordMessage(
    { ...contactFormReplyMessage(ONE_TO_ONE), attachments: [{ filename: "a.pdf", url: "https://x.example/a.pdf", data: "JVBER" } as never] },
    sink,
  )
  assert.equal(out.recorded, false)
  assert.equal(activities.size, 0)
})

// ── 4. Each message is its own record; the Person is untouched ─────────────────────────────────────────────────

test("recording messages leaves the Person document unchanged, in content and size", async () => {
  const store = new MemoryStore()
  const { person } = await ensurePerson(store, { contact: { name: "Dana Client", email: "dana@example.com" }, source: "web", at: AT })
  const before = JSON.stringify(await store.getPerson(person.id))
  const { sink, activities } = fakeSink()
  for (let i = 0; i < 20; i++) await recordMessage({ ...contactFormReplyMessage(ONE_TO_ONE), messageId: `re_${i}` }, sink)
  const after = JSON.stringify(await store.getPerson(person.id))
  assert.equal(after, before)
  assert.equal(Buffer.byteLength(after), Buffer.byteLength(before))
  assert.equal(activities.size, 20, "twenty messages, twenty small records")
  // The sink can only create activities and recipient parts: there is no path to write a Person.
  assert.deepEqual(Object.keys(sink).sort(), ["createActivity", "createRecipientPart"])
})

test("no send path writes a message body to a Person or a lead", () => {
  for (const f of ["lib/core-model/messages.ts", "lib/core-model/messages-server.ts", "lib/core-model/message-paths.ts"]) {
    const src = read(f)
    assert.doesNotMatch(src, /firestore-people|updatePerson|updateLead|appendLeadActivity/, `${f} touches no Person or lead`)
  }
})

// ── 5. Visibility ──────────────────────────────────────────────────────────────────────────────────────────────

function activity(over: Partial<Activity>): Activity {
  return { id: "a", type: "email", source: "manual", occurred_at: AT, contact: {}, summary: "s", triaged: false, created_at: AT, ...over }
}

test("sent mail is never in the inbox; a reply that comes back is", () => {
  const sent = activity({ id: "s", email: { direction: "sent", from: "a@send.434media.com", to: ["d@example.com"], cc: [], subject: "x" } })
  const got = activity({ id: "r", email: { direction: "received", from: "d@example.com", to: ["a@x.example"], cc: [], subject: "x" } })
  assert.deepEqual(inboxOf({ people: [], organizations: [], affiliations: [], activities: [sent, got] }).map((a) => a.id), ["r"])
})

test("a broadcast shows on each recipient's timeline, and a private person's address is hidden from everyone but the founder", async () => {
  const store = new MemoryStore()
  const { person: business } = await ensurePerson(store, { contact: { name: "Biz", email: "biz@example.com" }, source: "web", at: AT })
  const { person: friend } = await ensurePerson(store, {
    contact: { name: "Friend", email: "friend@example.com" },
    source: "google_contacts",
    at: AT,
    relationship: "personal",
    allowPrivate: true,
  })
  const bc = activity({
    id: "bc",
    email: { direction: "sent", from: "vip@send.434media.com", to: ["biz@example.com", "friend@example.com"], cc: [], subject: "x", broadcast: { recipient_count: 2, recipient_parts: 0, personalized: [] } },
  })
  const view = assembleCoreView({ people: [business, friend], organizations: [], affiliations: [], activities: [bc] }, [], new Set())
  assert.ok(onPersonTimeline(view.activities[0], business))

  const staffView = filterViewFor(view, { role: "full_admin" })
  assert.deepEqual(staffView.activities[0].email?.to, ["biz@example.com"], "the personal contact's address is not shown")
  const founderView = filterViewFor(view, { role: "crm_super_admin", superAdmin: true, founder: true })
  assert.deepEqual(founderView.activities[0].email?.to, ["biz@example.com", "friend@example.com"])
})

test("a 1:1 message to a private person is hidden with them", async () => {
  const store = new MemoryStore()
  const { person: friend } = await ensurePerson(store, {
    contact: { name: "Friend", email: "friend@example.com" },
    source: "google_contacts",
    at: AT,
    relationship: "personal",
    allowPrivate: true,
  })
  const msg = activity({ id: "m", contact: { email: "friend@example.com" }, email: { direction: "received", from: "friend@example.com", to: ["x@434media.com"], cc: [], subject: "hi" } })
  const view = assembleCoreView({ people: [friend], organizations: [], affiliations: [], activities: [msg] }, [], new Set())
  assert.equal(filterViewFor(view, { role: "full_admin" }).activities.length, 0)
  assert.equal(filterViewFor(view, { role: "crm_super_admin", superAdmin: true, founder: true }).activities.length, 1)
})

// ── Every send path is wired ───────────────────────────────────────────────────────────────────────────────────

test("every send and receive path in the inventory records its message", () => {
  const wired: [string, RegExp][] = [
    ["app/api/admin/contact-forms/[id]/reply/route.ts", /recordMessage\(\s*contactFormReplyMessage\(/],
    ["app/api/admin/leads/[id]/send-outreach/route.ts", /recordMessage\(\s*leadOutreachMessage\(/],
    ["lib/outreach-sequence.ts", /recordMessage\(\s*sequenceStepMessage\(/],
    ["app/api/webhooks/resend-inbound/route.ts", /recordMessage\(\s*sequenceReplyMessage\(/],
    ["lib/broadcast-send.ts", /recordMessage\(\s*broadcastMessage\(/],
    ["lib/brand-share-send.ts", /deps\.recordMessage\(brandShareMessage\(/],
    ["lib/brand-share-deps.ts", /recordMessage: \(m\) => recordMessage\(m\)/],
    ["app/api/lead-with-ops/feedback/route.ts", /recordMessage\(callRequestRecord\(/],
  ]
  for (const [file, re] of wired) assert.match(read(file), re, file)
})
