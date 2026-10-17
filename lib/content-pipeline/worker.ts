import { SERIES, checkFields, ddmmmyy, normalizeFields, type Placement, type RequestKind } from "./series"
import { MCU_RULES_VERSION } from "./editorial"
import { type McuAi, type ModelCall, type SubjectBox } from "./model"
import type { McuSeeds } from "./seeds"
import { MIN_SHORT_SIDE, archiveRelevant, imageSize, isDvidsImagePage, pageImageCandidate, type MediaCandidate, type SourcePage } from "./sources"
import { MAX_ATTEMPTS, WORKING, type ChosenMedia, type CropBox, type FrameCopy, type FrameDesign, type McuDraft, type McuJob, type McuStore, type Story } from "./store"

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
export interface PostRow { id: string; title: string; status: string; publishedUrl?: string; caption?: string }
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
export interface NoContentInput { requestId: string; jobId: string; title: string; reason: string; tried: { title: string; url: string }[]; requestedBy: { email: string; name: string } }
export interface PostInput { requestId: string; title: string; caption: string; notes: string; links: string[]; designIds: string[]; requestedBy: { email: string; name: string } }
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
  /** The one "N drafts ready" alert for a finished job. */
  notify(job: McuJob, drafts: McuDraft[]): Promise<void>
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
const BREAKING_WINDOW_MS = 24 * 3600_000
const ICYMI_COUNT = 5
const MAX_SUPPORTING = 2
const MAX_AUTO_REPLACE = 2
const MAX_MEDIA_RETRIES = 2
const MAX_SHOWN = 8
const MAX_VISION_BYTES = 4_500_000

