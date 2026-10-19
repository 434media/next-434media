import { createHash } from "node:crypto"
import { profileProblems, type BrandProfile, type SeriesKey } from "./profile"

/**
 * One document per brand in `brand_profiles/<id>` (lib/firestore-brand-profiles.ts), with every published version kept
 * beside it in `brand_profiles/<id>/versions/v<n>`. The document holds:
 * - identity: references to the master (names, definitions and mottos are read from it, never restated here);
 * - brand_type (owned | client) and an optional client_id;
 * - sources: where the brand's seeds live (the seeds themselves stay in their own document);
 * - draft: the profile being edited (voice and editorial rules, series and templates, …) and its approved and rejected
 *   examples. Nothing reads a draft for output;
 * - published: the version the engine runs, with the template map platform → format → series → Canva brand template.
 *
 * Draft → Publish: Publish validates the draft (validateProfile, the same validator the engine uses) and refuses an
 * invalid one. No second approver and no new role. Restore republishes an earlier version as a new version, so the
 * history only grows and each version says who published it, when, and what it was restored from.
 */
export const BRAND_TYPES = ["owned", "client"] as const
export type BrandType = typeof BRAND_TYPES[number]
export const PLATFORMS = ["instagram", "facebook"] as const
export type ProfilePlatform = typeof PLATFORMS[number]

export interface ProfileExample { text: string; note?: string; url?: string; at?: string }
export interface ProfileExamples { approved: ProfileExample[]; rejected: ProfileExample[] }
export interface ProfileIdentity {
  /** Where the brand's names, definitions and mottos come from; they are read there and never copied here. */
  source: string
  /** The record key in that source (lib/work-records.ts for 434's own brands; a client record for a client brand). */
  record: string
}
export interface ProfileDraft { profile: unknown; examples: ProfileExamples; updated_by: string; updated_at: string }
/** platform → format (feed | reels) → series → Canva brand template id. Derived from the profile's series on Publish. */
export type TemplateMap = Record<ProfilePlatform, Record<"feed" | "reels", Partial<Record<SeriesKey, string>>>>
export interface BackupState { status: "pending" | "done" | "failed"; path?: string; commit?: string; at?: string; error?: string }
export interface ProfileVersion {
  /** "<brand>@v<n>": stamped on every post written under this version (crm_content_posts.profile_version_id). */
  version_id: string
  brand_id: string
  n: number
  profile: BrandProfile
  examples: ProfileExamples
  template_map: TemplateMap
  /** sha256 of the profile's canonical JSON (first 16 hex). */
  profile_sha256: string
  published_by: string
  published_at: string
  restored_from: string | null
  backup: BackupState
}
export interface BrandProfileDoc {
  id: string
  brand_type: BrandType
  client_id: string | null
  identity: ProfileIdentity
  sources: { seeds: string | null; note?: string }
  draft: ProfileDraft | null
  published: ProfileVersion | null
  /** The highest version number kept (0 before the first Publish). */
  last_version: number
  /** The unpublished draft a forced Restore replaced, kept so no edit is lost (drafts are not versioned). */
  draft_before_restore: ProfileDraft | null
}

/** A draft or a version this size or larger is refused: three of them (draft, published, the draft a restore kept) stay
 * well under Firestore's 1 MiB document limit. */
export const MAX_PROFILE_BYTES = 250_000
const contentSha = (d: { profile: unknown; examples: unknown }) => profileSha256({ profile: d.profile, examples: d.examples })
/** The draft holds edits that are not published (or nothing is published yet). */
export const draftDiffers = (doc: Pick<BrandProfileDoc, "draft" | "published">) => !!doc.draft && (!doc.published || contentSha(doc.draft) !== contentSha(doc.published))

