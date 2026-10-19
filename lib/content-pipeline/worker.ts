import { SERIES, candidateFields, checkFields, clippedWords, cutOffWords, ddmmmyy, measure, normalizeFields, overLimits, type Placement, type RequestKind } from "./series"
import { BRAND } from "./brand"
import { headlineProblems, originalityFindings, originalityProblems, type Copied } from "./copy-checks"
import { framesFor, icymiCount, meaningful, normalizeUrl, unusedStorySlot, type Candidate, type McuAi, type ModelCall, type RankedPhoto, type SubjectBox } from "./model"
import { contentPropertyOf } from "./properties"
import type { ContentProperty, PipelineMedia } from "@/components/crm/types"
import type { McuSeeds } from "./seeds"
import { MIN_SHORT_SIDE, archiveRelevant, federalHost, imageSize, isDvidsImagePage, isOutlet, pageImageCandidate, type MediaCandidate, type SourcePage } from "./sources"
import { MAX_ATTEMPTS, WORKING, type CheckedPhoto, type ChosenMedia, type CropBox, type FrameCopy, type FrameDesign, type McuDraft, type McuJob, type McuStore, type RoundupItem, type SourcedFact, type Story } from "./store"

/**
 * The pipeline worker: advances due jobs and drafts one step at a time, saving after every step, so an interrupted run
 * resumes where it stopped. Server-side only (no browser). A job researches once and opens one draft per story; a
 * draft is written, given a licensed photo (zoomed in code), filled into its published Canva brand template, checked
 * on the real export, and then written to the Admin board as a crm_content_posts record in Review (needs_approval)
 * with its staged exports, caption, sources and photo credits. One "N drafts ready" alert goes out per job.
 * Nothing here prepares, approves or publishes: those stay with the publisher and its approver.
 * Moved from the pilot's Slack MCU skill (lib/slack/mcu/worker.ts at b36e7be). Slack review messages are replaced by
 * the board; revision ("revise", "refresh", "ready") moves to the drawer in Phase 2 and is not carried here.
 */
/**
 * publishedAt: when the post went out (posted_at, else its post date), for the ICYMI window; media: its pipeline_media;
 * card: its first staged image asset, the card as it was posted, which an ICYMI roundup reuses as that story's slide.
 */
export interface PostRow { id: string; title: string; status: string; publishedUrl?: string; caption?: string; publishedAt?: string; media?: PipelineMedia[]; card?: { url: string; sha256?: string } }
export interface DesignInput { requestId: string; templateId: string; title: string; text: Record<string, string>; image?: { field: string; url: string; name: string; crop?: CropBox } }
export interface ContentSide {
  /** MCU's content posts, for the repeat-story check and ICYMI. */
  recentPosts(): Promise<PostRow[]>
  templateFields(templateId: string): Promise<Record<string, string>>
  /** Idempotent per requestId (the Canva create ledger). */
  createDesign(input: DesignInput): Promise<Omit<FrameDesign, "templateId">>
  /** Writes the draft to the board, idempotent per requestId; returns the post and any export holds. */
  writePost(input: PostInput): Promise<{ postId: string; holds: string[] }>
  /** The "no new content" card in Review for a job that found nothing usable: idempotent per requestId; never a post. */
  writeNoContent(input: NoContentInput): Promise<{ postId: string }>
}
/** property: the content post's Property (its `platform` field), e.g. "MilCityUSA". */
export interface NoContentInput { requestId: string; jobId: string; property: ContentProperty; title: string; reason: string; tried: { title: string; url: string }[]; requestedBy: { email: string; name: string } }
/**
 * media: the photo each frame used, recorded on the post as pipeline_media for ICYMI to reuse. slides: images staged
 * after the designs' exports, as they are (an ICYMI roundup's stories: each one's published card).
 */
export interface PostInput { requestId: string; property: ContentProperty; title: string; caption: string; notes: string; links: string[]; media: PipelineMedia[]; designIds: string[]; slides?: { url: string; label: string }[]; requestedBy: { email: string; name: string } }
export interface WorkerDeps {
  store: McuStore
  /** The model calls; each call is reported through onCall so the draft records which model and provider served it. */
  ai(onCall: (call: ModelCall) => void): McuAi
  content: ContentSide
  seeds(): Promise<McuSeeds | null>
  fetchPage(url: string): Promise<SourcePage>
  fetchImage(url: string): Promise<{ bytes: Uint8Array; mime: "image/jpeg" | "image/png" }>
  searchCommons(query: string): Promise<MediaCandidate[]>
  /** Other open archives searched beside Commons (Openverse, NASA); each keeps only usable licenses. */
  searchMore?(query: string): Promise<MediaCandidate[]>
  /** DVIDS image search through its API (sources.ts searchDvids, with DVIDS_API_KEY); absent without a key. */
  searchDvids?(query: string): Promise<MediaCandidate[]>
  /**
   * Photo first (plan v10, Phase 1 direction 6): research confirms a usable, licensed photo of a story's subject before
   * the story is chosen, and moves to the next candidate when there is none (confirmPhoto). Production and the replay
   * set it; a job whose stories bring their own photo (skipPhotoFirst) is not checked.
   */
  photoFirst?: boolean
  /** The ICYMI lookback (content_pipeline_config/icymi_window): null days = the previous Monday-to-Sunday week. */
  icymiWindow?(): Promise<{ lookbackDays: number | null }>
  /** The one "N drafts ready" alert for a finished job. */
  notify(job: McuJob, drafts: McuDraft[]): Promise<void>
  /**
   * An ICYMI roundup with more stories than it takes waits for the requester's choice: an alert in Slack and the admin
   * notifications, and a CRM task, each linking to the draft in the Admin. Returns the task's id when one was recorded.
   */
  askChoice?(job: McuJob, draft: McuDraft): Promise<{ taskId?: string }>
  /** Closes the choice's CRM task, with what happened (picked, closed or superseded). */
  closeChoiceTask?: ChoiceTasks["close"]
  nowMs(): number
}
export const LEASE_MS = 290_000
/** A failed step is tried again after this long (its lease is shortened), within MAX_ATTEMPTS. */
export const RETRY_MS = 60_000
/**
 * Prefix on every key this pipeline writes to shared ledgers (the Canva create ledger, content posts' intake
 * requestId). The pilot keyed the same ledgers by bare draft id ("MCU-DT101-20261017-01:v1:f1"), so an unprefixed key
 * here could return the pilot's design or bind the pilot's published post.
 */
export const KEY_PREFIX = "admin:"
/** Drafts opened this recently, by any job, count for the repeat-story check (store.recentStories). */
const RECENT_STORY_MS = 3 * 864e5
/** The seeds' outlet sites, beside sources.ts's own list. */
async function outletSites(deps: Pick<WorkerDeps, "seeds">): Promise<string[]> {
  return ((await deps.seeds().catch(() => null))?.orgs ?? []).filter(o => o.kind === BRAND.seeds.outletKind).map(o => o.site)
}
/** Stories other drafts are working on: their titles steer research, their URLs are refused. */
async function storiesInFlight(deps: WorkerDeps, exceptDraft?: string): Promise<{ titles: string[]; urls: Set<string> }> {
  const recent = (await deps.store.recentStories(new Date(deps.nowMs() - RECENT_STORY_MS).toISOString()).catch(() => [])).filter(s => s.draftId !== exceptDraft)
  return { titles: [...new Set(recent.map(s => s.title))].slice(0, 30), urls: new Set(recent.map(s => normalizeUrl(s.primaryUrl))) }
}
/**
 * How recent a story's source must be (Phase 1b, 2026-10-17; the -05 DT101 draft was built on a 2025-07-16 article for
 * a card dated 2026-10-17). Breaking: an exact time within the profile's freshHours (breakingFreshness, below). News: published within the
 * last 7 days, by the page's stated date or else the date the search reported; with no date at all it is dropped,
 * since the card prints the source date. DT101 is an explainer, so an undated page describing the system (the maker's
 * product page) counts as current; but a dated page is a news hook, and it must be from the last 90 days. A stale
 * page is a miss like an unreadable one, so the subject's other primary pages are tried before it drops.
 */
export const RECENCY_DAYS: Partial<Record<RequestKind, number>> = Object.fromEntries(BRAND.requestKinds.filter(k => k.recencyDays).map(k => [k.kind, k.recencyDays]))
export function staleSource(kind: RequestKind, publishedAt: string | undefined, nowMs: number, within?: number): string | null {
  const days = within ?? RECENCY_DAYS[kind]
  if (!days) return null
  if (!publishedAt) return BRAND.requestKinds.find(k => k.kind === kind)?.undatedOk ? null : "states no publication date"
  const age = nowMs - Date.parse(`${publishedAt}T23:59:59Z`)
  return age > days * 864e5 ? `published ${publishedAt}, more than ${days} days ago` : null
}
const ICYMI_MAX = 5
const MAX_SUPPORTING = 2
const MAX_AUTO_REPLACE = 2
const MAX_MEDIA_RETRIES = 2
const MAX_SHOWN = 8
/** DVIDS API searches per photo search, and the most of its photos shown to the vision pick beside the others. */
const MAX_DVIDS_QUERIES = 3
const MAX_DVIDS_SHOWN = 4
const MAX_VISION_BYTES = 4_500_000

const iso = (deps: Pick<WorkerDeps, "nowMs">) => new Date(deps.nowMs()).toISOString()
/** Each request kind's code in draft ids ("MCU-NEWS-20261018-01"), and its label, from the brand profile. */
export const KIND_CODE = Object.fromEntries(BRAND.requestKinds.map(k => [k.kind, k.code])) as Record<RequestKind, string>
export const label = (k: RequestKind) => BRAND.requestKinds.find(x => x.kind === k)?.label ?? k

/** Runs due work until the time budget is spent. Returns how many steps ran. */
export async function runDue(deps: WorkerDeps, budgetMs = 240_000): Promise<number> {
  const started = deps.nowMs()
  let steps = 0
  while (deps.nowMs() - started < budgetMs) {
    const next = await deps.store.due(deps.nowMs(), 5)
    let ran = false
    for (const item of next) {
      const attempt = await deps.store.claim(item.kind, item.id, deps.nowMs(), LEASE_MS)
      if (!attempt) continue
      ran = true; steps++
      if (item.kind === "job") await jobStep(deps, item.id, attempt)
      else await draftStep(deps, item.id, attempt)
      break // re-read due work after every step
    }
    if (!ran) break
  }
  return steps
}

