import { generateText, Output, stepCountIs, tool, type ToolSet } from "ai"
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
  write(input: { kind: RequestKind; story: Story; today: string; previous?: { frames: FrameCopy[]; caption: string }; instructions?: string; problems?: string[] }): Promise<{ frames: FrameCopy[]; caption: string; hold?: string }>
  /** DVIDS image pages (and official .mil/.gov photo pages) showing the card's subject, found by web search. */
  findPhotoPages(input: { story: Story; frame: FrameCopy }): Promise<string[]>
  /** The best candidate, and for each relevant one (best first) where its subject sits, so the server can test the 4:5 crop. */
  pickMedia(input: { story: Story; frame: FrameCopy; candidates: { candidate: MediaCandidate; image: Uint8Array; mime: string }[]; avoid: string[] }): Promise<{ index: number | null; reason: string; ranked?: { index: number; box: SubjectBox; context?: boolean }[] }>
  /** Real defects on the exported card; photo defects are ones a different photo would fix. */
  checkArtwork(input: { frame: FrameCopy; images: { bytes: Uint8Array; mime: string }[] }): Promise<{ defect: string; photo: boolean }[]>
}
/** The main subject's bounding box as fractions of the photo (0–1, origin top left). */
export interface SubjectBox { x0: number; y0: number; x1: number; y1: number }
export interface Candidate { title: string; primaryUrl: string; publisher: string; publishedAt?: string; whyNow?: string; why: string; supportingUrls?: string[] }
/** One model call as served: which model and which provider answered (evidence for the routing check). */
export interface ModelCall { step: PipelineStep; model: string; provider?: string; finishReason?: string; inputTokens?: number; outputTokens?: number; /** Set when this call is the fallback for a model that could not answer. */ fallbackFrom?: string; fallbackReason?: string }

const system = (extra: string) => [{ role: "system" as const, content: MCU_EDITORIAL, providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } } }, { role: "system" as const, content: extra }]

function fieldBrief(f: FieldSpec): string {
  return `${f.name} (${f.label}${f.allowed ? `; exactly one of: ${f.allowed.join(" | ")}` : ""}${f.date ? "; DDMMMYY" : ""}${f.perLine && f.maxLines ? `; at most ${f.maxLines} line${f.maxLines > 1 ? "s" : ""} of ~${f.perLine} characters` : ""}${f.maxChars ? `; at most ${f.maxChars} characters` : ""}${f.uppercase ? "; UPPERCASE" : ""}${f.exactLines ? `; exactly ${f.exactLines} lines separated by a line break, each at most ${f.perLine} characters` : ""})`
}
export function framesFor(kind: RequestKind): SeriesKey[] {
  return kind === "icymi" ? ["icymi_cover", "icymi_story", "icymi_story", "icymi_story", "icymi_story", "icymi_story"] : [kind]
}