export const versionDocId = (n: number) => `v${n}`
export const versionIdOf = (brandId: string, n: number) => `${brandId}@${versionDocId(n)}`
export const BRAND_ID = /^[a-z][a-z0-9-]{1,30}$/

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(",")}}`
  return JSON.stringify(v)
}
export const profileSha256 = (profile: unknown) => createHash("sha256").update(canonical(profile)).digest("hex").slice(0, 16)

export function templateMap(profile: BrandProfile): TemplateMap {
  const format = (f: "feed" | "reels") => Object.fromEntries(Object.entries(profile.series).filter(([, s]) => s?.templates[f]).map(([k, s]) => [k, s!.templates[f]])) as Partial<Record<SeriesKey, string>>
  // Instagram and Facebook take the same 4:5 feed and 9:16 Reels designs today; Step 3 adds platforms with their own.
  return Object.fromEntries(PLATFORMS.map(p => [p, { feed: format("feed"), reels: format("reels") }])) as TemplateMap
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)
function exampleProblems(v: unknown): string[] {
  if (!isObj(v) || !Array.isArray(v.approved) || !Array.isArray(v.rejected)) return ["examples: {approved: [], rejected: []}"]
  const ok = (e: unknown) => isObj(e) && typeof e.text === "string" && e.text.trim() !== "" && e.text.length <= 5000 && Object.keys(e).every(k => ["text", "note", "url", "at"].includes(k))
    && (e.note === undefined || (typeof e.note === "string" && e.note.length <= 1000)) && (e.url === undefined || (typeof e.url === "string" && /^https:\/\//.test(e.url))) && (e.at === undefined || typeof e.at === "string")
  const p: string[] = []
  for (const k of ["approved", "rejected"] as const) {
    const list = v[k] as unknown[]
    if (list.length > 50) p.push(`examples.${k}: at most 50`)
    list.forEach((e, i) => { if (!ok(e)) p.push(`examples.${k}[${i}]: {text, note?, url? (https), at?}`) })
  }
  return p
}

/** Problems with a brand document's own fields (the profile is checked by validateProfile). Empty = publishable. */
export function documentProblems(doc: Pick<BrandProfileDoc, "id" | "brand_type" | "client_id" | "identity">): string[] {
  const p: string[] = []
  if (!BRAND_ID.test(doc.id)) p.push("id: lowercase letters, digits and hyphens")
  if (!(BRAND_TYPES as readonly unknown[]).includes(doc.brand_type)) p.push("brand_type: owned or client")
  if (doc.client_id !== null && !(typeof doc.client_id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(doc.client_id))) p.push("client_id: a client record id, or null")
  if (doc.brand_type === "client" && !doc.client_id) p.push("client_id is required for a client brand")
  if (!(isObj(doc.identity) && typeof doc.identity.source === "string" && doc.identity.source.trim() && typeof doc.identity.record === "string" && doc.identity.record.trim())) p.push("identity: {source, record} references")
  return p
}

/** Everything that stops a draft from being published (empty = it can be). */
export function publishProblems(doc: BrandProfileDoc, draft: { profile: unknown; examples: unknown } | null = doc.draft): string[] {
  if (!draft) return ["there is no draft to publish"]
  const size = Buffer.byteLength(JSON.stringify({ profile: draft.profile, examples: draft.examples }))
  if (size >= MAX_PROFILE_BYTES) return [`the draft is ${size} bytes; a profile and its examples must stay under ${MAX_PROFILE_BYTES}`]
  return [...documentProblems(doc), ...profileProblems(doc.id, { [doc.id]: draft.profile }), ...exampleProblems(draft.examples)]
}

export type PublishResult = { ok: true; version: ProfileVersion; doc: BrandProfileDoc } | { ok: false; problems: string[] }

/**
 * The next version from a draft: validated, numbered after the highest version kept, with who and
 * when. Pure; the store writes the version and the document together in one transaction.
 */
export function preparePublish(doc: BrandProfileDoc, actor: string, at: string, opts: { draft?: { profile: unknown; examples: ProfileExamples }; restoredFrom?: string; force?: boolean } = {}): PublishResult {
  const draft = opts.draft ?? doc.draft
  const problems = publishProblems(doc, draft)
  if (!actor.trim()) problems.push("who is publishing is required")
  // Publishing what is already live would only add a duplicate version.
  if (!opts.restoredFrom && draft && doc.published && contentSha(draft) === contentSha(doc.published)) problems.push(`nothing to publish: the draft is the published version ${doc.published.version_id}`)
  // A restore replaces the draft; unpublished edits there are refused unless forced, and then kept (draft_before_restore).
  const unpublished = !!opts.restoredFrom && draftDiffers(doc)
  if (unpublished && !opts.force) problems.push("the draft has unpublished edits: publish or discard them first, or restore with force (the draft is then kept as draft_before_restore)")
  if (problems.length || !draft) return { ok: false, problems }
  const profile = draft.profile as BrandProfile, n = (doc.last_version || 0) + 1
  const version: ProfileVersion = {
    version_id: versionIdOf(doc.id, n), brand_id: doc.id, n, profile, examples: draft.examples, template_map: templateMap(profile),
    profile_sha256: profileSha256(profile), published_by: actor, published_at: at, restored_from: opts.restoredFrom ?? null, backup: { status: "pending" },
  }
  // A restore also becomes the draft, so the next edit starts from what is live.
  const nextDraft = opts.restoredFrom ? { profile, examples: draft.examples, updated_by: actor, updated_at: at } : doc.draft
  return { ok: true, version, doc: { ...doc, draft: nextDraft, published: version, last_version: n, ...(unpublished ? { draft_before_restore: doc.draft } : {}) } }
}
