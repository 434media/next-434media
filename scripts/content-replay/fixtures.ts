import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { RequestKind } from "../../lib/content-pipeline/series"
import type { SourcePage } from "../../lib/content-pipeline/sources"
import type { Story } from "../../lib/content-pipeline/store"
import { storySourceText, type PostRow } from "../../lib/content-pipeline/worker"

/** The replay set (stories.json) and its captured pages (pages/<story id>.json). */
export const REPLAY_DIR = join(__dirname)
export const PAGES_DIR = join(REPLAY_DIR, "pages")

/** What a gate round did with a story, as the saved draft and the runtime logs recorded it. */
export interface Observed { round: number; draft: string; models: "nemotron" | "haiku"; outcome: "in_review" | "held" | "replaced"; reason: string; shown?: string[] }
/**
 * One story as a gate round drafted it. now: when that round drafted it, so the replay dates the card, the recency
 * rules and the ICYMI window as the round did. posts: an ICYMI roundup's candidate posts, from which the engine itself
 * decides what qualifies.
 */
export interface ReplayStory {
  id: string; kind: RequestKind; now: string; title: string
  primaryUrl?: string; publisher?: string; publishedAt?: string; supporting?: string[]
  fresh?: Story["fresh"]; whyNow?: string; note?: string
  posts?: PostRow[]
  observed: Observed[]
}
export interface ReplaySet { about: string; built: string; stories: ReplayStory[]; notRebuilt: { round: number; title: string; outcome: string; why: string }[] }
export interface CapturedPages { story: string; capturedAt: string; pages: Record<string, SourcePage>; misses?: string[] }

export function loadStories(file = join(REPLAY_DIR, "stories.json")): ReplaySet {
  return JSON.parse(readFileSync(file, "utf8")) as ReplaySet
}
export function loadPages(id: string, dir = PAGES_DIR): CapturedPages | null {
  const file = join(dir, `${id}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as CapturedPages : null
}

/**
 * The story as research hands it to the writer (worker.ts researchStories): the captured primary page's text with
 * the supporting pages the round used, its title as the source title, and the round's publisher, date and freshness.
 * Supporting pages that weren't captured are left out, as research skips an unreachable one.
 */
export function storyOf(s: ReplayStory, captured: CapturedPages): Story {
  const page = s.primaryUrl ? captured.pages[s.primaryUrl] : undefined
  if (!page) throw new Error(`${s.id}: the primary page was not captured (run capture.ts)`)
  const supporting = (s.supporting ?? []).map(u => captured.pages[u]).filter((p): p is SourcePage => !!p && p.text.length >= 200 && p.url !== page.url)
  return {
    title: s.title, primaryUrl: page.url, publisher: s.publisher || page.siteName || new URL(page.url).hostname,
    ...(s.publishedAt ? { publishedAt: s.publishedAt } : {}), ...(s.fresh ? { fresh: s.fresh } : {}), ...(s.whyNow ? { whyNow: s.whyNow } : {}),
    sourceTitle: page.title || s.title, sourceText: storySourceText(page, supporting),
    ...(supporting.length ? { supporting: supporting.map(sp => ({ url: sp.url, title: sp.title || sp.url })) } : {}),
  }
}
