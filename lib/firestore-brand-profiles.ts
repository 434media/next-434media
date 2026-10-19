import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import { profileProblems, type BrandProfile } from "./content-pipeline/profile"
import { preparePublish, versionDocId, BRAND_ID, MAX_PROFILE_BYTES, type BackupState, type BrandProfileDoc, type ProfileExamples, type ProfileVersion, type PublishResult } from "./content-pipeline/profile-store"
import type { ActiveProfile } from "./content-pipeline/brand"

/**
 * Firestore for brand profiles: `brand_profiles/<id>` (one document per brand: draft, published, identity references,
 * brand_type) and `brand_profiles/<id>/versions/v<n>` (every published version, kept). The shape and the publish rules
 * are lib/content-pipeline/profile-store.ts.
 *
 * NO CACHE, deliberately. The firestore-collection skill's 30-second list cache does not apply here: a brand-profile
 * read always goes to the database, so a Publish or Restore governs the very next request, and two instances never
 * run different rules for half a minute (plan v11, Step 1, item 7).
 */
const COLLECTION = CRM_COLLECTIONS.BRAND_PROFILES
const VERSIONS = "versions"

// Firestore rejects undefined; a JSON round trip drops it and keeps the record plain.
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const normalize = (id: string, raw: FirebaseFirestore.DocumentData): BrandProfileDoc => ({
  id,
  // As stored, so documentProblems can refuse a value that is neither owned nor client.
  brand_type: raw.brand_type as BrandProfileDoc["brand_type"],
  client_id: typeof raw.client_id === "string" && raw.client_id ? raw.client_id : null,
  identity: { source: String(raw.identity?.source ?? ""), record: String(raw.identity?.record ?? "") },
  sources: { seeds: typeof raw.sources?.seeds === "string" ? raw.sources.seeds : null, ...(typeof raw.sources?.note === "string" ? { note: raw.sources.note } : {}) },
  draft: raw.draft ?? null,
  published: raw.published ?? null,
  last_version: typeof raw.last_version === "number" ? raw.last_version : 0,
  draft_before_restore: raw.draft_before_restore ?? null,
})

export class DraftTooLarge extends Error {
  constructor(readonly bytes: number) { super(`the draft is ${bytes} bytes; a profile and its examples must stay under ${MAX_PROFILE_BYTES}`) }
}

export type NewBrandDoc = Pick<BrandProfileDoc, "id" | "brand_type" | "client_id" | "identity" | "sources">

export interface BrandProfileStore {
  get(id: string): Promise<BrandProfileDoc | null>
  list(): Promise<BrandProfileDoc[]>
  /** Creates the brand's document if it does not exist; an existing document is left as it is. */
  create(doc: NewBrandDoc): Promise<{ created: boolean }>
  /** Saves the draft. Nothing reads a draft for output; only Publish changes what runs. */
  saveDraft(id: string, draft: { profile: unknown; examples: ProfileExamples }, actor: string, at: string): Promise<BrandProfileDoc>
  publish(id: string, actor: string, at: string): Promise<PublishResult>
  /** Republishes an earlier version as a new version (one action); it becomes the draft too. A draft with unpublished
   * edits is refused unless force, and then kept as draft_before_restore. */
  restore(id: string, versionId: string, actor: string, at: string, force?: boolean): Promise<PublishResult>
  /** Every published version, newest first. */
  versions(id: string): Promise<ProfileVersion[]>
  markBackup(id: string, n: number, backup: BackupState): Promise<void>
}

