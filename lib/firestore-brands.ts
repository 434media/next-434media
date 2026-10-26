import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import { PIPELINE_PROPERTIES } from "./content-pipeline/properties"
import { draftDiffers, type BrandProfileDoc } from "./content-pipeline/profile-store"
import { profileProblems, type BrandProfile } from "./content-pipeline/profile"
import { META_BRANDS } from "./owned-meta-publisher"
import type { BrandFacts } from "./content-pipeline/brand-status"
import type { McuSeeds } from "./content-pipeline/seeds"

/**
 * The Brands area's reads (plan v11.2.1 Step 4 item 2): every brand on the CRM roster and every brand with a profile
 * document (a client brand has no roster entry), with the facts its status and checklist are read from. Read on each
 * request, never cached, like the profiles themselves (Step 1 item 7).
 */

/** The seeds document a profile's sources name: `content_pipeline_config/<doc>` or the doc id alone. */
export function seedsDocId(pointer: string | null | undefined): string | null {
  const m = /^(?:content_pipeline_config\/)?([a-z0-9_-]{1,64})$/.exec((pointer ?? "").trim())
  return m ? m[1] : null
}

async function postsMade(id: string): Promise<number> {
  // Every published version is "<id>@v<n>"; the range is that prefix.
  const snap = await getDb().collection(CRM_COLLECTIONS.CONTENT_POSTS).where("profile_version_id", ">=", `${id}@`).where("profile_version_id", "<", `${id}@`).count().get()
  return snap.data().count
}

export interface BrandRead { facts: BrandFacts; doc: BrandProfileDoc | null; seeds: McuSeeds | null }

export async function readBrand(id: string, doc: BrandProfileDoc | null): Promise<BrandRead> {
  const roster = PIPELINE_PROPERTIES.find(p => p.id === id)
  const { getSeedsDoc } = await import("./firestore-content-pipeline")
  const seedsId = seedsDocId(doc?.sources?.seeds)
  const [seeds, made] = await Promise.all([seedsId ? getSeedsDoc(seedsId).catch(() => null) : null, postsMade(id).catch(() => 0)])
  const pub = doc?.published ?? null
  const problems = pub ? profileProblems(id, { [id]: pub.profile }) : []
  const facts: BrandFacts = {
    id, label: roster?.label ?? pub?.profile.name ?? id, onRoster: !!roster, brandType: doc?.brand_type ?? null, hasDocument: !!doc,
    identity: doc?.identity ?? null, sources: doc?.sources ?? null,
    published: pub && !problems.length ? { versionId: pub.version_id, profile: pub.profile as BrandProfile, publishedAt: pub.published_at, publishedBy: pub.published_by } : null,
    publishedProblem: !doc ? "no profile document yet" : !pub ? "nothing published yet" : problems[0] ?? null,
    draftDiffers: !!doc && draftDiffers(doc),
    seeds: seeds ? { snapshot: seeds.snapshot, orgs: seeds.orgs.length, cohorts: seeds.cohorts.length, backlog: seeds.dt101Backlog.length, ...(seeds.updatedAt ? { updatedAt: seeds.updatedAt } : {}) } : null,
    postsMade: made, publisherBrands: META_BRANDS, brandBook: false,
  }
  return { facts, doc, seeds }
}

/** The roster first, in its order, then any other brand with a profile document (client brands), by id. */
export async function readAllBrands(): Promise<BrandRead[]> {
  const { firestoreBrandProfiles } = await import("./firestore-brand-profiles")
  const docs = await firestoreBrandProfiles().list()
  const ids = [...PIPELINE_PROPERTIES.map(p => p.id), ...docs.map(d => d.id).filter(id => !PIPELINE_PROPERTIES.some(p => p.id === id)).sort()]
  return Promise.all(ids.map(id => readBrand(id, docs.find(d => d.id === id) ?? null)))
}
