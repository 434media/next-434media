/**
 * The read-only "434 context" tool's content (434 build sequence V1 item 4: "brand voice, offers, properties and the
 * approved descriptors. Public, brand-level content only. Offers by name only, never figures (founder ruling). Every
 * assistant then knows 434 without a third-party memory service").
 *
 * Every string here comes from a file generated from the canon, never typed by hand:
 *  - the approved descriptors and both motto forms: lib/brand-records.ts (master Sections 1.1, 1.3, 1.4);
 *  - offers, by name with their one-line definition: lib/commercial-models.ts (master Section 4.3);
 *  - properties: the published Original IP records in lib/work-records.ts (the system-of-record seed), public fields;
 *  - brand voice: the brand voice file only (01 Voice System/01-434-MEDIA-BRAND-VOICE.md), as loaded into
 *    `policy_documents` by scripts/sor/load.ts. Not the founder voice or the build-inbox or outbound overlays.
 *
 * Data class (Security Policy §7.1, "Assistant vendor"): public and brand-level content only. `contextProblems` refuses
 * anything that looks like a figure or carries an internal field, and the route drops the voice file rather than
 * serve one that fails it.
 *
 * Pure.
 */
import { BRAND_RECORDS } from "../brand-records"
import { COMMERCIAL_MODEL_DEFINITIONS } from "../commercial-models"
import { WORK_RECORDS } from "../work-records"

/** The `policy_documents` key scripts/sor/load.ts gives the brand voice file. */
export const BRAND_VOICE_KEY = "voice-01-434-media-brand-voice"

export interface BrandVoice { title: string; version: string; body: string }

export interface Context434 {
  company: {
    canonicalDefinition: string
    shortDescriptor: string
    spokenIntroduction: string
    /** For machine-read fields. */
    mottoPlain: string
    /** For visual display. */
    mottoStyled: string
  }
  offers: { name: string; definition: string }[]
  properties: { name: string; description: string; url: string | null }[]
  brandVoice: BrandVoice | null
  rules: string[]
}

const RULES = [
  "Use the canonical definition and descriptors exactly as written; never reword, shorten or split them.",
  "Use mottoPlain in machine-read fields and mottoStyled for display; never extend the motto into a claim.",
  "Offers are named here without figures. Never quote prices, rates, ranges or terms; those come from 434 directly.",
  "This is public, brand-level content. It holds no client, contact or internal data.",
]

export function build434Context(voice: BrandVoice | null): Context434 {
  return {
    company: { ...BRAND_RECORDS },
    offers: Object.entries(COMMERCIAL_MODEL_DEFINITIONS).map(([name, definition]) => ({ name, definition })),
    properties: WORK_RECORDS
      .filter((r) => r.model === "Original IP" && r.description)
      .map((r) => ({ name: r.title, description: r.description as string, url: r.publicUrl })),
    brandVoice: voice,
    rules: [...RULES],
  }
}

/** A money amount, a percentage or a rate: what "never figures" forbids. Years and version numbers pass. */
const FIGURE = /[$€£]\s?\d|\d\s?%|\b\d[\d,.]*\s?(k|K|USD|dollars?)\b|\bper (hour|day|month|post)\b/
/** Field names that only internal records carry (lib/sor/visibility.ts and the work-record emitter's exclusions). */
const INTERNAL_FIELDS = ["internal_context", "proof_assets", "cost_basis", "restrictions", "ownership", "threshold", "rate_card"]
const bare = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "")

/** Problems with a context payload, by path. Empty means it may leave. */
export function contextProblems(value: unknown, path = "$"): string[] {
  if (typeof value === "string") return FIGURE.test(value) ? [`${path}: looks like a figure`] : []
  if (Array.isArray(value)) return value.flatMap((v, i) => contextProblems(v, `${path}[${i}]`))
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      INTERNAL_FIELDS.some((f) => bare(k).includes(bare(f)))
        ? [`${path}.${k}: internal field`]
        : contextProblems(v, `${path}.${k}`))
  }
  return []
}

/** The voice file as stored, or null when it is missing, malformed or fails the content check. */
export function brandVoiceOf(row: unknown): BrandVoice | null {
  if (!row || typeof row !== "object") return null
  const r = row as Record<string, unknown>
  if (r.kind !== "voice" || typeof r.body !== "string" || typeof r.title !== "string") return null
  const voice = { title: r.title, version: typeof r.version === "string" ? r.version : "unversioned", body: r.body }
  return contextProblems(voice).length ? null : voice
}
