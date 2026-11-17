import { BRAND } from "./brand"
import type { ModelCall } from "./model"
import type { RequestKind } from "./profile"
import type { Story } from "./store"
import { confirmPhoto, researchStories, storiesInFlight, type WorkerDeps } from "./worker"

/**
 * The morning story list (434 build sequence V1 item 0, "A daily story list for the MilCityUSA producer"; founder,
 * 2026-11-17). Each weekday morning the content engine's existing research job runs under the brand's published
 * profile and finds 3 to 5 story candidates, each with its primary source, research's one line on why it fits, and the
 * photo lead photo first found for it. The producer picks one and works it in Create as she does today: nothing here
 * drafts, designs, writes a post or changes a job. It runs inside withProfile() (the caller's), like every entry point.
 */
export const LIST_COUNT = 5
export const LIST_MIN = 3
/** Stories already sent in the last few lists: research is steered away from them, and their URLs are refused. */
export interface SentStories { titles: string[]; urls: string[] }
export interface ListedStory {
  title: string
  url: string
  publisher: string
  publishedAt?: string
  why: string
  /** The licensed photo photo first confirmed for the subject, or why none was found (or checked). */
  photo: { url: string; pageUrl: string; credit: string } | { none: string }
}
export interface StoryList { kind: RequestKind; stories: ListedStory[]; hold?: string; calls: ModelCall[] }

/** The kind the list researches: News where the brand has it (the everyday story), else its first researched kind. */
export function listKind(): RequestKind | null {
  const researched = BRAND.requestKinds.filter(k => k.kind !== "icymi" && BRAND.research.kinds[k.kind]).map(k => k.kind)
  return researched.includes("news") ? "news" : researched[0] ?? null
}

/**
 * Research once (and once more, steered away from what was dropped, as a job does), then photo first on each story
 * while the budget lasts. A story whose photo check runs out of time or finds nothing still goes on the list, with
 * that said: the producer finds video and photos herself today, so a lead is help, not a gate.
 */
export async function buildStoryList(deps: WorkerDeps, sent: SentStories, budgetMs: number): Promise<StoryList> {
  const started = deps.nowMs(), calls: ModelCall[] = []
  const kind = listKind()
  if (!kind) return { kind: "news", stories: [], hold: "the brand profile has no researched story kind", calls }
  const ai = deps.ai(c => calls.push(c))
  const [posts, seeds, inFlight] = await Promise.all([deps.content.recentPosts(), deps.seeds(), storiesInFlight(deps)])
  const titles = [...posts.map(p => p.title), ...sent.titles]
  const job = { kind, count: LIST_COUNT }
  let found = await researchStories(deps, ai, job, titles, seeds, [], sent.urls, inFlight, LIST_COUNT)
  if (!Array.isArray(found)) found = await researchStories(deps, ai, job, titles, seeds, found.tried ?? [], found.triedUrls ?? sent.urls, inFlight, LIST_COUNT)
  if (!Array.isArray(found)) return { kind, stories: [], hold: found.hold, calls }
  const stories: ListedStory[] = []
  for (const s of found) {
    const left = budgetMs - (deps.nowMs() - started)
    const photo = left < 30_000 ? { none: "not checked this morning (out of time)" } : await photoLead(deps, ai, s, kind)
    stories.push({ title: s.title, url: s.primaryUrl, publisher: s.publisher, ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}), why: s.why ?? "", photo })
  }
  return { kind, stories, calls }
}

async function photoLead(deps: WorkerDeps, ai: ReturnType<WorkerDeps["ai"]>, story: Story, kind: RequestKind): Promise<ListedStory["photo"]> {
  try {
    const r = await confirmPhoto(deps, ai, story, kind, "feed")
    if ("why" in r) return { none: `no licensed photo found: ${r.why}`.slice(0, 300) }
    const c = r.photo.candidate
    return { url: c.url, pageUrl: c.pageUrl, credit: c.credit }
  } catch (err) {
    return { none: `the photo check failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300) }
  }
}

/** The email to the producer: plain text, one numbered candidate each. */
export function storyListEmail(list: Pick<StoryList, "stories" | "hold">, p: { brand: string; day: string; createUrl: string; versionId: string }): { subject: string; text: string } {
  if (!list.stories.length) {
    return {
      subject: `${p.brand} story list, ${p.day}: no candidates this morning`,
      text: `Research found no ${p.brand} story to suggest this morning.\n\nWhy: ${list.hold ?? "no candidates found"}\n\nCreate: ${p.createUrl}\n\n(Brand profile ${p.versionId}.)`,
    }
  }
  const n = list.stories.length
  const items = list.stories.map((s, i) => [
    `${i + 1}. ${s.title}`,
    `   Source: ${s.url} (${s.publisher}${s.publishedAt ? `, ${s.publishedAt}` : ""})`,
    `   Why it fits: ${s.why || "research gave no reason"}`,
    "pageUrl" in s.photo ? `   Photo lead: ${s.photo.pageUrl}\n   Credit: ${s.photo.credit}` : `   Photo lead: none (${s.photo.none})`,
  ].join("\n"))
  return {
    subject: `${p.brand} story list, ${p.day}: ${n} candidate${n === 1 ? "" : "s"}`,
    text: `Good morning. ${n === 1 ? "One story" : `${n} stories`} for ${p.brand} today. Pick one and work it in Create as usual; nothing has been drafted.\n\n${items.join("\n\n")}\n\nCreate: ${p.createUrl}\n\nFrom the content engine's research, under brand profile ${p.versionId}.`,
  }
}
