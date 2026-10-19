/**
 * The replay itself, without the network: one story through the real worker (lib/content-pipeline/worker.ts runDue)
 * against an in-memory store, from the writing step through the copy checks and the photo pick, stopping where the
 * Canva fill would begin. Research is fixed to the captured story: a draft whose subject would be replaced is held
 * instead, since a replacement would be a different story. Nothing here reaches Firestore, Canva, Slack or the board;
 * the models and fetchers are whatever the caller passes (replay.ts: the Gateway and a local cache; the test: scripts).
 */
import { BRAND } from "../../lib/content-pipeline/brand"
import type { McuAi, ModelCall } from "../../lib/content-pipeline/model"
import type { McuSeeds } from "../../lib/content-pipeline/seeds"
import { SERIES, overLimits, type SeriesKey } from "../../lib/content-pipeline/series"
import { usableLicense, type MediaCandidate, type SourcePage } from "../../lib/content-pipeline/sources"
import { WORKING, type McuDraft, type McuJob, type McuStore, type Story } from "../../lib/content-pipeline/store"
import { DOD_NOTICE, KIND_CODE, NO_PHOTO_FIRST, RETRY_MS, confirmPhoto, runDue, unsourcedNumbers, type WorkerDeps } from "../../lib/content-pipeline/worker"
import { storyOf, type CapturedPages, type ReplayStory } from "./fixtures"

/** The in-memory store, with the Firestore store's lease rules (as the offline tests use). A draft that reaches the
 * Canva step is no longer due: the replay ends there. */
class ReplayStore implements McuStore {
  jobs = new Map<string, { job: McuJob; due: boolean; leaseUntil: number; attempts: number }>()
  drafts = new Map<string, { draft: McuDraft; due: boolean; leaseUntil: number; attempts: number }>()
  private col(k: "job" | "draft") { return (k === "job" ? this.jobs : this.drafts) as Map<string, { due: boolean; leaseUntil: number; attempts: number }> }
  async createJob(job: McuJob, due = true) { const c = this.jobs.get(job.id); if (c) return { created: false, job: structuredClone(c.job) }; this.jobs.set(job.id, { job: structuredClone(job), due, leaseUntil: 0, attempts: 0 }); return { created: true, job } }
  async getJob(id: string) { const j = this.jobs.get(id); return j ? structuredClone(j.job) : null }
  async saveJob(job: McuJob) { this.jobs.get(job.id)!.job = structuredClone(job) }
  async createDraft(d: McuDraft) { if (!this.drafts.has(d.id)) this.drafts.set(d.id, { draft: structuredClone(d), due: true, leaseUntil: 0, attempts: 0 }) }
  async getDraft(id: string) { const d = this.drafts.get(id); return d ? structuredClone(d.draft) : null }
  async saveDraft(d: McuDraft) { this.drafts.get(d.id)!.draft = structuredClone(d) }
  async claim(k: "job" | "draft", id: string, now: number, lease: number) { const r = this.col(k).get(id); if (!r || !r.due || r.leaseUntil > now) return 0; r.leaseUntil = now + lease; r.attempts++; return r.attempts }
  async release(k: "job" | "draft", id: string, due: boolean) { const r = this.col(k).get(id)!; r.leaseUntil = 0; r.due = due; r.attempts = 0 }
  async due(now: number, limit: number) {
    return [...[...this.jobs].filter(([, v]) => v.due && v.leaseUntil <= now).map(([id]) => ({ kind: "job" as const, id })),
      ...[...this.drafts].filter(([, v]) => v.due && v.leaseUntil <= now && !STOP.includes(v.draft.status)).map(([id]) => ({ kind: "draft" as const, id }))].slice(0, limit)
  }
  async highestDraftNumber(prefix: string) { return Math.max(0, ...[...this.drafts.keys()].filter(k => k.startsWith(prefix)).map(k => Number(k.slice(prefix.length, prefix.length + 2)))) }
  async backoff(k: "job" | "draft", id: string, until: number) { this.col(k).get(id)!.leaseUntil = until }
  async choosingDrafts() { return [...this.drafts.values()].filter(v => v.draft.status === "choosing").map(v => v.draft.id) }
  async recentStories(since: string) { return [...this.drafts.values()].map(v => v.draft).filter(d => d.createdAt >= since && d.story).map(d => ({ draftId: d.id, jobId: d.jobId, title: d.story.title, primaryUrl: d.story.primaryUrl })) }
  /** A step that failed and waits for its retry (its lease runs to the retry time). */
  waiting(now: number) { return [...this.drafts.values(), ...this.jobs.values()].some(v => v.due && v.leaseUntil > now) }
}
/** Where a replay ends: the Canva fill is the next step (designing), or the draft is settled. */
const STOP: readonly McuDraft["status"][] = ["designing"]

