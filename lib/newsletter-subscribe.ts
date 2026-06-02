import axios from "axios"
import crypto from "crypto"
import { saveEmailSignup } from "@/lib/firestore-email-signups"
import { normalizeTags } from "@/lib/mailchimp-tags"

// Shared newsletter/email-capture handler — the single write path that lands a
// public email signup in both Firestore and the one Mailchimp audience.
//
// Step 4 of the audiences/Mailchimp alignment plan: the four public signup
// routes (newsletter, sdoh-newsletter, txmx-newsletter, sdoh-impact-report) were
// near-identical copy-paste that each wrote drifted hyphenated tags
// (web-434media, newsletter-signup, …) straight to Mailchimp — recreating the
// exact taxonomy this project just cleaned up. They now all funnel through here,
// and tags are produced by tagsForSource() / coerced canonical, so a new signup
// can never reintroduce a legacy tag. See docs/audiences-mailchimp-alignment.md.

const apiKey = process.env.MAILCHIMP_API_KEY
const listId = process.env.MAILCHIMP_AUDIENCE_ID_434MEDIA || process.env.MAILCHIMP_AUDIENCE_ID
const datacenter = apiKey ? apiKey.split("-").pop() : null

export interface SubscribeEmailOpts {
  /** Raw email; lowercased/trimmed internally. */
  email: string
  /** Firestore `source` label (e.g. "434Media", "SDOH", "TXMX"). */
  source: string
  /** Canonical Mailchimp tags — build with tagsForSource(). Coerced canonical. */
  tags: string[]
  /** Defaults to "subscribed". Use "transactional" for non-opted-in captures. */
  status?: "subscribed" | "transactional" | "pending"
  /** Optional Mailchimp merge fields (FNAME, LNAME, SOURCE, …). */
  mergeFields?: Record<string, string>
}

export interface SubscribeEmailResult {
  ok: boolean
  warnings: string[]
  mailchimpEnabled: boolean
  /** Non-canonical tags that were dropped before sending to Mailchimp. */
  droppedTags: string[]
}

/**
 * Persist an email signup to Firestore and upsert it into Mailchimp with
 * canonical tags. Mailchimp/Firestore run concurrently; failures are collected
 * as warnings rather than thrown, so a public signup never 500s over a
 * downstream hiccup. Existing Mailchimp members get a tag-only update (their
 * subscription status is preserved).
 */
export async function subscribeEmail(opts: SubscribeEmailOpts): Promise<SubscribeEmailResult> {
  const email = opts.email.toLowerCase().trim()
  const status = opts.status ?? "subscribed"

  // Coerce to canonical defensively. tagsForSource() output is already canonical,
  // so dropped is normally empty — but this guarantees no legacy tag ever reaches
  // Mailchimp even if a caller passes something off-taxonomy.
  const { canonical: tags, dropped: droppedTags } = normalizeTags(opts.tags)
  if (droppedTags.length > 0) {
    console.warn(`[subscribeEmail] dropped non-canonical tags for ${email}:`, droppedTags)
  }

  const warnings: string[] = []
  const mailchimpEnabled = !!(apiKey && listId)
  if (!mailchimpEnabled) {
    console.warn("[subscribeEmail] Mailchimp disabled — missing API key or audience id")
  }

  const firestorePromise = saveEmailSignup({
    email,
    source: opts.source,
    created_at: new Date().toISOString(),
    mailchimp_tags: tags,
  })

  const promises: Promise<unknown>[] = [firestorePromise]

  if (mailchimpEnabled) {
    promises.push(
      axios.post(
        `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members`,
        {
          email_address: email,
          status,
          tags,
          ...(opts.mergeFields ? { merge_fields: opts.mergeFields } : {}),
        },
        {
          auth: { username: "apikey", password: apiKey! },
          headers: { "Content-Type": "application/json" },
          validateStatus: (s) => s < 500,
        },
      ),
    )
  }

  const results = await Promise.allSettled(promises)

  const firestoreResult = results[0]
  if (firestoreResult.status === "rejected") {
    console.error("[subscribeEmail] Firestore error:", firestoreResult.reason)
    warnings.push("Firestore save failed")
  } else {
    const value = firestoreResult.value as { success?: boolean; error?: string }
    if (value && value.success === false) {
      console.error("[subscribeEmail] Firestore save error:", value.error)
      warnings.push("Firestore save failed")
    }
  }

  const mailchimpResult = mailchimpEnabled ? results[1] : null
  if (mailchimpEnabled && mailchimpResult) {
    if (mailchimpResult.status === "rejected") {
      console.error("[subscribeEmail] Mailchimp error:", mailchimpResult.reason)
      const error = mailchimpResult.reason as { response?: { data?: unknown } }
      await handleMailchimpError(email, tags, error?.response?.data, warnings)
    } else {
      // validateStatus<500 means 4xx land here as fulfilled — inspect for the
      // "Member Exists" case and PATCH the member's tags instead.
      const resp = mailchimpResult.value as { status: number; data?: { title?: string } }
      if (resp.status >= 400) {
        await handleMailchimpError(email, tags, resp.data, warnings)
      }
    }
  }

  return { ok: warnings.length === 0, warnings, mailchimpEnabled, droppedTags }
}

/**
 * Mailchimp rejects a POST for an already-present member with "Member Exists".
 * In that case PATCH the member to apply the canonical tags (tag-only update —
 * status is left untouched so we never resubscribe someone who opted out).
 */
async function handleMailchimpError(
  email: string,
  tags: string[],
  data: unknown,
  warnings: string[],
): Promise<void> {
  if (typeof data === "string" && data.includes("<!DOCTYPE")) {
    console.error("[subscribeEmail] Mailchimp returned HTML — likely auth issue")
    warnings.push("Mailchimp authentication failed")
    return
  }
  if (typeof data === "object" && data && (data as { title?: string }).title === "Member Exists") {
    try {
      const emailHash = crypto.createHash("md5").update(email).digest("hex")
      await axios.patch(
        `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${emailHash}`,
        { tags },
        {
          auth: { username: "apikey", password: apiKey! },
          headers: { "Content-Type": "application/json" },
        },
      )
    } catch (updateError) {
      console.error("[subscribeEmail] Failed to update existing member:", updateError)
      warnings.push("Mailchimp update failed")
    }
    return
  }
  warnings.push("Mailchimp subscription failed")
}
