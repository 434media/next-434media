import { getDefaultAudienceId, getPropertyNameByAudienceId } from "./mailchimp-config"
import { getMailchimpTags } from "./mailchimp-analytics"
import { isCanonicalTag, CANONICAL_TAGS } from "./mailchimp-tags"

// Step 6 of the audiences/Mailchimp alignment plan — the reconciliation check.
//
// Two jobs:
//  1. DRIFT ALARM — flag any tag present in Mailchimp that is NOT canonical.
//     Since the app is the sole authoritative writer of marketing tags (every
//     write path goes through lib/mailchimp-tags), a non-canonical tag means
//     someone hand-tagged in the Mailchimp UI. That's the only way drift can
//     re-enter, so surfacing it operationally enforces the sole-writer policy.
//  2. STATUS BREAKDOWN — report subscribed/transactional/unsubscribed/cleaned/
//     pending so the "total contacts" headline (the "1688") is always
//     explainable in-app, and the marketable subset is unambiguous.
//
// This complements /api/admin/mailchimp/sync-audit (which reconciles email
// PRESENCE between Firestore and Mailchimp); this one reconciles the TAG
// TAXONOMY and consent status.

export interface ReconcileStatusCounts {
  subscribed: number
  transactional: number
  unsubscribed: number
  cleaned: number
  pending: number
  /** subscribed + transactional + unsubscribed — matches Mailchimp's headline. */
  totalContacts: number
}

export interface ReconcileTagRow {
  name: string
  memberCount: number
  canonical: boolean
}

export interface ReconcileReport {
  ok: boolean
  generatedAt: string
  audienceId: string
  audienceName: string
  statusCounts: ReconcileStatusCounts
  /** Every tag/segment in Mailchimp, flagged canonical or not. */
  tags: ReconcileTagRow[]
  /** Non-canonical tags = drift (hand-tagged in the Mailchimp UI). Empty = clean. */
  drift: ReconcileTagRow[]
  /** Canonical tags defined in code but with zero members in Mailchimp (informational). */
  canonicalUnused: string[]
}

function mcClient() {
  const apiKey = process.env.MAILCHIMP_API_KEY
  if (!apiKey) throw new Error("MAILCHIMP_API_KEY not set")
  const serverPrefix = apiKey.split("-")[1]
  if (!serverPrefix) throw new Error("Invalid MAILCHIMP_API_KEY format")
  return {
    base: `https://${serverPrefix}.api.mailchimp.com/3.0`,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  }
}

/** Count members in a given status via total_items (no member payload pulled). */
async function statusTotal(
  base: string,
  headers: HeadersInit,
  audienceId: string,
  status: string,
): Promise<number> {
  const res = await fetch(
    `${base}/lists/${audienceId}/members?status=${status}&count=1&fields=total_items`,
    { headers },
  )
  if (!res.ok) return 0
  const json = (await res.json()) as { total_items?: number }
  return json.total_items ?? 0
}

/**
 * Build the reconciliation report for the configured 434 Media audience.
 * Throws if Mailchimp isn't configured.
 */
export async function reconcileMailchimpTaxonomy(): Promise<ReconcileReport> {
  const audienceId = getDefaultAudienceId()
  if (!audienceId) throw new Error("No Mailchimp audience configured")

  const { base, headers } = mcClient()

  // List stats give subscribed/unsubscribed/cleaned in one call; transactional
  // and pending need a total_items probe each.
  const listRes = await fetch(
    `${base}/lists/${audienceId}?fields=name,stats.member_count,stats.unsubscribe_count,stats.cleaned_count`,
    { headers },
  )
  if (!listRes.ok) {
    throw new Error(`Mailchimp /lists/${audienceId} → ${listRes.status}`)
  }
  const list = (await listRes.json()) as {
    name?: string
    stats?: { member_count?: number; unsubscribe_count?: number; cleaned_count?: number }
  }

  const [transactional, pending, tagsResp] = await Promise.all([
    statusTotal(base, headers, audienceId, "transactional"),
    statusTotal(base, headers, audienceId, "pending"),
    getMailchimpTags(audienceId),
  ])

  const subscribed = list.stats?.member_count ?? 0
  const unsubscribed = list.stats?.unsubscribe_count ?? 0
  const cleaned = list.stats?.cleaned_count ?? 0

  const statusCounts: ReconcileStatusCounts = {
    subscribed,
    transactional,
    unsubscribed,
    cleaned,
    pending,
    totalContacts: subscribed + transactional + unsubscribed,
  }

  const tags: ReconcileTagRow[] = (tagsResp.tags ?? [])
    .map((t) => ({
      name: t.name,
      memberCount: t.member_count ?? 0,
      canonical: isCanonicalTag(t.name),
    }))
    .sort((a, b) => b.memberCount - a.memberCount)

  const drift = tags.filter((t) => !t.canonical)

  const present = new Set(tags.map((t) => t.name))
  const canonicalUnused = CANONICAL_TAGS.filter((t) => !present.has(t))

  return {
    ok: drift.length === 0,
    generatedAt: new Date().toISOString(),
    audienceId,
    audienceName: getPropertyNameByAudienceId(audienceId),
    statusCounts,
    tags,
    drift,
    canonicalUnused,
  }
}
