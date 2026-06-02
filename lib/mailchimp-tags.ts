// Canonical Mailchimp tag taxonomy — the single source of truth for marketing tags.
//
// Mirrors the EXCLUDED_COUNTRIES pattern (lib/prospecting/scorer.ts): every
// marketing-tag write in the app flows through this module, and nothing else is
// allowed to invent tags. The app is the SOLE authoritative writer of marketing
// tags — hand-tagging in the Mailchimp UI is off-limits and is surfaced as drift
// by the reconciliation check (Step 6).
//
// There is exactly ONE live Mailchimp audience ("434 Media", 7fa6fbcb82),
// segmented by these tags. The old TXMX audience id is a 404 ghost and is being
// removed (Step 2). See docs/audiences-mailchimp-alignment.md.
//
// Convention: lowercase-kebab, colon-delimited, one dimension per tag.
//   brand:434media   source:newsletter   event:sa-tech-day-2026   status:customer

// ── Dimensions ──────────────────────────────────────────────────────────────

/** Which 434 property the contact belongs to. */
export const BRANDS = [
  "434media",
  "txmx",
  "vemosvamos",
  "digitalcanvas",
  "aim",
  "sdoh",
  "salute",
  "ampd",
] as const
export type Brand = (typeof BRANDS)[number]

/** How the contact entered the audience. */
export const SOURCES = [
  "newsletter",
  "event",
  "partner",
  "shopify",
  "sales",
  "legacy-import",
] as const
export type Source = (typeof SOURCES)[number]

/** Lifecycle / relationship status. */
export const STATUSES = ["customer", "customer-repeat", "customer-vip", "prospect"] as const
export type Status = (typeof STATUSES)[number]

/**
 * Known events. This list is intentionally open-ended — new events are added
 * here as they happen. `event:` tags are validated structurally (any kebab
 * value) so a new event never silently fails reconciliation, but registering it
 * here keeps the multiselect UI and reporting complete.
 */
export const EVENTS = [
  "sa-tech-day",
  "sa-tech-day-2026",
  "mxr",
  "aim-summit",
  "texas-me-summit-2026",
] as const
export type EventTag = (typeof EVENTS)[number]

const CANONICAL_PREFIXES = ["brand", "source", "event", "status"] as const

// ── Tag builders ──────────────────────────────────────────────────────────────

export const brandTag = (b: Brand): string => `brand:${b}`
export const sourceTag = (s: Source): string => `source:${s}`
export const statusTag = (s: Status): string => `status:${s}`
/** Events are open-ended; pass any kebab slug (e.g. "sa-tech-day-2026"). */
export const eventTag = (slug: string): string => `event:${slug}`

/**
 * The full registry of structurally-fixed canonical tags (brand/source/status +
 * the registered events). Used to populate the canonical multiselect in the
 * push modal (Step 4) and as the baseline for reconciliation (Step 6).
 */
export const CANONICAL_TAGS: string[] = [
  ...BRANDS.map(brandTag),
  ...SOURCES.map(sourceTag),
  ...STATUSES.map(statusTag),
  ...EVENTS.map(eventTag),
]

const BRAND_SET = new Set<string>(BRANDS)
const SOURCE_SET = new Set<string>(SOURCES)
const STATUS_SET = new Set<string>(STATUSES)
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * True when `tag` conforms to the canonical taxonomy.
 *
 * brand/source/status values must be in their fixed sets; event values may be
 * any kebab slug (events grow over time). Anything else — bare tags, hyphenated
 * legacy tags, unknown prefixes — is non-canonical and signals drift.
 */
export function isCanonicalTag(tag: string): boolean {
  const idx = tag.indexOf(":")
  if (idx < 1) return false
  const prefix = tag.slice(0, idx)
  const value = tag.slice(idx + 1)
  if (!(CANONICAL_PREFIXES as readonly string[]).includes(prefix)) return false
  if (!KEBAB.test(value)) return false
  switch (prefix) {
    case "brand":
      return BRAND_SET.has(value)
    case "source":
      return SOURCE_SET.has(value)
    case "status":
      return STATUS_SET.has(value)
    case "event":
      return true // open-ended, structurally validated above
    default:
      return false
  }
}

/** Throws if any tag is non-canonical. Used to guard write paths (Step 4). */
export function assertCanonical(tags: string[]): void {
  const bad = tags.filter((t) => !isCanonicalTag(t))
  if (bad.length > 0) {
    throw new Error(`Non-canonical Mailchimp tag(s): ${bad.join(", ")}`)
  }
}

// ── Old → new remap (drives the one-time backfill, Step 3) ──────────────────────
//
// Keyed by the lowercased legacy tag name as it exists in Mailchimp today.
// A legacy tag maps to one OR MORE canonical tags. Counts (2026-06-02 audit) are
// noted for reference. Tags not listed here and carrying zero members are swept
// by the backfill (see RETIRED_TAGS + the empty-segment deletion pass).