// ── jobs: research once, open one draft per story ──
async function jobStep(deps: WorkerDeps, id: string, attempt: number): Promise<void> {
  const job = await deps.store.getJob(id)
  if (!job || job.status !== "researching") { await deps.store.release("job", id, false); return }
  if (attempt > MAX_ATTEMPTS) {
    job.status = "failed"; job.note = "Research kept failing"; job.updatedAt = iso(deps)
    await deps.store.saveJob(job); await deps.store.release("job", id, false)
    return
  }
  try {
    const posts = await deps.content.recentPosts()
    const calls: ModelCall[] = []
    const ai = deps.ai(c => calls.push(c)), titles = posts.map(p => p.title), seeds = job.kind === "icymi" ? null : await deps.seeds()
    const inFlight = job.kind === "icymi" ? { titles: [], urls: new Set<string>() } : await storiesInFlight(deps)
    // A new roundup supersedes any earlier one still waiting for a choice: that draft closes, and so does its task.
    if (job.kind === "icymi") for (const waiting of await deps.store.choosingDrafts().catch(() => [])) {
      await closeRoundup(deps.store, waiting, "the content pipeline", iso(deps), `regenerated: a new ICYMI request (${id}) replaced it`, deps.closeChoiceTask ? { close: deps.closeChoiceTask } : undefined)
    }
    // Every candidate dropped (a blocked or script-only source page, no readable article, outside the Breaking window):
    // research once more, steering away from what was tried, before the job holds (production, 2026-10-17).
    // Zero candidates too: that pass found nothing to try, so the second pass is the search's one retry, not a loop.
    const research = async (limit = job.count) => {
      const first = await researchStories(deps, ai, job, titles, seeds, [], [], inFlight, limit)
      if (!("hold" in first && "tried" in first)) return first
      console.info("[content-pipeline] research again", JSON.stringify({ job: id, dropped: first.hold.slice(0, 600) }))
      const again = await researchStories(deps, ai, job, titles, seeds, first.tried ?? [], first.triedUrls ?? [], inFlight, limit)
      return "hold" in again ? { hold: `${first.hold}; then: ${again.hold}`, tried: again.tried, triedUrls: again.triedUrls } : again
    }
    let stories: Story[] | { hold: string; tried?: string[]; triedUrls?: string[] }
    let draftCalls = calls
    if (job.kind === "icymi") stories = icymiStory(posts, icymiWindow(deps.nowMs(), (await deps.icymiWindow?.().catch(() => null))?.lookbackDays ?? null), roundupSize())
    else if (photoFirstOn(deps, job)) {
      // Photo first, one saved step at a time (each check is its own step, so the run's time budget and the job's
      // lease hold): research keeps every readable candidate, then each step checks the next one's photo.
      const r = await photoFirstStep(deps, ai, job, calls, research, titles, seeds, inFlight)
      if (r === "continue") { job.updatedAt = iso(deps); await deps.store.saveJob(job); await deps.store.release("job", id, true); return }
      stories = r.stories; draftCalls = r.calls
      job.photoFirst = undefined
    } else stories = await research()
    if (calls.length) console.info("[content-pipeline] calls", JSON.stringify({ job: id, calls }))
    if ("hold" in stories || !stories.length) {
      // One thorough search found nothing usable: the request ends here with a "no new content" card in Review,
      // which the requester closes; nothing searches again.
      const reason = "hold" in stories ? stories.hold.slice(0, 1000) : "No qualifying stories found"
      const titlesTried = "hold" in stories ? stories.tried ?? [] : [], urlsTried = "hold" in stories ? stories.triedUrls ?? [] : []
      const tried = titlesTried.map((title, i) => ({ title: title.slice(0, 200), url: urlsTried[i] ?? "" })).filter((t, i, all) => /^https:\/\//.test(t.url) && all.findIndex(x => x.url === t.url) === i).slice(0, 12)
      const card = await deps.content.writeNoContent({ requestId: `${KEY_PREFIX}${id}:no-content`, jobId: id, property: contentPropertyOf(job.property), title: `No new ${label(job.kind)} content — ${iso(deps).slice(0, 10)}`, reason, tried, requestedBy: { email: job.request.actorEmail, name: job.request.actorName } })
      job.status = "held"; job.note = reason; job.noContentPostId = card.postId; job.updatedAt = iso(deps); job.notifiedAt = job.updatedAt
      await deps.store.saveJob(job); await deps.store.release("job", id, false)
      console.info("[content-pipeline] job held", JSON.stringify({ job: id, kind: job.kind, card: card.postId, tried: tried.length, note: reason.slice(0, 400) }))
      await deps.notify(job, []).catch(err => console.error("[content-pipeline] notify failed", id, err instanceof Error ? err.message : err))
      return
    }
    // Read again just before opening drafts: a job running alongside may have opened the same story meanwhile.
    if (job.kind !== "icymi") {
      const now = await storiesInFlight(deps), before = stories.length
      stories = stories.filter(st => !now.urls.has(normalizeUrl(st.primaryUrl)))
      if (stories.length < before) console.info("[content-pipeline] repeat story dropped", JSON.stringify({ job: id, dropped: before - stories.length }))
      if (!stories.length) stories = { hold: "every story found is already being drafted by another request" }
    }
    if ("hold" in stories) {
      const reason = stories.hold
      const card = await deps.content.writeNoContent({ requestId: `${KEY_PREFIX}${id}:no-content`, jobId: id, property: contentPropertyOf(job.property), title: `No new ${label(job.kind)} content — ${iso(deps).slice(0, 10)}`, reason, tried: [], requestedBy: { email: job.request.actorEmail, name: job.request.actorName } })
      job.status = "held"; job.note = reason; job.noContentPostId = card.postId; job.updatedAt = iso(deps); job.notifiedAt = job.updatedAt
      await deps.store.saveJob(job); await deps.store.release("job", id, false)
      await deps.notify(job, []).catch(err => console.error("[content-pipeline] notify failed", id, err instanceof Error ? err.message : err))
      return
    }
    const day = iso(deps).slice(0, 10).replace(/-/g, ""), prefix = `${BRAND.draftPrefix}-${KIND_CODE[job.kind]}-${day}-`
    let n = await deps.store.highestDraftNumber(prefix)
    const now = iso(deps), size = roundupSize(), choosing: McuDraft[] = []
    for (const story of stories) {
      const draftId = `${prefix}${String(++n).padStart(2, "0")}`
      job.drafts.push(draftId)
      // More published stories than a roundup takes: the draft waits for the requester to choose (founder, 2026-10-18).
      const choose = job.kind === "icymi" && (story.roundup?.length ?? 0) > size.max
      const draft: McuDraft = { id: draftId, jobId: id, kind: job.kind, placement: job.placement, request: job.request, status: choose ? "choosing" : "queued", version: 1, ...(job.topic ? { direction: job.topic } : {}), ...(job.kind === "icymi" ? { choice: { min: size.min, max: size.max } } : {}), story, frames: [], media: [], designs: [], qa: [], notices: [], calls: draftCalls.map(c => ({ ...c, at: now })), history: [{ at: now, event: `opened under ${BRAND.rulesVersion}${choose ? `; ${story.roundup!.length} stories qualify, waiting for the requester to choose ${size.min}–${size.max}` : ""}` }], createdAt: now, updatedAt: now }
      await deps.store.createDraft(draft)
      if (choose) { await deps.store.release("draft", draftId, false); choosing.push(draft) }
    }
    job.status = "drafting"; job.updatedAt = now; job.note = undefined
    if (job.kind !== "icymi" && stories.length < job.count) job.note = `${stories.length} of ${job.count} qualified`
    if (choosing.length) job.note = `${choosing[0].story.roundup!.length} published stories qualify: choose ${size.min}–${size.max} of them on the ICYMI draft`
    await deps.store.saveJob(job); await deps.store.release("job", id, false)
    for (const d of choosing) {
      const asked = await deps.askChoice?.(job, d).catch(err => { console.error("[content-pipeline] choice alert failed", d.id, err instanceof Error ? err.message : err); return null })
      if (asked?.taskId) { d.choice = { ...d.choice!, taskId: asked.taskId }; await deps.store.saveDraft(d) }
    }
    console.info("[content-pipeline] job drafting", JSON.stringify({ job: id, kind: job.kind, drafts: job.drafts, stories: stories.map(s => s.primaryUrl) }))
  } catch (err) {
    console.error("[content-pipeline] research failed", id, err instanceof Error ? err.message : err)
    const why = err instanceof Error ? err.message.slice(0, 200) : "error"
    if (attempt >= MAX_ATTEMPTS) {
      // The last attempt: close the job now, with its reason, rather than leaving it looking busy.
      job.status = "failed"; job.note = `Research failed after ${attempt} attempts: ${why}`; job.updatedAt = iso(deps)
      await deps.store.saveJob(job).catch(() => {}); await deps.store.release("job", id, false).catch(() => {})
      return
    }
    job.note = `Research failed, retrying: ${why}`
    await deps.store.saveJob(job).catch(() => {})
    // Retried by a later run after RETRY_MS (bounded by MAX_ATTEMPTS).
    await deps.store.backoff("job", id, deps.nowMs() + RETRY_MS).catch(() => {})
  }
}

/** Whether a job's stories are chosen photo first: deps.photoFirst, not ICYMI, and not a job whose stories bring their own photo. */
const photoFirstOn = (deps: Pick<WorkerDeps, "photoFirst">, job: Pick<McuJob, "kind" | "skipPhotoFirst">) => !!deps.photoFirst && job.kind !== "icymi" && !job.skipPhotoFirst
type Researched = Story[] | { hold: string; tried?: string[]; triedUrls?: string[] }
/**
 * Photo first for a job, one step at a time (coordinator review of #209: every check inside one research step ran past
 * the cron's 300 s and the job's lease). The first step researches, keeping every readable candidate (count + 2), and
 * saves them on the job. Each later step checks one candidate's photo (confirmPhoto) and saves what it found. When the
 * job has its count, or the candidates or the checks (photoChecksFor) run out, the job opens its drafts: the kept
 * stories, then unchecked ones once the checks are spent. When every candidate was passed over, research runs once more
 * (as it does when every candidate's page fails), and its candidates are checked the same way.
 */
async function photoFirstStep(deps: WorkerDeps, ai: McuAi, job: McuJob, calls: ModelCall[], research: (limit?: number) => Promise<Researched>, titles: string[], seeds: McuSeeds | null, inFlight: { titles: string[]; urls: Set<string> }): Promise<"continue" | { stories: Researched; calls: ModelCall[] }> {
  const limit = photoChecksFor(job.count)
  if (!job.photoFirst) {
    const found = await research(limit)
    if ("hold" in found) return { stories: found, calls }
    job.photoFirst = { pending: found, kept: [], dropped: [], left: limit, passes: 1, tried: found.map(s => s.title), triedUrls: found.map(s => s.primaryUrl), calls }
    job.note = `Checking ${found.length} ${found.length === 1 ? "story" : "stories"} for a usable photo`
    return "continue"
  }
  const pf = job.photoFirst
  pf.calls = [...pf.calls, ...calls]
  const story = pf.pending.shift()
  if (story && pf.left > 0) {
    pf.left--
    // A check that errors (a provider down) leaves the story unchecked rather than dropping it.
    const found = await confirmPhoto(deps, ai, story, job.kind, job.placement).catch(err => { console.error("[content-pipeline] photo first failed", story.primaryUrl, err instanceof Error ? err.message : err); return null })
    pf.calls = [...pf.calls, ...calls.filter(c => !pf.calls.includes(c))]
    if (found && "why" in found) pf.dropped.push(`${story.title}: ${NO_PHOTO_FIRST} (${found.why.slice(0, 300)})`)
    else { if (found) story.photo = found.photo; pf.kept.push(story) }
  } else if (story) pf.pending.unshift(story)
  pf.calls = pf.calls.slice(-60)
  if (pf.kept.length < job.count && pf.pending.length && pf.left > 0) { job.note = `Checked ${limit - pf.left} of up to ${limit} stories for a usable photo`; return "continue" }
  // The checks are spent: stories go on unchecked, and the media step searches as before.
  if (pf.kept.length < job.count && pf.pending.length) {
    const unchecked = pf.pending.splice(0, job.count - pf.kept.length)
    console.info("[content-pipeline] photo first", JSON.stringify({ job: job.id, unchecked: unchecked.map(s => s.primaryUrl), why: "the job's photo checks are spent" }))
    pf.kept.push(...unchecked)
  }
  if (!pf.kept.length && pf.passes < 2) {
    const again = await researchStories(deps, ai, job, titles, seeds, pf.tried, pf.triedUrls, inFlight, limit)
    pf.calls = [...pf.calls, ...calls.filter(c => !pf.calls.includes(c))]
    pf.passes = 2
    if (!("hold" in again)) {
      console.info("[content-pipeline] research again", JSON.stringify({ job: job.id, dropped: pf.dropped.join("; ").slice(0, 600) }))
      pf.pending = again; pf.tried.push(...again.map(s => s.title)); pf.triedUrls.push(...again.map(s => s.primaryUrl))
      return "continue"
    }
    pf.dropped.push(`then: ${again.hold}`)
  }
  pf.calls = pf.calls.slice(-60)
  if (pf.kept.length) return { stories: pf.kept, calls: pf.calls }
  return { stories: { hold: pf.dropped.join("; ").slice(0, 1000) || "no candidates found", tried: pf.tried, triedUrls: pf.triedUrls }, calls: pf.calls }
}
/** Midnight in America/Chicago on a calendar day, as UTC milliseconds (CDT or CST, whichever applies that day). */
function chicagoMidnight(y: number, m: number, d: number): number {
  for (const offset of [5, 6]) {
    const t = Date.UTC(y, m - 1, d, offset)
    if (new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }).format(t).replace(/^0+(?=\d)/, "") === "0") return t
  }
  return Date.UTC(y, m - 1, d, 6)
}
/**
 * The ICYMI window (founder, 2026-10-17): the previous week, Monday 00:00 to Monday 00:00 America/Chicago, so a
 * roundup posted Monday 7:00 AM CDT recaps the week before it. A super-admin can widen it to the last N days
 * (content_pipeline_config/icymi_window) for a test, without a deploy.
 */
export function icymiWindow(nowMs: number, lookbackDays: number | null): { startMs: number; endMs: number; label: string } {
  if (lookbackDays && lookbackDays > 0) return { startMs: nowMs - lookbackDays * 864e5, endMs: nowMs, label: `the last ${lookbackDays} days` }
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(nowMs).split("-").map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(), sinceMonday = (dow + 6) % 7
  const monday = new Date(Date.UTC(y, m - 1, d - sinceMonday)), prev = new Date(Date.UTC(y, m - 1, d - sinceMonday - 7))
  const endMs = chicagoMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()), startMs = chicagoMidnight(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate())
  return { startMs, endMs, label: `the week of ${prev.toISOString().slice(0, 10)}` }
}
/** The ICYMI roundup's size, from the profile's request kind (3–5 for MCU), else 1–5. */
export function roundupSize(): { min: number; max: number } {
  const k = BRAND.requestKinds.find(x => x.kind === "icymi")
  return { min: k?.minStories ?? 1, max: k?.maxStories ?? ICYMI_MAX }
}
/** Candidates offered for a choice, newest first. */
const MAX_CHOICES = 20
/**
 * ICYMI (founder, 2026-10-18): the window's published News or Breaking stories, newest first, no repeats, each with
 * its own published card to reuse as its slide. Fewer than `min`: no roundup. More than `max`: every candidate, up
 * to MAX_CHOICES, for the requester to choose from (the job opens the draft as "choosing"). A post with no
 * publication time can't be placed in a week, and a post with no staged card has no slide, so both are left out.
 * TODO(analytics): the founder's rule is the five best-performing stories; rank by performance once analytics are
 * mapped to this workflow. Until then, recency, and the requester's choice when more qualify.
 */
