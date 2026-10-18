import { SERIES, checkFields, clippedWords, ddmmmyy, normalizeFields, type Placement, type RequestKind } from "./series"
import { BRAND } from "./brand"
import { headlineProblems, originalityProblems } from "./copy-checks"
import { icymiCount, meaningful, normalizeUrl, unusedStorySlot, type McuAi, type ModelCall, type RankedPhoto, type SubjectBox } from "./model"
import { contentPropertyOf } from "./properties"
import type { ContentProperty, PipelineMedia } from "@/components/crm/types"
import type { McuSeeds } from "./seeds"
import { MIN_SHORT_SIDE, archiveRelevant, federalHost, imageSize, isDvidsImagePage, isOutlet, pageImageCandidate, type MediaCandidate, type SourcePage } from "./sources"
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
/** publishedAt: when the post went out (posted_at, else its post date), for the ICYMI window; media: its pipeline_media. */
export interface PostRow { id: string; title: string; status: string; publishedUrl?: string; caption?: string; publishedAt?: string; media?: PipelineMedia[] }
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
/** media: the photo each frame used, recorded on the post as pipeline_media for ICYMI to reuse. */
export interface PostInput { requestId: string; property: ContentProperty; title: string; caption: string; notes: string; links: string[]; media: PipelineMedia[]; designIds: string[]; requestedBy: { email: string; name: string } }
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
  /** The ICYMI lookback (content_pipeline_config/icymi_window): null days = the previous Monday-to-Sunday week. */
  icymiWindow?(): Promise<{ lookbackDays: number | null }>
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
 * a card dated 2026-10-17). Breaking: the page's own stated time, within 24 hours (below). News: published within the
 * last 7 days, by the page's stated date or else the date the search reported; with no date at all it is dropped,
 * since the card prints the source date. DT101 is an explainer, so an undated page describing the system (the maker's
 * product page) counts as current; but a dated page is a news hook, and it must be from the last 90 days. A stale
 * page is a miss like an unreadable one, so the subject's other primary pages are tried before it drops.
 */
export const RECENCY_DAYS: Partial<Record<RequestKind, number>> = Object.fromEntries(BRAND.requestKinds.filter(k => k.recencyDays).map(k => [k.kind, k.recencyDays]))
export function staleSource(kind: RequestKind, publishedAt: string | undefined, nowMs: number): string | null {
  const days = RECENCY_DAYS[kind]
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
    let stories: Story[] | { hold: string; tried?: string[]; triedUrls?: string[] } = job.kind === "icymi" ? icymiStory(posts, icymiWindow(deps.nowMs(), (await deps.icymiWindow?.().catch(() => null))?.lookbackDays ?? null)) : await researchStories(deps, ai, job, titles, seeds, [], [], inFlight)
    // Every candidate dropped (a blocked or script-only source page, no readable article, outside the Breaking window):
    // research once more, steering away from what was tried, before the job holds (production, 2026-10-17).
    // Zero candidates too: that pass found nothing to try, so the second pass is the search's one retry, not a loop.
    if ("hold" in stories && "tried" in stories) {
      console.info("[content-pipeline] research again", JSON.stringify({ job: id, dropped: stories.hold.slice(0, 600) }))
      const first = stories
      const again = await researchStories(deps, ai, job, titles, seeds, first.tried ?? [], first.triedUrls ?? [], inFlight)
      stories = "hold" in again ? { hold: `${first.hold}; then: ${again.hold}`, tried: again.tried, triedUrls: again.triedUrls } : again
    }
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
    const now = iso(deps)
    for (const story of stories) {
      const draftId = `${prefix}${String(++n).padStart(2, "0")}`
      job.drafts.push(draftId)
      await deps.store.createDraft({ id: draftId, jobId: id, kind: job.kind, placement: job.placement, request: job.request, status: "queued", version: 1, ...(job.topic ? { direction: job.topic } : {}), story, frames: [], media: [], designs: [], qa: [], notices: [], calls: calls.map(c => ({ ...c, at: now })), history: [{ at: now, event: `opened under ${BRAND.rulesVersion}` }], createdAt: now, updatedAt: now })
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
/**
 * ICYMI: up to five published MCU News or Breaking stories from the window, newest first, no repeats; held only when
 * none qualify (founder, 2026-10-17: "UP TO 5"). A post with no publication time can't be placed in a week, so it is
 * left out.
 * TODO(analytics): the founder's rule is the five best-performing stories; rank by performance once analytics are
 * mapped to this workflow. Until then, recency.
 */
export function icymiStory(posts: PostRow[], window: { startMs: number; endMs: number; label: string }): Story[] | { hold: string } {
  const at = (p: PostRow) => p.publishedAt ? Date.parse(p.publishedAt) : NaN
  // DT101 posts are told by their mission-brief caption too: older manual ones aren't titled DT101 (gate round 1, ULTRA).
  const exclude = new RegExp(BRAND.posts.roundupExclude, "i"), excludeCaption = new RegExp(BRAND.posts.roundupExcludeCaption, "i")
  const eligible = posts.filter(p => (p.status === "posted" || p.publishedUrl) && !exclude.test(p.title) && p.caption && !excludeCaption.test(p.caption) && at(p) >= window.startMs && at(p) < window.endMs)
    .sort((a, b) => at(b) - at(a))
    .filter((p, i, all) => all.findIndex(x => x.title.trim().toLowerCase() === p.title.trim().toLowerCase()) === i)
    .slice(0, ICYMI_MAX)
  if (!eligible.length) return { hold: `no ${BRAND.shortName} News or Breaking story was published in ${window.label}, so there is no ICYMI` }
  return [{ title: "ICYMI roundup", primaryUrl: eligible[0].publishedUrl || BRAND.posts.homeUrl, publisher: BRAND.name, sourceTitle: `${eligible.length} published ${BRAND.shortName} ${eligible.length === 1 ? "story" : "stories"} from ${window.label}`, sourceText: eligible.map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n"), roundup: eligible.map(p => ({
    postId: p.id, title: p.title, caption: (p.caption || "").split("\n").filter(l => !/^Image: /.test(l) && l !== DOD_NOTICE).join("\n").trim().slice(0, 800), ...(p.publishedUrl ? { publishedUrl: p.publishedUrl } : {}), ...(p.media?.[0] ? { media: p.media[0] } : {}),
  })) }]
}

