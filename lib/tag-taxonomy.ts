/**
 * Tag taxonomy — namespaced labels with consistent visual treatment.
 *
 * Tags are stored as `{namespace}:{value}` strings. The namespace governs
 * color and meaning; the value is free-form within the namespace.
 *
 * Why namespacing: the previous free-form tag system mixed operational
 * (form:434media), intent (sponsor), and quality signals into one bag.
 * Filters could not distinguish them and color reuse made scanning slow.
 *
 * Backward compat: legacy tags like `sponsor`, `form:434media`,
 * `newsletter:txmx`, `tech-fuel` are normalized at read time via
 * `normalizeLegacyTag()`. New writes always emit namespaced form.
 */

export type TagNamespace =
  | "source"
  | "site"
  | "event"
  | "role"
  | "intent"
  | "quality"
  | "geo"
  | "industry"
  | "client"

export interface ParsedTag {
  namespace: TagNamespace | null
  value: string
  raw: string
}

const KNOWN_NAMESPACES = new Set<TagNamespace>([
  "source",
  "site",
  "event",
  "role",
  "intent",
  "quality",
  "geo",
  "industry",
  "client",
])

export function parseTag(raw: string): ParsedTag {
  const idx = raw.indexOf(":")
  if (idx === -1) return { namespace: null, value: raw, raw }
  const ns = raw.slice(0, idx) as TagNamespace
  const value = raw.slice(idx + 1)
  if (!KNOWN_NAMESPACES.has(ns)) return { namespace: null, value: raw, raw }
  return { namespace: ns, value, raw }
}

export function makeTag(namespace: TagNamespace, value: string): string {
  return `${namespace}:${value.toLowerCase().replace(/\s+/g, "-")}`
}

/**
 * Map legacy free-form tags to namespaced form.
 * Returns the array of replacement tags (may be 0, 1, or 2 entries).
 *
 * Examples:
 *   "sponsor"          → ["intent:sponsor"]
 *   "brand"            → ["intent:sponsor"]
 *   "form:434media"    → ["source:form", "site:434media"]
 *   "newsletter:txmx"  → ["source:newsletter", "site:txmx"]
 *   "tech-fuel"        → ["role:tech-fuel-attendee"]
 *   "sa-tech-day"      → ["event:sa-tech-day"]
 *   "event:mhth-2026"  → ["event:mhth-2026"]   (already namespaced)
 *   "intent:sponsor"   → ["intent:sponsor"]    (already namespaced)
 */
export function normalizeLegacyTag(raw: string): string[] {
  const parsed = parseTag(raw)
  if (parsed.namespace) return [parsed.raw]

  const v = raw.toLowerCase().trim()
  if (!v) return []

  // Intent aliases
  if (v === "sponsor" || v === "brand") return ["intent:sponsor"]
  if (v === "spam") return ["intent:spam"]
  if (v === "partnership") return ["intent:partnership"]

  // Role aliases
  if (v === "tech-fuel" || v === "techfuel" || v === "tech_fuel") {
    return ["role:tech-fuel-attendee"]
  }
  if (v === "speaker" || v === "speakers") return ["role:speaker"]
  if (v === "attendee" || v === "attendees") return ["role:attendee"]
  if (v === "judge" || v === "judges") return ["role:judge"]

  // Compound legacy `form:<site>` and `newsletter:<site>` (parser falls
  // through because `form` and `newsletter` aren't in KNOWN_NAMESPACES).
  if (v.startsWith("form:")) {
    const site = v.slice("form:".length)
    return site ? ["source:form", makeTag("site", site)] : ["source:form"]
  }
  if (v.startsWith("newsletter:")) {
    const site = v.slice("newsletter:".length)
    return site ? ["source:newsletter", makeTag("site", site)] : ["source:newsletter"]
  }

  // Event slugs without prefix
  if (v === "sa-tech-day" || v === "satechday") return ["event:sa-tech-day"]
  if (v === "mhth" || v === "more-human-than-human") return ["event:mhth"]

  // Anything else: keep as-is so we don't lose data
  return [raw]
}

/** Apply normalizeLegacyTag across an array, deduping. */
export function normalizeLegacyTags(tags: string[] | undefined | null): string[] {
  if (!tags || tags.length === 0) return []
  const out = new Set<string>()
  for (const t of tags) {
    for (const norm of normalizeLegacyTag(t)) {
      out.add(norm)
    }
  }
  return Array.from(out)
}

/**
 * Visual treatment per namespace. Linear-style: mostly neutral, accent
 * only where signal helps the eye (intent + quality).
 *
 * Returns Tailwind class strings for chip background + text.
 */