const iso = (deps: Pick<WorkerDeps, "nowMs">) => new Date(deps.nowMs()).toISOString()
export const KIND_CODE: Record<RequestKind, string> = { news: "NEWS", breaking: "BN", dt101: "DT101", icymi: "ICYMI" }
export const label = (k: RequestKind) => k === "icymi" ? "ICYMI roundup" : SERIES[k].label

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
    let stories: Story[] | { hold: string; tried?: string[]; triedUrls?: string[] } = job.kind === "icymi" ? icymiStory(posts) : await researchStories(deps, ai, job, titles, seeds)
    // Every candidate dropped (a blocked or script-only source page, no readable article, outside the Breaking window):
    // research once more, steering away from what was tried, before the job holds (production, 2026-10-17).
    if ("hold" in stories && stories.tried?.length) {
      console.info("[content-pipeline] research again", JSON.stringify({ job: id, dropped: stories.hold.slice(0, 600) }))
      const first = stories
      const again = await researchStories(deps, ai, job, titles, seeds, first.tried ?? [], first.triedUrls ?? [])
      stories = "hold" in again ? { hold: `${first.hold}; then: ${again.hold}`, tried: again.tried, triedUrls: again.triedUrls } : again
    }
    if (calls.length) console.info("[content-pipeline] calls", JSON.stringify({ job: id, calls }))
    if ("hold" in stories || !stories.length) {
      // One thorough search found nothing usable: the request ends here with a "no new content" card in Review,
      // which the requester closes; nothing searches again.
      const reason = "hold" in stories ? stories.hold.slice(0, 1000) : "No qualifying stories found"
      const titlesTried = "hold" in stories ? stories.tried ?? [] : [], urlsTried = "hold" in stories ? stories.triedUrls ?? [] : []
      const tried = titlesTried.map((title, i) => ({ title: title.slice(0, 200), url: urlsTried[i] ?? "" })).filter((t, i, all) => /^https:\/\//.test(t.url) && all.findIndex(x => x.url === t.url) === i).slice(0, 12)
      const card = await deps.content.writeNoContent({ requestId: `${KEY_PREFIX}${id}:no-content`, jobId: id, title: `No new ${label(job.kind)} content — ${iso(deps).slice(0, 10)}`, reason, tried, requestedBy: { email: job.request.actorEmail, name: job.request.actorName } })
      job.status = "held"; job.note = reason; job.noContentPostId = card.postId; job.updatedAt = iso(deps); job.notifiedAt = job.updatedAt
      await deps.store.saveJob(job); await deps.store.release("job", id, false)
      console.info("[content-pipeline] job held", JSON.stringify({ job: id, kind: job.kind, card: card.postId, tried: tried.length, note: reason.slice(0, 400) }))
      await deps.notify(job, []).catch(err => console.error("[content-pipeline] notify failed", id, err instanceof Error ? err.message : err))
      return
    }
    const day = iso(deps).slice(0, 10).replace(/-/g, ""), prefix = `MCU-${KIND_CODE[job.kind]}-${day}-`
    let n = await deps.store.highestDraftNumber(prefix)
    const now = iso(deps)
    for (const story of stories) {
      const draftId = `${prefix}${String(++n).padStart(2, "0")}`
      job.drafts.push(draftId)
      await deps.store.createDraft({ id: draftId, jobId: id, kind: job.kind, placement: job.placement, request: job.request, status: "queued", version: 1, ...(job.topic ? { direction: job.topic } : {}), story, frames: [], media: [], designs: [], qa: [], notices: [], calls: calls.map(c => ({ ...c, at: now })), history: [{ at: now, event: `opened under ${MCU_RULES_VERSION}` }], createdAt: now, updatedAt: now })
    }
    job.status = "drafting"; job.updatedAt = now; job.note = undefined
    if (job.kind !== "icymi" && stories.length < job.count) job.note = `${stories.length} of ${job.count} qualified`
    await deps.store.saveJob(job); await deps.store.release("job", id, false)
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

/** ICYMI: five published MCU News or Breaking stories from the CRM, newest first. */
function icymiStory(posts: PostRow[]): Story[] | { hold: string } {
  const eligible = posts.filter(p => (p.status === "posted" || p.publishedUrl) && !/icymi|dt101|defense tech 101|salute to troops/i.test(p.title) && p.caption).slice(0, ICYMI_COUNT)
  if (eligible.length < ICYMI_COUNT) return { hold: `only ${eligible.length} published MCU News or Breaking stories were found in the CRM; ICYMI needs five (ask Marcos for an exception)` }
  return [{ title: "ICYMI roundup", primaryUrl: eligible[0].publishedUrl || "https://www.instagram.com/milcityusa/", publisher: "MilCityUSA", sourceTitle: "Five published MCU stories", sourceText: eligible.map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n"), roundup: eligible.map(p => ({ postId: p.id, title: p.title, caption: (p.caption || "").slice(0, 800), ...(p.publishedUrl ? { publishedUrl: p.publishedUrl } : {}) })) }]
}

/** On a hold, `tried` and `triedUrls` name the candidates that were dropped, so a second pass can avoid them. */
async function researchStories(deps: WorkerDeps, ai: McuAi, job: Pick<McuJob, "kind" | "count" | "topic">, recentTitles: string[], seeds: McuSeeds | null, avoid: string[] = [], avoidUrls: string[] = []): Promise<Story[] | { hold: string; tried?: string[]; triedUrls?: string[] }> {
  const today = iso(deps).slice(0, 10)
  const r = await ai.research({ kind: job.kind, count: job.count, ...(job.topic ? { topic: job.topic } : {}), today, recentTitles, seeds, ...(avoid.length ? { avoid } : {}) })
  const stories: Story[] = [], dropped: string[] = []
  for (const c of r.candidates) {
    if (stories.length >= job.count) break
    let page: SourcePage
    try { page = await deps.fetchPage(c.primaryUrl) } catch { dropped.push(`${c.title}: source page unreachable`); continue }
    if (page.text.length < 400) { dropped.push(`${c.title}: source page has no readable article`); continue }
    const publishedAt = normalizeDate(page.publishedAt) ?? normalizeDate(c.publishedAt)
    if (job.kind === "breaking") {
      // The 24-hour window is checked against the source's own stated date, not the model's reading.
      const t = page.publishedAt ? Date.parse(page.publishedAt) : NaN
      if (!Number.isFinite(t)) { dropped.push(`${c.title}: the source page states no publication time, so the 24-hour Breaking window can't be verified`); continue }
      if (deps.nowMs() - t > BREAKING_WINDOW_MS) { dropped.push(`${c.title}: announced more than 24 hours ago (News at most)`); continue }
      if (!c.whyNow) { dropped.push(`${c.title}: no sourced why-now sentence`); continue }
    }
    if (stories.some(s => s.primaryUrl === page.url) || avoidUrls.includes(page.url)) { dropped.push(`${c.title}: already used or rejected`); continue }
    // Supporting pages fill what the primary leaves out (a DT101 card needs the maker and its headquarters, which an
    // Army article often omits: live test, 2026-10-16). Unreachable ones are skipped; the primary still decides.
    const supporting: SourcePage[] = []
    for (const u of (c.supportingUrls ?? []).slice(0, MAX_SUPPORTING)) {
      try { const sp = await deps.fetchPage(u); if (sp.text.length >= 200 && sp.url !== page.url) supporting.push(sp) } catch { /* skipped */ }
    }
    const sourceText = supporting.length ? [page.text.slice(0, 16_000), ...supporting.map(sp => `--- SUPPORTING SOURCE: ${sp.title || sp.url} (${sp.url}) ---\n${sp.text.slice(0, 4_000)}`)].join("\n\n") : page.text
    stories.push({ title: c.title, primaryUrl: page.url, publisher: c.publisher || page.siteName || new URL(page.url).hostname, ...(publishedAt ? { publishedAt } : {}), ...(job.kind === "breaking" && c.whyNow ? { whyNow: c.whyNow } : {}), sourceTitle: page.title || c.title, sourceText, ...(supporting.length ? { supporting: supporting.map(sp => ({ url: sp.url, title: sp.title || sp.url })) } : {}) })
  }
  if (!stories.length) return { hold: [r.note, ...dropped].filter(Boolean).join("; ") || "no candidates found", tried: [...avoid, ...r.candidates.map(c => c.title)], triedUrls: [...avoidUrls, ...r.candidates.map(c => c.primaryUrl)] }
  return stories
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
      case "queued": case "writing": await writeStep(deps, ai, d); break
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
  if (drafts.length < job.drafts.length || drafts.some(x => WORKING.includes(x.status))) return
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

async function writeStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const today = iso(deps).slice(0, 10)
  let problems: string[] = []
  const seeds = await deps.seeds(), steer = { seeds, ...(d.direction ? { direction: d.direction } : {}) }
  let out = await ai.write({ kind: d.kind, story: d.story, today, ...steer, ...(d.frames.length ? { previous: { frames: d.frames, caption: d.caption ?? "" } } : {}) })
  for (let round = 0; round < 2; round++) {
    if (out.hold) return sourceHold(deps, ai, d, out.hold)
    out.frames = out.frames.map((f, i) => fix(f, i, d, today))
    problems = validate(out.frames, out.caption, d.story)
    if (!problems.length) break
    out = await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames: out.frames, caption: out.caption }, problems })
  }
  if (out.hold) return sourceHold(deps, ai, d, out.hold)
  out.frames = out.frames.map((f, i) => fix(f, i, d, today))
  problems = validate(out.frames, out.caption, d.story)
  if (problems.length) return hold(deps, d, `the copy still breaks the template rules after two rewrites: ${problems.slice(0, 4).join("; ")}`)
  d.frames = out.frames; d.caption = out.caption; d.holdReason = undefined; d.error = undefined
  d.status = d.media.length === d.frames.length && d.media.every(Boolean) ? "designing" : "media"
  await save(deps, d, `copy written (v${d.version})`)
}
/** Fills what the server knows better than the model: DDMMMYY dates, the ICYMI counters, uppercase fields. */
function fix(f: FrameCopy, index: number, d: McuDraft, today: string): FrameCopy {
  const series = SERIES[f.series], fields = { ...f.fields }
  if (series.fields.some(x => x.name === "date")) fields.date = ddmmmyy(f.series === "icymi_cover" ? today : d.story.publishedAt ?? today)
  if (f.series === "icymi_story") fields.counter = `0${index} / 05` // the cover is not counted
  return { ...f, fields: normalizeFields(series, fields) }
}
function validate(frames: FrameCopy[], caption: string, story: Story): string[] {
  const problems = frames.flatMap((f, i) => checkFields(SERIES[f.series], f.fields).map(p => frames.length > 1 ? `frame ${i + 1}: ${p}` : p))
  if (!caption.trim()) problems.push("caption is empty")
  if (caption.length > 2100) problems.push("caption is longer than Instagram allows (2,200 characters with credits)")
  if (/@[A-Za-z0-9_.]{2,}/.test(caption)) problems.push("caption contains an @handle; use plain names (tags need verified accounts)")
  // Credit and notice lines carry license versions and item numbers, not story facts.
  const body = caption.split("\n").filter(l => !/^(Archive image|Image|Photo): /.test(l) && l !== DOD_NOTICE).join("\n")
  const nums = unsourcedNumbers([body, ...frames.flatMap(f => Object.entries(f.fields).filter(([k]) => k !== "date" && k !== "counter").map(([, v]) => v))], story.sourceText)
  if (nums.length) problems.push(`these figures are not in the source: ${nums.join(", ")}`)
  return problems
}

