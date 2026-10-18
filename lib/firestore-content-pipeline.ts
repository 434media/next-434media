import { FieldPath } from "firebase-admin/firestore"
import { getDb } from "./firebase-admin"
import { CRM_COLLECTIONS } from "../types/crm-types"
import type { McuDraft, McuJob, McuStore } from "./content-pipeline/store"
import type { McuSeeds } from "./content-pipeline/seeds"

/**
 * Firestore for the content pipeline: jobs and drafts with their leases, and the run-time settings (the MCU seeds).
 * No list cache: a lease must be read fresh, and the Generate panel polls for live state. Records hold the job or
 * draft as one JSON-clean object beside the lease fields (due, leaseUntil, attempts), as the pilot stored them.
 */
const JOBS = CRM_COLLECTIONS.CONTENT_PIPELINE_JOBS
const DRAFTS = CRM_COLLECTIONS.CONTENT_PIPELINE_DRAFTS
const CONFIG = CRM_COLLECTIONS.CONTENT_PIPELINE_CONFIG
const SEEDS_DOC = "mcu_seeds"
const ICYMI_WINDOW_DOC = "icymi_window"

// Firestore rejects undefined; a JSON round trip drops it and keeps the record plain.
const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

export function firestorePipelineStore(db: FirebaseFirestore.Firestore = getDb()): McuStore {
  const jobs = db.collection(JOBS), drafts = db.collection(DRAFTS)
  const col = (k: "job" | "draft") => k === "job" ? jobs : drafts
  return {
    createJob: job => db.runTransaction(async tx => {
      const ref = jobs.doc(job.id), current = (await tx.get(ref)).data()
      if (current) return { created: false, job: current.job as McuJob }
      tx.set(ref, { job: clean(job), due: true, leaseUntil: 0, attempts: 0, createdAt: job.createdAt, actor: job.request.actorEmail })
      return { created: true, job }
    }),
    getJob: async id => ((await jobs.doc(id).get()).data()?.job as McuJob | undefined) ?? null,
    // mergeFields replaces the whole job or draft object and keeps the lease fields beside it. A plain merge kept every
    // field the new object no longer has: a cleared caption (undefined, dropped by clean) survived a subject switch
    // and a later step read it back (gate round 3, 2026-10-17: DT101-10 captioned for Raid Hunter, sourced for Thunder).
    saveJob: async job => { await jobs.doc(job.id).set({ job: clean(job) }, { mergeFields: ["job"] }) },
    createDraft: async draft => { await drafts.doc(draft.id).create({ draft: clean(draft), due: true, leaseUntil: 0, attempts: 0, jobId: draft.jobId, createdAt: draft.createdAt }).catch(e => { if ((e as { code?: number }).code !== 6) throw e }) },
    getDraft: async id => ((await drafts.doc(id).get()).data()?.draft as McuDraft | undefined) ?? null,
    saveDraft: async draft => { await drafts.doc(draft.id).set({ draft: clean(draft) }, { mergeFields: ["draft"] }) },
    claim: (k, id, nowMs, leaseMs) => db.runTransaction(async tx => {
      const ref = col(k).doc(id), d = (await tx.get(ref)).data()
      if (!d || d.due !== true || (typeof d.leaseUntil === "number" && d.leaseUntil > nowMs)) return 0
      const attempts = (typeof d.attempts === "number" ? d.attempts : 0) + 1
      tx.update(ref, { leaseUntil: nowMs + leaseMs, attempts })
      return attempts
    }),
    // A step that finished cleanly resets the attempt count; only repeated failure of the same step closes the item.
    release: async (k, id, due) => { await col(k).doc(id).update({ leaseUntil: 0, due, attempts: 0 }) },
    backoff: async (k, id, untilMs) => { await col(k).doc(id).update({ leaseUntil: untilMs }) },
    due: async (nowMs, limit) => {
      const out: { kind: "job" | "draft"; id: string; at: string }[] = []
      for (const k of ["job", "draft"] as const) {
        const snap = await col(k).where("due", "==", true).limit(25).get()
        for (const d of snap.docs) { const v = d.data(); if (!(typeof v.leaseUntil === "number" && v.leaseUntil > nowMs)) out.push({ kind: k, id: d.id, at: String(v.createdAt || "") }) }
      }
      return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit).map(({ kind, id }) => ({ kind, id }))
    },
    // ids are MCU-<KIND>-<YYYYMMDD>-NN. The pilot's drafts live in its own database, but every design it made is in
    // the Canva create ledger and every post it readied carries intake.requestId, both keyed by the bare draft id.
    highestDraftNumber: async prefix => {
      const end = `${prefix}\uf8ff`
      const [own, posts, designs] = await Promise.all([
        drafts.where(FieldPath.documentId(), ">=", prefix).where(FieldPath.documentId(), "<", end).select().get(),
        db.collection(CRM_COLLECTIONS.CONTENT_POSTS).where("intake.requestId", ">=", prefix).where("intake.requestId", "<", end).select("intake.requestId").get(),
        db.collection("crm_meta").doc("owned_meta_canva").collection("created").where("requestId", ">=", prefix).where("requestId", "<", end).select("requestId").get(),
      ])
      const ids = [...own.docs.map(d => d.id), ...posts.docs.map(d => String(d.get("intake.requestId") ?? "")), ...designs.docs.map(d => String(d.get("requestId") ?? ""))]
      return Math.max(0, ...ids.map(id => Number(/^\d{2,}/.exec(id.slice(prefix.length))?.[0] ?? 0)))
    },
    recentStories: async sinceIso => {
      const snap = await drafts.where("createdAt", ">=", sinceIso).limit(200).get()
      return snap.docs.map(doc => doc.data().draft as McuDraft | undefined).filter((d): d is McuDraft => !!d?.story).map(d => ({ draftId: d.id, jobId: d.jobId, title: d.story.title, primaryUrl: d.story.primaryUrl }))
    },
  }
}