export interface TagStyle {
  className: string
  label: string
}

export function getTagStyle(tag: ParsedTag): TagStyle {
  const display = formatTagValue(tag.value)

  if (!tag.namespace) {
    return { className: "bg-neutral-100 text-neutral-700", label: display }
  }

  switch (tag.namespace) {
    case "source":
    case "site":
    case "geo":
    case "industry":
      return { className: "bg-neutral-100 text-neutral-700", label: display }

    case "event":
    case "role":
      return { className: "bg-indigo-50 text-indigo-700", label: display }

    // Client engagements get their own subtle color so a Tech Day registrant
    // tagged `client:techbloc` reads as "this contact is part of our Techbloc
    // scope of work" without competing with the indigo event/role tags.
    case "client":
      return { className: "bg-sky-50 text-sky-700", label: display }

    case "intent":
      switch (tag.value) {
        case "sponsor":
          return { className: "bg-emerald-50 text-emerald-700", label: display }
        case "platform-question":
          return { className: "bg-amber-50 text-amber-700", label: display }
        case "partnership":
          return { className: "bg-indigo-50 text-indigo-700", label: display }
        case "spam":
          return { className: "bg-rose-50 text-rose-700", label: display }
        default:
          return { className: "bg-neutral-100 text-neutral-700", label: display }
      }

    case "quality":
      switch (tag.value) {
        case "verified":
          return { className: "bg-emerald-50 text-emerald-700", label: display }
        case "bounce-risk":
        case "disposable":
          return { className: "bg-rose-50 text-rose-700", label: display }
        case "free-domain":
          return { className: "bg-amber-50 text-amber-700", label: display }
        default:
          return { className: "bg-neutral-100 text-neutral-700", label: display }
      }
  }
}

function formatTagValue(value: string): string {
  return value
    .split("-")
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ")
}

/**
 * True if a lead is tagged as a sponsor inquiry. Reads both namespaced
 * and legacy forms so scoring stays correct during the migration.
 */
export function isSponsorTagged(tags: string[] | undefined | null): boolean {
  if (!tags) return false
  return tags.some((t) => {
    const v = t.toLowerCase()
    return v === "intent:sponsor" || v === "sponsor" || v === "brand"
  })
}

/**
 * Convert a namespaced tag to a human-readable Mailchimp tag name, or
 * `null` if the tag is internal-only (geo, industry, quality) and shouldn't
 * be pushed to Mailchimp.
 *
 * Examples:
 *   "intent:sponsor"          → "Sponsor"
 *   "event:sa-tech-day-2026"  → "SA Tech Day 2026"
 *   "role:tech-fuel-attendee" → "Tech Fuel Attendee"
 *   "site:txmx"               → "TXMX"
 *   "geo:texas"               → null  (internal scoring metadata)
 *   "quality:verified"        → null  (internal email-quality data)
 */
export function tagToMailchimpLabel(rawTag: string): string | null {
  const parsed = parseTag(rawTag)
  if (!parsed.namespace) return null

  // Skip internal-only namespaces — they're scoring/quality signals, not
  // operational segmentation data Mailchimp users care about.
  if (parsed.namespace === "geo" || parsed.namespace === "industry" || parsed.namespace === "quality") {
    return null
  }

  const value = parsed.value
  // Site abbreviations and acronyms — keep uppercase
  const upperValues: Record<string, string> = {
    txmx: "TXMX",
    aim: "AIM",
    ampd: "AMPD",
    devsa: "DevSA",
    "434media": "434 Media",
    milcity: "MilCity",
    digitalcanvas: "Digital Canvas",
    vemos: "Vemos Vamos",
    salute: "Salute to Troops",
    techday: "Tech Day",
    mhth: "More Human Than Human",
  }
  if (upperValues[value]) return upperValues[value]

  // Title-case the value, expand kebab-case
  return value
    .split("-")
    .map((part) => {
      if (part.length <= 3) {
        // Short tokens that are likely acronyms (sxsw, mhth, etc.)
        if (/^[a-z]+$/.test(part) && part.length >= 3) return part.toUpperCase()
        return part.charAt(0).toUpperCase() + part.slice(1)
      }
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")
}

/**
 * Aggregate Mailchimp tag suggestions from a list of source tags.
 * Used by the push modal to derive segmentation labels from selected
 * leads' namespaced tags.
 */
export function aggregateMailchimpSuggestions(allSourceTags: string[]): string[] {
  const out = new Set<string>()
  for (const t of allSourceTags) {
    const label = tagToMailchimpLabel(t)
    if (label) out.add(label)
  }
  return Array.from(out).sort()
}