export function icymiStory(posts: PostRow[], window: { startMs: number; endMs: number; label: string }, size = { min: 1, max: ICYMI_MAX }): Story[] | { hold: string } {
  const at = (p: PostRow) => p.publishedAt ? Date.parse(p.publishedAt) : NaN
  // DT101 posts are told by their mission-brief caption too: older manual ones aren't titled DT101 (gate round 1, ULTRA).
  const exclude = new RegExp(BRAND.posts.roundupExclude, "i"), excludeCaption = new RegExp(BRAND.posts.roundupExcludeCaption, "i")
  const eligible = posts.filter(p => publishedPost(p) && !exclude.test(p.title) && p.caption && !excludeCaption.test(p.caption) && at(p) >= window.startMs && at(p) < window.endMs)
    .sort((a, b) => at(b) - at(a))
    .filter((p, i, all) => all.findIndex(x => x.title.trim().toLowerCase() === p.title.trim().toLowerCase()) === i)
  const withCard = eligible.filter(p => p.card && /^https:\/\//.test(p.card.url)).slice(0, MAX_CHOICES)
  if (!eligible.length) return { hold: `no ${BRAND.shortName} News or Breaking story was published in ${window.label}, so there is no ICYMI` }
  if (withCard.length < size.min) return { hold: `only ${withCard.length} ${BRAND.shortName} News or Breaking ${withCard.length === 1 ? "story" : "stories"} with a published card ${withCard.length === 1 ? "was" : "were"} published in ${window.label}${eligible.length > withCard.length ? ` (${eligible.length - withCard.length} more without a staged card)` : ""}, and an ICYMI takes at least ${size.min}, so there is no ICYMI` }
  return [roundupStory(withCard.map(p => ({
    postId: p.id, title: p.title, caption: (p.caption || "").split("\n").filter(l => !/^Image: /.test(l) && l !== DOD_NOTICE).join("\n").trim().slice(0, 800), ...(p.publishedUrl ? { publishedUrl: p.publishedUrl } : {}), ...(p.publishedAt ? { publishedAt: p.publishedAt } : {}), ...(p.media?.[0] ? { media: p.media[0] } : {}), card: p.card!,
  })), window.label)]
}
/**
 * A title that still says the post is a review draft (the Slack pilot's "MCU-BN-20261009-02 | Marconi … | REVIEW
 * DRAFT", gate round 6): whatever its status, it was never published as it stands. The pilot's marker is a title segment
 * of its own, after a "|"; a headline that merely mentions a review draft ("DoD opens review draft of CMMC rule") is not.
 */
export const REVIEW_DRAFT_TITLE = /\|\s*review[\s_-]*draft\s*(\||$)/i
/**
 * Whether a post is truly published, for ICYMI (gate round 6): its status is posted (a published link alone isn't
 * enough: any editor can set one) and its title doesn't mark it a review draft. The engine decides this, never the
 * writer; with the staged card icymiStory also requires, it is what makes a story eligible.
 */
export function publishedPost(p: Pick<PostRow, "status" | "title">): boolean {
  return p.status === "posted" && !REVIEW_DRAFT_TITLE.test(p.title)
}
/** The roundup's story: its source is the stories' own titles and captions, in order. */
function roundupStory(items: RoundupItem[], label: string): Story {
  return { title: "ICYMI roundup", primaryUrl: items[0]?.publishedUrl || BRAND.posts.homeUrl, publisher: BRAND.name, sourceTitle: `${items.length} published ${BRAND.shortName} ${items.length === 1 ? "story" : "stories"} from ${label}`, sourceText: items.map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n"), roundup: items }
}
/**
 * The requester's choice for an ICYMI draft waiting on one (the Admin's picker): min–max of the candidates, kept in
 * the roundup's order (newest first). The draft then runs like any roundup. Returns why a choice is refused.
 */
export interface ChoiceTasks { close(taskId: string, note: string): Promise<void> }
export async function chooseRoundup(store: McuStore, draftId: string, postIds: string[], by: string, nowIso: string, tasks?: ChoiceTasks): Promise<{ ok: true } | { error: string }> {
  const d = await store.getDraft(draftId)
  if (!d || d.kind !== "icymi") return { error: "No ICYMI draft with that id" }
  if (d.status !== "choosing") return { error: "This draft is not waiting for a choice" }
  const { min, max } = d.choice ?? roundupSize(), picked = new Set(postIds), items = d.story.roundup ?? []
  if (picked.size !== postIds.length || postIds.some(id => !items.some(p => p.postId === id))) return { error: "Choose stories offered on this draft, each once" }
  if (picked.size < min || picked.size > max) return { error: `Choose ${min}–${max} stories` }
  const label = d.story.sourceTitle.replace(/^\d+ published \S+ (stories|story) from /, "")
  d.story = roundupStory(items.filter(p => picked.has(p.postId)), label)
  d.choice = { ...d.choice!, min, max, chosenBy: by, chosenAt: nowIso }
  d.status = "queued"; d.updatedAt = nowIso
  d.history.push({ at: nowIso, event: `${picked.size} stories chosen by ${by}` })
  await store.saveDraft(d); await store.release("draft", draftId, true)
  const job = await store.getJob(d.jobId)
  if (job) await store.saveJob({ ...job, note: `${picked.size} stories chosen by ${by}`, updatedAt: nowIso })
  await closeTask(tasks, d, `Done: ${picked.size} stories chosen by ${by} at ${nowIso} (${postIds.join(", ")}). The ICYMI draft ${d.id} is running.`)
  return { ok: true }
}
/** The choice's CRM task closes with what happened; a failure is logged and never undoes the draft's change. */
async function closeTask(tasks: ChoiceTasks | undefined, d: McuDraft, note: string): Promise<void> {
  if (!tasks || !d.choice?.taskId) return
  await tasks.close(d.choice.taskId, note).catch(err => console.error("[content-pipeline] choice task not closed", d.id, err instanceof Error ? err.message : err))
}
/**
 * An ICYMI draft waiting for a choice that ends without one: closed by the requester in the Admin, or superseded by a
 * new ICYMI request. The draft is held with the reason, its job settles, and its CRM task closes with that reason.
 */
export async function closeRoundup(store: McuStore, draftId: string, by: string, nowIso: string, reason: string, tasks?: ChoiceTasks): Promise<{ ok: true } | { error: string }> {
  const d = await store.getDraft(draftId)
  if (!d || d.kind !== "icymi") return { error: "No ICYMI draft with that id" }
  if (d.status !== "choosing") return { error: "This draft is not waiting for a choice" }
  d.status = "held"; d.holdReason = `no stories chosen: ${reason}`; d.updatedAt = nowIso
  d.choice = { ...d.choice!, closedBy: by, closedAt: nowIso, closedReason: reason }
  d.history.push({ at: nowIso, event: `closed by ${by} without a choice: ${reason}` })
  await store.saveDraft(d)
  const job = await store.getJob(d.jobId)
  if (job && job.status === "drafting") await store.saveJob({ ...job, status: "done", note: `No stories chosen: ${reason}`, notifiedAt: job.notifiedAt ?? nowIso, updatedAt: nowIso })
  await closeTask(tasks, d, `Closed without a choice by ${by} at ${nowIso}: ${reason}.`)
  return { ok: true }
}

/** On a hold, `tried` and `triedUrls` name the candidates that were dropped, so a second pass can avoid them. */
async function researchStories(deps: WorkerDeps, ai: McuAi, job: Pick<McuJob, "kind" | "count" | "topic">, recentTitles: string[], seeds: McuSeeds | null, avoid: string[] = [], avoidUrls: string[] = [], inFlight: { titles: string[]; urls: Set<string> } = { titles: [], urls: new Set() }, limit = job.count): Promise<Story[] | { hold: string; tried?: string[]; triedUrls?: string[] }> {
  const today = iso(deps).slice(0, 10)
  const r = await ai.research({ kind: job.kind, count: job.count, ...(job.topic ? { topic: job.topic } : {}), today, recentTitles, seeds, ...(avoid.length ? { avoid } : {}), ...(inFlight.titles.length ? { drafting: inFlight.titles } : {}) })
  const stories: Story[] = [], dropped: string[] = [], outlets = (seeds?.orgs ?? []).filter(o => o.kind === BRAND.seeds.outletKind).map(o => o.site)
  for (const c of r.candidates) {
    if (stories.length >= limit) break
    // The primary page first, then other primary pages for the same subject (product page, .mil/.gov page, press
    // release), so one unreadable page doesn't drop the subject. Each miss keeps its reason for the hold note.
    if (avoidUrls.includes(c.primaryUrl)) { dropped.push(`${c.title}: already tried`); continue }
    if (inFlight.urls.has(normalizeUrl(c.primaryUrl))) { dropped.push(`${c.title}: already being drafted`); continue }
    let page: SourcePage | null = null, publishedAt: string | undefined, dating: { reportedAt: string; datedBy: { url: string; publishedAt: string } } | undefined
    const misses: string[] = [], readVia: string[] = [], rule = BRAND.requestKinds.find(k => k.kind === job.kind)
    // The story is sourced from its primary page: an outlet's article only led to it (gate round 2: two DT101 cards
    // sourced from Defense News). Outlet URLs are skipped; another primary page for the subject is tried instead.
    for (const url of [...new Set([c.primaryUrl, ...(c.alternateUrls ?? [])])].slice(0, 5)) {
      if (isOutlet(url, outlets)) { misses.push(`${url} is a news outlet's article, not the primary source`); continue }
      let p: SourcePage, viaSearch = false
      try { p = await deps.fetchPage(url) } catch (err) {
        const reason = err instanceof Error ? err.message : "unreachable"
        // An official page that refuses the pipeline's fetch (faa.gov, defense.gov, war.gov in round 3) is read from
        // the search tool's extracted content instead (founder, 2026-10-18): that exact page only, never an outlet
        // (skipped above), and no browser user agent is spoofed.
        const read = /^http_(401|403|429)$/.test(reason) && ai.readRefusedPage ? await ai.readRefusedPage(url).catch(() => null) : null
        if (!read) { misses.push(`${reason} at ${url}`); continue }
        p = read; viaSearch = true
      }
      if (p.text.length < 400) { misses.push(`no readable article at ${url}${viaSearch ? " (read through the search tool)" : ""}`); continue }
      // The search's date stands in only for the page it described, never for an alternate.
      const date = normalizeDate(p.publishedAt) ?? (url === c.primaryUrl ? normalizeDate(c.publishedAt) : undefined)
      const stale = staleSource(job.kind, date, deps.nowMs())
      if (stale) {
        // News may be dated by an outlet's recent report of the same event (founder, 2026-10-18), never cited.
        const dated = rule?.datedByReport && rule.recencyDays ? await reportDating(deps, ai, c, p, outlets, { days: rule.recencyDays }) : { why: "" }
        if (!("reportedAt" in dated)) { misses.push(`${url} ${stale}${dated.why ? `; ${dated.why}` : ""}`); continue }
        dating = dated
      }
      if (viaSearch) readVia.push(url)
      page = p; publishedAt = date; break
    }
    if (!page) { dropped.push(`${c.title}: source page unreachable, unreadable or out of date (${misses.join("; ").slice(0, 300)})`); continue }
    let fresh: Story["fresh"]
    if (rule?.freshHours) {
      // Breaking freshness (founder, 2026-10-18), checked against exact times read from the pages, never the model's.
      const f = await breakingFreshness(deps, ai, c, page, outlets, rule)
      if ("why" in f) { dropped.push(`${c.title}: ${f.why}, so it isn't ${rule.label}; it may run as News`); continue }
      fresh = f.fresh
      if (f.dating) dating = f.dating
    }
    if (job.kind === "breaking" && !c.whyNow) { dropped.push(`${c.title}: no sourced why-now sentence`); continue }
    if (stories.some(s => normalizeUrl(s.primaryUrl) === normalizeUrl(page.url)) || avoidUrls.includes(page.url) || inFlight.urls.has(normalizeUrl(page.url))) { dropped.push(`${c.title}: already used, rejected or being drafted`); continue }
    // Supporting pages fill what the primary leaves out (a DT101 card needs the maker and its headquarters, which an
    // Army article often omits: live test, 2026-10-16). Unreachable ones are skipped; the primary still decides.
    const supporting: SourcePage[] = []
    for (const u of (c.supportingUrls ?? []).slice(0, MAX_SUPPORTING)) {
      if (isOutlet(u, outlets)) continue
      // A supporting page must be about the same subject (round 2 attached an unrelated Northrop Raid Hunter release).
      try { const sp = await deps.fetchPage(u); if (sp.text.length >= 200 && sp.url !== page.url && (COMPANY_PAGE.test(new URL(sp.url).pathname) || sameSubject(c.title, `${sp.title} ${sp.text.slice(0, 6000)}`))) supporting.push(sp) } catch { /* skipped */ }
    }
    const sourceText = storySourceText(page, supporting)
    const story: Story = { title: c.title, primaryUrl: page.url, publisher: c.publisher || page.siteName || new URL(page.url).hostname, ...(publishedAt ? { publishedAt } : {}), ...(dating ?? {}), ...(fresh ? { fresh } : {}), ...(readVia.length ? { readViaSearch: readVia } : {}), ...(job.kind === "breaking" && c.whyNow ? { whyNow: c.whyNow } : {}), sourceTitle: page.title || c.title, sourceText, ...(supporting.length ? { supporting: supporting.map(sp => ({ url: sp.url, title: sp.title || sp.url })) } : {}) }
    stories.push(story)
  }
  // The model's note is chatter about how it chose ("Candidates selected based on relevance…", round 2) unless it is
  // the only explanation, when nothing was found.
  if (!stories.length) return { hold: [r.candidates.length ? "" : r.note, ...dropped].filter(Boolean).join("; ") || "no candidates found", tried: [...avoid, ...r.candidates.map(c => c.title)], triedUrls: [...avoidUrls, ...r.candidates.map(c => c.primaryUrl)] }
  return stories
}
/** A story's source text: the primary page, then each supporting page under its own heading (the replay set builds its stories the same way). */
export function storySourceText(page: SourcePage, supporting: SourcePage[]): string {
  return supporting.length ? [page.text.slice(0, 16_000), ...supporting.map(sp => `--- SUPPORTING SOURCE: ${sp.title || sp.url} (${sp.url}) ---\n${sp.text.slice(0, 4_000)}`)].join("\n\n") : page.text
}
/**
 * Whether a news outlet's report dates a story whose official page is older or undated (founder, 2026-10-18): the
 * report is an outlet's, it is read, its own date (else the search's) is within `days`, it names the story's subject,
 * and the model judges that the official page describes the same event the report covers, not an older announcement
 * the report only mentions. The outlet dates the story and is never cited.
 */
async function reportDating(deps: WorkerDeps, ai: McuAi, c: Pick<Candidate, "title" | "reportUrl" | "reportPublishedAt">, primary: SourcePage, outlets: string[], within: { days: number } | { hours: number }): Promise<{ reportedAt: string; datedBy: { url: string; publishedAt: string } } | { why: string }> {
  if (!c.reportUrl || !/^https:\/\//.test(c.reportUrl)) return { why: "" }
  if (!isOutlet(c.reportUrl, outlets)) return { why: "the report named is not a news outlet's" }
  let report: SourcePage
  try { report = await deps.fetchPage(c.reportUrl) } catch (err) { return { why: `the outlet's report couldn't be read (${err instanceof Error ? err.message : "unreachable"})` } }
  let at: string | undefined
  if ("hours" in within) {
    // An hours window needs the report page's own exact time; a date, or the model's reading of it, is not enough.
    const t = exactTime(report.publishedAt)
    if (t === null) return { why: "the outlet's report shows no exact publish time" }
    if (!withinHours(t, deps.nowMs(), within.hours)) return { why: `the outlet's report (${report.publishedAt}) is more than ${within.hours} hours old` }
    at = new Date(t).toISOString()
  } else {
    at = normalizeDate(report.publishedAt) ?? normalizeDate(c.reportPublishedAt)
    if (!at || staleSource("news", at, deps.nowMs(), within.days)) return { why: `the outlet's report is not from the last ${within.days} days` }
  }
  if (!sameSubject(c.title, `${report.title} ${report.text.slice(0, 8000)}`)) return { why: "the outlet's report is not about this story" }
  const judged = ai.sameEvent ? await ai.sameEvent({ report: { ...report, publishedAt: at }, primary }).catch(() => null) : null
  if (!judged?.same) return { why: `the official page is not the event the outlet reported${judged?.reason ? ` (${judged.reason.slice(0, 160)})` : ""}` }
  return { reportedAt: "hours" in within ? zonedDay(Date.parse(at), BRAND.timeZone) : at, datedBy: { url: report.url, publishedAt: at } }
}
/**
 * A machine-readable time with a time of day, as UTC milliseconds; null for a date alone or nothing. A time with no
 * zone is read at its earliest possible moment (UTC+14), so it can only look older than it is, never fresher.
 */
export function exactTime(v: string | undefined): number | null {
  const s = v?.trim()
  if (!s || !/\d{1,2}:\d{2}/.test(s)) return null
  const zoned = /(?:Z|[+-]\d{2}:?\d{2}|\b(?:UTC|GMT|[ECMP][SD]T))$/i.test(s)
  const t = zoned ? Date.parse(s) : /^\d{4}-\d{2}-\d{2}[T ]/.test(s) ? Date.parse(`${s.replace(" ", "T")}Z`) - 14 * 3600_000 : Date.parse(`${s} UTC`) - 14 * 3600_000
  return Number.isFinite(t) ? t : null
}
const withinHours = (t: number, nowMs: number, hours: number) => t <= nowMs + 15 * 60_000 && nowMs - t <= hours * 3600_000
/** The calendar day (YYYY-MM-DD) of an instant in a time zone (the brand's; UTC when it has none). */
export function zonedDay(ms: number, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(ms)
}
/**
 * Breaking freshness (founder, 2026-10-18), in order: the official page's machine-readable publish time, when it
 * carries a time of day; otherwise a news outlet's report of the same event with an exact time (it dates the story and
 * is never cited); if neither shows the story is within the window, it isn't Breaking, and it may run as News. A
 * date-only byline never qualifies on its own: it is recorded only as a cross-check, which counts only when it is
 * today in the brand's time zone.
 */
export async function breakingFreshness(deps: WorkerDeps, ai: McuAi, c: Pick<Candidate, "title" | "publishedAt" | "reportUrl" | "reportPublishedAt">, page: SourcePage, outlets: string[], rule: { freshHours?: number; datedByReport?: boolean }): Promise<{ fresh: NonNullable<Story["fresh"]>; dating?: { reportedAt: string; datedBy: { url: string; publishedAt: string } } } | { why: string }> {
  const hours = rule.freshHours ?? 24, now = deps.nowMs(), zone = BRAND.timeZone
  const dateOnly = exactTime(page.publishedAt) === null ? normalizeDate(page.publishedAt) ?? normalizeDate(c.publishedAt) : undefined
  const byline = dateOnly ? { byline: dateOnly, bylineToday: dateOnly === zonedDay(now, zone) } : {}
  const official = exactTime(page.publishedAt)
  if (official !== null) {
    if (!withinHours(official, now, hours)) return { why: `the official page's publish time (${page.publishedAt}) is more than ${hours} hours old` }
    return { fresh: { at: new Date(official).toISOString(), how: "official" } }
  }
  const dated = rule.datedByReport ? await reportDating(deps, ai, c, page, outlets, { hours }) : { why: "" }
  if ("reportedAt" in dated) return { fresh: { at: dated.datedBy.publishedAt, how: "report", ...byline }, dating: dated }
  const date = dateOnly ? `only a date (${dateOnly}${byline.bylineToday ? `, today in ${zone}, which is a cross-check, never enough on its own` : ""})` : "no publish time"
  return { why: `the official page shows ${date}, and no news report of the same event shows an exact time within ${hours} hours${dated.why ? ` (${dated.why})` : ""}` }
}
/** A maker's own about page: kept as a supporting source for the headquarters even though it doesn't name the product. */
const COMPANY_PAGE = /\/(about|about-us|who-we-are|company|our-company|contact|contact-us|locations|leadership|overview)(\/|$)/i
const COMMON = new Set(["the", "and", "for", "with", "from", "into", "first", "new", "army", "navy", "air", "force", "space", "marine", "corps", "defense", "system", "systems", "contract", "awarded", "awards", "wins", "test", "tests", "flight", "company", "program", "announces", "unveils", "completes", "fully", "next", "generation", "u.s", "us"])
/** Whether a page is about the story's subject: it names a model designation from the title or two of its distinctive words. */
export function sameSubject(title: string, text: string): boolean {
  const hay = text.toLowerCase()
  const tokens = [...new Set(title.toLowerCase().match(/[a-z0-9][a-z0-9.\-]*[a-z0-9]/g) ?? [])]
  const words = tokens.filter(w => w.length >= 3 && !COMMON.has(w))
  // A model designation names the subject however short it is (C2, F-35, YFQ-48A).
  const designations = tokens.filter(w => /\d/.test(w) && /[a-z]/.test(w))
  if (designations.some(w => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}([^a-z0-9]|$)`).test(hay))) return true
  return words.filter(w => !/\d/.test(w) && hay.includes(w)).length >= 2
}
export function normalizeDate(v: string | undefined): string | undefined {
  if (!v) return undefined
  const t = Date.parse(v)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : undefined
}

// ── drafts ──
async function draftStep(deps: WorkerDeps, id: string, attempt: number): Promise<void> {
  const d = await deps.store.getDraft(id)
  if (!d || !WORKING.includes(d.status)) { await deps.store.release("draft", id, false); return }
  if (attempt > MAX_ATTEMPTS) {
    const step = d.status
    d.status = "failed"; d.error = d.error || `the ${step} step kept failing`
    await save(deps, d, `failed at ${step}`); await deps.store.release("draft", id, false)
    await maybeNotify(deps, d.jobId)
    return
  }
  const ai = deps.ai(c => { d.calls = [...(d.calls ?? []), { ...c, at: iso(deps) }].slice(-40) })
  try {
    switch (d.status) {
      case "queued": case "writing": if (d.replacing) await replaceStep(deps, ai, d); else await writeStep(deps, ai, d); break
      case "media": await mediaStep(deps, ai, d); break
      case "designing": await designStep(deps, d); break
      case "reviewing": await reviewStep(deps, ai, d); break
      case "posting": await postStep(deps, d); break
    }
    // The step went through, so an earlier failure is no longer the draft's state.
    if (d.error) { d.error = undefined; await deps.store.saveDraft(d) }
    await deps.store.release("draft", id, WORKING.includes(d.status))
    if (!WORKING.includes(d.status)) await maybeNotify(deps, d.jobId)
  } catch (err) {
    d.error = err instanceof Error ? err.message.slice(0, 300) : "error"
    console.error("[content-pipeline] step failed", d.id, d.status, d.error)
    if (attempt >= MAX_ATTEMPTS) {
      // The last attempt: the draft shows as failed with its error now, not as still working.
      const step = d.status
      d.status = "failed"; d.error = `the ${step} step failed ${attempt} times; last error: ${d.error}`.slice(0, 400)
      await save(deps, d, `failed at ${step}`).catch(() => {}); await deps.store.release("draft", id, false).catch(() => {})
      await maybeNotify(deps, d.jobId).catch(() => {})
      return
    }
    await save(deps, d, `step ${d.status} failed: ${d.error}`).catch(() => {})
    // Retried by a later run after RETRY_MS (bounded by MAX_ATTEMPTS).
    await deps.store.backoff("draft", id, deps.nowMs() + RETRY_MS).catch(() => {})
  }
}
async function save(deps: WorkerDeps, d: McuDraft, event: string): Promise<void> {
  d.updatedAt = iso(deps); d.history.push({ at: d.updatedAt, event }); d.history = d.history.slice(-60)
  await deps.store.saveDraft(d)
}
async function hold(deps: WorkerDeps, d: McuDraft, reason: string): Promise<void> {
  d.status = "held"; d.holdReason = reason
  await save(deps, d, `held: ${reason}`)
}

/** When every draft of a job has settled, the one "N drafts ready" alert goes out. */
async function maybeNotify(deps: WorkerDeps, jobId: string): Promise<void> {
  const job = await deps.store.getJob(jobId)
  if (!job || job.notifiedAt || job.status !== "drafting") return
  const drafts = (await Promise.all(job.drafts.map(id => deps.store.getDraft(id)))).filter((x): x is McuDraft => !!x)
  if (drafts.length < job.drafts.length || drafts.some(x => WORKING.includes(x.status) || x.status === "choosing")) return
  job.status = "done"; job.notifiedAt = iso(deps); job.updatedAt = job.notifiedAt
  await deps.store.saveJob(job)
  await deps.notify(job, drafts).catch(err => console.error("[content-pipeline] notify failed", jobId, err instanceof Error ? err.message : err))
}

/** Every number on the card or in the caption must appear in the source text (dates excepted). */
export function unsourcedNumbers(texts: string[], source: string): string[] {
  const norm = (s: string) => s.replace(/[,\s]/g, "")
  const hay = norm(source)
  const found = texts.join(" ").match(/\$?\d[\d,.]*\s?(?:million|billion|trillion|[MBK%])?/gi) ?? []
  return [...new Set(found.map(n => n.trim()))].filter(n => {
    const digits = n.replace(/[^\d.]/g, "").replace(/\.$/, "")
    if (!digits || /^(19|20)\d{2}$/.test(digits) || /^\d{1,2}$/.test(digits) && Number(digits) <= 31) return false // years, days, small counts
    return !hay.includes(norm(digits))
  })
}

/** Text as it is compared for a quote: lowercase letters and digits, every other run of characters one space. */
const quoteText = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim()
/**
 * The extracted facts the source bears out: each fact's quoted sentence must be found in the source text, compared as
 * quoteText (case, punctuation and spacing aside). A fact whose quote isn't there, or is too short to show anything
 * (under four words), is dropped. Duplicates are dropped too.
 */
export function sourcedFacts(facts: readonly { fact?: unknown; quote?: unknown }[], source: string): { kept: SourcedFact[]; dropped: string[] } {
  const hay = ` ${quoteText(source)} `, kept: SourcedFact[] = [], dropped: string[] = []
  for (const f of facts) {
    const fact = typeof f.fact === "string" ? f.fact.trim() : "", quote = typeof f.quote === "string" ? f.quote.trim() : ""
    if (!fact) continue
    const q = quoteText(quote)
    if (q.split(" ").length < 4 || !hay.includes(` ${q} `)) { dropped.push(fact); continue }
    if (!kept.some(k => k.fact === fact)) kept.push({ fact, quote })
  }
  return { kept, dropped }
}
/** Fewer sourced facts than this and the writer writes from the source text, as before fact extraction. */
export const MIN_FACTS = 2
/**
 * Fact extraction before the first write of a story (plan v10, Phase 1 direction 3). The facts are kept on the story,
 * so the rewrites, the fit and the fresh wording write from the same facts, and a switched story extracts its own. An
 * extraction that fails, or finds fewer than MIN_FACTS sourced facts, leaves the writer on the source text as before,
 * and the history says so. A roundup is written from its published posts, so it extracts nothing.
 */
async function extractFacts(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  if (d.story.roundup || d.story.facts || !ai.extractFacts) return
  const r = await ai.extractFacts({ story: d.story }).catch(err => { console.error("[content-pipeline] fact extraction failed", d.id, err instanceof Error ? err.message : err); return null })
  if (!r) { d.history.push({ at: iso(deps), event: "fact extraction failed; writing from the source text" }); return }
  const { kept, dropped } = sourcedFacts(Array.isArray(r.facts) ? r.facts : [], d.story.sourceText)
  const note = dropped.length ? `; dropped ${dropped.length} whose sentence isn't in the source: ${dropped.slice(0, 4).map(f => `"${f.slice(0, 80)}"`).join(", ")}` : ""
  if (kept.length < MIN_FACTS) { d.history.push({ at: iso(deps), event: `fact extraction found ${kept.length} sourced fact${kept.length === 1 ? "" : "s"}${note}; writing from the source text` }); return }
  d.story.facts = kept
  d.history.push({ at: iso(deps), event: `facts extracted: ${kept.length}${note}`.slice(0, 600) })
}

async function writeStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const today = iso(deps).slice(0, 10)
  await extractFacts(deps, ai, d)
  let problems: string[] = []
  const seeds = await deps.seeds(), steer = { seeds, ...(d.direction ? { direction: d.direction } : {}) }
  // A roundup's stories were chosen by the engine (icymiStory: published, with a staged card), so a writer that holds
  // one on eligibility is overruled and logged, never obeyed (gate round 6: it held on a "REVIEW DRAFT" title).
  const writerHold = (o: { hold?: string }) => {
    const h = meaningful(o.hold) // "None" is no hold (gate round 3: it replaced a subject)
    if (h && d.kind === "icymi") { d.history.push({ at: iso(deps), event: `the writer asked to hold the roundup ("${h.slice(0, 200)}"); overruled: the engine decides which stories qualify` }); return undefined }
    return h
  }
  // Each write offers candidates for the headline or hook and the sub-headline; the one that goes on is chosen here.
  const batches = { left: MAX_CANDIDATE_BATCHES }
  const pick = (o: Awaited<ReturnType<McuAi["write"]>>) => writerHold(o) ? o : chooseCopy(deps, ai, d, o, today, steer, batches)
  let out = await pick(await ai.write({ kind: d.kind, story: d.story, today, ...steer, ...(d.frames.length ? { previous: { frames: d.frames, caption: d.caption ?? "" } } : {}) }))
  for (let round = 0; round < 2; round++) {
    out.hold = writerHold(out)
    if (out.hold) return sourceHold(deps, ai, d, out.hold)
    out.frames = out.frames.map((f, i) => fix(f, i, d, today))
    problems = validate(out.frames, out.caption, d.story)
    if (!problems.length) break
    out = await pick(await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames: out.frames, caption: out.caption }, problems }))
  }
  out.hold = writerHold(out)
  if (out.hold) return sourceHold(deps, ai, d, out.hold)
  out.frames = out.frames.map((f, i) => fix(f, i, d, today))
  // The v9 hold bar: only a safety problem holds the draft; a style problem left after the rewrites goes to Review as a
  // note (copyProblems).
  const safetyOf = (o: typeof out) => copyProblems(o.frames, o.caption, d.story).safety
  problems = safetyOf(out)
  // Only copied wording or length is left: before holding, ask for fresh wording of just the fields that copy the
  // source (gate round 6), then for shorter wording of just the fields that run over (gate round 5).
  const targeted = (ps: string[], o: typeof out) => ps.every(p => overflow(o.frames).some(x => x.message === p) || copiedFields(o.frames, o.caption, d.story).some(x => x.message === p))
  if (problems.length && targeted(problems, out)) {
    const attempts: string[] = []
    if (copiedFields(out.frames, out.caption, d.story).length) {
      const fresh = await freshStep(ai, d, out, today, steer)
      if (fresh.tries) { out = fresh.out; problems = safetyOf(out); attempts.push(`${fresh.tries} rewording attempt${fresh.tries === 1 ? "" : "s"}`) }
    }
    if (problems.length && problems.every(p => overflow(out.frames).some(o => o.message === p))) {
      const fitted = await fitStep(ai, d, out, today, steer)
      if (fitted.tries) { out = fitted.out; problems = safetyOf(out); attempts.push(`${fitted.tries} shortening attempt${fitted.tries === 1 ? "" : "s"}`) }
    }
    if (problems.length && attempts.length) return hold(deps, d, `the copy still breaks the template rules after two rewrites and ${attempts.join(" and ")}: ${problems.slice(0, 4).join("; ")}`)
  }
  if (problems.length) return hold(deps, d, `the copy still breaks the template rules after two rewrites: ${problems.slice(0, 4).join("; ")}`)
  const style = copyProblems(out.frames, out.caption, d.story).style
  d.frames = out.frames; d.caption = out.caption; d.holdReason = undefined; d.error = undefined
  d.copyNotes = style.length ? style : undefined
  d.status = d.media.length === d.frames.length && d.media.every(Boolean) ? "designing" : "media"
  await save(deps, d, `copy written (v${d.version})${style.length ? `; to Review with ${style.length} style note${style.length === 1 ? "" : "s"}: ${style.join("; ").slice(0, 300)}` : ""}`)
}
/** New candidate batches asked for, per write step, when none of the writer's candidates fits. */
export const MAX_CANDIDATE_BATCHES = 2
/**
 * What keeps one candidate off the card, measured in code (plan v9, Phase 1 direction 2): its fields past the
 * template's limits (per-line width and line count, as overLimits words them: the field, the limit and the measured
 * length), a figure the source doesn't give, an abbreviated or cut-off word, and wording copied from the source past
 * the profile's originality limits (unchanged). The candidate is normalized first, as the card would set it: uppercase,
 * and a fixed-line hook re-broken where its words fit another way (fitLines). Nothing is stripped or cut.
 */