export interface ReplayDeps {
  /** The pipeline's models; research is replaced (see replayAi), every other call goes through. */
  ai(onCall: (call: ModelCall) => void): McuAi
  seeds: McuSeeds | null
  fetchPage(url: string): Promise<SourcePage>
  fetchImage(url: string): Promise<{ bytes: Uint8Array; mime: "image/jpeg" | "image/png" }>
  searchCommons(query: string): Promise<MediaCandidate[]>
  searchMore?(query: string): Promise<MediaCandidate[]>
  searchDvids?(query: string): Promise<MediaCandidate[]>
  /**
   * Photo first (plan v10), as research runs it: the story's photo is confirmed before it is written. Research is fixed
   * here, so a story without one can't move to the next candidate: it is held, and counted as skipped by photo first.
   */
  photoFirst?: boolean
  /** The fact check on copy that reached the Canva step (score.ts factCheck), or none. */
  factCheck?(input: { story: Story; frames: McuDraft["frames"]; caption: string; onCall: (call: ModelCall) => void }): Promise<string[]>
}

/**
 * Research is fixed to the captured story: no web search, no replacement subject. A draft the pipeline would move to
 * another subject (a photo it can't find, a writer's hold) is held with the reason it gave, plus this note.
 */
export const FIXED_RESEARCH = "replay: research is fixed to the captured story, so no replacement subject is searched"
function replayAi(ai: McuAi): McuAi {
  return { ...ai, research: async () => ({ candidates: [], note: FIXED_RESEARCH }) }
}

/**
 * Every template's fields as the Canva datasets have them now: the series' text fields and, where the series places
 * a photo, its image field (the News feed photo frame became an autofill field before round 6). The replay stops
 * before the fill, so only the media step reads this, to know whether a frame takes a photo.
 */
async function templateFields(templateId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const s of Object.values(SERIES)) if (Object.values(s.templates).includes(templateId)) {
    for (const f of s.fields) out[f.name] = "text"
    for (const m of Object.values(s.media)) if (m) out[m] = "image"
  }
  return out
}

/** Per story: where it ended, why, what it wrote and chose, and every model call. */
export interface StoryRun {
  id: string; kind: ReplayStory["kind"]
  /** review: reached the Canva step; held; failed (a step kept failing); none: the engine opened no draft (ICYMI). */
  end: "review" | "held" | "failed" | "none"
  status: McuDraft["status"] | "no_draft"; reason: string | null
  frames: McuDraft["frames"]; caption: string | null
  media: ({ pageUrl: string; license: string; credit: string; rightsNote?: string; note?: string } | null)[]
  history: string[]; calls: ModelCall[]; ms: number
  /** An ICYMI roundup's stories, as the engine chose them. */
  roundup?: string[]
  /** Photo first: the story's photo confirmed before writing (kept), none found (skipped: production would try the next story), or not run. */
  photoFirst?: "kept" | "skipped"
  /** Style problems the draft went to Review with (plan v9: notes, not holds). */
  notes?: string[]
  story?: Story
}