/** The maker named on the card ("ULTRA / OVERLAND AI" → "OVERLAND AI"), else the story's publisher. */
export function makerOf(frame: FrameCopy, story: Pick<Story, "publisher">): string {
  return (frame.fields.subject_identifier ?? "").split("/")[1]?.trim() || story.publisher
}
const GOV_PAGE = /(^|\.)(mil|gov)$|(^|\.)dvidshub\.net$/i
/**
 * A page the photo search found is used only when its photo's rights can be read from it: a U.S. government or DVIDS
 * page (public domain unless marked courtesy), or the maker's own site (company media, flagged for the reviewer to
 * confirm its terms). A news outlet's or anyone else's page is skipped: its photo is licensed to that outlet.
 */
export function searchedPageUsable(url: string, maker: string): boolean {
  let host: string
  try { host = new URL(url).hostname.toLowerCase() } catch { return false }
  if (GOV_PAGE.test(host)) return true
  const words = maker.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !["inc", "corp", "the", "company", "technologies", "systems", "industries", "group", "defense", "defence"].includes(w))
  const labels = host.replace(/^www\./, "").split(".").slice(0, -1).join(".")
  return words.length > 0 && words.some(w => labels.includes(w))
}
/**
 * Photo candidates, in the editorial rules' order: the story's own pages first (official company or agency media),
 * then pages the photo search found (DVIDS, other U.S. government sites, the maker's newsroom or press kit), then the
 * open archives (Wikimedia Commons, Openverse, NASA). Archive hits must tie themselves to the story (archiveRelevant).
 * Each is fetched once, sized from its own header and dropped below MIN_SHORT_SIDE; at most MAX_SHOWN go to the
 * vision pick. Sources that need a key or account (the DVIDS API) are not used until the founder adds one.
 */
