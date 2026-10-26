import { gateway } from "@ai-sdk/gateway"
import { createMcuAi, framesFor, type McuAi, type ModelCall } from "./model"
import { PIPELINE_MODELS } from "./models"
import { fetchSourcePage, pageImageCandidate, type SourcePage } from "./sources"
import { SERIES, type RequestKind } from "./series"
import { DOD_NOTICE, normalizeDate, roundupStory, withCredits, writeCopy, type WrittenCopy } from "./worker"
import type { McuSeeds } from "./seeds"
import type { RequestRef, RoundupItem, Story } from "./store"
import { cellRoles } from "./create-table"
import { dvidsImagePage } from "./create-media"

/**
 * Human+ (plan v11 Step 2): the per-row copy assist in the Create table. The person gives a reference link (and
 * optional notes); the page is read, and the pipeline's own writer drafts the card fields and the caption from it, with
 * fact extraction and every copy check (worker.ts writeCopy). The story is the person's: nothing is researched and no
 * other subject is chosen. Runs inside withProfile() with the brand's published profile, read fresh by the route.
 */
export interface HumanPlusInput {
  kind: RequestKind; url: string; notes?: string; requestedBy: RequestRef
  /** The link the row's media was pasted from, when it was pasted (RowMedia.source): a DVIDS photo keeps its credit. */
  mediaFrom?: string
}
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
/** Labels of a line about a photo or video; the line is the label's when it starts with one. */
const MEDIA_LABEL = /^\s*(?:Archive image|Photo credit|Image credit|Photo|Image|Video|Credit|Courtesy)s?:\s/i
/**
 * The caption without lines about media: in the Create table the person supplies the photo or video, so a line the writer
 * took from the source's photo caption ("Photo: … during a test flight at Dugway", Step 2 run, 2026-10-19) describes a
 * picture the post doesn't carry. A line that starts with a media label goes, as does the government notice; on the
 * Source: line only, a trailing "Photo: …" clause is cut. Any other line is kept whole ("federal tax credit: up to
 * $7,500", "Watch the video: link in bio").
 */
export function withoutMediaLines(caption: string): string {
  const clause = /\s(?:Archive image|Photo credit|Image credit|Photo|Image|Video|Credit|Courtesy)s?:\s.*$/i
  return caption.split("\n")
    .filter(l => l.trim() !== DOD_NOTICE && !MEDIA_LABEL.test(l))
    .map(l => /^\s*Source:\s/i.test(l) ? l.replace(clause, "").trimEnd() : l.trimEnd())
    .join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * The caption's media lines for the row's own media. The person's own photo or video gets none. A photo pasted from
 * DVIDS gets its credit and the DoW notice, as the pipeline gives a DVIDS photo (worker.ts withCredits): the credit is
 * read from the image's DVIDS page. When that page can't be read, the notice is added and the person is told to add
 * the credit.
 */
async function mediaCredit(deps: Pick<HumanPlusDeps, "fetchPage">, caption: string, mediaFrom?: string): Promise<{ caption: string; note?: string }> {
  const bare = withoutMediaLines(caption)
  const dvids = dvidsImagePage(mediaFrom)
  if (!dvids) return { caption: bare }
  const page = await deps.fetchPage(dvids).catch(() => null)
  const photo = page ? pageImageCandidate(page, "dvids") : null
  if (photo?.credit) return { caption: withCredits(bare, [{ ...photo, title: photo.title }]) }
  return { caption: `${bare}\n\n${DOD_NOTICE}`, note: `The DVIDS page ${dvids} could not be read for the photo's credit: add its "Image: U.S. … photo by …" line above the notice` }
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
  const credited = await mediaCredit(deps, written.caption, input.mediaFrom)
  return {
    fields,
    headline: (roles.headline && fields[roles.headline]) || "",
    subHeadline: (roles.subHeadline && fields[roles.subHeadline]) || "",
    caption: credited.caption,
    notes: credited.note ? [...written.notes, credited.note] : written.notes,
    facts: written.facts,
    ...(written.hold ? { hold: written.hold } : {}),
    source: { url: story.primaryUrl, title: story.sourceTitle, ...(story.publishedAt ? { publishedAt: story.publishedAt } : {}), ...(viaSearch ? { readViaSearch: true } : {}) },
    calls,
  }
}

/**
 * Human+ for an ICYMI roundup row (Step 4 item 1): the pipeline's writer drafts the cover's story rows and the caption
 * from the chosen published posts' own titles and captions, as the pipeline's roundup did. Nothing is read from the web:
 * the stories are the brand's own posts. The cover's headline is fixed and its date and numbers are the server's.
 */
export async function humanPlusRoundup(deps: HumanPlusDeps, input: { kind: RequestKind; items: RoundupItem[]; window: string; notes?: string; requestedBy: RequestRef; mediaFrom?: string }): Promise<HumanPlusCopy> {
  const calls: ModelCall[] = []
  const ai = deps.ai(c => { calls.push(c) })
  const story = roundupStory(input.items, input.window)
  let written: WrittenCopy
  try { written = await writeCopy(deps, ai, { kind: input.kind, story, ...(input.notes?.trim() ? { direction: input.notes.trim() } : {}), requestedBy: input.requestedBy }) }
  catch (err) {
    console.error("[human-plus] roundup write failed:", err instanceof Error ? err.message : err)
    throw new HumanPlusError("The writer could not answer just now; try Human+ again", 502)
  }
  // The cover prints its own numbers (story_numbers): a row the writer numbered ("01 Microchip buys …", seen on the
  // live preview, 2026-10-26) loses its number. Only a "01" or "1." style marker: "5 drones arrive" keeps its 5.
  const fields = Object.fromEntries(Object.entries(written.frames[0]?.fields ?? {}).filter(([k]) => /^story_0\d$/.test(k) || k === "date")
    .map(([k, v]) => [k, k === "date" ? v : v.replace(/^\s*(?:0\d|\d{1,2}[.):\-–—|])\s+/, "")]))
  // The cover's photo is the row's: a DVIDS photo gets its credit and the notice, as a one-card row's does.
  const credited = await mediaCredit(deps, written.caption, input.mediaFrom)
  return { fields, headline: "", subHeadline: "", caption: credited.caption, notes: credited.note ? [...written.notes, credited.note] : written.notes, facts: 0, ...(written.hold ? { hold: written.hold } : {}), source: { url: story.primaryUrl, title: story.sourceTitle }, calls }
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