export const TAG_REMAP: Record<string, string[]> = {
  techday: [sourceTag("event"), eventTag("sa-tech-day")], // 578
  "newsletter-signup": [sourceTag("newsletter")], // 494
  "legacy-import": [sourceTag("legacy-import")], // 414
  "web-aimsummit": [brandTag("aim"), sourceTag("event"), eventTag("aim-summit")], // 344
  "legacy-aim-summit": [brandTag("aim"), eventTag("aim-summit"), sourceTag("legacy-import")], // 313
  "web-digitalcanvas": [brandTag("digitalcanvas")], // 101
  "mxr-rsvp": [sourceTag("event"), eventTag("mxr")], // 93
  "join-the-feed": [sourceTag("newsletter")], // 93
  "legacy-salute": [brandTag("salute"), sourceTag("legacy-import")], // 50
  "web-txmxboxing": [brandTag("txmx"), sourceTag("newsletter")], // 25
  "shopify-txmx": [brandTag("txmx"), sourceTag("shopify")], // 23
  "web-434media": [brandTag("434media"), sourceTag("newsletter")], // 18
  "shopify-txmx-purchased": [brandTag("txmx"), sourceTag("shopify"), statusTag("customer")], // 17
  "customer-new": [statusTag("customer")], // 17
  "web-vemosvamos": [brandTag("vemosvamos")], // 12
  "legacy-txmx-boxing": [brandTag("txmx"), sourceTag("legacy-import")], // 11
  "sales-brand-hello": [sourceTag("sales")], // 7  (rep identity → lead.assigned_to, not a tag)
  "sales-stacy": [sourceTag("sales")], // 7
  "sales-barb": [sourceTag("sales")], // 2
  "legacy-agency": [sourceTag("legacy-import")], // 6
  "shopify-txmx-browser": [brandTag("txmx"), sourceTag("shopify"), statusTag("prospect")], // 3
  "legacy-event-mgmt": [sourceTag("legacy-import")], // 3
  "web-ampdproject": [brandTag("ampd")], // 2
  "web-salutetotroops": [brandTag("salute")], // 2
  "web-434sdoh": [brandTag("sdoh")], // 1
  "web-sdoh": [brandTag("sdoh")], // 1
  "sdoh-impact-report": [brandTag("sdoh")], // 1
  "web-newsletter": [sourceTag("newsletter"), brandTag("434media")], // 1
  "web-techday": [sourceTag("event"), eventTag("sa-tech-day")], // 0 (canonicalize if it gains members)
}

/**
 * Legacy tags to delete outright with no canonical replacement (data-quality
 * artifacts, not segments). The backfill also deletes ALL zero-member segments
 * — including the ~20 unused `industry-*` placeholders and stale per-year event
 * tags — so they don't need enumerating here.
 */
export const RETIRED_TAGS: string[] = ["acquired list", "no-email-contact", "social media"]

// ── Normalization (used by the backfill and the push route) ──────────────────

export interface NormalizedTags {
  /** Canonical tags to apply (deduped). */
  canonical: string[]
  /** Legacy tags slated for removal (in RETIRED_TAGS or had no mapping). */
  dropped: string[]
}

/**
 * Map an arbitrary set of existing tags to the canonical taxonomy.
 *
 * - Already-canonical tags pass through.
 * - Tags in TAG_REMAP expand to their canonical equivalents.
 * - Tags in RETIRED_TAGS, or with no mapping, are reported in `dropped`.
 *
 * Used by the one-time backfill (Step 3) and the push-members route (Step 4) to
 * coerce input into canonical form rather than rejecting outright.
 */
export function normalizeTags(input: string[]): NormalizedTags {
  const canonical = new Set<string>()
  const dropped: string[] = []
  for (const raw of input) {
    const tag = raw.trim()
    if (!tag) continue
    if (isCanonicalTag(tag)) {
      canonical.add(tag)
      continue
    }
    const key = tag.toLowerCase()
    const mapped = TAG_REMAP[key]
    if (mapped) {
      mapped.forEach((t) => canonical.add(t))
    } else {
      dropped.push(tag)
    }
  }
  return { canonical: [...canonical], dropped }
}

// ── tagsForSource — the only entry point write paths should call ──────────────

export type AudienceCollection =
  | "email_signups"
  | "event_registrations"
  | "partner_list_members"
  | "contact_forms"

/**
 * Map a Firestore `_dbSource` to its brand. Named DBs and the Digital Canvas
 * project carry their own brand; everything else defaults to 434media.
 */
export function brandFromDbSource(dbSource?: string): Brand | undefined {
  switch (dbSource) {
    case "aimsatx":
      return "aim"
    case "digital-canvas":
    case "digitalcanvas":
      return "digitalcanvas"
    case undefined:
    case "":
      return undefined
    default:
      return "434media"
  }
}

/**
 * Produce the canonical tag set for a contact entering from a given audience
 * source. This is the ONLY function write paths (newsletter routes, event
 * registration, partner import, push modal) should use to build tags.
 *
 * @example tagsForSource("email_signups", { brand: "434media" })
 *          // → ["brand:434media", "source:newsletter"]
 * @example tagsForSource("event_registrations", { brand: "digitalcanvas", event: "mxr" })
 *          // → ["brand:digitalcanvas", "source:event", "event:mxr"]
 */
export function tagsForSource(
  collection: AudienceCollection,
  opts: { brand?: Brand; event?: string; dbSource?: string; status?: Status } = {},
): string[] {
  const tags = new Set<string>()

  const brand = opts.brand ?? brandFromDbSource(opts.dbSource)
  if (brand) tags.add(brandTag(brand))

  switch (collection) {
    case "email_signups":
      tags.add(sourceTag("newsletter"))
      break
    case "event_registrations":
      tags.add(sourceTag("event"))
      if (opts.event) tags.add(eventTag(opts.event))
      break
    case "partner_list_members":
      tags.add(sourceTag("partner"))
      break
    case "contact_forms":
      // Inbox submissions are not a marketing source by default; brand only.
      break
  }

  if (opts.status) tags.add(statusTag(opts.status))

  return [...tags]
}