const candidateSchema = z.object({ candidates: z.array(z.object({ title: z.string(), primaryUrl: z.string(), publisher: z.string(), publishedAt: z.string().optional(), whyNow: z.string().optional(), why: z.string(), supportingUrls: z.array(z.string()).optional() })), note: z.string().optional() })
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
export function createMcuAi(deps: { models: Record<PipelineStep, string>; searchTools: ToolSet; onCall?(call: ModelCall): void; fallbacks?: Partial<Record<PipelineStep, string>> }): McuAi {
  const m = deps.models, fallbacks = deps.fallbacks ?? CALL_FALLBACK
  const run = <R extends Served, T = R>(step: PipelineStep, call: (model: string) => Promise<R>, accept: (r: R) => T | Promise<T> = r => r as unknown as T): Promise<T> =>
    servedCall(step, m[step], fallbacks[step], deps.onCall, call, accept)
  return {
    async research({ kind, count, topic, today, recentTitles, avoid, seeds }) {
      const want = kind === "dt101" ? "defense technologies worth a Defense Tech 101 explainer (a specific, real product or system with a clear maker and a sourced status)" : kind === "breaking" ? "Breaking-qualified developments (primary-source announcement within the last 24 hours AND consequential enough to need immediate attention)" : "defense-industry news stories from the last 7 days"
      const r = await run("research", model => generateText({
        model, tools: deps.searchTools, stopWhen: stepCountIs(10), maxOutputTokens: outputBudget(model, 24_000), providerOptions: callOptions(model, "medium"), allowSystemInMessages: true, // the cached editorial prefix is ours, not user input
        messages: [...system(`${seedBrief(kind, seeds)}\n\nToday is ${today}. Task: find up to ${count + 2} ${want}${topic ? `, about: ${topic}` : ""}. Search the web; for each, find the ORIGINAL primary-source page (the company, agency or service's own announcement, contract notice or official article) and give its exact URL. Skip anything MCU already covered (recent MCU titles below) and anything listed under NEVER. Prefer U.S. defense, national-security and defense-tech companies and programs. ${kind === "dt101" ? "A DT101 card needs the maker and its headquarters: when the primary page does not name them, give supportingUrls with up to two pages that do (the maker's own product or about page first). " : ""}${kind === "breaking" ? "For each, give whyNow: one sourced sentence on what is newly different, its material consequence, and why it needs attention now. If nothing qualifies, return no candidates and say why in note." : ""}\nNever revive: ${NEVER_REVIVE.map(n => `${n.id} — ${n.what}`).join("; ")}.${avoid?.length ? `\nThese subjects were turned down or could not be sourced; pick something clearly different: ${avoid.join("; ")}.` : ""}\nRecent MCU titles:\n${recentTitles.map(t => `- ${t}`).join("\n") || "- (none found)"}`), { role: "user", content: `Find the candidates now. Return publishedAt as YYYY-MM-DD when the source states it.` }],
        output: Output.object({ schema: candidateSchema }),
      }))
      return { candidates: r.output.candidates.slice(0, count + 2), ...(r.output.note ? { note: r.output.note } : {}) }
    },

    async write({ kind, story, today, previous, instructions, problems }) {
      const frames = framesFor(kind)
      const spec = frames.map((s, i) => `Frame ${i + 1} — ${SERIES[s].label}: ${SERIES[s].fields.map(fieldBrief).join("; ") || "(media only)"}`).join("\n")
      const icymi = kind === "icymi" ? `\nICYMI: frame 1 is the cover (headline = the roundup's theme; story_01..story_05 = one short entry per story, in order; date = today as DDMMMYY). Frames 2–6 are the story cards in the same order: counter "01 / 05" … "05 / 05", headline and deck for that story. The stories:\n${(story.roundup ?? []).map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n")}` : ""
      const schema = writeSchema(kind)
      const asPrevious = (p: { frames: FrameCopy[]; caption: string }) => JSON.stringify(kind === "icymi" ? { cover: { fields: p.frames[0]?.fields }, stories: p.frames.slice(1).map(f => ({ fields: f.fields })), caption: p.caption } : { card: { fields: p.frames[0]?.fields }, caption: p.caption })
      const r = await run("write", model => generateText({
        model, maxOutputTokens: outputBudget(model, 16_000), providerOptions: callOptions(model, "medium"), allowSystemInMessages: true,
        tools: { submit_post: tool({ description: "Submit the finished card copy and caption.", inputSchema: schema as z.ZodType<Record<string, unknown>> }) }, toolChoice: { type: "tool", toolName: "submit_post" },
        messages: [...system(`Today is ${today}. Write the on-card copy and the one master caption for this MilCityUSA ${kind === "icymi" ? "ICYMI roundup" : SERIES[kind as SeriesKey].label} post from the source below, and submit them with submit_post. Use only facts in the source. Fill every field. If the source cannot support a post under the rules (unverifiable figure, not Breaking-worthy, etc.), set hold to the one-sentence reason. Never hold for the photo or its credit (a later step chooses it) or for a DOMAIN call (use Multi-domain when it spans several).\n${spec}${icymi}`),
          { role: "user", content: `SOURCE: ${story.sourceTitle}\nURL: ${story.primaryUrl}\nPublisher: ${story.publisher}\nPublished: ${story.publishedAt ?? "not stated on the page"}${story.whyNow ? `\nWhy now (Breaking): ${story.whyNow}` : ""}${story.supporting?.length ? `\nSupporting sources (their text follows the primary's, each under its own heading; use them only for what the primary leaves out, such as the maker and its headquarters): ${story.supporting.map(x => x.url).join(" ; ")}` : ""}\n\n${story.sourceText.slice(0, 24_000)}${instructions && !previous ? `\n\nREVIEWER'S DIRECTION: ${instructions}` : ""}` },
          ...(previous ? [{ role: "assistant" as const, content: `Previous version: ${asPrevious(previous)}` }, { role: "user" as const, content: `${problems?.length ? `Fix these problems: ${problems.join("; ")}. ` : ""}${instructions ? `Reviewer's changes: ${instructions}` : "Submit the corrected version."} Keep everything the reviewer did not ask to change.` }] : [])],
      }))
      const out = await submitted<{ card?: { fields: Record<string, string>; mediaQuery?: string }; cover?: { fields: Record<string, string>; mediaQuery?: string }; stories?: { fields: Record<string, string>; mediaQuery?: string }[]; caption: string; hold?: string }>(r, "submit_post")
      const parts = kind === "icymi" ? [out.cover, ...(out.stories ?? []).slice(0, 5)] : [out.card]
      console.info("[content-pipeline] write", JSON.stringify({ kind, frames: parts.filter(Boolean).length, fields: parts.map(p => Object.keys(p?.fields ?? {}).filter(k => (p?.fields[k] ?? "").trim())), hold: !!out.hold }))
      return { frames: frames.map((series, i) => ({ series, fields: { ...(parts[i]?.fields ?? {}) }, ...(parts[i]?.mediaQuery ? { mediaQuery: parts[i]!.mediaQuery } : {}) })), caption: (out.caption ?? "").trim(), ...(out.hold ? { hold: out.hold } : {}) }
    },

    async findPhotoPages({ story, frame }) {
      const subject = frame.fields.subject_identifier || frame.fields.headline || story.title
      const r = await run("photoSearch", model => generateText({
        model, tools: deps.searchTools, stopWhen: stepCountIs(6), maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
        messages: [{ role: "system", content: "You find photos for a defense-news social card. Search the web for DVIDS image pages (https://www.dvidshub.net/image/<number>/...) that show the subject itself, and official U.S. military or government (.mil, .gov) pages whose main photo shows it. Return exact page URLs only, best first; never image-file URLs, search pages or guesses. Return an empty list if none show the subject." },
          { role: "user", content: `Subject: ${subject}\nStory: ${story.title}\nPhoto idea: ${frame.mediaQuery ?? ""}` }],
        output: Output.object({ schema: z.object({ pages: z.array(z.string()).describe("up to 6 page URLs, best first") }) }),
      }))
      return [...new Set(r.output.pages.filter(u => /^https:\/\//.test(u)))].slice(0, 6)
    },

    async pickMedia({ story, frame, candidates, avoid }) {
      if (!candidates.length) return { index: null, reason: "no licensed candidates" }
      const pick = await run("photoPick", model => generateText({
        model, maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
        messages: [{ role: "system", content: "You choose the photo for a MilCityUSA social card: 1080 × 1350, full bleed, the photo filling the frame, the text block on a dark scrim over the lower 40%. The approved look is a close, dominant hero subject that fills the upper part of the frame and stays recognizable at phone size. Rank every candidate whose subject is the actual system, unit or organization in the story, best first, and give each one's subject bounding box as fractions of that photo (x0, y0 top-left to x1, y1 bottom-right; 0–1). Also say whether its background adds context (terrain, a setting, operators or other equipment that make the photo more interesting, like a forest behind an off-road vehicle) or is empty space (open sky, plain water, a blank wall or pier) that the subject should fill instead. Reject mostly-sky or empty frames, tail-only or cropped-off subjects, tiny distant subjects, and unrelated archive imagery presented as the event. index is your single best choice, or null if none is relevant and strong." },
          { role: "user", content: [
            { type: "text", text: `Story: ${story.title}\nCard: ${JSON.stringify(frame.fields)}\nAvoid repeating: ${avoid.join(", ") || "none"}\nCandidates follow, numbered from 0.` },
            ...candidates.flatMap((c, i) => [{ type: "text" as const, text: `#${i}: ${c.candidate.title} — ${c.candidate.description} (${c.candidate.width}×${c.candidate.height}, ${c.candidate.date ?? "date unknown"})` }, { type: "image" as const, image: c.image, mediaType: c.mime }]),
          ] }],
        tools: { choose_photo: tool({ description: "Choose the photo, or null when none is relevant and strong.", inputSchema: z.object({ index: z.number().int().nullable(), reason: z.string(), ranked: z.array(z.object({ index: z.number().int(), x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number(), context: z.boolean().describe("true when the background adds context; false when it is empty space the subject should fill") })).describe("every relevant candidate, best first, with its subject box") }) }) }, toolChoice: "required", // the only tool: the same contract as naming it, accepted by more providers
      }), r => submitted<{ index: number | null; reason: string; ranked?: { index: number; x0: number; y0: number; x1: number; y1: number; context?: boolean }[] }>(r, "choose_photo"))
      const i = pick.index, ok = (n: number) => Number.isInteger(n) && n >= 0 && n < candidates.length
      const clamp = (v: number) => Math.min(1, Math.max(0, Number(v) || 0))
      const ranked = (pick.ranked ?? []).filter(x => ok(x.index)).map(x => ({ index: x.index, box: { x0: clamp(Math.min(x.x0, x.x1)), y0: clamp(Math.min(x.y0, x.y1)), x1: clamp(Math.max(x.x0, x.x1)), y1: clamp(Math.max(x.y0, x.y1)) }, context: x.context !== false }))
      return { index: i !== null && ok(i) ? i : null, reason: pick.reason, ...(ranked.length ? { ranked } : {}) }
    },

    async checkArtwork({ frame, images }) {
      const out = await run("artworkCheck", model => generateText({
        model, maxOutputTokens: outputBudget(model, 6_000), providerOptions: callOptions(model, "low"),
        messages: [{ role: "system", content: "You check an exported social card at full size. Report only real defects: text clipped, overflowing or colliding; text over a face or the subject; placeholder or sample text; an empty slot showing; a wrong or unreadable value; the subject not recognizable at phone size, cut off, mostly sky or tail-only. Answer an empty list when there are none." },
          { role: "user", content: [{ type: "text", text: `Intended values: ${JSON.stringify(frame.fields)}` }, ...images.map(im => ({ type: "image" as const, image: im.bytes, mediaType: im.mime }))] }],
        tools: { report_defects: tool({ description: "Report the real defects, or an empty list.", inputSchema: z.object({ defects: z.array(z.object({ defect: z.string(), photo: z.boolean().describe("true when a different photo or crop would fix it (subject hidden, cut off, too small, under the text, mostly sky); false for text problems") })) }) }) }, toolChoice: "required",
      }), r => submitted<{ defects: { defect: string; photo: boolean }[] }>(r, "report_defects"))
      return out.defects.slice(0, 6)
    },
  }
}
