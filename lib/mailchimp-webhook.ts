// What a Mailchimp webhook event does to the CRM (founder, 2026-11-21: "approve the webhook"). Pure: no request,
// no Firestore. app/api/webhooks/mailchimp/route.ts does the I/O.
//
// An opt-out recorded in Mailchimp becomes a suppression (`email_suppression`, lib/firestore-suppression.ts) the
// moment it happens, so the hourly push (lib/mailchimp-autosync.ts) skips the address instead of retrying it on the
// daily full pass, and no other surface emails it. This module only ever adds a suppression. Nothing here clears
// one or subscribes anyone: a `subscribe` event goes on to capture a lead, as it did before, and never touches
// suppression.
//
// Mailchimp posts application/x-www-form-urlencoded with bracketed keys:
//   type=unsubscribe   data[email]=…  data[list_id]=…  data[reason]=manual|abuse
//   type=cleaned       data[email]=…  data[list_id]=…  data[reason]=hard|abuse
//   type=upemail       data[old_email]=…  data[new_email]=…  data[list_id]=…
//   type=profile       data[email]=…  data[merges][…]=…
//   type=subscribe     data[email]=…  data[merges][FNAME]=…  data[list_id]=…

/** `email_suppression` reasons this webhook writes. An existing record keeps its own reason (addSuppressions). */
export const WEBHOOK_SUPPRESSION_REASONS = {
  unsubscribe: "mailchimp-unsubscribe",
  cleaned: "mailchimp-cleaned",
  upemail: "mailchimp-email-changed",
} as const

export type WebhookAction =
  | { kind: "suppress"; email: string; reason: (typeof WEBHOOK_SUPPRESSION_REASONS)[keyof typeof WEBHOOK_SUPPRESSION_REASONS] }
  | { kind: "subscribe" }
  | { kind: "ignore"; why: string }

/**
 * A lowercased, trimmed address, or undefined when the value is not one: at most 254 characters, no whitespace, one
 * "@" with text before it, and a dot inside the part after it. Checked without a backtracking regular expression, since
 * the value comes from the request (CodeQL js/polynomial-redos).
 */
export function webhookEmail(v: string | undefined): string | undefined {
  const e = (v ?? "").trim().toLowerCase()
  if (!e || e.length > 254 || /\s/.test(e)) return undefined
  const at = e.indexOf("@")
  if (at < 1 || at !== e.lastIndexOf("@")) return undefined
  const domain = e.slice(at + 1)
  const dot = domain.indexOf(".")
  return dot > 0 && !domain.endsWith(".") ? e : undefined
}

/**
 * The action for one event. `fields` are the form fields as Mailchimp sent them; `audienceId` is the one live
 * audience (getDefaultAudienceId). An opt-out from any other audience, or with no audience configured, is ignored:
 * the push writes only to that audience.
 *
 * - `unsubscribe`, `cleaned` (a hard bounce or an abuse report): the address is suppressed.
 * - `upemail`: the old address is suppressed. The person moved to the new one in Mailchimp, so pushing the old one
 *   would add it back as a new subscriber. The new address is left to the push like any other.
 * - `profile`: ignored. A changed name or merge field is not an opt-out, and suppressing on it would stop email to
 *   people who are still subscribed.
 * - `subscribe`: handed back to the route's existing lead capture. It never clears a suppression.
 * - anything else (`campaign`, unknown): ignored.
 */
export function mailchimpWebhookAction(fields: Record<string, string | undefined>, audienceId: string | undefined): WebhookAction {
  const type = (fields.type ?? "").trim()
  if (type === "subscribe") return { kind: "subscribe" }
  if (type !== "unsubscribe" && type !== "cleaned" && type !== "upemail") return { kind: "ignore", why: `type ${type || "(none)"}` }

  const listId = (fields["data[list_id]"] ?? "").trim()
  if (!audienceId) return { kind: "ignore", why: "no audience configured" }
  if (listId !== audienceId) return { kind: "ignore", why: "another audience" }

  const email = webhookEmail(type === "upemail" ? fields["data[old_email]"] : fields["data[email]"])
  if (!email) return { kind: "ignore", why: "no address" }
  return { kind: "suppress", email, reason: WEBHOOK_SUPPRESSION_REASONS[type] }
}