export async function replayStory(s: ReplayStory, captured: CapturedPages | null, deps: ReplayDeps): Promise<StoryRun> {
  const started = Date.now(), base = Date.parse(s.now)
  let offset = 0
  const store = new ReplayStore(), calls: ModelCall[] = []
  const request = { actorEmail: "replay@localhost", actorName: "Replay" }
  const workerDeps: WorkerDeps = {
    store,
    ai: onCall => replayAi(deps.ai(c => { calls.push(c); onCall(c) })),
    content: {
      recentPosts: async () => s.posts ?? [],
      templateFields,
      createDesign: async () => { throw new Error("replay: stops before the Canva fill") },
      writePost: async () => { throw new Error("replay: writes nothing to the board") },
      writeNoContent: async () => ({ postId: "replay-no-content" }),
    },
    seeds: async () => deps.seeds,
    icymiWindow: async () => ({ lookbackDays: null }),
    fetchPage: deps.fetchPage, fetchImage: deps.fetchImage, searchCommons: deps.searchCommons, ...(deps.searchMore ? { searchMore: deps.searchMore } : {}), ...(deps.searchDvids ? { searchDvids: deps.searchDvids } : {}),
    ...(deps.photoFirst ? { photoFirst: true } : {}),
    notify: async () => {},
    nowMs: () => base + offset,
  }
  const at = new Date(base).toISOString(), day = at.slice(0, 10).replace(/-/g, "")
  const job: McuJob = { id: `replay-${s.id}`, kind: s.kind, count: 1, placement: "feed", request, status: s.kind === "icymi" ? "researching" : "drafting", drafts: [], createdAt: at }
  let story: Story | undefined
  if (s.kind === "icymi") {
    // The roundup's research is the engine's own: icymiStory over the posts, in the round's week.
    await store.createJob(job)
  } else {
    if (!captured) throw new Error(`${s.id}: no captured pages (run capture.ts)`)
    story = storyOf(s, captured)
    // Photo first, where research would run it (worker.ts researchStories): before the draft opens.
    if (deps.photoFirst) {
      // A check that errors leaves the story unchecked, as research does.
      const found = await confirmPhoto(workerDeps, workerDeps.ai(() => {}), story, s.kind, "feed").catch(() => null)
      if (found && "why" in found) return { id: s.id, kind: s.kind, end: "held", status: "held", reason: `${NO_PHOTO_FIRST}: ${found.why}`.slice(0, 1000), frames: [], caption: null, media: [], history: [], calls, ms: Date.now() - started, photoFirst: "skipped", story }
      if (found) story.photo = found.photo
    }
    const id = `${BRAND.draftPrefix}-${KIND_CODE[s.kind]}-${day}-01`
    job.drafts = [id]
    await store.createJob(job, false)
    await store.createDraft({ id, jobId: job.id, kind: s.kind, placement: "feed", request, status: "queued", version: 1, story, frames: [], media: [], designs: [], qa: [], notices: [], calls: [], history: [{ at, event: `opened under ${BRAND.rulesVersion} (replay)` }], createdAt: at, updatedAt: at })
  }
  // A failed step waits RETRY_MS for its retry: the clock moves on rather than the replay waiting.
  for (let round = 0; round < 12; round++) {
    await runDue(workerDeps, Number.MAX_SAFE_INTEGER)
    if (!store.waiting(base + offset)) break
    offset += RETRY_MS + 1
  }
  const d = [...store.drafts.values()][0]?.draft
  if (!d) {
    const j = (await store.getJob(job.id))!
    return { id: s.id, kind: s.kind, end: "none", status: "no_draft", reason: j.note ?? null, frames: [], caption: null, media: [], history: [], calls, ms: Date.now() - started }
  }
  const end = d.status === "designing" ? "review" : d.status === "held" ? "held" : d.status === "failed" ? "failed" : WORKING.includes(d.status) ? "failed" : "held"
  const reason = end === "review" ? null : d.holdReason ?? d.error ?? `stopped at ${d.status}`
  return {
    id: s.id, kind: s.kind, end, status: d.status, reason,
    frames: d.frames, caption: d.caption ?? null,
    media: d.media.map(m => m ? { pageUrl: m.pageUrl, license: m.license, credit: m.credit, ...(m.rightsNote ? { rightsNote: m.rightsNote } : {}), ...(m.note ? { note: m.note } : {}) } : null),
    history: d.history.map(h => h.event), calls, ms: Date.now() - started,
    ...(d.story.roundup ? { roundup: d.story.roundup.map(p => p.title) } : {}),
    ...(d.copyNotes?.length ? { notes: d.copyNotes } : {}),
    ...(d.story.photo ? { photoFirst: "kept" as const } : {}),
    story: d.story,
  }
}

// ── scoring on the v9 pass bar ──

/**
 * Why a draft was held, in the plan v9 terms. safety: a reason v9 keeps as a hold (a figure not in the source, copy
 * past the template's limits, copy not about the story, no photo with verified rights). style: a reason v9 no longer
 * holds for, which goes to Review with a note (headline punctuation, the caption's format, copied wording). source:
 * the writer judged the source can't support the post. error: a step kept failing.
 */