async function gatherMedia(deps: WorkerDeps, ai: McuAi, d: McuDraft, frame: FrameCopy, avoid: string[]): Promise<{ candidate: MediaCandidate; image: Uint8Array; mime: string }[]> {
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
  const pages: SourcePage[] = []
  for (const u of [d.story.primaryUrl, ...(d.story.supporting ?? []).map(x => x.url)]) { try { pages.push(await deps.fetchPage(u)) } catch { /* skipped */ } }
  for (const pg of pages) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source"))
  const maker = makerOf(frame, d.story)
  for (const u of await ai.findPhotoPages({ story: d.story, frame }).catch(() => [])) {
    if (out.length >= MAX_SHOWN) break
    if (!searchedPageUsable(u, maker)) continue
    try { const pg = await deps.fetchPage(u); if (searchedPageUsable(pg.url, maker)) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source")) } catch { /* skipped */ }
  }
  for (const q of mediaQueries(frame, d.story)) {
    if (out.length >= MAX_SHOWN) break
    const [commons, more] = await Promise.all([deps.searchCommons(q).catch(() => []), deps.searchMore ? deps.searchMore(q).catch(() => []) : Promise.resolve([])])
    for (const c of [...commons, ...more]) if (archiveRelevant(c, maker)) await add(c)
  }
  return out
}

const FRAME_ASPECT: Record<Placement, number> = { feed: 4 / 5, reels: 9 / 16 }
/**
 * Where a photo's subject lands on the card. Canva fills the template's full-bleed frame like CSS "cover": scaled to
 * fill, centred, the overflow cropped. The approved DT101 (ULTRA, DAHXpX39sh8) has a close hero subject filling the
 * upper part of the card with the text block on the scrim over the lower 40%; Smartie's log adds: full bleed, subject
 * recognizable at phone size, no sky-only or tail-only crops, change the crop or image rather than the layout.
 * Rules: the subject is not cut off by the crop, its centre sits above the text block (upper 60%), it spans at least
 * 30% of the card's height or 45% of its width, and the cropped photo is at least 500 px wide before upscaling.
 */
export function cropFit(width: number, height: number, box: SubjectBox, placement: Placement): { ok: boolean; problems: string[] } {
  const f = FRAME_ASPECT[placement], a = width / height
  const win = a > f ? { x0: 0.5 - f / (2 * a), x1: 0.5 + f / (2 * a), y0: 0, y1: 1 } : { x0: 0, x1: 1, y0: 0.5 - a / (2 * f), y1: 0.5 + a / (2 * f) }
  const toCard = (v: number, lo: number, hi: number) => (v - lo) / (hi - lo)
  const bx0 = toCard(box.x0, win.x0, win.x1), bx1 = toCard(box.x1, win.x0, win.x1), by0 = toCard(box.y0, win.y0, win.y1), by1 = toCard(box.y1, win.y0, win.y1)
  const visible = (Math.min(bx1, 1) - Math.max(bx0, 0)) * (Math.min(by1, 1) - Math.max(by0, 0))
  const area = Math.max(1e-6, (bx1 - bx0) * (by1 - by0))
  const problems: string[] = []
  if (visible / area < 0.85) problems.push("the 4:5 crop cuts off the subject")
  if ((by0 + by1) / 2 > 0.6) problems.push("the subject sits low, under the text block")
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
const ZOOM = { context: { bottom: 0.6, height: 0.45 }, empty: { bottom: 0.72, height: 0.62 }, maxWidth: 0.9, minWindowPx: 600 }
/**
 * The crop (fractions of the photo) that zooms a subject into that space on a 4:5 (or 9:16) card, within the photo's
 * edges and never narrower than 600 px of source, so the upscale stays sharp. lib/image-crop.ts applies it before the
 * Canva fill, which then has nothing left to centre.
 */
export function zoomCrop(width: number, height: number, box: SubjectBox, placement: Placement, context = true): CropBox {
  const f = FRAME_ASPECT[placement], target = context ? ZOOM.context : ZOOM.empty
  const bw = (box.x1 - box.x0) * width, bh = (box.y1 - box.y0) * height
  let wh = Math.max(bh / target.height, bw / (ZOOM.maxWidth * f), ZOOM.minWindowPx / f) // window height in source px
  wh = Math.min(wh, height, width / f)
  const ww = wh * f
  const left = Math.min(Math.max(((box.x0 + box.x1) / 2) * width - ww / 2, 0), width - ww)
  const top = Math.min(Math.max(box.y1 * height - target.bottom * wh, 0), height - wh)
  const r = (v: number) => Math.round(v * 10_000) / 10_000
  return { x: r(left / width), y: r(top / height), width: r(ww / width), height: r(wh / height) }
}
/** The subject box inside a crop, as fractions of the cropped photo. */
function boxInCrop(box: SubjectBox, c: CropBox): SubjectBox {
  return { x0: (box.x0 - c.x) / c.width, x1: (box.x1 - c.x) / c.width, y0: (box.y0 - c.y) / c.height, y1: (box.y1 - c.y) / c.height }
}
/**
 * The pick, zoomed and checked: the vision model's ranking, best first; each relevant photo is zoomed so its subject
 * fills the open space, and the first that then passes the crop rule wins. When none does, its best choice is kept,
 * zoomed, with a note for the reviewer (the artwork check then looks at the real export).
 */
export function choosePhoto(pick: { index: number | null; ranked?: { index: number; box: SubjectBox; context?: boolean }[] }, candidates: MediaCandidate[], placement: Placement): { index: number; crop?: CropBox; note?: string } | null {
  if (!pick.ranked?.length) return pick.index === null ? null : { index: pick.index }
  const judge = (r: { index: number; box: SubjectBox; context?: boolean }) => {
    const c = candidates[r.index]
    if (!c) return null
    const crop = zoomCrop(c.width, c.height, r.box, placement, r.context !== false)
    return { crop, fit: cropFit(crop.width * c.width, crop.height * c.height, boxInCrop(r.box, crop), placement) }
  }
  for (const r of pick.ranked) { const j = judge(r); if (j?.fit.ok) return { index: r.index, crop: j.crop } }
  const best = pick.ranked.find(x => x.index === pick.index) ?? pick.ranked[0], j = judge(best)
  return { index: best.index, ...(j ? { crop: j.crop } : {}), note: `No candidate photo fit the card cleanly${j?.fit.problems.length ? ` (${j.fit.problems.join("; ")})` : ""}; check the photo placement` }
}

async function mediaStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const job = await deps.store.getJob(d.jobId)
  const used = new Set<string>()
  for (const other of job?.drafts ?? []) if (other !== d.id) for (const m of (await deps.store.getDraft(other))?.media ?? []) if (m) used.add(m.pageUrl)
  const media: (ChosenMedia | null)[] = []
  for (const [i, frame] of d.frames.entries()) {
    if (!SERIES[frame.series].media[d.placement]) { media.push(null); continue }
    if (d.media[i]) { media.push(d.media[i]); continue }
    const avoid = [...used, ...(d.avoidMedia ?? [])]
    const shown = await gatherMedia(deps, ai, d, frame, avoid)
    const pick = await ai.pickMedia({ story: d.story, frame, candidates: shown, avoid: [...avoid] })
    const chosen = choosePhoto(pick, shown.map(x => x.candidate), d.placement)
    if (chosen === null) { d.media = media; return hold(deps, d, `no relevant, licensed photo was found${frame.mediaQuery ? ` for "${frame.mediaQuery}"` : ""} (${pick.reason})`) }
    const c = shown[chosen.index].candidate
    used.add(c.pageUrl)
    console.info("[content-pipeline] media", JSON.stringify({ draft: d.id, v: d.version, retry: d.mediaRetries ?? 0, shown: shown.map(x => `${x.candidate.origin ?? "?"}:${x.candidate.width}x${x.candidate.height}:${x.candidate.title.slice(0, 60)}`), ranked: pick.ranked ?? null, chosen: chosen.index, crop: chosen.crop ?? null, note: chosen.note ?? null }))
    media.push({ url: c.url, pageUrl: c.pageUrl, title: c.title, license: c.license, creator: c.creator, credit: c.credit, usGovernment: c.usGovernment, ...(c.date ? { date: c.date } : {}), ...(c.rightsNote || chosen.note ? { note: [c.rightsNote, chosen.note].filter(Boolean).join(". ") } : {}), ...(chosen.crop ? { crop: chosen.crop } : {}) })
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
    const text = Object.fromEntries(Object.entries(frame.fields).filter(([k]) => dataset[k] === "text"))
    const missing = Object.keys(frame.fields).filter(k => dataset[k] !== "text")
    if (missing.length) notices.add(`${series.label} template has no field for ${missing.join(", ")}`)
    const title = `${d.id} v${d.version}${d.frames.length > 1 ? ` · ${i + 1}/${d.frames.length}` : ""} — ${(frame.fields.headline || frame.fields.subject_identifier || frame.fields.counter || series.label).slice(0, 120)}`
    const r = await deps.content.createDesign({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}:f${i + 1}${d.mediaRetries ? `:m${d.mediaRetries}` : ""}`, templateId, title, text, ...(image ? { image } : {}) })
    designs.push({ templateId, ...r })
  }
  if (d.frames.some(f => f.series === "icymi_story")) notices.add("ICYMI story cards: the progress bar width can't be set through Canva's API, so each card keeps the template's bar")
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
  const qa: string[] = [], photoDefects: { frame: number; defect: string }[] = []
  for (const [i, frame] of d.frames.entries()) {
    if (!images[i]) continue
    for (const p of await ai.checkArtwork({ frame, images: [images[i]] }).catch(() => [{ defect: "automatic artwork check did not run", photo: false }])) {
      qa.push(d.frames.length > 1 ? `frame ${i + 1}: ${p.defect}` : p.defect)
      if (p.photo) photoDefects.push({ frame: i, defect: p.defect })
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
  for (const m of d.media) if (m?.note && !qa.includes(m.note)) qa.push(m.note)
  d.qa = qa; d.status = "posting"
  await save(deps, d, `artwork checked (v${d.version}): ${qa.length ? `${qa.length} to check` : "no defects found"}`)
}

/** The content post's review notes: sources, photo rights, checks and what was not done. Plain text, ≤4,000 characters. */
export function reviewNotes(d: McuDraft): string {
  const sections: string[] = [`${d.id} · v${d.version} · ${label(d.kind)} — drafted by the content pipeline (${MCU_RULES_VERSION}). Review the card and caption, then approve through the publisher.`]
  d.frames.forEach((f, i) => {
    const vals = SERIES[f.series].fields.filter(x => f.fields[x.name]).map(x => `- ${x.label}: ${f.fields[x.name]}`)
    sections.push(`Graphic copy${d.frames.length > 1 ? ` — ${i + 1}. ${SERIES[f.series].label}` : ""} (on the card)\n${vals.join("\n")}`)
  })
  sections.push(`Source\n${d.story.sourceTitle.slice(0, 160)} — ${d.story.publisher}${d.story.publishedAt ? `, ${d.story.publishedAt}` : ""}\n${d.story.primaryUrl}${(d.story.supporting ?? []).map(x => `\nAlso: ${x.title.slice(0, 120)} — ${x.url}`).join("")}`)
  if (d.story.whyNow) sections.push(`Why Breaking\n${d.story.whyNow}`)
  const media = d.media.map((m, i) => m ? `- ${d.media.length > 1 ? `${i + 1}: ` : ""}${m.title.slice(0, 80)} — ${m.license}${m.creator && m.creator !== "Unknown" ? `, ${m.creator}` : ""}\n  ${m.pageUrl}${m.note ? `\n  ${m.note}` : ""}` : null).filter(Boolean)
  sections.push(`Photo rights\n${media.length ? media.join("\n") : "- No photo on this card"}`)
  sections.push(`Canva\n${d.designs.map((x, i) => `${d.designs.length > 1 ? `Frame ${i + 1}: ` : ""}${x.editUrl || x.viewUrl} (design ${x.designId})`).join("\n")}`)
  if (d.qa.length) sections.push(`Check before approving\n${d.qa.map(q => `- ${q}`).join("\n")}`)
  if (d.notices.length) sections.push(`Not done\n${d.notices.map(n => `- ${n}`).join("\n")}`)
  const out = sections.join("\n\n")
  return out.length > 4000 ? `${out.slice(0, 3990)}…` : out
}

async function postStep(deps: WorkerDeps, d: McuDraft): Promise<void> {
  if (d.postId) { d.status = "in_review"; return save(deps, d, "already on the board") }
  const head = d.frames[0]?.fields.headline || d.frames[0]?.fields.subject_identifier || d.story.title
  const links = [...new Set([d.story.primaryUrl, ...(d.story.supporting ?? []).map(x => x.url), ...d.media.filter((m): m is ChosenMedia => !!m).map(m => m.pageUrl)])]
  const r = await deps.content.writePost({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}`, title: `${d.id} v${d.version} — ${head.replace(/\n/g, " ")}`.slice(0, 200), caption: d.caption ?? "", notes: reviewNotes(d), links, designIds: d.designs.map(x => x.designId), requestedBy: { email: d.request.actorEmail, name: d.request.actorName } })
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
  const found = await researchStories(deps, ai, { ...job, count: 1 }, (await deps.content.recentPosts()).map(x => x.title), await deps.seeds(), rejected, [d.story.primaryUrl])
  if ("hold" in found || !found.length) return hold(deps, d, `${reason} No replacement subject qualified: ${"hold" in found ? found.hold : "none found"}`)
  const was = d.story.title
  d.rejected = rejected; d.story = found[0]
  d.frames = []; d.caption = undefined; d.media = []; d.designs = []; d.qa = []; d.holdReason = undefined
  await save(deps, d, `"${was}" couldn't be sourced (${reason.replace(/\.$/, "")}); switched to ${d.story.title}`)
  return writeStep(deps, ai, d)
}

export type { Placement }