export function firestoreBrandProfiles(db: FirebaseFirestore.Firestore = getDb()): BrandProfileStore {
  const col = db.collection(COLLECTION)
  const missing = (id: string): PublishResult => ({ ok: false, problems: [`no brand profile document for ${id}`] })
  const write = (tx: FirebaseFirestore.Transaction, id: string, result: PublishResult & { ok: true }) => {
    tx.create(col.doc(id).collection(VERSIONS).doc(versionDocId(result.version.n)), clean(result.version))
    tx.set(col.doc(id), clean({ draft: result.doc.draft, published: result.version, last_version: result.version.n, draft_before_restore: result.doc.draft_before_restore }), { mergeFields: ["draft", "published", "last_version", "draft_before_restore"] })
  }
  return {
    get: async id => {
      if (!BRAND_ID.test(id)) return null
      const snap = await col.doc(id).get()
      return snap.exists ? normalize(id, snap.data()!) : null
    },
    list: async () => (await col.get()).docs.map(d => normalize(d.id, d.data())),
    create: doc => db.runTransaction(async tx => {
      const ref = col.doc(doc.id)
      if ((await tx.get(ref)).exists) return { created: false }
      tx.create(ref, clean({ ...doc, draft: null, published: null, last_version: 0, draft_before_restore: null }))
      return { created: true }
    }),
    saveDraft: (id, draft, actor, at) => db.runTransaction(async tx => {
      if (!BRAND_ID.test(id)) throw new Error(`no brand profile document for ${id}`)
      const ref = col.doc(id), snap = await tx.get(ref)
      if (!snap.exists) throw new Error(`no brand profile document for ${id}`)
      const size = Buffer.byteLength(JSON.stringify({ profile: draft.profile, examples: draft.examples }))
      if (size >= MAX_PROFILE_BYTES) throw new DraftTooLarge(size)
      const next = { profile: draft.profile, examples: draft.examples, updated_by: actor, updated_at: at }
      tx.set(ref, clean({ draft: next }), { mergeFields: ["draft"] })
      return { ...normalize(id, snap.data()!), draft: next }
    }),
    publish: (id, actor, at) => db.runTransaction(async tx => {
      if (!BRAND_ID.test(id)) return missing(id)
      const snap = await tx.get(col.doc(id))
      if (!snap.exists) return missing(id)
      const result = preparePublish(normalize(id, snap.data()!), actor, at)
      if (result.ok) write(tx, id, result)
      return result
    }),
    restore: (id, versionId, actor, at, force = false) => db.runTransaction(async tx => {
      if (!BRAND_ID.test(id)) return missing(id)
      const ref = col.doc(id), snap = await tx.get(ref)
      if (!snap.exists) return missing(id)
      const n = new RegExp(`^${id}@v(\\d+)$`).exec(versionId)?.[1]
      const old = n ? await tx.get(ref.collection(VERSIONS).doc(versionDocId(Number(n)))) : null
      if (!old?.exists) return { ok: false, problems: [`no published version ${versionId}`] }
      const v = old.data() as ProfileVersion
      // Validated again: a version published under older rules is not restored if the validator now refuses it.
      const result = preparePublish(normalize(id, snap.data()!), actor, at, { draft: { profile: v.profile, examples: v.examples }, restoredFrom: versionId, force })
      if (result.ok) write(tx, id, result)
      return result
    }),
    versions: async id => (await col.doc(id).collection(VERSIONS).orderBy("n", "desc").get()).docs.map(d => d.data() as ProfileVersion),
    markBackup: async (id, n, backup) => {
      await col.doc(id).collection(VERSIONS).doc(versionDocId(n)).update({ backup: clean(backup) })
      // The document's copy of the published version carries the same state while it is the published one.
      await db.runTransaction(async tx => {
        const ref = col.doc(id), cur = (await tx.get(ref)).data()
        if (cur?.published?.n === n) tx.update(ref, { "published.backup": clean(backup) })
      })
    },
  }
}

/**
 * The brand's published profile, read from the database on every call (no cache: see above), validated again, with its
 * version id. A brand with no published profile, or one that fails validation, returns its problems instead, and is
 * neither offered nor run.
 */
export async function readPublishedProfile(id: string, db?: FirebaseFirestore.Firestore): Promise<{ active: ActiveProfile } | { problems: string[] }> {
  const doc = await firestoreBrandProfiles(db).get(id)
  if (!doc?.published) return { problems: [`no published brand profile for ${id}`] }
  const problems = profileProblems(id, { [id]: doc.published.profile })
  if (problems.length) return { problems }
  return { active: { profile: doc.published.profile as BrandProfile, versionId: doc.published.version_id } }
}

/** readPublishedProfile, or an error naming why the brand cannot run. */
export async function requirePublishedProfile(id: string, db?: FirebaseFirestore.Firestore): Promise<ActiveProfile> {
  const r = await readPublishedProfile(id, db)
  if ("problems" in r) throw new Error(`The ${id} brand profile cannot run: ${r.problems.slice(0, 8).join("; ")}`)
  return r.active
}