/** On a hold, `tried` and `triedUrls` name the candidates that were dropped, so a second pass can avoid them. */
async function researchStories(deps: WorkerDeps, ai: McuAi, job: Pick<McuJob, "kind" | "count" | "topic">, recentTitles: string[], seeds: McuSeeds | null, avoid: string[] = [], avoidUrls: string[] = [], inFlight: { titles: string[]; urls: Set<string> } = { titles: [], urls: new Set() }): Promise<Story[] | { hold: string; tried?: string[]; triedUrls?: string[] }> {
  const today = iso(deps).slice(0, 10)
  const r = await ai.research({ kind: job.kind, count: job.count, ...(job.topic ? { topic: job.topic } : {}), today, recentTitles, seeds, ...(avoid.length ? { avoid } : {}), ...(inFlight.titles.length ? { drafting: inFlight.titles } : {}) })
  const stories: Story[] = [], dropped: string[] = [], outlets = (seeds?.orgs ?? []).filter(o => o.kind === BRAND.seeds.outletKind).map(o => o.site)
  for (const c of r.candidates) {
    if (stories.length >= job.count) break
    // The primary page first, then other primary pages for the same subject (product page, .mil/.gov page, press
    // release), so one unreadable page doesn't drop the subject. Each miss keeps its reason for the hold note.
    if (avoidUrls.includes(c.primaryUrl)) { dropped.push(`${c.title}: already tried`); continue }
    if (inFlight.urls.has(normalizeUrl(c.primaryUrl))) { dropped.push(`${c.title}: already being drafted`); continue }
    let page: SourcePage | null = null, publishedAt: string | undefined
    const misses: string[] = []
    // The story is sourced from its primary page: an outlet's article only led to it (gate round 2: two DT101 cards
    // sourced from Defense News). Outlet URLs are skipped; another primary page for the subject is tried instead.
    for (const url of [...new Set([c.primaryUrl, ...(c.alternateUrls ?? [])])].slice(0, 5)) {
      if (isOutlet(url, outlets)) { misses.push(`${url} is a news outlet's article, not the primary source`); continue }
      try {
        const p = await deps.fetchPage(url)
        if (p.text.length < 400) { misses.push(`no readable article at ${url}`); continue }
        // The search's date stands in only for the page it described, never for an alternate.
        const date = normalizeDate(p.publishedAt) ?? (url === c.primaryUrl ? normalizeDate(c.publishedAt) : undefined)
        const stale = staleSource(job.kind, date, deps.nowMs())
        if (stale) { misses.push(`${url} ${stale}`); continue }
        page = p; publishedAt = date; break
      } catch (err) { misses.push(`${err instanceof Error ? err.message : "unreachable"} at ${url}`) }
    }
    if (!page) { dropped.push(`${c.title}: source page unreachable, unreadable or out of date (${misses.join("; ").slice(0, 300)})`); continue }
    if (job.kind === "breaking") {
      // The 24-hour window is checked against the source's own stated date, not the model's reading.
      const t = page.publishedAt ? Date.parse(page.publishedAt) : NaN
      if (!Number.isFinite(t)) { dropped.push(`${c.title}: the source page states no publication time, so the 24-hour Breaking window can't be verified`); continue }
      if (deps.nowMs() - t > BREAKING_WINDOW_MS) { dropped.push(`${c.title}: announced more than 24 hours ago (News at most)`); continue }
      if (!c.whyNow) { dropped.push(`${c.title}: no sourced why-now sentence`); continue }
    }
    if (stories.some(s => normalizeUrl(s.primaryUrl) === normalizeUrl(page.url)) || avoidUrls.includes(page.url) || inFlight.urls.has(normalizeUrl(page.url))) { dropped.push(`${c.title}: already used, rejected or being drafted`); continue }
    // Supporting pages fill what the primary leaves out (a DT101 card needs the maker and its headquarters, which an
    // Army article often omits: live test, 2026-10-16). Unreachable ones are skipped; the primary still decides.
    const supporting: SourcePage[] = []
    for (const u of (c.supportingUrls ?? []).slice(0, MAX_SUPPORTING)) {
      if (isOutlet(u, outlets)) continue
      // A supporting page must be about the same subject (round 2 attached an unrelated Northrop Raid Hunter release).
      try { const sp = await deps.fetchPage(u); if (sp.text.length >= 200 && sp.url !== page.url && (COMPANY_PAGE.test(new URL(sp.url).pathname) || sameSubject(c.title, `${sp.title} ${sp.text.slice(0, 6000)}`))) supporting.push(sp) } catch { /* skipped */ }
    }
    const sourceText = supporting.length ? [page.text.slice(0, 16_000), ...supporting.map(sp => `--- SUPPORTING SOURCE: ${sp.title || sp.url} (${sp.url}) ---\n${sp.text.slice(0, 4_000)}`)].join("\n\n") : page.text
    stories.push({ title: c.title, primaryUrl: page.url, publisher: c.publisher || page.siteName || new URL(page.url).hostname, ...(publishedAt ? { publishedAt } : {}), ...(job.kind === "breaking" && c.whyNow ? { whyNow: c.whyNow } : {}), sourceTitle: page.title || c.title, sourceText, ...(supporting.length ? { supporting: supporting.map(sp => ({ url: sp.url, title: sp.title || sp.url })) } : {}) })
  }
  // The model's note is chatter about how it chose ("Candidates selected based on relevance…", round 2) unless it is
  // the only explanation, when nothing was found.
  if (!stories.length) return { hold: [r.candidates.length ? "" : r.note, ...dropped].filter(Boolean).join("; ") || "no candidates found", tried: [...avoid, ...r.candidates.map(c => c.title)], triedUrls: [...avoidUrls, ...r.candidates.map(c => c.primaryUrl)] }
  return stories
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
    out.hold = meaningful(out.hold) // "None" is no hold (gate round 3: it replaced a subject)
    if (out.hold) return sourceHold(deps, ai, d, out.hold)
    out.frames = out.frames.map((f, i) => fix(f, i, d, today))
    problems = validate(out.frames, out.caption, d.story)
    if (!problems.length) break
    out = await ai.write({ kind: d.kind, story: d.story, today, ...steer, previous: { frames: out.frames, caption: out.caption }, problems })
  }
  out.hold = meaningful(out.hold)
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
  if (f.series === "icymi_story") fields.counter = `0${index} / 0${icymiCount(d.story)}` // the cover is not counted
  if (f.series === "icymi_cover") for (const k of Object.keys(fields)) if (unusedStorySlot(k, icymiCount(d.story))) delete fields[k]
  return { ...f, fields: normalizeFields(series, fields) }
}
function validate(frames: FrameCopy[], caption: string, story: Story): string[] {
  // The cover's slots past the roundup's last story are blank by design, not empty by mistake.
  const n = icymiCount(story), unused = new Set(SERIES.icymi_cover.fields.filter(f => unusedStorySlot(f.name, n)).map(f => `${f.label} is empty`))
  const problems = frames.flatMap((f, i) => checkFields(SERIES[f.series], f.fields).filter(p => f.series !== "icymi_cover" || !unused.has(p)).map(p => frames.length > 1 ? `frame ${i + 1}: ${p}` : p))
  if (!caption.trim()) problems.push("caption is empty")
  if (caption.length > 2100) problems.push("caption is longer than Instagram allows (2,200 characters with credits)")
  if (/@[A-Za-z0-9_.]{2,}/.test(caption)) problems.push("caption contains an @handle; use plain names (tags need verified accounts)")
  // Credit and notice lines carry license versions and item numbers, not story facts.
  const body = caption.split("\n").filter(l => !/^(Archive image|Image|Photo): /.test(l) && l !== DOD_NOTICE).join("\n")
  const nums = unsourcedNumbers([body, ...frames.flatMap(f => Object.entries(f.fields).filter(([k]) => k !== "date" && k !== "counter").map(([, v]) => v))], story.sourceText)
  if (nums.length) problems.push(`these figures are not in the source: ${nums.join(", ")}`)
  // The caption ends with its own "Source:" line, and a DT101 caption is the mission brief (gate round 2: a DT101 with
  // a three-paragraph news caption, another with no source line, a News caption with "Source:" mid-paragraph).
  if (!/^Source: \S/m.test(body)) problems.push('the caption needs its source on a line of its own: "Source: <organization>, <date>"')
  const format = frames[0] ? SERIES[frames[0].series]?.caption : undefined
  if (format) {
    const lines = body.split("\n").map(l => l.trim()).filter(Boolean)
    if (format.firstLines.some((re, i) => !new RegExp(re).test(lines[i] ?? ""))) problems.push(format.format)
    for (const label of format.labels) if (!lines.some(l => l.startsWith(label))) problems.push(format.missingLabel.replace("{label}", label))
  }
  // The copy must be about this draft's story (gate round 3: after a subject switch, DT101-10 and -12 carried the
  // previous subject's mission brief). A roundup's copy is about five stories, so it is not checked here.
  if (!story.roundup && !sameSubject(`${story.title} ${story.sourceTitle}`, [caption, ...frames.flatMap(f => Object.values(f.fields))].join(" "))) problems.push(`the copy is not about this story ("${story.title.slice(0, 100)}"): write it from the source below`)
  for (const f of frames) if (f.fields.deck && !/[.!?]["”’)]?$/.test(f.fields.deck.trim())) problems.push(`the deck must be one complete sentence ending with a period: "${f.fields.deck}"`)
  // The profile's headline and originality checks (Phase 1c, founder 2026-10-17): off unless the profile turns them on.
  const checks = BRAND.checks
  if (checks?.headline) problems.push(...headlineProblems(frames, checks.headline))
  if (checks?.originality) problems.push(...originalityProblems(frames, caption, story, checks.originality, [...(checks.headline?.fields ?? []), ...(checks.headline?.hookFields ?? [])]))
  const clipped = [...new Set(frames.flatMap(f => clippedWords(f.fields, story.sourceText)))]
  if (clipped.length) problems.push(`abbreviated words on the card (${clipped.join(", ")}); use whole words, and shorter ones if it must fit`)
  return problems
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
 * vision pick. Sources that need a key or account (the DVIDS API) are not used until the founder adds one.
 */
async function gatherMedia(deps: WorkerDeps, ai: McuAi, story: Story, frame: FrameCopy, avoid: string[], reuse?: MediaCandidate[]): Promise<{ candidate: MediaCandidate; image: Uint8Array; mime: string }[]> {
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
  // A social post's share image is MCU's own rendered card (ICYMI's stories link to Instagram), and an outlet's photo
  // is licensed to the outlet: neither is a photo source.
  for (const u of [story.primaryUrl, ...(story.supporting ?? []).map(x => x.url)].filter(u => /^https:\/\//.test(u) && !SOCIAL_HOST.test(u) && !isOutlet(u, outlets))) { try { pages.push(await deps.fetchPage(u)) } catch { /* skipped */ } }
  for (const pg of pages) await add(pageImageCandidate(pg, isDvidsImagePage(pg.url) ? "dvids" : "source"))
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
 * images), from the record the pipeline wrote on the post (pipeline_media). It is fetched from exactly the recorded
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
 * The story a frame's photo is about. An ICYMI story card shows the published story it recaps (its title and caption),
 * not the roundup; the cover takes the lead story's photo (mediaStep). Gate round 1 (2026-10-17) searched for a cover
 * photo of the roundup's theme, "Multi-domain", and found nothing.
 */
export function frameStory(d: Pick<McuDraft, "story">, frame: FrameCopy, index: number): Story {
  if (frame.series !== "icymi_story") return d.story
  const p = d.story.roundup?.[index - 1]
  return p ? { title: p.title.replace(new RegExp(`^${BRAND.draftPrefix}-[A-Z0-9]+-\\d{8}-\\d{2}\\s+v\\d+\\s+—\\s+`), ""), primaryUrl: p.publishedUrl ?? "", publisher: BRAND.name, sourceTitle: p.title, sourceText: p.caption } : d.story
}
/** Series the brand profile marks representative (for MCU: News, Breaking and the ICYMI story cards; never DT101). */
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
const ZOOM = { context: { bottom: 0.6, height: 0.45 }, empty: { bottom: 0.72, height: 0.62 }, maxWidth: 0.9, minWindowPx: 600 }
/**
 * The crop (fractions of the photo) that zooms a subject into that space on a 4:5 (or 9:16) card, within the photo's
 * edges and never narrower than 600 px of source, so the upscale stays sharp. lib/image-crop.ts applies it before the
 * Canva fill, which then has nothing left to centre.
 */
export function zoomCrop(width: number, height: number, box: SubjectBox, placement: Placement, context = true, core?: SubjectBox): CropBox {
  const f = FRAME_ASPECT[placement], target = context ? ZOOM.context : ZOOM.empty
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

async function mediaStep(deps: WorkerDeps, ai: McuAi, d: McuDraft): Promise<void> {
  const job = await deps.store.getJob(d.jobId)
  const used = new Set<string>()
  for (const other of job?.drafts ?? []) if (other !== d.id) for (const m of (await deps.store.getDraft(other))?.media ?? []) if (m) used.add(m.pageUrl)
  const media: (ChosenMedia | null)[] = d.frames.map((_, i) => d.media[i] ?? null)
  // The ICYMI cover is filled last, from the lead story's photo.
  const order = d.frames.map((f, i) => ({ f, i })).sort((a, b) => Number(a.f.series === "icymi_cover") - Number(b.f.series === "icymi_cover"))
  for (const { f: frame, i } of order) {
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
    if (frame.series === "icymi_cover") {
      const lead = media.find((m, j) => !!m && d.frames[j].series === "icymi_story")
      if (lead) { media[i] = { ...lead }; continue }
    }
    const story = frameStory(d, frame, i), representative = allowsRepresentative(frame)
    const avoid = [...used, ...(d.avoidMedia ?? [])]
    const item = frame.series === "icymi_story" ? d.story.roundup?.[i - 1] : undefined
    const reuse = item ? publishedPhoto(item) : []
    let shown = reuse.length ? await gatherMedia(deps, ai, story, frame, avoid, reuse) : []
    // Nothing recoverable from the published post: search, and say so.
    const searched = !shown.length
    if (searched) shown = await gatherMedia(deps, ai, story, frame, avoid)
    const pick = await ai.pickMedia({ story, frame, candidates: shown, avoid: [...avoid], representative })
    const chosen = choosePhoto(pick, shown.map(x => x.candidate), d.placement)
    console.info("[content-pipeline] media", JSON.stringify({ draft: d.id, v: d.version, frame: i + 1, retry: d.mediaRetries ?? 0, representative, shown: shown.map(x => `${x.candidate.origin ?? "?"}:${x.candidate.width}x${x.candidate.height}:${x.candidate.title.slice(0, 60)}`), ranked: pick.ranked ?? null, turnedDown: pick.turnedDown ?? null, chosen: chosen.index, crop: chosen.index === null ? null : chosen.crop, why: chosen.index === null ? chosen.why : null }))
    if (chosen.index === null) {
      d.media = media
      // No photo of the subject: like a source that can't support the post, the subject is replaced (MAX_AUTO_REPLACE).
      return sourceHold(deps, ai, d, `no relevant, licensed photo was found${d.frames.length > 1 ? ` for frame ${i + 1}` : ""}${frame.mediaQuery ? ` ("${frame.mediaQuery}")` : ""}: ${chosen.why} (${pick.reason}).`)
    }
    const c = shown[chosen.index].candidate
    used.add(c.pageUrl)
    const fresh = item && searched ? `The published post has no recorded photo${item.media ? " that could be fetched" : ""}, so this one was searched for: check it against ${item.postId}` : ""
    const rep = chosen.ranked.representative ? `Representative photo${chosen.ranked.shows ? ` (${chosen.ranked.shows})` : ""}, not the event itself: check the caption doesn't present it as the event` : ""
    media[i] = { url: c.url, pageUrl: c.pageUrl, title: c.title, license: c.license, creator: c.creator, credit: c.credit, usGovernment: c.usGovernment, ...(c.date ? { date: c.date } : {}), ...(c.rightsNote ? { rightsNote: c.rightsNote } : {}), ...(c.rightsNote || rep || fresh ? { note: [c.rightsNote, rep, fresh].filter(Boolean).join(". ") } : {}), crop: chosen.crop }
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
    const text: Record<string, string> = Object.fromEntries(Object.entries(frame.fields).filter(([k]) => dataset[k] === "text"))
    // A roundup of fewer than five blanks the cover's unused story slots, so none shows its sample text.
    if (frame.series === "icymi_cover" && icymiCount(d.story) < ICYMI_MAX) {
      for (const f of series.fields) if (unusedStorySlot(f.name, icymiCount(d.story)) && dataset[f.name] === "text") text[f.name] = " "
      notices.add(`ICYMI cover: ${icymiCount(d.story)} of 5 story slots used. The template prints the numbers 01–05 itself, so the unused numbers still show; the cover needs a version for fewer stories in Canva`)
    }
    const missing = Object.keys(frame.fields).filter(k => dataset[k] !== "text")
    if (missing.length) notices.add(`${series.label} template has no field for ${missing.join(", ")}`)
    const title = `${d.id} v${d.version}${d.frames.length > 1 ? ` · ${i + 1}/${d.frames.length}` : ""} — ${(frame.fields.headline || frame.fields.subject_identifier || frame.fields.counter || series.label).slice(0, 120)}`
    const r = await deps.content.createDesign({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}:f${i + 1}${d.autoReplaced ? `:r${d.autoReplaced}` : ""}${d.mediaRetries ? `:m${d.mediaRetries}` : ""}`, templateId, title, text, ...(image ? { image } : {}) })
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
    for (const p of await ai.checkArtwork({ frame, images: [images[i]], noPhoto: !d.media[i] }).catch(() => [{ defect: "automatic artwork check did not run", photo: false }])) {
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
  const sections: string[] = [`${d.id} · v${d.version} · ${label(d.kind)} — drafted by the content pipeline (${BRAND.rulesVersion}). Review the card and caption, then approve through the publisher.`]
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
  const media = d.media.filter((m): m is ChosenMedia => !!m).map(m => ({ url: m.url, pageUrl: m.pageUrl, title: m.title, license: m.license, creator: m.creator, credit: m.credit, usGovernment: m.usGovernment, ...(m.date ? { date: m.date } : {}), ...(m.rightsNote ? { rightsNote: m.rightsNote } : {}) }))
  const job = await deps.store.getJob(d.jobId)
  const r = await deps.content.writePost({ requestId: `${KEY_PREFIX}${d.id}:v${d.version}`, property: contentPropertyOf(job?.property), title: `${d.id} v${d.version} — ${head.replace(/\n/g, " ")}`.slice(0, 200), caption: d.caption ?? "", notes: reviewNotes(d), links, media, designIds: d.designs.map(x => x.designId), requestedBy: { email: d.request.actorEmail, name: d.request.actorName } })
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
  const found = await researchStories(deps, ai, { ...job, count: 1 }, (await deps.content.recentPosts()).map(x => x.title), await deps.seeds(), rejected, [d.story.primaryUrl], inFlight)
  if ("hold" in found || !found.length) return hold(deps, d, `${reason} No replacement subject qualified: ${"hold" in found ? found.hold : "none found"}`)
  const was = d.story.title
  d.rejected = rejected; d.story = found[0]
  // A new subject starts its photo search afresh; its designs get their own Canva request ids (":r<n>"), since a
  // photo hold can come after the first subject's design was created.
  d.frames = []; d.caption = undefined; d.media = []; d.designs = []; d.qa = []; d.holdReason = undefined; d.mediaRetries = undefined; d.avoidMedia = undefined
  // The new subject starts at writing: if the write below fails, the retry writes again rather than resuming the
  // photo step on nothing (gate round 3).
  d.status = "writing"
  await save(deps, d, `"${was}" couldn't be sourced (${reason.replace(/\.$/, "")}); switched to ${d.story.title}`)
  return writeStep(deps, ai, d)
}

export type { Placement }