export function candidateProblems(frame: FrameCopy, option: Record<string, string>, fields: string[], story: Story, normalize: (f: FrameCopy) => FrameCopy): { frame: FrameCopy; problems: string[] } {
  const series = SERIES[frame.series]
  const set = normalize({ ...frame, fields: { ...frame.fields, ...Object.fromEntries(fields.map(n => [n, typeof option[n] === "string" ? option[n] : ""])) } })
  const own = Object.fromEntries(fields.map(n => [n, set.fields[n] ?? ""]))
  const problems: string[] = []
  for (const spec of series.fields.filter(f => fields.includes(f.name))) {
    const v = own[spec.name]
    if (!v.trim()) { problems.push(`${spec.label} is empty`); continue }
    if (spec.exactLines && v.split("\n").map(l => l.trim()).filter(Boolean).length !== spec.exactLines) problems.push(`${spec.label} must be exactly ${spec.exactLines} lines`)
    problems.push(...overLimits(spec, v))
  }
  const nums = unsourcedNumbers(Object.values(own), story.sourceText)
  if (nums.length) problems.push(`these figures are not in the source: ${nums.join(", ")}`)
  const cut = [...new Set([...clippedWords(own, story.sourceText), ...cutOffWords(own, story.sourceText)])]
  if (cut.length) problems.push(`abbreviated or cut-off words (${cut.join(", ")}): use whole words`)
  problems.push(...copiedFields([set], "", story).filter(c => fields.includes(c.field)).map(c => c.message))
  return { frame: set, problems }
}
/**
 * Copy from candidates (plan v9, Phase 1 direction 2). The writer offers its first choice and 3–5 alternatives for the
 * candidate fields (series.ts candidateFields). Each is measured in code (candidateProblems); a model picks the most
 * compelling of those that fit (McuAi.pickCopy; without one, the writer's order stands). When none fits, the writer is
 * asked for a new batch, told each candidate's exact overflow (field, limit, length), up to MAX_CANDIDATE_BATCHES per
 * write step. When none fits even then, the writer's first choice goes on to the rewrites and the fit pass, as before.
 * Only the candidate fields change here; a writer that offers no candidates is taken as it wrote.
 */
