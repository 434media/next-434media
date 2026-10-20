import { gateway } from "@ai-sdk/gateway"
import { createMcuAi, framesFor, type McuAi, type ModelCall } from "./model"
import { PIPELINE_MODELS } from "./models"
import { fetchSourcePage, type SourcePage } from "./sources"
import { SERIES, type RequestKind } from "./series"
import { DOD_NOTICE, normalizeDate, writeCopy, type WrittenCopy } from "./worker"
import type { McuSeeds } from "./seeds"
import type { RequestRef, Story } from "./store"
import { cellRoles } from "./create-table"

/**
 * Human+ (plan v11 Step 2): the per-row copy assist in the Create table. The person gives a reference link (and
 * optional notes); the page is read, and the pipeline's own writer drafts the card fields and the caption from it, with
 * fact extraction and every copy check (worker.ts writeCopy). The story is the person's: nothing is researched and no
 * other subject is chosen. Runs inside withProfile() with the brand's published profile, read fresh by the route.
 */
export interface HumanPlusInput { kind: RequestKind; url: string; notes?: string; requestedBy: RequestRef }
export interface HumanPlusCopy {
  /** Fields of the template's first card, by name, as the writer set them (date included). */
  fields: Record<string, string>
  headline: string
  subHeadline: string
  caption: string
  /** Style notes left after the rewrites (not a hold); the person fixes them in the cells. */
  notes: string[]
  facts: number
  /** Set when the writer would not write this story as it stands (the reason, for the person). */
  hold?: string
  source: { url: string; title: string; publishedAt?: string; readViaSearch?: boolean }
  calls: ModelCall[]
}
export interface HumanPlusDeps {
  ai(onCall: (call: ModelCall) => void): McuAi
  fetchPage(url: string): Promise<SourcePage>
  seeds(): Promise<McuSeeds | null>
  nowMs(): number
}

export class HumanPlusError extends Error {
  constructor(message: string, readonly status: 400 | 502) { super(message) }
}

/** The reference page as a story: read directly, or (an official page that refuses the fetch) through the search tool. */
export async function storyFromLink(deps: Pick<HumanPlusDeps, "fetchPage">, ai: McuAi, url: string): Promise<{ story: Story; viaSearch: boolean }> {
  let page: SourcePage | null = null, viaSearch = false
  try { page = await deps.fetchPage(url) }
  catch (err) {
    const reason = err instanceof Error ? err.message : "unreachable"
    if (/^http_(401|403|429)$/.test(reason) && ai.readRefusedPage) { page = await ai.readRefusedPage(url).catch(() => null); viaSearch = !!page }
    if (!page) throw new HumanPlusError(`The reference link could not be read (${reason}). Paste the article's own page, or write the cells by hand.`, 400)
  }
  if (page.text.length < 400) throw new HumanPlusError("The reference link has no readable article text. Paste the article's own page, or write the cells by hand.", 400)
  const publishedAt = normalizeDate(page.publishedAt)
  const host = new URL(page.url).hostname.replace(/^www\./, "")
  return {
    story: { title: page.title || host, primaryUrl: page.url, publisher: page.siteName || host, ...(publishedAt ? { publishedAt } : {}), ...(viaSearch ? { readViaSearch: [page.url] } : {}), sourceTitle: page.title || host, sourceText: page.text },
    viaSearch,
  }
}

/** Told to the writer with the person's notes: the row's photo or video is theirs, not the source's. */
export const OWN_MEDIA_DIRECTION = "The person adds the photo or video to this post themselves. Write no Photo, Image, Video or credit line, and never describe the source article's photo."
/**
 * The caption without lines about media: in the Create table the person supplies the photo or video, so a line the writer
 * took from the source's photo caption ("Photo: … during a test flight at Dugway", Step 2 run, 2026-10-19) describes a
 * picture the post doesn't carry. Whole credit lines and the government notice go, and a trailing "Photo: …" clause on
 * another line (the source line) is cut.
 */
export function withoutMediaLines(caption: string): string {
  const media = /(?:^|\s)(?:Archive image|Photo credit|Image credit|Photo|Image|Video|Credit|Courtesy)s?:\s.*$/i
  return caption.split("\n")
    .filter(l => l.trim() !== DOD_NOTICE && !/^\s*(?:Archive image|Photo credit|Image credit|Photo|Image|Video|Credit|Courtesy)s?:\s/i.test(l))
    .map(l => l.replace(media, "").trimEnd())
    .join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

export async function humanPlus(deps: HumanPlusDeps, input: HumanPlusInput): Promise<HumanPlusCopy> {
  const calls: ModelCall[] = []
  const ai = deps.ai(c => { calls.push(c) })
  const { story, viaSearch } = await storyFromLink(deps, ai, input.url)
  let written: WrittenCopy
  try { written = await writeCopy(deps, ai, { kind: input.kind, story, direction: [input.notes?.trim(), OWN_MEDIA_DIRECTION].filter(Boolean).join("\n"), requestedBy: input.requestedBy }) }
  catch (err) {
    console.error("[human-plus] write failed:", err instanceof Error ? err.message : err)
    throw new HumanPlusError("The writer could not answer just now; try Human+ again", 502)
  }
  const frame = written.frames[0], series = framesFor(input.kind)[0]
  const fields = { ...(frame?.fields ?? {}) }
  const roles = cellRoles(SERIES[series])
  return {
    fields,
    headline: (roles.headline && fields[roles.headline]) || "",
    subHeadline: (roles.subHeadline && fields[roles.subHeadline]) || "",
    caption: withoutMediaLines(written.caption),
    notes: written.notes,
    facts: written.facts,
    ...(written.hold ? { hold: written.hold } : {}),
    source: { url: story.primaryUrl, title: story.sourceTitle, ...(story.publishedAt ? { publishedAt: story.publishedAt } : {}), ...(viaSearch ? { readViaSearch: true } : {}) },
    calls,
  }
}

/** Production wiring: the pipeline's models and search tool (run.ts pipelineDeps), without the board or Canva. */
export async function humanPlusDeps(): Promise<HumanPlusDeps> {
  const { getMcuSeeds } = await import("@/lib/firestore-content-pipeline")
  const searchTools = { web_search: gateway.tools.parallelSearch({ mode: "agentic", maxResults: 10 }) }
  return {
    ai: onCall => createMcuAi({ models: PIPELINE_MODELS, searchTools, readTools: { web_search: gateway.tools.parallelSearch({ mode: "one-shot", maxResults: 5, excerpts: { maxCharsPerResult: 20_000 } }) }, onCall }),
    fetchPage: url => fetchSourcePage(url),
    seeds: getMcuSeeds,
    nowMs: Date.now,
  }
}