/** Recent jobs with their drafts, newest first, for the Generate panel. */
export async function listRecentPipelineJobs(limit = 8): Promise<{ job: McuJob; drafts: McuDraft[] }[]> {
  const db = getDb()
  const snap = await db.collection(JOBS).orderBy("createdAt", "desc").limit(limit).get()
  const jobs = snap.docs.map(d => d.data().job as McuJob).filter(Boolean)
  const ids = [...new Set(jobs.flatMap(j => j.drafts ?? []))]
  const drafts = new Map<string, McuDraft>()
  for (let i = 0; i < ids.length; i += 30) {
    const refs = ids.slice(i, i + 30).map(id => db.collection(DRAFTS).doc(id))
    for (const s of refs.length ? await db.getAll(...refs) : []) { const d = s.data()?.draft as McuDraft | undefined; if (d) drafts.set(d.id, d) }
  }
  return jobs.map(job => ({ job, drafts: (job.drafts ?? []).map(id => drafts.get(id)).filter((d): d is McuDraft => !!d) }))
}

export async function getMcuSeeds(): Promise<McuSeeds | null> {
  const d = (await getDb().collection(CONFIG).doc(SEEDS_DOC).get()).data()
  return d && typeof d.purpose === "string" && Array.isArray(d.orgs) ? {
    purpose: d.purpose, snapshot: String(d.snapshot ?? ""),
    cohorts: Array.isArray(d.cohorts) ? d.cohorts.map(String) : [],
    orgs: d.orgs, dt101Backlog: Array.isArray(d.dt101Backlog) ? d.dt101Backlog : [], dt101Covered: Array.isArray(d.dt101Covered) ? d.dt101Covered.map(String) : [],
    ...(typeof d.updatedAt === "string" ? { updatedAt: d.updatedAt } : {}), ...(typeof d.updatedBy === "string" ? { updatedBy: d.updatedBy } : {}),
  } : null
}
export async function saveMcuSeeds(seeds: McuSeeds): Promise<void> {
  await getDb().collection(CONFIG).doc(SEEDS_DOC).set(clean(seeds))
}

/**
 * The ICYMI lookback, a super-admin setting: null (the default, and when the document is missing) means the previous
 * Monday-to-Sunday week in America/Chicago; a number means the last N days, for a test run. 1–60 days.
 */
export interface IcymiWindowSetting { lookbackDays: number | null; updatedAt?: string; updatedBy?: string }
export async function getIcymiWindow(): Promise<IcymiWindowSetting> {
  const d = (await getDb().collection(CONFIG).doc(ICYMI_WINDOW_DOC).get()).data()
  const days = d?.lookbackDays
  return { lookbackDays: typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 60 ? days : null, ...(typeof d?.updatedAt === "string" ? { updatedAt: d.updatedAt } : {}), ...(typeof d?.updatedBy === "string" ? { updatedBy: d.updatedBy } : {}) }
}
export async function saveIcymiWindow(setting: IcymiWindowSetting): Promise<void> {
  await getDb().collection(CONFIG).doc(ICYMI_WINDOW_DOC).set(clean(setting))
}