async function chooseCopy(deps: WorkerDeps, ai: McuAi, d: McuDraft, out: Awaited<ReturnType<McuAi["write"]>>, today: string, steer: { seeds: McuSeeds | null; direction?: string }, batches: { left: number }): Promise<Awaited<ReturnType<McuAi["write"]>>> {
  const frames = out.frames.map(f => ({ ...f, fields: { ...f.fields } }))
  const offered = (r: Awaited<ReturnType<McuAi["write"]>>, i: number, fields: string[]) => {
    const all = [Object.fromEntries(fields.map(n => [n, r.frames[i]?.fields[n] ?? ""])), ...(r.options?.[i] ?? [])]
    return all.filter((o, k) => fields.some(n => (o[n] ?? "").trim()) && all.findIndex(x => fields.every(n => (x[n] ?? "").trim() === (o[n] ?? "").trim())) === k)
  }
  for (const [i, f] of frames.entries()) {
    const fields = candidateFields(f.series)
    if (!fields.length || !out.options?.[i]?.length) continue
    const measure = (o: Record<string, string>) => candidateProblems(frames[i], o, fields, d.story, x => fix(x, i, d, today))
    let pool = offered(out, i, fields), measured = pool.map(measure), asked = 0
    while (!measured.some(m => !m.problems.length) && batches.left > 0) {
      batches.left--; asked++
      const batch = measured.flatMap((m, k) => m.problems.map(p => `candidate ${k + 1} (${fields.map(n => `"${(m.frame.fields[n] ?? "").replace(/\n/g, " / ")}"`).join(", ")}): ${p}`))
      const r = await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames, caption: out.caption }, batch })
      pool = offered(r, i, fields); measured = pool.map(measure)
    }
    const fitting = measured.map((m, k) => ({ ...m, k })).filter(m => !m.problems.length)
    const tally = `${pool.length} candidate${pool.length === 1 ? "" : "s"}${asked ? ` after ${asked} new batch${asked === 1 ? "" : "es"}` : ""}, ${fitting.length} fit`
    if (!fitting.length) { d.history.push({ at: iso(deps), event: `copy candidates: ${tally}; the writer's first choice goes on to the rewrites` }); continue }
    let chosen = fitting[0], why = "the only one that fits"
    if (fitting.length > 1) {
      why = "the writer's order (no pick)"
      if (ai.pickCopy) {
        const r = await ai.pickCopy({ kind: d.kind, story: d.story, frame: frames[i], fields, options: fitting.map(m => Object.fromEntries(fields.map(n => [n, m.frame.fields[n]]))) })
          .catch(err => { console.error("[content-pipeline] copy pick failed", d.id, err instanceof Error ? err.message : err); return null })
        if (r) { chosen = fitting[r.index] ?? fitting[0]; why = r.reason || "picked" }
        else why = "the writer's order (the pick failed)"
      }
    }
    for (const n of fields) frames[i].fields[n] = chosen.frame.fields[n]
    d.history.push({ at: iso(deps), event: `copy candidates: ${tally}; chose ${chosen.k + 1} (${fields.map(n => `"${chosen.frame.fields[n].replace(/\n/g, " / ")}"`).join(", ")}): ${why}`.slice(0, 600) })
  }
  return { ...out, frames, options: undefined }
}
/** A problem's rule, without the copy it quotes (a caption label such as "Tech:" is kept: it names the rule). */
const ruleOf = (p: string) => p.replace(/"(?![A-Za-z]+:")[^"]*"/g, '""')
/**
 * What a fit or a rewording would break: every safety problem it leaves, and a style problem only when the copy before
 * it didn't already have that rule's problem (coordinator review, 2026-10-19). Style isn't a hold (copyProblems), so a
 * style problem the writer was told to leave alone, such as a caption with no "Tech:" line, never turns a shortening
 * down; a shortening that adds one ("EYES ON. / SQUAD SEES ALL") still is.
 */
function introduced(after: { frames: FrameCopy[]; caption: string }, before: { frames: FrameCopy[]; caption: string }, story: Story): string[] {
  const now = copyProblems(after.frames, after.caption, story), had = new Set(copyProblems(before.frames, before.caption, story).style.map(ruleOf))
  return [...now.safety, ...now.style.filter(p => !had.has(ruleOf(p)))]
}
/** Shortening attempts after the rewrites, before a draft is held for length alone. */
export const MAX_FIT_ATTEMPTS = 3
/** Each field that runs past its limits, with the measured problem (as validate words it). */
function overflow(frames: FrameCopy[]): { frame: number; field: string; message: string }[] {
  return frames.flatMap((f, i) => SERIES[f.series].fields.flatMap(spec => typeof f.fields[spec.name] === "string" && f.fields[spec.name].trim()
    ? overLimits(spec, f.fields[spec.name]).map(m => ({ frame: i, field: spec.name, message: frames.length > 1 ? `frame ${i + 1}: ${m}` : m }))
    : []))
}
/**
 * The shortening-only fit (gate round 5: Haiku wrote good DT101 hooks that ran a few characters past 16 a line, twice).
 * The writer is asked to shorten only the fields that run over, told each one's limit, measured length and overflowing
 * line. Only those fields are taken from its answer, and only when the new value is shorter than the old; the caption
 * and every other field stay as they were. A shorter value that breaks another rule is turned down, and the next
 * attempt is told why. Nothing is cut or abbreviated here, and no limit is relaxed: the copy passes every rule, or the
 * draft is held. tries: how many attempts were made (0 when nothing could be asked).
 */
async function fitStep(ai: McuAi, d: McuDraft, out: { frames: FrameCopy[]; caption: string }, today: string, steer: { seeds: McuSeeds | null; direction?: string }): Promise<{ out: { frames: FrameCopy[]; caption: string }; tries: number }> {
  let cur = out, tries = 0, turnedDown: string[] = []
  for (; tries < MAX_FIT_ATTEMPTS; tries++) {
    const over = overflow(cur.frames)
    if (!over.length) break
    const r = await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames: cur.frames, caption: cur.caption }, fit: [...over.map(o => o.message), ...turnedDown] })
    const next = cur.frames.map(f => ({ ...f, fields: { ...f.fields } }))
    let shorter = false
    for (const o of over) {
      const raw = r.frames[o.frame]?.fields[o.field]
      if (typeof raw !== "string" || !raw.trim()) continue
      const value = fix({ ...next[o.frame], fields: { ...next[o.frame].fields, [o.field]: raw } }, o.frame, d, today).fields[o.field]
      if (measure(value) < measure(cur.frames[o.frame].fields[o.field])) { next[o.frame].fields[o.field] = value; shorter = true }
    }
    turnedDown = []
    if (!shorter) { turnedDown = ["the last answer was not shorter: use fewer or shorter words"]; continue }
    const candidate = { frames: next, caption: cur.caption }
    const broke = introduced(candidate, cur, d.story).filter(p => !overflow(candidate.frames).some(o => o.message === p))
    if (broke.length) { turnedDown = [`the last shorter version was turned down because it broke these rules: ${broke.slice(0, 3).join("; ")}`]; continue }
    cur = candidate
    if (!overflow(cur.frames).length) { tries++; break }
  }
  return { out: cur, tries }
}
/** Rewording attempts for copied wording, after the rewrites and before the fit; the limits stay as ruled (founder, 2026-10-18). */
export const MAX_FRESH_ATTEMPTS = 3
/** The fields that copy more of the source than the profile allows (none when the profile doesn't check originality). */
function copiedFields(frames: FrameCopy[], caption: string, story: Story): Copied[] {
  const c = BRAND.checks
  return c?.originality ? originalityFindings(frames, caption, story, c.originality, [...(c.headline?.fields ?? []), ...(c.headline?.hookFields ?? [])]) : []
}
/**
 * The fresh-wording pass (gate round 6: a News caption still copied 16 words in a row from army.mil after two
 * rewrites). Like the fit, it is targeted: the writer is shown each copied run and asked to reword only the fields
 * that carry one. Only those fields are taken from its answer, and only when the field then copies less than before;
 * every other field and the caption stay as they were. A rewording that breaks another rule (a figure, the source line,
 * the deck) is turned down and the next attempt is told why; a rewording that runs long is left to the fit pass that
 * follows. tries: how many attempts were made.
 */
async function freshStep(ai: McuAi, d: McuDraft, out: { frames: FrameCopy[]; caption: string }, today: string, steer: { seeds: McuSeeds | null; direction?: string }): Promise<{ out: { frames: FrameCopy[]; caption: string }; tries: number }> {
  let cur = out, tries = 0, turnedDown: string[] = []
  const name = (c: Copied) => c.field === "caption" ? "caption" : `${cur.frames.length > 1 ? `frame ${c.frame + 1} ` : ""}${c.field}`
  const runOf = (all: Copied[], c: Copied) => all.find(x => x.frame === c.frame && x.field === c.field)?.run.length ?? 0
  for (; tries < MAX_FRESH_ATTEMPTS; tries++) {
    const copied = copiedFields(cur.frames, cur.caption, d.story)
    if (!copied.length) break
    const r = await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames: cur.frames, caption: cur.caption }, fresh: [...copied.map(c => `${name(c)}: ${c.message}`), ...turnedDown] })
    const next = { frames: cur.frames.map(f => ({ ...f, fields: { ...f.fields } })), caption: cur.caption }
    for (const c of copied) {
      if (c.field === "caption") { if (r.caption?.trim()) next.caption = r.caption.trim(); continue }
      const raw = r.frames[c.frame]?.fields[c.field]
      if (typeof raw === "string" && raw.trim()) next.frames[c.frame].fields[c.field] = fix({ ...next.frames[c.frame], fields: { ...next.frames[c.frame].fields, [c.field]: raw } }, c.frame, d, today).fields[c.field]
    }
    // A field is taken only when it now copies less; otherwise it keeps its old wording.
    const after = copiedFields(next.frames, next.caption, d.story)
    let changed = false
    for (const c of copied) {
      if (runOf(after, c) < c.run.length) { changed = true; continue }
      if (c.field === "caption") next.caption = cur.caption
      else next.frames[c.frame].fields[c.field] = cur.frames[c.frame].fields[c.field]
    }
    turnedDown = []
    if (!changed) { turnedDown = ["the last answer still copied the same run of words: say it differently, in your own words"]; continue }
    const left = copiedFields(next.frames, next.caption, d.story)
    const broke = introduced(next, cur, d.story).filter(p => !left.some(x => x.message === p) && !overflow(next.frames).some(o => o.message === p))
    if (broke.length) { turnedDown = [`the last rewording was turned down because it broke these rules: ${broke.slice(0, 3).join("; ")}`]; continue }
    cur = next
    if (!left.length) { tries++; break }
  }
  return { out: cur, tries }
}
/** Fills what the server knows better than the model: DDMMMYY dates, fixed values, uppercase fields. */
function fix(f: FrameCopy, _index: number, d: McuDraft, today: string): FrameCopy {
  const series = SERIES[f.series], fields = { ...f.fields }
  if (series.fields.some(x => x.name === "date")) fields.date = ddmmmyy(f.series === "icymi_cover" ? today : d.story.reportedAt ?? d.story.publishedAt ?? today)
  for (const x of series.fields) if (x.fixed) fields[x.name] = x.fixed
  if (f.series === "icymi_cover") for (const k of Object.keys(fields)) if (unusedStorySlot(k, icymiCount(d.story))) delete fields[k]
  const out = normalizeFields(series, fields)
  // The cover's row numbers, one per story used ("01\n02\n03"), so a roundup of 3 or 4 shows no unused number. Set
  // after normalizing, which would join the lines.
  if (f.series === "icymi_cover" && series.fields.some(x => x.name === "story_numbers")) out.story_numbers = Array.from({ length: icymiCount(d.story) }, (_, i) => String(i + 1).padStart(2, "0")).join("\n")
  return { ...f, fields: out }
}
/**
 * The copy's problems, sorted by the plan v9 hold bar (Phase 1 direction 1): a draft is held only for a safety problem
 * (a fact or subject error, an unsourced figure, copy past the template's limits or otherwise a broken card, a cut-off
 * word, a missing source line), and copy that copies its source's words beyond the profile's originality limits stays a
 * hold too, as the words' rights. A style problem (headline or hook punctuation, the deck's form, the caption's shape)
 * still gets the rewrites, and if it persists the draft goes to Review with it as a note, fixed through Open in Canva.
 */