export type HoldKind = "photo" | "limits" | "figures" | "subject" | "originality" | "headline" | "format" | "writer" | "eligibility" | "error"
/** Holds v9 keeps: the safety reasons, and a writer's judgment that the source can't support the facts. */
export const SAFETY_HOLDS: readonly HoldKind[] = ["photo", "limits", "figures", "subject", "writer"]
export function holdKinds(reason: string, end: StoryRun["end"]): HoldKind[] {
  if (end === "failed") return ["error"]
  const r = reason, kinds = new Set<HoldKind>()
  if (/^no relevant, licensed photo|^no photo of the subject/i.test(r)) kinds.add("photo")
  // The copy rules' own reasons; a writer's hold is in its own words, which may name a rule ("the mission brief").
  if (/^the copy still breaks the template rules/i.test(r)) {
    if (/figures are not in the source/i.test(r)) kinds.add("figures")
    if (/runs past \d+ lines?|at most \d+ characters|each line at most/i.test(r)) kinds.add("limits")
    if (/the copy is not about this story/i.test(r)) kinds.add("subject")
    if (/copies \d+ words in a row/i.test(r)) kinds.add("originality")
    if (/the headline (takes|has)|the hook (ends|takes)|the deck (must|is one|repeats|carries)/i.test(r)) kinds.add("headline")
    if (/mission brief|needs its source on a line|is empty|must be one of|abbreviated words|@handle|placeholder/i.test(r)) kinds.add("format")
  }
  if (/no .* story was published|so there is no ICYMI/i.test(r)) kinds.add("eligibility")
  if (!kinds.size) kinds.add("writer") // a writer's hold: the source can't support the post, in its words
  return [...kinds]
}

/** The safety checks on copy that reached the Canva step, each measured in code except the fact check. */
export interface Safety {
  /** Fields past their template limits, as the server measures them. */
  limits: string[]
  /** Figures on the card or in the caption that aren't in the source text. */
  unsourced: string[]
  /** Per photo frame: verified (public domain or an open license), company (official company media: its terms are for the reviewer to confirm) or missing. */
  rights: ("verified" | "company" | "missing" | "none_needed")[]
  /**
   * Cut-off words on the card: a line's last word, which the source doesn't use, that is the start of one it does ("PREC" for
   * "precision", baseline 2026-10-19). The engine's own check (series.ts clippedWords) knows only a fixed list.
   */
  clipped: string[]
  /** Statements the fact check found unsupported by or contrary to the source; null when it didn't run. */
  factErrors: string[] | null
}
export function safetyOf(run: StoryRun): Omit<Safety, "factErrors"> {
  const limits = run.frames.flatMap((f, i) => SERIES[f.series as SeriesKey].fields.flatMap(spec => typeof f.fields[spec.name] === "string" && f.fields[spec.name].trim() ? overLimits(spec, f.fields[spec.name]).map(m => run.frames.length > 1 ? `frame ${i + 1}: ${m}` : m) : []))
  const body = (run.caption ?? "").split("\n").filter(l => !/^(Archive image|Image|Photo): /.test(l) && l !== DOD_NOTICE).join("\n")
  const unsourced = run.story ? unsourcedNumbers([body, ...run.frames.flatMap(f => Object.entries(f.fields).filter(([k]) => k !== "date" && k !== "counter").map(([, v]) => v))], run.story.sourceText) : []
  const rights = run.frames.map((f, i) => {
    if (!SERIES[f.series as SeriesKey].media.feed) return "none_needed" as const
    const m = run.media[i]
    if (!m) return "missing" as const
    return usableLicense(m.license.replace(/\s*\(.*\)$/, "")) || /^public domain/i.test(m.license) ? "verified" as const : "company" as const
  })
  return { limits, unsourced, rights, clipped: run.story ? cutOffWords(run.frames, run.story.sourceText) : [] }
}
const SERVER_FIELDS = new Set(["date", "counter", "image_context", "story_numbers", "source"])
export function cutOffWords(frames: StoryRun["frames"], source: string): string[] {
  const inSource = new Set((source.toLowerCase().match(/[a-z]+/g) ?? []))
  const longer = [...inSource].filter(w => w.length >= 6)
  // A word is cut off where a line runs out: only the last word of each line is a candidate ("WAIT FOR EYES" is not).
  const words = frames.flatMap(f => Object.entries(f.fields).filter(([k]) => !SERVER_FIELDS.has(k)).flatMap(([, v]) => v.split("\n").map(l => (l.toLowerCase().match(/[a-z]+/g) ?? []).pop() ?? "")))
  return [...new Set(words.filter(w => w.length >= 3 && !inSource.has(w) && longer.some(l => l.length >= w.length + 3 && l.startsWith(w))).map(w => w.toUpperCase()))]
}
/**
 * The v9 pass: the draft reaches Review safe and within limits. Reached the Canva step, every field within its
 * limits, every figure in the source, every photo frame with a photo whose rights were read from its page (company
 * media counts, flagged for the reviewer, as production sends it to Review), and the fact check finding nothing. A
 * broken layout can only be seen on the Canva export, which the replay doesn't make: it is not scored here.
 */
export function passes(run: StoryRun, s: Safety): boolean {
  return run.end === "review" && !s.limits.length && !s.unsourced.length && !s.clipped.length && !s.rights.includes("missing") && (s.factErrors?.length ?? 0) === 0
}
