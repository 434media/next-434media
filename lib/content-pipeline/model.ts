import { generateText, stepCountIs, tool, type ToolSet } from "ai"
import { z } from "zod4"
import { MCU_EDITORIAL, NEVER_REVIVE } from "./editorial"
import { CALL_FALLBACK, callOptions, outputBudget, type PipelineStep } from "./models"
import { seedBrief, type McuSeeds } from "./seeds"
import { SERIES, type FieldSpec, type RequestKind, type SeriesKey } from "./series"
import type { MediaCandidate } from "./sources"
import type { FrameCopy, Story } from "./store"

/**
 * The model calls behind the content pipeline. Each returns structured output checked again in code (series.ts) —
 * the model proposes, the server verifies. Each step uses its own model (models.ts), so one setting moves a step to its
 * fallback. Budgets are generous (CLAUDE.md, "The token trap"); the stable editorial prefix is marked cacheable.
 * Moved from the pilot's Slack MCU skill (lib/slack/mcu/model.ts at b36e7be); the prompts are unchanged.
 */
export interface McuAi {
  research(input: { kind: RequestKind; count: number; topic?: string; today: string; recentTitles: string[]; avoid?: string[]; seeds: McuSeeds | null }): Promise<{ candidates: Candidate[]; note?: string }>
  /**
   * direction: the requester's proactive instruction from Generate (angle, emphasis), never above the rules or the
   * source. instructions: a reviewer's change to an existing draft (the drawer, Phase 2).
   */
  write(input: { kind: RequestKind; story: Story; today: string; previous?: { frames: FrameCopy[]; caption: string }; instructions?: string; problems?: string[]; direction?: string; seeds?: McuSeeds | null }): Promise<{ frames: FrameCopy[]; caption: string; hold?: string }>
  /** DVIDS image pages (and official .mil/.gov photo pages) showing the card's subject, found by web search. */
  findPhotoPages(input: { story: Story; frame: FrameCopy }): Promise<string[]>
  /** The best candidate, and for each relevant one (best first) where its subject sits, so the server can test the 4:5 crop. */
  pickMedia(input: { story: Story; frame: FrameCopy; candidates: { candidate: MediaCandidate; image: Uint8Array; mime: string }[]; avoid: string[] }): Promise<{ index: number | null; reason: string; ranked?: { index: number; box: SubjectBox; context?: boolean; shows?: string }[]; turnedDown?: string[] }>
  /** Real defects on the exported card; photo defects are ones a different photo would fix. */
  checkArtwork(input: { frame: FrameCopy; images: { bytes: Uint8Array; mime: string }[] }): Promise<{ defect: string; photo: boolean }[]>
}
/** The main subject's bounding box as fractions of the photo (0–1, origin top left). */
export interface SubjectBox { x0: number; y0: number; x1: number; y1: number }
export interface Candidate { title: string; primaryUrl: string; publisher: string; publishedAt?: string; whyNow?: string; why: string; supportingUrls?: string[]; /** Other primary pages for the same subject, tried when the primary can't be read. */ alternateUrls?: string[] }
/** One model call as served: which model and which provider answered (evidence for the routing check). */
export interface ModelCall { step: PipelineStep; model: string; provider?: string; finishReason?: string; inputTokens?: number; outputTokens?: number; /** Set when this call is the fallback for a model that could not answer. */ fallbackFrom?: string; fallbackReason?: string }

const system = (extra: string) => [{ role: "system" as const, content: MCU_EDITORIAL, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } } }, { role: "system" as const, content: extra }]

function fieldBrief(f: FieldSpec): string {
  return `${f.name} (${f.label}${f.allowed ? `; exactly one of: ${f.allowed.join(" | ")}` : ""}${f.date ? "; DDMMMYY" : ""}${f.perLine && f.maxLines ? `; at most ${f.maxLines} line${f.maxLines > 1 ? "s" : ""} of ~${f.perLine} characters` : ""}${f.maxChars ? `; at most ${f.maxChars} characters` : ""}${f.uppercase ? "; UPPERCASE" : ""}${f.exactLines ? `; exactly ${f.exactLines} lines separated by a line break, each at most ${f.perLine} characters of whole words, never abbreviated` : ""})`
}
export function framesFor(kind: RequestKind): SeriesKey[] {
  return kind === "icymi" ? ["icymi_cover", "icymi_story", "icymi_story", "icymi_story", "icymi_story", "icymi_story"] : [kind]
}