export function copyProblems(frames: FrameCopy[], caption: string, story: Story): { safety: string[]; style: string[] } {
  const safety: string[] = [], style: string[] = []
  // The cover's slots past the roundup's last story are blank by design, not empty by mistake.
  const n = icymiCount(story), unused = new Set(SERIES.icymi_cover.fields.filter(f => unusedStorySlot(f.name, n)).map(f => `${f.label} is empty`))
  safety.push(...frames.flatMap((f, i) => checkFields(SERIES[f.series], f.fields).filter(p => f.series !== "icymi_cover" || !unused.has(p)).map(p => frames.length > 1 ? `frame ${i + 1}: ${p}` : p)))
  if (!caption.trim()) safety.push("caption is empty")
  if (caption.length > 2100) safety.push("caption is longer than Instagram allows (2,200 characters with credits)")
  if (/@[A-Za-z0-9_.]{2,}/.test(caption)) safety.push("caption contains an @handle; use plain names (tags need verified accounts)")
  // Credit and notice lines carry license versions and item numbers, not story facts.
  const body = caption.split("\n").filter(l => !/^(Archive image|Image|Photo): /.test(l) && l !== DOD_NOTICE).join("\n")
  const nums = unsourcedNumbers([body, ...frames.flatMap(f => Object.entries(f.fields).filter(([k]) => k !== "date" && k !== "counter").map(([, v]) => v))], story.sourceText)
  if (nums.length) safety.push(`these figures are not in the source: ${nums.join(", ")}`)
  // The caption ends with its own "Source:" line, and a DT101 caption is the mission brief (gate round 2: a DT101 with
  // a three-paragraph news caption, another with no source line, a News caption with "Source:" mid-paragraph).
  if (!/^Source: \S/m.test(body)) safety.push('the caption needs its source on a line of its own: "Source: <organization>, <date>"')
  const format = frames[0] ? SERIES[frames[0].series]?.caption : undefined
  if (format) {
    const lines = body.split("\n").map(l => l.trim()).filter(Boolean)
    if (format.firstLines.some((re, i) => !new RegExp(re).test(lines[i] ?? ""))) style.push(format.format)
    for (const label of format.labels) if (!lines.some(l => l.startsWith(label))) style.push(format.missingLabel.replace("{label}", label))
  }
  // The copy must be about this draft's story (gate round 3: after a subject switch, DT101-10 and -12 carried the
  // previous subject's mission brief). A roundup's copy is about five stories, so it is not checked here.
  if (!story.roundup && !sameSubject(`${story.title} ${story.sourceTitle}`, [caption, ...frames.flatMap(f => Object.values(f.fields))].join(" "))) safety.push(`the copy is not about this story ("${story.title.slice(0, 100)}"): write it from the source below`)
  for (const f of frames) if (f.fields.deck && !/[.!?]["”’)]?$/.test(f.fields.deck.trim())) style.push(`the deck must be one complete sentence ending with a period: "${f.fields.deck}"`)
  // The profile's headline and originality checks (Phase 1c, founder 2026-10-17): off unless the profile turns them on.
  const checks = BRAND.checks
  if (checks?.headline) style.push(...headlineProblems(frames, checks.headline))
  if (checks?.originality) safety.push(...originalityProblems(frames, caption, story, checks.originality, [...(checks.headline?.fields ?? []), ...(checks.headline?.hookFields ?? [])]))
  const clipped = [...new Set(frames.flatMap(f => clippedWords(f.fields, story.sourceText)))]
  if (clipped.length) safety.push(`abbreviated words on the card (${clipped.join(", ")}); use whole words, and shorter ones if it must fit`)
  const cut = [...new Set(frames.flatMap(f => cutOffWords(f.fields, story.sourceText)))].filter(w => !clipped.includes(w))
  if (cut.length) safety.push(`cut-off words on the card (${cut.join(", ")}): a line ends in part of a word; use whole words, and shorter ones if it must fit`)
  return { safety, style }
}
/** Every problem, safety first: what a rewrite is asked to fix. */
function validate(frames: FrameCopy[], caption: string, story: Story): string[] {
  const c = copyProblems(frames, caption, story)
  return [...c.safety, ...c.style]
}

/** The maker named on the card ("ULTRA / OVERLAND AI" → "OVERLAND AI"), else the story's publisher. */
export function makerOf(frame: FrameCopy, story: Pick<Story, "publisher">): string {
  return (frame.fields.subject_identifier ?? "").split("/")[1]?.trim() || story.publisher
}
/**
 * A page the photo search found is used only when its photo's rights can be read from it: a federal or DVIDS page
 * (public domain unless pageImageCandidate finds a notice or an off-site photo), or the maker's own site (company
 * media, flagged for the reviewer to confirm its terms). A state or local .gov, a news outlet's or anyone else's page
 * is skipped: its photo belongs to that government or outlet.
 */
export function searchedPageUsable(url: string, maker: string, outlets: readonly string[] = []): boolean {
  let host: string
  try { host = new URL(url).hostname.toLowerCase() } catch { return false }
  if (federalHost(host)) return true
  // An outlet is never the maker, even when the maker fallback is the story's publisher ("Defense News", round 2).
  if (isOutlet(url, outlets)) return false
  const words = maker.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !["inc", "corp", "the", "company", "technologies", "systems", "industries", "group", "defense", "defence"].includes(w))
  const labels = host.replace(/^www\./, "").split(".").slice(0, -1).join(".")
  return words.length > 0 && words.some(w => labels.includes(w))
}
/**
 * Photo candidates, in the editorial rules' order: the story's own pages first (official company or agency media),
 * then pages the photo search found (DVIDS, other U.S. government sites, the maker's newsroom or press kit), then the
 * open archives (Wikimedia Commons, Openverse, NASA). Archive hits must tie themselves to the story (archiveRelevant).
 * Each is fetched once, sized from its own header and dropped below MIN_SHORT_SIDE; at most MAX_SHOWN go to the
 * vision pick. DVIDS is searched through its API when a key is set (searchDvids), and its pages found by the web
 * search are still read as pages.
 */
async function gatherMedia(deps: WorkerDeps, ai: McuAi, story: Story, frame: FrameCopy, avoid: string[], reuse?: MediaCandidate[], representativeOnly = false): Promise<{ candidate: MediaCandidate; image: Uint8Array; mime: string }[]> {
  const out: { candidate: MediaCandidate; image: Uint8Array; mime: string }[] = [], seen = new Set<string>(avoid)
  const add = async (c: MediaCandidate | null) => {
    if (!c || out.length >= MAX_SHOWN || seen.has(c.pageUrl) || seen.has(c.url)) return
    seen.add(c.pageUrl); seen.add(c.url)
    try {
      // DVIDS pages share a 1000 px rendition; a 2000 px one usually sits beside it, and zooming needs the pixels.
      const larger = c.origin === "dvids" && /\/1000w_q95\.jpg$/.test(c.url) ? c.url.replace(/\/1000w_q95\.jpg$/, "/2000w_q95.jpg") : null
      const big = larger ? await deps.fetchImage(larger).catch(() => null) : null
      if (big && larger) { c.url = larger; c.thumbUrl = larger }
      const im = big ?? await deps.fetchImage(c.thumbUrl)
      if (im.bytes.byteLength > MAX_VISION_BYTES) return // vision providers refuse images over ~5 MB
      if (!c.width || !c.height) { const size = imageSize(im.bytes); if (!size) return; c.width = size.width; c.height = size.height }
      if (Math.min(c.width, c.height) < MIN_SHORT_SIDE) return
      out.push({ candidate: c, image: im.bytes, mime: im.mime })
    } catch { /* unreadable: skipped */ }
  }
  // An ICYMI story card shows the photo its published post used, when that can be recovered; nothing else is searched.
  if (reuse) { for (const c of reuse) await add(c); return out }
  const pages: SourcePage[] = [], outlets = await outletSites(deps)
  // The representative pass: only the photo search, asked for the people, unit or equipment the story is about; the
  // story's pages and the archives were already tried for the subject itself.
  if (representativeOnly) {
    const maker = makerOf(frame, story)
    for (const u of await ai.findPhotoPages({ story, frame, representative: true }).catch(() => [])) {
      if (out.length >= MAX_SHOWN) break
      if (!searchedPageUsable(u, maker, outlets)) continue
      try { const pg = await deps.fetchPage(u); if (searchedPageUsable(pg.url, maker, outlets)) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source")) } catch { /* skipped */ }
    }
    return out
  }
  // A social post's share image is MCU's own rendered card (ICYMI's stories link to Instagram), and an outlet's photo
  // is licensed to the outlet: neither is a photo source.
  for (const u of [story.primaryUrl, ...(story.supporting ?? []).map(x => x.url)].filter(u => /^https:\/\//.test(u) && !SOCIAL_HOST.test(u) && !isOutlet(u, outlets))) { try { pages.push(await deps.fetchPage(u)) } catch { /* skipped */ } }
  for (const pg of pages) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source"))
  // DVIDS through its API (plan v10, Phase 1 direction 6), searched for the subject by name: a few short searches, at
  // most MAX_DVIDS_SHOWN of its photos, so the maker's pages and the archives still have room.
  if (deps.searchDvids) {
    const before = out.length
    for (const q of dvidsQueries(frame, story)) {
      if (out.length >= MAX_SHOWN || out.length - before >= MAX_DVIDS_SHOWN) break
      for (const c of await deps.searchDvids(q).catch(() => [])) { if (out.length - before >= MAX_DVIDS_SHOWN) break; await add(c) }
    }
  }
  const maker = makerOf(frame, story)
  for (const u of await ai.findPhotoPages({ story, frame }).catch(() => [])) {
    if (out.length >= MAX_SHOWN) break
    if (!searchedPageUsable(u, maker, outlets)) continue
    try { const pg = await deps.fetchPage(u); if (searchedPageUsable(pg.url, maker, outlets)) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source")) } catch { /* skipped */ }
  }
  for (const q of mediaQueries(frame, story)) {
    if (out.length >= MAX_SHOWN) break
    const [commons, more] = await Promise.all([deps.searchCommons(q).catch(() => []), deps.searchMore ? deps.searchMore(q).catch(() => []) : Promise.resolve([])])
    for (const c of [...commons, ...more]) if (archiveRelevant(c, maker)) await add(c)
  }
  return out
}

const SOCIAL_HOST = /^https:\/\/([a-z0-9-]+\.)*(instagram\.com|facebook\.com|fb\.com|threads\.net|x\.com|twitter\.com|linkedin\.com|tiktok\.com|youtube\.com)(\/|$)/i
/**
 * The photo an ICYMI story's published post used (founder, 2026-10-17: the roundup reuses the stories' approved
 * images; the cover takes the first story's that can be recovered), from the record the pipeline wrote on the post (pipeline_media). It is fetched from exactly the recorded
 * URL and keeps the rights it was approved with: its license, credit, government status and rights note are never
 * overridden, and "Reused" is added beside the note, not in place of it. A post's links are not read: any content
 * editor can change them, and their last page needn't hold the photo used (security review, 2026-10-17, finding 2).
 * Empty when the post has no record (a post made by hand, or before the record existed); the photo is then searched for.
 */
export function publishedPhoto(item: NonNullable<Story["roundup"]>[number]): MediaCandidate[] {
  const m = item.media
  if (!m || !/^https:\/\//.test(m.url) || !/^https:\/\//.test(m.pageUrl)) return []
  return [{ url: m.url, thumbUrl: m.url, pageUrl: m.pageUrl, title: m.title, description: "", width: 0, height: 0, license: m.license, creator: m.creator, credit: m.credit, usGovernment: m.usGovernment === true, ...(m.date ? { date: m.date } : {}), rightsNote: [m.rightsNote, `Reused from the published post ${item.postId}`].filter(Boolean).join(". ") }]
}
/**
 * The story a frame's photo is about. The ICYMI cover shows the lead story it recaps (its title and caption), not the
 * roundup: gate round 1 (2026-10-17) searched for a cover photo of the roundup's theme, "Multi-domain", and found nothing.
 */
export function frameStory(d: Pick<McuDraft, "story">, frame: FrameCopy): Story {
  if (frame.series !== "icymi_cover") return d.story
  const p = d.story.roundup?.[0]
  return p ? { title: p.title.replace(new RegExp(`^${BRAND.draftPrefix}-[A-Z0-9]+-\\d{8}-\\d{2}\\s+v\\d+\\s+—\\s+`), ""), primaryUrl: p.publishedUrl ?? "", publisher: BRAND.name, sourceTitle: p.title, sourceText: p.caption } : d.story
}
/** Series the brand profile marks representative (for MCU: News and Breaking; never DT101). */
export const allowsRepresentative = (frame: FrameCopy) => SERIES[frame.series]?.representative === true
const FRAME_ASPECT: Record<Placement, number> = { feed: 4 / 5, reels: 9 / 16 }
/**
 * Where a photo's subject lands on the card. Canva fills the template's full-bleed frame like CSS "cover": scaled to
 * fill, centred, the overflow cropped. The approved DT101 (ULTRA, DAHXpX39sh8) has a close hero subject filling the
 * upper part of the card with the text block on the scrim over the lower 40%; Smartie's log adds: full bleed, subject
 * recognizable at phone size, no sky-only or tail-only crops, change the crop or image rather than the layout.
 * Rules: the subject is not cut off by the crop, its centre sits above the text block (upper 60%), it spans at least
 * 30% of the card's height or 45% of its width, and the cropped photo is at least 500 px wide before upscaling.
 * With a core box (the part that must stay in frame), "not cut off" and "above the text" are judged on the core, so
 * a wide subject may lose its ends: gate round 1 (2026-10-17) rejected every landscape photo whose subject was wider
 * than a 4:5 window can be (a 1200 × 630 missile render, soldiers across a 2000 × 1334 frame), exact matches included.
 */
export function cropFit(width: number, height: number, box: SubjectBox, placement: Placement, core?: SubjectBox): { ok: boolean; problems: string[] } {
  const f = FRAME_ASPECT[placement], a = width / height
  const win = a > f ? { x0: 0.5 - f / (2 * a), x1: 0.5 + f / (2 * a), y0: 0, y1: 1 } : { x0: 0, x1: 1, y0: 0.5 - a / (2 * f), y1: 0.5 + a / (2 * f) }
  const toCard = (v: number, lo: number, hi: number) => (v - lo) / (hi - lo)
  const onCard = (b: SubjectBox) => ({ x0: toCard(b.x0, win.x0, win.x1), x1: toCard(b.x1, win.x0, win.x1), y0: toCard(b.y0, win.y0, win.y1), y1: toCard(b.y1, win.y0, win.y1) })
  const { x0: bx0, x1: bx1, y0: by0, y1: by1 } = onCard(box), k = onCard(core ?? box)
  const visible = (Math.min(k.x1, 1) - Math.max(k.x0, 0)) * (Math.min(k.y1, 1) - Math.max(k.y0, 0))
  const area = Math.max(1e-6, (k.x1 - k.x0) * (k.y1 - k.y0))
  const problems: string[] = []
  if (visible / area < (core ? 0.9 : 0.85)) problems.push("the 4:5 crop cuts off the subject")
  if ((k.y0 + k.y1) / 2 > 0.6) problems.push("the subject sits low, under the text block")
  if (by1 - by0 < 0.3 && bx1 - bx0 < 0.45) problems.push("the subject is small at phone size")
  if ((win.x1 - win.x0) * width < 500) problems.push("the cropped photo is under 500 px wide")
  return { ok: !problems.length, problems }
}
/**
 * Where the subject should sit on the card. With a background that adds context (the approved ULTRA card: an
 * off-road vehicle with the forest behind it), the subject fills the open space between the logo band and the text
 * block, base at 60% of the card, about 45% tall. With an empty background (open sky, plain water, a pier) the
 * subject takes that space over instead, about 62% tall from just under the logo band, its base behind the text as
 * on ULTRA. Founder, on the Saildrone drafts (2026-10-16): "enlarged so the ships fill more of the open space and
 * deconflict themselves a bit better from the text"; the forest "made it contextual and interesting", while open sky
 * "is just unused space to feature the actual vehicle more".
 */
const ZOOM = { context: { bottom: 0.6, height: 0.45 }, empty: { bottom: 0.72, height: 0.62 }, clear: { bottom: 0.5, height: 0.4 }, maxWidth: 0.9, minWindowPx: 600 }
/**
 * The crop (fractions of the photo) that zooms a subject into that space on a 4:5 (or 9:16) card, within the photo's
 * edges and never narrower than 600 px of source, so the upscale stays sharp. lib/image-crop.ts applies it before the
 * Canva fill, which then has nothing left to centre.
 */
export function zoomCrop(width: number, height: number, box: SubjectBox, placement: Placement, context = true, core?: SubjectBox, clearOfText = false): CropBox {
  const f = FRAME_ASPECT[placement], target = clearOfText ? ZOOM.clear : context ? ZOOM.context : ZOOM.empty
  // The height fits the whole subject; the width only has to hold the core, centred on it.
  const w = core ?? box
  const bw = (w.x1 - w.x0) * width, bh = (box.y1 - box.y0) * height
  let wh = Math.max(bh / target.height, bw / (ZOOM.maxWidth * f), ZOOM.minWindowPx / f) // window height in source px
  wh = Math.min(wh, height, width / f)
  const ww = wh * f
  const left = Math.min(Math.max(((w.x0 + w.x1) / 2) * width - ww / 2, 0), width - ww)
  const top = Math.min(Math.max(box.y1 * height - target.bottom * wh, 0), height - wh)
  const r = (v: number) => Math.round(v * 10_000) / 10_000
  return { x: r(left / width), y: r(top / height), width: r(ww / width), height: r(wh / height) }
}
/** The subject box inside a crop, as fractions of the cropped photo. */
function boxInCrop(box: SubjectBox, c: CropBox): SubjectBox {
  return { x0: (box.x0 - c.x) / c.width, x1: (box.x1 - c.x) / c.width, y0: (box.y0 - c.y) / c.height, y1: (box.y1 - c.y) / c.height }
}
/**
 * The pick, zoomed and checked: the vision model's exact matches (model.ts readPick), best first; each is zoomed so
 * its subject fills the open space, and the first that then passes the crop rule wins. When none passes, or there is
 * no exact match with a subject box, nothing is chosen: a photo that misses the subject or the crop is not placed on
 * the card with a note (the -05 DT101 draft, 2026-10-17, went to Review that way).
 */
export function choosePhoto(pick: { index: number | null; ranked?: RankedPhoto[] }, candidates: MediaCandidate[], placement: Placement): { index: number; crop: CropBox; ranked: RankedPhoto } | { index: null; why: string } {
  if (!pick.ranked?.length) return { index: null, why: "no candidate shows the subject itself" }
  const misses: string[] = []
  for (const r of pick.ranked) {
    const c = candidates[r.index]
    if (!c) continue
    const crop = zoomCrop(c.width, c.height, r.box, placement, r.context !== false, r.core)
    const fit = cropFit(crop.width * c.width, crop.height * c.height, boxInCrop(r.box, crop), placement, r.core ? boxInCrop(r.core, crop) : undefined)
    if (fit.ok) return { index: r.index, crop, ranked: r }
    misses.push(`#${r.index}: ${fit.problems.join("; ")}`)
  }
  return { index: null, why: `no photo of the subject fits the ${placement === "feed" ? "4:5" : "9:16"} card (${misses.join(" · ") || "no usable candidate"})` }
}

type Shown = { candidate: MediaCandidate; image: Uint8Array; mime: string }
interface PhotoSearch { shown: Shown[]; pick: Awaited<ReturnType<McuAi["pickMedia"]>>; chosen: ReturnType<typeof choosePhoto>; searched: boolean; repTried: boolean }
/**
 * One frame's photo search and pick, as the media step and photo first run it: a published post's recorded photo when
 * one is given (reuse), else the search; the vision pick and the crop rule; then, where the series allows a
 * representative photo and nothing qualified (gate round 6: a Breaking story about an Office of Strategic Capital loan
 * had no candidate at all), one more search for the people, unit or equipment the story is about.
 */
async function searchPhoto(deps: WorkerDeps, ai: McuAi, story: Story, frame: FrameCopy, placement: Placement, avoid: string[], reuse: MediaCandidate[], log: (pass: string, r: Pick<PhotoSearch, "shown" | "pick" | "chosen">) => void): Promise<PhotoSearch> {
  const representative = allowsRepresentative(frame)
  let shown = reuse.length ? await gatherMedia(deps, ai, story, frame, avoid, reuse) : []
  // Nothing recoverable from the published post: search.
  const searched = !shown.length
  if (searched) shown = await gatherMedia(deps, ai, story, frame, avoid)
  let pick = await ai.pickMedia({ story, frame, candidates: shown, avoid: [...avoid], representative })
  let chosen = choosePhoto(pick, shown.map(x => x.candidate), placement)
  log("subject", { shown, pick, chosen })
  let repTried = false
  if (chosen.index === null && searched && representative) {
    repTried = true
    const first = shown
    shown = await gatherMedia(deps, ai, story, frame, [...avoid, ...first.flatMap(x => [x.candidate.pageUrl, x.candidate.url])], undefined, true)
    if (shown.length) {
      pick = await ai.pickMedia({ story, frame, candidates: shown, avoid: [...avoid], representative })
      chosen = choosePhoto(pick, shown.map(x => x.candidate), placement)
    }
    log("representative", { shown, pick, chosen })
  }
  return { shown, pick, chosen, searched, repTried }
}
const shownLog = (shown: Shown[]) => shown.map(x => `${x.candidate.origin ?? "?"}:${x.candidate.width}x${x.candidate.height}:${x.candidate.title.slice(0, 60)}`)
/** A chosen photo as the draft records it, with the reviewer's notes: its rights, a representative photo, a fresh cover search. */
function chosenMedia(c: MediaCandidate, ranked: RankedPhoto, crop: CropBox, fresh = ""): ChosenMedia {
  const rep = ranked.representative ? `Representative photo${ranked.shows ? ` (${ranked.shows})` : ""}, not the event itself: check the caption doesn't present it as the event` : ""
  return { url: c.url, pageUrl: c.pageUrl, title: c.title, license: c.license, creator: c.creator, credit: c.credit, usGovernment: c.usGovernment, ...(c.date ? { date: c.date } : {}), ...(c.rightsNote ? { rightsNote: c.rightsNote } : {}), ...(c.rightsNote || rep || fresh ? { note: [c.rightsNote, rep, fresh].filter(Boolean).join(". ") } : {}), crop, subject: { box: ranked.box, ...(ranked.core ? { core: ranked.core } : {}), context: ranked.context !== false, width: c.width, height: c.height } }
}

/** Words that name a kind of thing, not a subject: a card that shares only these with the checked subject isn't the same subject. */
const KIND_WORDS = new Set(["interceptor", "interceptors", "drone", "drones", "missile", "missiles", "rotorcraft", "vehicle", "vehicles", "aircraft", "uas", "suas", "usv", "usvs", "uav", "helmet", "gun", "radar", "counter", "platform", "launcher", "rocket", "satellite", "vessel", "ship", "boat", "robot", "software", "network", "kit", "pod", "jet", "loan", "award", "order", "base", "industrial", "submarine", "autonomous", "unmanned", "uncrewed", "attack", "air", "sea", "land", "space", "defense", "system", "systems"])
/**
 * Whether the card's written subject is the subject photo first confirmed a photo for: the card's fields (DT101's
 * "COYOTE / RAYTHEON", a News headline and deck) carry one of its designations (PAC-3, X10D) or one of its distinctive
 * name words (Coyote, Lightfish), the maker's and kind words aside. With nothing distinctive to compare, it matches.
 */
export function subjectMatches(checked: string, frame: FrameCopy): boolean {
  const written = Object.entries(frame.fields).filter(([k]) => !["date", "source", "image_context", "counter"].includes(k)).map(([, v]) => v).join(" ").toLowerCase()
  const maker = (frame.fields.subject_identifier ?? "").split("/")[1]?.toLowerCase() ?? ""
  const tokens = [...new Set(checked.toLowerCase().match(/[a-z0-9][a-z0-9.\-+]*[a-z0-9+]|[a-z0-9]/g) ?? [])]
  const distinct = tokens.filter(t => /\d/.test(t) ? /[a-z]/.test(t) : t.length >= 3 && !COMMON.has(t) && !KIND_WORDS.has(t) && !maker.includes(t))
  if (!distinct.length) return true
  return distinct.some(t => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}([^a-z0-9]|$)`).test(written))
}
/** How a story passed over by photo first is described in research's drop list (and the no-content card). */
export const NO_PHOTO_FIRST = "no relevant, licensed photo of the subject was found before writing, so the next story was tried"
/** Photo checks per job (photo first): one for each candidate a research pass returns (count + 2). */
export const photoChecksFor = (count: number) => count + 2
/**
 * Photo first (plan v10, Phase 1 direction 6): whether a usable, licensed photo of the story's subject exists before
 * the story is written. The subject is read from the story (photoSubject; else its title and publisher), then the
 * media step's own search and pick run on it: the story's pages, DVIDS, the photo search and the archives; the vision
 * pick with a subject box; the crop rule (the subject whole and large, the crop at least 500 px wide, no upscaling); and
 * a representative photo where the series allows one. The photo found is kept on the story for its card. Costs per
 * check: one subject call and the photo search's calls on the text model, and one or two vision calls.
 */
export async function confirmPhoto(deps: WorkerDeps, ai: McuAi, story: Story, kind: RequestKind, placement: Placement, avoid: string[] = []): Promise<{ photo: CheckedPhoto } | { why: string }> {
  const named = ai.photoSubject ? await ai.photoSubject({ story }).catch(() => null) : null
  const subject = named?.subject?.trim() || story.title.split(":")[0].trim(), maker = named?.maker?.trim() || story.publisher
  const frame: FrameCopy = { series: framesFor(kind)[0], fields: { subject_identifier: `${subject} / ${maker}` }, ...(named?.query?.trim() ? { mediaQuery: named.query.trim() } : {}) }
  const r = await searchPhoto(deps, ai, story, frame, placement, avoid, [], (pass, x) => console.info("[content-pipeline] photo first", JSON.stringify({ story: story.primaryUrl, subject, query: frame.mediaQuery ?? null, pass, shown: shownLog(x.shown), ranked: x.pick.ranked ?? null, chosen: x.chosen.index, why: x.chosen.index === null ? x.chosen.why : null })))
  if (r.chosen.index === null) return { why: `${r.chosen.why} (${r.pick.reason})${r.repTried ? `; a representative photo was searched for too, and ${r.shown.length ? "none of the photos found qualified" : "none was found"}` : ""}` }
  return { photo: { candidate: r.shown[r.chosen.index].candidate, ranked: r.chosen.ranked, crop: r.chosen.crop, placement, subject } }
}

async function mediaStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const job = await deps.store.getJob(d.jobId)
  const used = new Set<string>()
  for (const other of job?.drafts ?? []) if (other !== d.id) for (const m of (await deps.store.getDraft(other))?.media ?? []) if (m) used.add(m.pageUrl)
  const media: (ChosenMedia | null)[] = d.frames.map((_, i) => d.media[i] ?? null)
  for (const [i, frame] of d.frames.entries()) {
    const series = SERIES[frame.series], field = series.media[d.placement], templateId = series.templates[d.placement]
    if (!field) { media[i] = null; continue }
    if (media[i]) { used.add(media[i]!.pageUrl); continue }
    // A template whose photo frame isn't an autofill field can't take a photo, so none is searched for or required
    // (gate round 2: the News feed template, EAHXWo1LiF8, held NEWS-03 for a photo it could never place).
    if (templateId && (await deps.content.templateFields(templateId))[field] !== "image") {
      media[i] = null
      d.notices = [...new Set([...d.notices, `${series.label} ${d.placement} template has no photo field, so no photo was searched for frame ${i + 1}: connect its photo frame as a data field in Canva`])]
      continue
    }
    const story = frameStory(d, frame), representative = allowsRepresentative(frame)
    const avoid = [...used, ...(d.avoidMedia ?? [])]
    // Photo first: the photo research confirmed goes on the story's card, unless it must be avoided (another draft of
    // the job uses it, or the artwork check turned it down) or the card names another subject than the one it was
    // confirmed for (coordinator review of #209); then the search runs as before.
    const pre = i === 0 && frame.series !== "icymi_cover" ? d.story.photo : undefined
    const sameAsChecked = !!pre && subjectMatches(pre.subject, frame)
    if (pre && !sameAsChecked) console.info("[content-pipeline] media", JSON.stringify({ draft: d.id, v: d.version, frame: i + 1, pass: "photo first", skipped: `the card's subject is not the one the photo was confirmed for (${pre.subject})` }))
    if (pre && sameAsChecked && pre.placement === d.placement && !avoid.includes(pre.candidate.pageUrl) && !avoid.includes(pre.candidate.url)) {
      console.info("[content-pipeline] media", JSON.stringify({ draft: d.id, v: d.version, frame: i + 1, retry: d.mediaRetries ?? 0, pass: "photo first", chosen: pre.candidate.pageUrl, crop: pre.crop }))
      media[i] = chosenMedia(pre.candidate, pre.ranked, pre.crop)
      used.add(pre.candidate.pageUrl)
      continue
    }
    // The ICYMI cover reuses a story's recorded photo, the lead story's first; only when none can be recovered is the
    // lead story's photo searched for.
    const roundup = frame.series === "icymi_cover" ? d.story.roundup ?? [] : []
    const reuse = roundup.flatMap(publishedPhoto)
    const item = roundup.length ? roundup.find(p => publishedPhoto(p).length) ?? roundup[0] : undefined
    const { shown, pick, chosen, searched, repTried } = await searchPhoto(deps, ai, story, frame, d.placement, avoid, reuse, (pass, x) => console.info("[content-pipeline] media", JSON.stringify({ draft: d.id, v: d.version, frame: i + 1, retry: d.mediaRetries ?? 0, representative, pass, shown: shownLog(x.shown), ranked: x.pick.ranked ?? null, turnedDown: x.pick.turnedDown ?? null, chosen: x.chosen.index, crop: x.chosen.index === null ? null : x.chosen.crop, why: x.chosen.index === null ? x.chosen.why : null })))
    if (chosen.index === null) {
      d.media = media
      // No photo of the subject: like a source that can't support the post, the subject is replaced (MAX_AUTO_REPLACE).
      const rep = repTried ? `; a representative photo (the people, unit or equipment the story is about) was searched for too, and ${shown.length ? "none of the photos found qualified" : "none was found"}` : ""
      return sourceHold(deps, ai, d, `no relevant, licensed photo was found${d.frames.length > 1 ? ` for frame ${i + 1}` : ""}${frame.mediaQuery ? ` ("${frame.mediaQuery}")` : ""}: ${chosen.why} (${pick.reason})${rep}.`)
    }
    const c = shown[chosen.index].candidate
    used.add(c.pageUrl)
    const fresh = item && searched ? `No story's published post has a recorded photo${reuse.length ? " that could be fetched" : ""}, so the cover's was searched for: check it against ${item.postId}` : ""
    media[i] = chosenMedia(c, chosen.ranked, chosen.crop, fresh)
  }
  d.media = media
  // Credits and the DoD non-endorsement line belong to the caption the reviewer approves.
  d.caption = withCredits(d.caption ?? "", media)
  d.status = "designing"
  await save(deps, d, "media chosen")
}
/**
 * Commons searches, most specific first. Commons matches every word, so the model's long phrase often finds nothing
 * ("Saildrone Voyager unmanned surface vehicle at sea, U.S. Navy 4th Fleet Caribbean" → 0; "Saildrone Voyager" → the
 * Navy photo of the vehicle: live test, 2026-10-16). Fall back to the phrase cut at its first comma and to six words,
 * then the card's subject and maker, then the story title.
 */
export function mediaQueries(frame: FrameCopy, story: Pick<Story, "title">): string[] {
  const words = (t: string, n: number) => t.split(/\s+/).filter(Boolean).slice(0, n).join(" ")
  const mq = frame.mediaQuery?.trim() ?? ""
  const [subject = "", maker = ""] = (frame.fields.subject_identifier ?? "").split("/").map(x => x.trim())
  const out = [mq, words(mq.split(",")[0], 6), words(mq, 3), subject && maker ? `${subject} ${maker}` : "", subject, maker, story.title.split(":")[0], story.title]
  return [...new Set(out.map(q => q.replace(/[^\p{L}\p{N}\s.\-'&]/gu, " ").replace(/\s+/g, " ").trim()).filter(q => q.length > 2))]
}
/**
 * DVIDS API searches: the short ones of mediaQueries (at most four words; its search matches every word, and a long
 * phrase finds nothing), never the maker alone (a prime's name alone returns its every photo), at most MAX_DVIDS_QUERIES.
 */
export function dvidsQueries(frame: FrameCopy, story: Pick<Story, "title" | "publisher">): string[] {
  const maker = makerOf(frame, story).toLowerCase()
  return mediaQueries(frame, story).filter(q => q.split(" ").length <= 4 && q.toLowerCase() !== maker).slice(0, MAX_DVIDS_QUERIES)
}
// Wording as on the approved, published MCU posts (ULTRA, HIMARS).
const MONTHS3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
/** The DT101 image label, as on the approved cards: "ARCHIVE: U.S. ARMY • 29 JAN 2026" (or IMAGE: when current). */
export function imageLabel(m: ChosenMedia | null | undefined, storyDate?: string): string {
  if (!m) return ""
  const who = `${m.creator} ${m.credit}`
  const branch = [["U.S. ARMY", /\barmy\b/i], ["U.S. NAVY", /\bnavy\b/i], ["U.S. AIR FORCE", /air force/i], ["U.S. MARINE CORPS", /marine/i], ["U.S. SPACE FORCE", /space force/i], ["U.S. COAST GUARD", /coast guard/i], ["NASA", /\bnasa\b/i], ["DOD", /department of (defense|war)|\bdod\b|\bdow\b/i]] as const
  const org = (m.usGovernment ? branch.find(([, re]) => re.test(who))?.[0] : undefined) ?? m.creator.replace(/\s*\/.*$/, "").toUpperCase().slice(0, 28)
  const t = m.date ? Date.parse(m.date.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")) : NaN
  if (!Number.isFinite(t)) return `IMAGE: ${org}`
  const dt = new Date(t), when = `${dt.getUTCDate()} ${MONTHS3[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`
  const archive = !storyDate || Date.parse(storyDate) - t > 30 * 864e5
  return `${archive ? "ARCHIVE" : "IMAGE"}: ${org} • ${when}`
}
export const DOD_NOTICE = "The appearance of U.S. Department of War (DoW) visual information does not imply or constitute DoW endorsement."
export function withCredits(caption: string, media: (ChosenMedia | null)[]): string {
  let out = caption.split("\n").filter(l => !/^(Archive image|Image|Photo): /.test(l) && l !== DOD_NOTICE).join("\n").trimEnd()
  const credits = [...new Set(media.filter((m): m is ChosenMedia => !!m && !!m.credit).map(m => m.credit))]
  if (credits.length) out += `\n\nImage: ${credits.join("; ")}`
  if (media.some(m => m?.usGovernment)) out += `\n\n${DOD_NOTICE}`
  return out
}

async function designStep(deps: WorkerDeps, d: McuDraft): Promise<void> {
  const designs: FrameDesign[] = []
  const notices = new Set(d.notices)
  for (const [i, frame] of d.frames.entries()) {
    const series = SERIES[frame.series], templateId = series.templates[d.placement]
    if (!templateId) return hold(deps, d, `there is no ${series.label} template for ${d.placement} yet; ask for the feed version`)
    if (series.fields.some(f => f.name === "image_context")) frame.fields = { ...frame.fields, image_context: imageLabel(d.media[i], d.story.publishedAt) }
    const dataset = await deps.content.templateFields(templateId)
    const mediaField = series.media[d.placement], m = d.media[i]
    const image = m && mediaField && dataset[mediaField] === "image" ? { field: mediaField, url: m.url, name: m.title.slice(0, 50) || "MCU media", ...(m.crop ? { crop: m.crop } : {}) } : undefined
    if (m && !image) notices.add(`${series.label} ${d.placement} template has no photo field, so the photo was not placed on frame ${i + 1}`)
    const text: Record<string, string> = Object.fromEntries(Object.entries(frame.fields).filter(([k]) => dataset[k] === "text"))
    // A roundup of fewer than five blanks the cover's unused story slots, so none shows its sample text.
    if (frame.series === "icymi_cover" && icymiCount(d.story) < ICYMI_MAX) {
      for (const f of series.fields) if (unusedStorySlot(f.name, icymiCount(d.story)) && dataset[f.name] === "text") text[f.name] = " "
      if (dataset.story_numbers !== "text") notices.add(`ICYMI cover: ${icymiCount(d.story)} of 5 story slots used. The template prints the numbers 01–05 itself, so the unused numbers still show; the cover needs a version for fewer stories in Canva`)
    }
    const missing = Object.keys(frame.fields).filter(k => dataset[k] !== "text")
    if (missing.length) notices.add(`${series.label} template has no field for ${missing.join(", ")}`)
    const title = `${d.id} v${d.version}${d.frames.length > 1 ? ` · ${i + 1}/${d.frames.length}` : ""} — ${(frame.fields.headline || frame.fields.subject_identifier || frame.fields.counter || series.label).slice(0, 120)}`
    const r = await deps.content.createDesign({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}:f${i + 1}${d.autoReplaced ? `:r${d.autoReplaced}` : ""}${d.mediaRetries ? `:m${d.mediaRetries}` : ""}${d.labelRefit ? `:l${d.labelRefit}` : ""}`, templateId, title, text, ...(image ? { image } : {}) })
    designs.push({ templateId, ...r })
  }
  d.designs = designs; d.notices = [...notices]; d.status = "reviewing"
  await save(deps, d, `designs created (v${d.version}): ${designs.map(x => x.designId).join(", ")}`)
}

async function reviewStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const images: { bytes: Uint8Array; mime: string }[] = []
  for (const x of d.designs) {
    const url = x.previewUrls[0]
    if (!url) continue
    images.push(await deps.fetchImage(url))
  }
  const qa: string[] = [], photoDefects: { frame: number; defect: string }[] = [], labelHits = new Set<number>()
  for (const [i, frame] of d.frames.entries()) {
    if (!images[i]) continue
    for (const p of await ai.checkArtwork({ frame, images: [images[i]], noPhoto: !d.media[i] }).catch(() => [{ defect: "automatic artwork check did not run", photo: false }])) {
      qa.push(d.frames.length > 1 ? `frame ${i + 1}: ${p.defect}` : p.defect)
      if (p.photo) photoDefects.push({ frame: i, defect: p.defect })
      else if (labelDefect(p.defect) && SERIES[frame.series].fields.some(f => f.name === "image_context")) labelHits.add(i)
    }
  }
  // The machine fixes what it can before anyone reviews: a photo defect sends the draft back for the next photo,
  // up to MAX_MEDIA_RETRIES times.
  const retryable = photoDefects.filter(p => d.media[p.frame])
  console.info("[content-pipeline] artwork", JSON.stringify({ draft: d.id, v: d.version, retry: d.mediaRetries ?? 0, defects: qa, photo: photoDefects.map(p => p.defect), retrying: !!retryable.length && (d.mediaRetries ?? 0) < MAX_MEDIA_RETRIES }))
  if (retryable.length && (d.mediaRetries ?? 0) < MAX_MEDIA_RETRIES) {
    d.mediaRetries = (d.mediaRetries ?? 0) + 1
    d.avoidMedia = [...new Set([...(d.avoidMedia ?? []), ...retryable.map(p => d.media[p.frame]!.pageUrl)])]
    for (const p of retryable) d.media[p.frame] = null
    d.status = "media"
    return save(deps, d, `artwork check: ${retryable.map(p => p.defect).join("; ")} — trying another photo (${d.mediaRetries}/${MAX_MEDIA_RETRIES})`)
  }
  // The image label crosses the subject (gate round 6: "IMAGE: … runs across the rocket's nozzle"). The label's place
  // is the template's, so the photo moves instead: once, re-zoomed so the subject's base clears the text block, then
  // filled and checked again. A crop that can't move, or that would break the crop rule, leaves the defect for review.
  if (labelHits.size && !d.labelRefit) {
    let moved = false
    for (const i of labelHits) {
      const m = d.media[i], s = m?.subject
      if (!m || !s) continue
      const crop = zoomCrop(s.width, s.height, s.box, d.placement, s.context, s.core, true)
      const fit = cropFit(crop.width * s.width, crop.height * s.height, boxInCrop(s.box, crop), d.placement, s.core ? boxInCrop(s.core, crop) : undefined)
      if (fit.ok && JSON.stringify(crop) !== JSON.stringify(m.crop)) { d.media[i] = { ...m, crop }; moved = true }
    }
    if (moved) {
      d.labelRefit = 1; d.status = "designing"
      return save(deps, d, `artwork check: the image label crosses the subject (${[...labelHits].map(i => qa.find(q => labelDefect(q) && (d.frames.length === 1 || q.startsWith(`frame ${i + 1}:`))) ?? "").filter(Boolean).join("; ").slice(0, 300)}) — the photo was re-zoomed above the text block and is filled again (1/1)`)
    }
  }
  for (const m of d.media) if (m?.note && !qa.includes(m.note)) qa.push(m.note)
  d.qa = qa; d.status = "posting"
  await save(deps, d, `artwork checked (v${d.version}): ${qa.length ? `${qa.length} to check` : "no defects found"}`)
}

/**
 * An artwork defect about the card's image label (the credit line) colliding with the photo's subject, as the check
 * words it. Placement only: a remark about contrast or legibility alone is not one, since moving the photo can't fix it.
 */
export function labelDefect(defect: string): boolean {
  return /\b(image|photo)\s+(credit|label|caption)\b|\bcredit\s+(line|label|text)\b|\bimage_context\b|\b(IMAGE|ARCHIVE):/i.test(defect)
    && /\b(across|over|overlap\w*|collid\w*|collision|obscur\w*|cross\w*|clash\w*|covers?|covering|runs into|on top of)\b/i.test(defect)
}
/** The content post's review notes: sources, photo rights, checks and what was not done. Plain text, ≤4,000 characters. */
export function reviewNotes(d: McuDraft): string {
  const sections: string[] = [`${d.id} · v${d.version} · ${label(d.kind)} — drafted by the content pipeline (${BRAND.rulesVersion}). Review the card and caption, then approve through the publisher.`]
  d.frames.forEach((f, i) => {
    const vals = SERIES[f.series].fields.filter(x => f.fields[x.name]).map(x => `- ${x.label}: ${f.fields[x.name]}`)
    sections.push(`Graphic copy${d.frames.length > 1 ? ` — ${i + 1}. ${SERIES[f.series].label}` : ""} (on the card)\n${vals.join("\n")}`)
  })
  if (d.kind === "icymi" && d.story.roundup?.length) sections.push(`Story slides (each story's published card, reused exactly as posted)\n${d.story.roundup.map((p, i) => `${i + 1}. ${p.title.slice(0, 120)} — post ${p.postId}${p.publishedUrl ? ` — ${p.publishedUrl}` : ""}`).join("\n")}${d.choice?.chosenBy ? `\nChosen by ${d.choice.chosenBy}` : ""}`)
  sections.push(`Source\n${d.story.sourceTitle.slice(0, 160)} — ${d.story.publisher}${d.story.publishedAt ? `, ${d.story.publishedAt}` : ""}\n${d.story.primaryUrl}${(d.story.supporting ?? []).map(x => `\nAlso: ${x.title.slice(0, 120)} — ${x.url}`).join("")}`)
  if (d.story.datedBy && !d.story.fresh) sections.push(`Dated by a news report\nThe official page is older; a news outlet reported the same event on ${d.story.datedBy.publishedAt}, which dates the story and the card. The outlet is not cited: ${d.story.datedBy.url}`)
  if (d.story.readViaSearch?.length) sections.push(`Read through the search tool\nThese official pages refused the pipeline's fetch, so their text was read from the search tool's extracted content: ${d.story.readViaSearch.join(" ; ")}`)
  if (d.story.fresh) sections.push(`How fresh\n${d.story.fresh.how === "official" ? `The official page's publish time, ${d.story.fresh.at}.` : `A news outlet's report of the same event, timed ${d.story.fresh.at}; the official page shows no time. The outlet is not cited.`}${d.story.fresh.byline ? ` The page's date-only byline, ${d.story.fresh.byline}, ${d.story.fresh.bylineToday ? `is today in ${BRAND.timeZone ?? "the brand's time zone"} and agrees` : `is not today in ${BRAND.timeZone ?? "the brand's time zone"}, so it isn't counted`}.` : ""}`)
  if (d.story.whyNow) sections.push(`Why Breaking\n${d.story.whyNow}`)
  const media = d.media.map((m, i) => m ? `- ${d.media.length > 1 ? `${i + 1}: ` : ""}${m.title.slice(0, 80)} — ${m.license}${m.creator && m.creator !== "Unknown" ? `, ${m.creator}` : ""}\n  ${m.pageUrl}${m.note ? `\n  ${m.note}` : ""}` : null).filter(Boolean)
  sections.push(`Photo rights\n${media.length ? media.join("\n") : "- No photo on this card"}`)
  sections.push(`Canva\n${d.designs.map((x, i) => `${d.designs.length > 1 ? `Frame ${i + 1}: ` : ""}${x.editUrl || x.viewUrl} (design ${x.designId})`).join("\n")}`)
  if (d.qa.length) sections.push(`Check before approving\n${d.qa.map(q => `- ${q}`).join("\n")}`)
  if (d.copyNotes?.length) sections.push(`Style notes (not held: fix through Open in Canva)\n${d.copyNotes.map(n => `- ${n}`).join("\n")}`)
  if (d.notices.length) sections.push(`Not done\n${d.notices.map(n => `- ${n}`).join("\n")}`)
  const out = sections.join("\n\n")
  return out.length > 4000 ? `${out.slice(0, 3990)}…` : out
}

async function postStep(deps: WorkerDeps, d: McuDraft): Promise<void> {
  if (d.postId) { d.status = "in_review"; return save(deps, d, "already on the board") }
  const head = d.frames[0]?.fields.headline || d.frames[0]?.fields.subject_identifier || d.story.title
  const links = [...new Set([d.story.primaryUrl, ...(d.story.supporting ?? []).map(x => x.url), ...(d.story.roundup ?? []).flatMap(p => p.publishedUrl ? [p.publishedUrl] : []), ...d.media.filter((m): m is ChosenMedia => !!m).map(m => m.pageUrl)])]
  // An ICYMI roundup: after the cover, each story's own published card, exactly as posted, in order.
  const slides = d.kind === "icymi" ? (d.story.roundup ?? []).filter(p => p.card).map((p, i) => ({ url: p.card!.url, label: `story-${i + 1}` })) : []
  const media = d.media.filter((m): m is ChosenMedia => !!m).map(m => ({ url: m.url, pageUrl: m.pageUrl, title: m.title, license: m.license, creator: m.creator, credit: m.credit, usGovernment: m.usGovernment, ...(m.date ? { date: m.date } : {}), ...(m.rightsNote ? { rightsNote: m.rightsNote } : {}) }))
  const job = await deps.store.getJob(d.jobId)
  const r = await deps.content.writePost({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}`, property: contentPropertyOf(job?.property), title: `${d.id} v${d.version} — ${head.replace(/\n/g, " ")}`.slice(0, 200), caption: d.caption ?? "", notes: reviewNotes(d), links, media, designIds: d.designs.map(x => x.designId), ...(slides.length ? { slides } : {}), requestedBy: { email: d.request.actorEmail, name: d.request.actorName } })
  d.postId = r.postId
  if (r.holds.length) d.qa = [...new Set([...d.qa, ...r.holds])]
  console.info("[content-pipeline] posted", JSON.stringify({ draft: d.id, v: d.version, postId: r.postId, designs: d.designs.map(x => x.designId), holds: r.holds, calls: (d.calls ?? []).map(c => `${c.step}:${c.model}@${c.provider ?? "?"}${c.fallbackFrom ? ` (fallback from ${c.fallbackFrom})` : ""}`) }))
  d.status = "in_review"
  await save(deps, d, `on the board for review: post ${r.postId}`)
}

/** A source that can't support the post: research a replacement subject, up to MAX_AUTO_REPLACE times (founder, 2026-10-16). */
async function sourceHold(deps: WorkerDeps, ai: McuAi, d: McuDraft, reason: string): Promise<void> {
  if (d.kind === "icymi" || (d.autoReplaced ?? 0) >= MAX_AUTO_REPLACE) return hold(deps, d, reason)
  const job = await deps.store.getJob(d.jobId)
  if (!job) return hold(deps, d, reason)
  d.autoReplaced = (d.autoReplaced ?? 0) + 1
  const rejected = [...new Set([d.story.title, ...(d.rejected ?? [])])]
  const inFlight = await storiesInFlight(deps, d.id)
  // Photo first: the replacement's candidates (one story's worth) are kept and checked one per step (replaceStep).
  const photo = photoFirstOn(deps, job)
  const found = await researchStories(deps, ai, { ...job, count: 1 }, (await deps.content.recentPosts()).map(x => x.title), await deps.seeds(), rejected, [d.story.primaryUrl], inFlight, photo ? photoChecksFor(1) : 1)
  if ("hold" in found || !found.length) return hold(deps, d, `${reason} No replacement subject qualified: ${"hold" in found ? found.hold : "none found"}`)
  if (photo) {
    d.replacing = { pending: found, left: photoChecksFor(1), reason, dropped: [], rejected }
    d.status = "writing"
    return save(deps, d, `"${d.story.title}" couldn't be sourced (${reason.replace(/\.$/, "")}); checking ${found.length} replacement ${found.length === 1 ? "story" : "stories"} for a usable photo first`)
  }
  await switchStory(deps, d, found[0], rejected, reason)
  return writeStep(deps, ai, d)
}
/** The draft takes a replacement subject, starting again at writing. */
async function switchStory(deps: WorkerDeps, d: McuDraft, story: Story, rejected: string[], reason: string): Promise<void> {
  const was = d.story.title
  d.rejected = rejected; d.story = story
  // A new subject starts its photo search afresh; its designs get their own Canva request ids (":r<n>"), since a
  // photo hold can come after the first subject's design was created.
  d.frames = []; d.caption = undefined; d.copyNotes = undefined; d.media = []; d.designs = []; d.qa = []; d.holdReason = undefined; d.mediaRetries = undefined; d.avoidMedia = undefined; d.labelRefit = undefined
  // The new subject starts at writing: if the write below fails, the retry writes again rather than resuming the
  // photo step on nothing (gate round 3).
  d.status = "writing"
  await save(deps, d, `"${was}" couldn't be sourced (${reason.replace(/\.$/, "")}); switched to ${d.story.title}`)
}
/**
 * Photo first for a replacement subject, one check per step (coordinator review of #209): the next candidate's photo
 * is checked; the first with one becomes the draft's subject, and writing follows in the next step. Once the checks
 * are spent the next candidate goes on unchecked; when none is left, the draft holds with every reason.
 */
async function replaceStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const r = d.replacing!
  const next = r.pending.shift()
  if (next && r.left > 0) {
    r.left--
    const found = await confirmPhoto(deps, ai, next, d.kind, d.placement).catch(err => { console.error("[content-pipeline] photo first failed", next.primaryUrl, err instanceof Error ? err.message : err); return null })
    if (!found || !("why" in found)) {
      if (found) next.photo = found.photo
      d.replacing = undefined
      return switchStory(deps, d, next, r.rejected, r.reason)
    }
    r.dropped.push(`${next.title}: ${NO_PHOTO_FIRST} (${found.why.slice(0, 300)})`)
    if (r.pending.length) return save(deps, d, `replacement "${next.title}" has no usable photo; checking the next`)
  } else if (next) { d.replacing = undefined; return switchStory(deps, d, next, r.rejected, r.reason) }
  d.replacing = undefined
  return hold(deps, d, `${r.reason} No replacement subject qualified: ${r.dropped.join("; ").slice(0, 1200) || "none found"}`)
}

export type { Placement }
