/**
 * The Mailchimp webhook's decision (lib/mailchimp-webhook.ts): which events add a suppression, which are ignored, and
 * that nothing clears one or subscribes anyone. Pure; no request, no Firestore.
 * Run: tsx --test lib/__tests__/mailchimp-webhook.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { WEBHOOK_SUPPRESSION_REASONS, mailchimpWebhookAction, webhookEmail } from "../mailchimp-webhook"

const AUD = "aud123"
const ev = (type: string, data: Record<string, string>) => ({
  type,
  ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data[${k}]`, v])),
})

test("unsubscribe suppresses the address, lowercased", () => {
  assert.deepEqual(mailchimpWebhookAction(ev("unsubscribe", { email: " Person@Example.com ", list_id: AUD, reason: "manual" }), AUD), {
    kind: "suppress",
    email: "person@example.com",
    reason: "mailchimp-unsubscribe",
  })
})

test("cleaned (hard bounce or abuse) suppresses the address", () => {
  for (const reason of ["hard", "abuse"]) {
    assert.deepEqual(mailchimpWebhookAction(ev("cleaned", { email: "b@example.com", list_id: AUD, reason }), AUD), {
      kind: "suppress",
      email: "b@example.com",
      reason: "mailchimp-cleaned",
    })
  }
})

test("upemail suppresses the old address, not the new one", () => {
  assert.deepEqual(mailchimpWebhookAction(ev("upemail", { old_email: "old@example.com", new_email: "new@example.com", list_id: AUD }), AUD), {
    kind: "suppress",
    email: "old@example.com",
    reason: "mailchimp-email-changed",
  })
})

test("profile is not an opt-out: ignored", () => {
  const a = mailchimpWebhookAction(ev("profile", { email: "p@example.com", list_id: AUD }), AUD)
  assert.equal(a.kind, "ignore")
})

test("subscribe goes to the existing lead capture and never suppresses", () => {
  assert.deepEqual(mailchimpWebhookAction(ev("subscribe", { email: "s@example.com", list_id: AUD }), AUD), { kind: "subscribe" })
})

test("campaign, unknown and missing types are ignored", () => {
  for (const t of ["campaign", "resubscribe", ""]) assert.equal(mailchimpWebhookAction(ev(t, { email: "x@example.com", list_id: AUD }), AUD).kind, "ignore")
})

test("another audience, or no audience configured, is ignored", () => {
  assert.equal(mailchimpWebhookAction(ev("unsubscribe", { email: "x@example.com", list_id: "other" }), AUD).kind, "ignore")
  assert.equal(mailchimpWebhookAction(ev("unsubscribe", { email: "x@example.com" }), AUD).kind, "ignore")
  assert.equal(mailchimpWebhookAction(ev("unsubscribe", { email: "x@example.com", list_id: AUD }), undefined).kind, "ignore")
})

test("a missing or malformed address is ignored", () => {
  assert.equal(mailchimpWebhookAction(ev("unsubscribe", { list_id: AUD }), AUD).kind, "ignore")
  assert.equal(mailchimpWebhookAction(ev("cleaned", { email: "not-an-address", list_id: AUD }), AUD).kind, "ignore")
  assert.equal(webhookEmail("a b@example.com"), undefined)
  for (const bad of ["@example.com", "a@b@example.com", "a@example", "a@.com", "a@example.", "x".repeat(250) + "@example.com"]) {
    assert.equal(webhookEmail(bad), undefined, bad)
  }
  assert.equal(webhookEmail(" A.B+tag@Sub.Example.co "), "a.b+tag@sub.example.co")
})

test("a long crafted value is rejected quickly (CodeQL js/polynomial-redos)", () => {
  const t = Date.now()
  assert.equal(webhookEmail("!@!." + "!.".repeat(50_000)), undefined)
  assert.ok(Date.now() - t < 200)
})

test("only suppression reasons exist: the module has no clear or subscribe path", () => {
  assert.deepEqual(Object.values(WEBHOOK_SUPPRESSION_REASONS).sort(), ["mailchimp-cleaned", "mailchimp-email-changed", "mailchimp-unsubscribe"])
  const route = readFileSync("app/api/webhooks/mailchimp/route.ts", "utf8")
  assert.match(route, /secretMatches\(provided, expected\)/)
  assert.doesNotMatch(route, /clearMailchimpRemoved|\.delete\(|status:\s*"subscribed"/)
})