const candidateSchema = z.object({ candidates: z.array(z.object({ title: z.string(), primaryUrl: z.string(), publisher: z.string(), publishedAt: z.string().optional(), whyNow: z.string().optional(), why: z.string(), supportingUrls: z.array(z.string()).optional(), alternateUrls: z.array(z.string()).optional().describe("other primary pages for the same subject: the maker's product page, a .mil or .gov page, a press release") })), note: z.string().optional() })
/** Every https URL in the search tool's results, in order, de-duplicated (the tool's output shape is not relied on). */
export function searchResultUrls(steps: readonly { toolResults: readonly { output?: unknown }[] }[]): string[] {
  const out: string[] = []
  for (const st of steps) for (const tr of st.toolResults) for (const m of JSON.stringify(tr.output ?? "").matchAll(/https:\/\/[^\s"'<>\\]+/g)) { const u = m[0].replace(/[),.;]+$/, ""); if (!out.includes(u)) out.push(u) }
  return out
}
export const normalizeUrl = (u: string) => u.trim().replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase()
// Card fields are declared per series (explicit, required keys, fixed lists as enums) and the answer comes back as a
// forced "submit" tool call, the pattern lib/ai-gateway-text.ts uses. An open record, and then name/value pairs
// through structured output, both came back empty in the 2026-10-16 live test. Date and counter are filled by the
// server, so they are not asked for.
const SERVER_FILLED = new Set(["date", "counter"])
function fieldsSchema(series: SeriesKey) {
  return z.object(Object.fromEntries(SERIES[series].fields.filter(f => !SERVER_FILLED.has(f.name) && !f.serverFilled).map(f => [f.name, f.allowed ? z.enum(f.allowed as [string, ...string[]]).describe(fieldBrief(f)) : z.string().describe(fieldBrief(f))])))
}
const frameSchema = (series: SeriesKey) => z.object({ fields: fieldsSchema(series), mediaQuery: z.string().describe("3–6 words naming the actual subject, for finding a photo") })
function writeSchema(kind: RequestKind) {
  const base = { caption: z.string().describe("the one master caption"), hold: z.string().optional().describe("only if the source cannot support the post: the one-sentence reason") }
  return kind === "icymi"
    ? z.object({ cover: frameSchema("icymi_cover"), stories: z.array(frameSchema("icymi_story")).describe("exactly five story cards, in the cover's order"), ...base })
    : z.object({ card: frameSchema(kind as SeriesKey), ...base })
}
async function submitted<T>(r: { toolCalls: { toolName: string; input: unknown }[] }, name: string): Promise<T> {
  const call = r.toolCalls.find(c => c.toolName === name)
  if (!call) throw new Error(`model did not call ${name}`)
  return call.input as T
}

/**
 * The brand direction the writer gets beside MCU_EDITORIAL (the cached prefix: voice, accuracy, series, caption and
 * media rules, as in the pilot skill): MCU's purpose and source cohorts from the seeds, which the pilot gave research
 * only. Empty when no seeds are loaded.
 */
export function brandDirection(seeds: McuSeeds | null | undefined): string {
  return seeds ? `MCU PURPOSE: ${seeds.purpose}\nWho MCU covers:\n${seeds.cohorts.map(c => `- ${c}`).join("\n")}\n\n` : ""
}

const TEXT_WORDS = /\b(text|headline|hook|deck|caption|label|font|type|letters?|words?|typo|spell|misspell|abbreviat|truncat|line break|copy)/i
const PHOTO_WORDS = /\b(photo|picture|subject(?![ _](line|identifier|text))|face|crop|sky|tail-only|background)/i
/**
 * Whether an artwork defect sends the draft back for another photo. Only a photo-area defect does, and not one that
 * reads as a text problem with no photo cause: the 2026-10-17 check labelled "benefit headline text is clipped" a
 * photo defect and spent a photo retry on it. "Text over a face" names a photo cause, so it still counts.
 */
export function isPhotoDefect(area: string, defect: string): boolean {
  return area === "photo" && !(TEXT_WORDS.test(defect) && !PHOTO_WORDS.test(defect))
}

/** The provider the Gateway routed to, read defensively from its response metadata. */
export function servedBy(meta: unknown): string | undefined {
  const g = (meta as { gateway?: { routing?: Record<string, unknown> } } | undefined)?.gateway?.routing
  if (!g) return undefined
  for (const k of ["finalProvider", "resolvedProvider", "provider"]) if (typeof g[k] === "string") return g[k] as string
  return undefined
}

type Served = { finishReason?: string; providerMetadata?: unknown; usage?: { inputTokens?: number; outputTokens?: number } }
/**
 * One step's model call: out with its step's routing, its answer reported with the provider that served it. accept
 * reads the answer (a forced tool call, say); when it throws, the call failed as much as a refused request did, and a
 * step with a fallback (models.ts CALL_FALLBACK) makes the same call once on the fallback, reported as such.
 */
export async function servedCall<R extends Served, T>(step: PipelineStep, model: string, fallback: string | undefined, onCall: ((c: ModelCall) => void) | undefined, call: (model: string) => Promise<R>, accept: (r: R) => T | Promise<T>): Promise<T> {
  const once = async (use: string, from?: { from: string; reason: string }) => {
    const r = await call(use)
    const provider = servedBy(r.providerMetadata)
    onCall?.({ step, model: use, ...(provider ? { provider } : {}), ...(r.finishReason ? { finishReason: r.finishReason } : {}), ...(r.usage?.inputTokens !== undefined ? { inputTokens: r.usage.inputTokens } : {}), ...(r.usage?.outputTokens !== undefined ? { outputTokens: r.usage.outputTokens } : {}), ...(from ? { fallbackFrom: from.from, fallbackReason: from.reason } : {}) })
    if (r.finishReason === "length") throw new Error(`${step}: output truncated at the token cap (${use})`)
    return accept(r)
  }
  try { return await once(model) } catch (err) {
    if (!fallback || fallback === model) throw err
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 200)
    console.warn("[content-pipeline] fallback", JSON.stringify({ step, from: model, to: fallback, reason }))
    return once(fallback, { from: model, reason })
  }
}
/**
 * The vision pick as the server accepts it: only candidates the model saw as the exact subject, each with its subject
 * box, best first. The -05 DT101 draft (2026-10-17) placed a blurry F-14 from the Barracuda-M page because the model's
 * single index was taken without a box or a statement of what the photo showed. A pick outside the exact matches is
 * not a choice; what the others showed is kept for the log.
 */
export function readPick(pick: { index: number | null; reason: string; ranked?: { index: number; shows?: string; match?: string; x0: number; y0: number; x1: number; y1: number; context?: boolean }[] }, count: number): { index: number | null; reason: string; ranked?: { index: number; box: SubjectBox; context?: boolean; shows?: string }[]; turnedDown?: string[] } {
  const ok = (n: number) => Number.isInteger(n) && n >= 0 && n < count
  const clamp = (v: number) => Math.min(1, Math.max(0, Number(v) || 0))
  const all = (pick.ranked ?? []).filter(x => ok(x.index))
  const exact = all.filter(x => x.match === "exact" && x.x1 !== x.x0 && x.y1 !== x.y0)
  const ranked = exact.map(x => ({ index: x.index, box: { x0: clamp(Math.min(x.x0, x.x1)), y0: clamp(Math.min(x.y0, x.y1)), x1: clamp(Math.max(x.x0, x.x1)), y1: clamp(Math.max(x.y0, x.y1)) }, context: x.context !== false, ...(x.shows ? { shows: x.shows.slice(0, 160) } : {}) }))
  const turnedDown = all.filter(x => !exact.includes(x)).map(x => `#${x.index} ${x.match ?? "no match given"}: ${(x.shows ?? "").slice(0, 120)}`)
  const index = pick.index !== null && ranked.some(x => x.index === pick.index) ? pick.index : ranked[0]?.index ?? null
  return { index, reason: pick.reason, ...(ranked.length ? { ranked } : {}), ...(turnedDown.length ? { turnedDown } : {}) }
}
export function createMcuAi(deps: { models: Record<PipelineStep, string>; searchTools: ToolSet; onCall?(call: ModelCall): void; fallbacks?: Partial<Record<PipelineStep, string>> }): McuAi {
  const m = deps.models, fallbacks = deps.fallbacks ?? CALL_FALLBACK
  const run = <R extends Served, T = R>(step: PipelineStep, call: (model: string) => Promise<R>, accept: (r: R) => T | Promise<T> = r => r as unknown as T): Promise<T> =>
    servedCall(step, m[step], fallbacks[step], deps.onCall, call, accept)
  return {
    async research({ kind, count, topic, today, recentTitles, avoid, seeds }) {
      const want = kind === "dt101" ? "defense technologies worth a Defense Tech 101 explainer (a specific, real product or system with a clear maker and a sourced status)" : kind === "breaking" ? "Breaking-qualified developments (primary-source announcement within the last 24 hours AND consequential enough to need immediate attention)" : "defense-industry news stories from the last 7 days"
      const task = `${seedBrief(kind, seeds)}\n\nToday is ${today}. Task: find up to ${count + 2} ${want}${topic ? `, about: ${topic}` : ""}. Search the web; for each, find the ORIGINAL primary-source page (the company, agency or service's own announcement, contract notice or official article) and give its exact URL. Skip anything MCU already covered (recent MCU titles below) and anything listed under NEVER. Prefer U.S. defense, national-security and defense-tech companies and programs. ${kind === "dt101" ? "A DT101 card needs the maker and its headquarters: when the primary page does not name them, give supportingUrls with up to two pages that do (the maker's own product or about page first). The primary source must be current: a dated article or announcement from the last 90 days, or the maker's own product page; an older article is rejected, so give the product page or a recent announcement instead, with the older article only as a supporting source. " : kind === "news" ? "Give each story's publication date (publishedAt, YYYY-MM-DD) as the page states it; anything published more than 7 days ago is rejected. " : ""}${kind === "breaking" ? "For each, give whyNow: one sourced sentence on what is newly different, its material consequence, and why it needs attention now. If nothing qualifies, return no candidates and say why in note." : ""}\nNever revive: ${NEVER_REVIVE.map(n => `${n.id} — ${n.what}`).join("; ")}.${avoid?.length ? `\nThese subjects were turned down or could not be sourced; pick something clearly different: ${avoid.join("; ")}.` : ""}\nRecent MCU titles:\n${recentTitles.map(t => `- ${t}`).join("\n") || "- (none found)"}`
      // Two calls, because asking for structured output in the same call as the search tool makes the model answer
      // at once from memory instead of searching (production, 2026-10-17: one step, no search, guessed URLs that
      // 404'd, then zero candidates). 1) Search: only the search tool, required on the first step; the model writes
      // its findings as notes. 2) Extract: the candidates come back through one required tool, from those notes and
      // the URLs the search actually returned.
      const searched = await run("research", model => generateText({
        model, tools: deps.searchTools, stopWhen: stepCountIs(8), maxOutputTokens: outputBudget(model, 24_000), providerOptions: callOptions(model, "medium"), allowSystemInMessages: true, // the cached editorial prefix is ours, not user input
        prepareStep: ({ stepNumber }) => stepNumber === 0 ? { toolChoice: "required" as const } : {},
        messages: [...system(`${task}\nSearch first; never rely on memory for a URL. Then write your findings as plain notes: for each candidate, its title, publisher, publication date if stated, the exact primary-source URL as it appears in the search results, other primary pages for the same subject (the maker's product page, a .mil or .gov page, a press release) and why it fits.`), { role: "user", content: "Search now, then write the notes." }],
      }), r => ({ text: r.text, urls: searchResultUrls(r.steps), searches: r.steps.reduce((n, st) => n + st.toolCalls.length, 0), steps: r.steps.length, finishReason: r.finishReason, providerMetadata: r.providerMetadata, usage: r.usage }))
      const seen = new Set(searched.urls.map(normalizeUrl))
      const extracted = await run("research", model => generateText({
        model, maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
        tools: { submit_candidates: tool({ description: "Submit the candidates found, best first.", inputSchema: candidateSchema }) }, toolChoice: { type: "tool", toolName: "submit_candidates" },
        messages: [{ role: "system", content: `From the research notes and the search-result URLs below, submit up to ${count + 2} candidates, best first. Use URLs exactly as they appear in the search results; prefer the original primary source as primaryUrl, and put other primary pages for the same subject in alternateUrls. Return no candidates, with the reason in note, only when the notes found none.` },
          { role: "user", content: `NOTES:\n${searched.text.slice(0, 12_000) || "(none)"}\n\nSEARCH-RESULT URLS:\n${searched.urls.slice(0, 60).join("\n") || "(none)"}` }],
      }), r => submitted<z.infer<typeof candidateSchema>>(r, "submit_candidates"))
      const candidates = (extracted.candidates ?? []).slice(0, count + 2)
      console.info("[content-pipeline] research", JSON.stringify({ kind, steps: searched.steps, searches: searched.searches, resultUrls: searched.urls.length, notesChars: searched.text.length, candidates: candidates.length, inResults: candidates.filter(c => seen.has(normalizeUrl(c.primaryUrl))).length, alternates: candidates.reduce((n, c) => n + (c.alternateUrls?.length ?? 0), 0), note: !!extracted.note }))
      return { candidates, ...(extracted.note ? { note: extracted.note } : {}) }
    },

    async write({ kind, story, today, previous, instructions, problems, direction, seeds }) {
      const frames = framesFor(kind)
      const spec = frames.map((s, i) => `Frame ${i + 1} — ${SERIES[s].label}: ${SERIES[s].fields.map(fieldBrief).join("; ") || "(media only)"}`).join("\n")
      const icymi = kind === "icymi" ? `\nICYMI: frame 1 is the cover (headline = the roundup's theme; story_01..story_05 = one short entry per story, in order; date = today as DDMMMYY). Frames 2–6 are the story cards in the same order: counter "01 / 05" … "05 / 05", headline and deck for that story. The stories:\n${(story.roundup ?? []).map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n")}` : ""
      const schema = writeSchema(kind)
      const asPrevious = (p: { frames: FrameCopy[]; caption: string }) => JSON.stringify(kind === "icymi" ? { cover: { fields: p.frames[0]?.fields }, stories: p.frames.slice(1).map(f => ({ fields: f.fields })), caption: p.caption } : { card: { fields: p.frames[0]?.fields }, caption: p.caption })
      const r = await run("write", model => generateText({
        model, maxOutputTokens: outputBudget(model, 16_000), providerOptions: callOptions(model, "medium"), allowSystemInMessages: true,
        tools: { submit_post: tool({ description: "Submit the finished card copy and caption.", inputSchema: schema as z.ZodType<Record<string, unknown>> }) }, toolChoice: { type: "tool", toolName: "submit_post" },
        messages: [...system(`${brandDirection(seeds)}Today is ${today}. Write the on-card copy and the one master caption for this MilCityUSA ${kind === "icymi" ? "ICYMI roundup" : SERIES[kind as SeriesKey].label} post from the source below, and submit them with submit_post. Use only facts in the source. Fill every field. If the source cannot support a post under the rules (unverifiable figure, not Breaking-worthy, etc.), set hold to the one-sentence reason. Never hold for the photo or its credit (a later step chooses it) or for a DOMAIN call (use Multi-domain when it spans several).\n${spec}${icymi}`),
          { role: "user", content: `SOURCE: ${story.sourceTitle}\nURL: ${story.primaryUrl}\nPublisher: ${story.publisher}\nPublished: ${story.publishedAt ?? "not stated on the page"}${story.whyNow ? `\nWhy now (Breaking): ${story.whyNow}` : ""}${story.supporting?.length ? `\nSupporting sources (their text follows the primary's, each under its own heading; use them only for what the primary leaves out, such as the maker and its headquarters): ${story.supporting.map(x => x.url).join(" ; ")}` : ""}\n\n${story.sourceText.slice(0, 24_000)}${direction ? `\n\nREQUESTER'S DIRECTION (steer the angle and emphasis with it; it never overrides the rules above or the facts in the source): ${direction}` : ""}${instructions && !previous ? `\n\nREVIEWER'S DIRECTION: ${instructions}` : ""}` },
          ...(previous ? [{ role: "assistant" as const, content: `Previous version: ${asPrevious(previous)}` }, { role: "user" as const, content: `${problems?.length ? `Fix these problems: ${problems.join("; ")}. ` : ""}${instructions ? `Reviewer's changes: ${instructions}` : "Submit the corrected version."} Keep everything the reviewer did not ask to change.` }] : [])],
      }))
      const out = await submitted<{ card?: { fields: Record<string, string>; mediaQuery?: string }; cover?: { fields: Record<string, string>; mediaQuery?: string }; stories?: { fields: Record<string, string>; mediaQuery?: string }[]; caption: string; hold?: string }>(r, "submit_post")
      const parts = kind === "icymi" ? [out.cover, ...(out.stories ?? []).slice(0, 5)] : [out.card]
      console.info("[content-pipeline] write", JSON.stringify({ kind, frames: parts.filter(Boolean).length, fields: parts.map(p => Object.keys(p?.fields ?? {}).filter(k => (p?.fields[k] ?? "").trim())), hold: !!out.hold }))
      return { frames: frames.map((series, i) => ({ series, fields: { ...(parts[i]?.fields ?? {}) }, ...(parts[i]?.mediaQuery ? { mediaQuery: parts[i]!.mediaQuery } : {}) })), caption: (out.caption ?? "").trim(), ...(out.hold ? { hold: out.hold } : {}) }
    },

    async findPhotoPages({ story, frame }) {
      const subject = frame.fields.subject_identifier || frame.fields.headline || story.title
      // Search, then pick from what the search returned (the same two-call pattern as research, for the same reason).
      const searched = await run("photoSearch", model => generateText({
        model, tools: deps.searchTools, stopWhen: stepCountIs(6), maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
        prepareStep: ({ stepNumber }) => stepNumber === 0 ? { toolChoice: "required" as const } : {},
        messages: [{ role: "system", content: "You find photos for a defense-news social card. Search the web for pages whose main photo shows the subject itself (the actual system, product, vehicle, unit or event in the story), from sources whose photos may be used with credit: DVIDS image pages (https://www.dvidshub.net/image/<number>/...); U.S. government pages (defense.gov, war.gov, army.mil, navy.mil, af.mil, marines.mil, spaceforce.mil, uscg.mil, nasa.gov, other .mil and .gov sites); and the maker's own newsroom, press-release, press-kit or media pages. Never news outlets' or stock-photo sites' pages (their photos are licensed to them). Return exact page URLs only, best first; never image-file URLs, search pages or guesses. Return an empty list if none show the subject. Search first, then list the best page URLs you found with one line each on what their main photo shows." },
          { role: "user", content: `Subject: ${subject}\nStory: ${story.title}\nPublisher: ${story.publisher}\nPhoto idea: ${frame.mediaQuery ?? ""}` }],
      }), r => ({ text: r.text, urls: searchResultUrls(r.steps) }))
      if (!searched.urls.length) return []
      const picked = await run("photoSearch", model => generateText({
        model, maxOutputTokens: outputBudget(model, 4_000), providerOptions: callOptions(model, "low"),
        tools: { submit_pages: tool({ description: "Submit the page URLs whose main photo shows the subject, best first.", inputSchema: z.object({ pages: z.array(z.string()).describe("up to 8 page URLs from the list, best first") }) }) }, toolChoice: { type: "tool", toolName: "submit_pages" },
        messages: [{ role: "system", content: "From the notes and the search-result URLs, submit the pages whose main photo shows the subject itself, best first, using URLs exactly as listed. Never image-file URLs, search pages, news outlets' or stock-photo sites' pages. Submit an empty list if none fit." },
          { role: "user", content: `Subject: ${subject}\nNOTES:\n${searched.text.slice(0, 6_000) || "(none)"}\n\nSEARCH-RESULT URLS:\n${searched.urls.slice(0, 60).join("\n")}` }],
      }), r => submitted<{ pages: string[] }>(r, "submit_pages"))
      const listed = new Set(searched.urls.map(normalizeUrl))
      return [...new Set((picked.pages ?? []).filter(u => /^https:\/\//.test(u) && listed.has(normalizeUrl(u))))].slice(0, 8)
    },

    async pickMedia({ story, frame, candidates, avoid }) {
      if (!candidates.length) return { index: null, reason: "no licensed candidates" }
      const pick = await run("photoPick", model => generateText({
        model, maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
        messages: [{ role: "system", content: "You choose the photo for a MilCityUSA social card: 1080 × 1350, full bleed, the photo filling the frame, the text block on a dark scrim over the lower 40%. The approved look is a close, dominant hero subject that fills the upper part of the frame and stays recognizable at phone size. Judge each candidate by what its pixels show, never by its title, page or description: a page about a product often carries an unrelated share image (another aircraft, a hangar, a logo, an event photo). For each candidate you rank, first say in a few words what the photo itself shows, then whether that is the exact subject named below (match: exact), something related but not it (another variant, another vehicle, a generic scene: related), or not it at all (unrelated). Rank only candidates that visibly show the actual system, product, vehicle, unit or organization in the story, best first; a photo of something or someone that merely shares a name with it (a person, a band, a book, a convention panel, a logo or a graphic) is NOT relevant, and when you can't tell, leave it out. A blurry, dark or partial view of the subject is not a match either. Give each one's subject bounding box as fractions of that photo (x0, y0 top-left to x1, y1 bottom-right; 0–1). Also say whether its background adds context (terrain, a setting, operators or other equipment that make the photo more interesting, like a forest behind an off-road vehicle) or is empty space (open sky, plain water, a blank wall or pier) that the subject should fill instead. Reject mostly-sky or empty frames, tail-only or cropped-off subjects, tiny distant subjects, and unrelated archive imagery presented as the event. index is your single best choice, or null if none is relevant and strong." },
          { role: "user", content: [
            { type: "text", text: `Story: ${story.title}\nThe subject to show: ${frame.fields.subject_identifier || frame.fields.headline || story.title}\nCard: ${JSON.stringify(frame.fields)}\nAvoid repeating: ${avoid.join(", ") || "none"}\nCandidates follow, numbered from 0.` },
            ...candidates.flatMap((c, i) => [{ type: "text" as const, text: `#${i}: ${c.candidate.title} — ${c.candidate.description} (${c.candidate.width}×${c.candidate.height}, ${c.candidate.date ?? "date unknown"})` }, { type: "image" as const, image: c.image, mediaType: c.mime }]),
          ] }],
        tools: { choose_photo: tool({ description: "Choose the photo, or null when none is relevant and strong.", inputSchema: z.object({ index: z.number().int().nullable(), reason: z.string(), ranked: z.array(z.object({ index: z.number().int(), shows: z.string().describe("what the photo itself shows, in a few words, read from the image"), match: z.enum(["exact", "related", "unrelated"]).describe("exact: it is the subject named on the card; related: similar but not it; unrelated: not it"), x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number(), context: z.boolean().describe("true when the background adds context; false when it is empty space the subject should fill") })).describe("every candidate you judged, best first, with what it shows, its match and its subject box") }) }) }, toolChoice: "required", // the only tool: the same contract as naming it, accepted by more providers
      }), r => submitted<{ index: number | null; reason: string; ranked?: { index: number; shows?: string; match?: string; x0: number; y0: number; x1: number; y1: number; context?: boolean }[] }>(r, "choose_photo"))
      return readPick(pick, candidates.length)
    },

    async checkArtwork({ frame, images }) {
      const out = await run("artworkCheck", model => generateText({
        model, maxOutputTokens: outputBudget(model, 6_000), providerOptions: callOptions(model, "low"),
        messages: [{ role: "system", content: "You check an exported social card at full size. Report only real defects, each with its area. PHOTO defects are ones a different photo or crop would fix: the photo does not show the subject named on the card, or the subject is not recognizable at phone size, cut off, mostly sky, tail-only, or hidden under the text or a face. TEXT defects are in the words: text clipped, overflowing or colliding; placeholder or sample text; a wrong, misspelled, abbreviated or unreadable value. LAYOUT defects are neither: an empty slot showing, a misplaced element. A clipped or overflowing headline is a TEXT defect even though it sits over the photo. Answer an empty list when there are none." },
          { role: "user", content: [{ type: "text", text: `Intended values: ${JSON.stringify(frame.fields)}` }, ...images.map(im => ({ type: "image" as const, image: im.bytes, mediaType: im.mime }))] }],
        tools: { report_defects: tool({ description: "Report the real defects, or an empty list.", inputSchema: z.object({ defects: z.array(z.object({ defect: z.string(), area: z.enum(["photo", "text", "layout"]).describe("photo: a different photo or crop would fix it; text: the words are wrong, clipped or overflowing; layout: anything else") })) }) }) }, toolChoice: "required",
      }), r => submitted<{ defects: { defect: string; area?: string; photo?: boolean }[] }>(r, "report_defects"))
      return out.defects.slice(0, 6).map(d => ({ defect: d.defect, photo: isPhotoDefect(d.area ?? (d.photo ? "photo" : "text"), d.defect) }))
    },
  }
}
