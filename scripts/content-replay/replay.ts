/**
 * Replays the content pipeline over the replay set with the real models through the Vercel AI Gateway, and scores each
 * story on the plan v9 pass bar (Phase 1 direction 4: a change that lowers this score does not go to a live round).
 *
 *   npx tsx --env-file=<.env with the Gateway credential> scripts/content-replay/replay.ts [--label <name>] [--only <id,id>] [--seeds <file>] [--no-fact-check]
 *
 * The models are production's (lib/content-pipeline/models.ts PIPELINE_MODELS), with production's routing. Research is
 * fixed to each captured story (pages/); the writing, the copy checks, the fit and fresh-wording passes, the photo
 * search and the photo pick run as they do in production. The photo search's pages, the images and the archive
 * searches are cached in .replay-cache/ (gitignored: photos are not ours to publish), so a rerun sees the candidates
 * the first run saw. No Canva fill, no artwork check (it needs the fill), no Firestore, no board, no Slack.
 * Cost is the Gateway's own: its credits' total used, before and after.
 * Output: results/<label>.json and results/<label>.md.
 */
import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { gateway } from "@ai-sdk/gateway"
import { generateText, tool } from "ai"
import { z } from "zod4"
import { BRAND } from "../../lib/content-pipeline/brand"
import { createMcuAi, servedCall, type ModelCall } from "../../lib/content-pipeline/model"
import { PIPELINE_MODELS, FALLBACK_MODELS, callOptions, outputBudget } from "../../lib/content-pipeline/models"
import type { McuSeeds } from "../../lib/content-pipeline/seeds"
import { fetchImage, fetchSourcePage, searchCommons, searchNasa, searchOpenverse, type SourcePage } from "../../lib/content-pipeline/sources"
import type { Story } from "../../lib/content-pipeline/store"
import { holdKinds, passes, replayStory, safetyOf, SAFETY_HOLDS, type ReplayDeps, type Safety, type StoryRun } from "./core"
import { loadPages, loadStories, REPLAY_DIR, storyOf, type ReplayStory } from "./fixtures"

const CACHE = process.env.REPLAY_CACHE || join(REPLAY_DIR, "..", "..", ".replay-cache")
const RESULTS = join(REPLAY_DIR, "results")
/** The fact check is the scorer's, not the pipeline's: the vision default's model, which isn't a writer here. */
const FACT_MODEL = FALLBACK_MODELS.vision

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined }

/** A credential is present and, for a Vercel OIDC token, not expired (`vercel env pull` refreshes it, for 12 hours). */
function checkCredential(): void {
  if (process.env.AI_GATEWAY_API_KEY) return
  const t = process.env.VERCEL_OIDC_TOKEN
  if (!t) throw new Error("No Gateway credential: set AI_GATEWAY_API_KEY, or VERCEL_OIDC_TOKEN (vercel env pull), in the --env-file")
  const exp = (JSON.parse(Buffer.from(t.split(".")[1] ?? "", "base64url").toString() || "{}") as { exp?: number }).exp
  if (exp && exp * 1000 < Date.now() + 10 * 60_000) throw new Error(`VERCEL_OIDC_TOKEN expired at ${new Date(exp * 1000).toISOString()}: run \`vercel env pull\` in the linked checkout`)
}

// ── the local cache: a rerun sees what the first run saw ──
const key = (kind: string, k: string) => join(CACHE, kind, createHash("sha256").update(k).digest("hex").slice(0, 32))
async function cached<T>(kind: string, k: string, load: () => Promise<T>, encode: (v: T) => Buffer = v => Buffer.from(JSON.stringify(v)), decode: (b: Buffer) => T = b => JSON.parse(b.toString()) as T): Promise<T> {
  const file = key(kind, k)
  if (existsSync(file)) {
    const b = readFileSync(file)
    if (b.subarray(0, 6).toString() === "ERROR:") throw new Error(b.subarray(6).toString())
    return decode(b)
  }
  mkdirSync(join(CACHE, kind), { recursive: true })
  try { const v = await load(); writeFileSync(file, encode(v)); return v } catch (err) {
    // A refusal is part of what the first run saw (an http_403), so it is replayed too.
    const msg = err instanceof Error ? err.message : String(err)
    if (/^http_\d+$|not public|unreachable|too large|not an image/i.test(msg)) writeFileSync(file, `ERROR:${msg}`)
    throw err
  }
}

/** The story's own captured pages first (exactly what the writer was given), then the cache, then the web. */
function pageFetcher(captured: Record<string, SourcePage>): (url: string) => Promise<SourcePage> {
  return url => captured[url] ? Promise.resolve(captured[url]) : cached("page", url, () => fetchSourcePage(url))
}
const imageFetcher = (url: string) => cached("image", url, () => fetchImage(url),
  v => Buffer.concat([Buffer.from(`${v.mime}\n`), Buffer.from(v.bytes)]),
  b => { const nl = b.indexOf(10); return { mime: b.subarray(0, nl).toString() as "image/jpeg" | "image/png", bytes: new Uint8Array(b.subarray(nl + 1)) } })

/**
 * The scorer's fact check: every statement on the card and in the caption against the source text. It reports only
 * claims the source doesn't support or contradicts, never style, length or wording. Credit lines and the DoW
 * notice are the pipeline's own and are not checked.
 */
async function factCheck(input: { story: Story; frames: StoryRun["frames"]; caption: string; onCall: (c: ModelCall) => void }): Promise<string[]> {
  const card = input.frames.map((f, i) => `Frame ${i + 1}: ${Object.entries(f.fields).filter(([k]) => k !== "image_context").map(([k, v]) => `${k}: ${v.replace(/\n/g, " / ")}`).join(" | ")}`).join("\n")
  const caption = input.caption.split("\n").filter(l => !/^(Image|Archive image|Photo): |^The appearance of U\.S\. Department/.test(l)).join("\n")
  const out = await servedCall("write", FACT_MODEL, undefined, input.onCall, model => generateText({
    model, maxOutputTokens: outputBudget(model, 8_000), providerOptions: callOptions(model, "low"),
    tools: { report: tool({ description: "Report the factual errors, or an empty list.", inputSchema: z.object({ errors: z.array(z.object({ claim: z.string(), why: z.string().describe("one sentence: what the source says instead, or that it says nothing about this") })) }) }) }, toolChoice: { type: "tool", toolName: "report" },
    messages: [{ role: "system", content: "You fact-check a social card and its caption against the source text they were written from. Report every statement of fact that the source does not support or that contradicts it: a wrong or invented figure, name, date, place, capability, customer, status or claim (\"fielded\" when the source says \"tested\", a company's own claim presented as fact without attribution). A reasonable paraphrase or summary of what the source says is not an error. Do not report style, tone, length, punctuation, word choice, headline quality or what is left out. Dates may be written as DDMMMYY. A ticker or headquarters the source states is fine. Answer an empty list when every statement is supported." },
      { role: "user", content: `SOURCE (${input.story.publisher}, ${input.story.publishedAt ?? "undated"}): ${input.story.sourceTitle}\n${input.story.sourceText.slice(0, 24_000)}${input.story.roundup ? `\n\nROUNDUP STORIES:\n${input.story.roundup.map((p, i) => `${i + 1}. ${p.title}\n${p.caption}`).join("\n\n")}` : ""}\n\nCARD:\n${card}\n\nCAPTION:\n${caption}` }],
  }), async r => { const c = r.toolCalls.find(x => x.toolName === "report"); if (!c) throw new Error("fact check did not report"); return (c.input as { errors: { claim: string; why: string }[] }).errors })
  return out.map(e => `${e.claim} — ${e.why}`)
}

interface Scored { run: StoryRun; safety: Safety | null; pass: boolean; holdKinds: string[]; v9Hold: boolean | null; observed: ReplayStory["observed"] }

/**
 * --rescore <results json>: the code checks and the hold sorting applied again to a recorded run, with no model
 * called; the fact check's findings, the cost and the token counts are kept as recorded. For a change to the scoring.
 */
function rescore(file: string): void {
  const old = JSON.parse(readFileSync(file, "utf8")) as ReturnType<typeof summarize>
  const set = loadStories()
  const scored: Scored[] = old.stories.map(o => {
    const s = set.stories.find(x => x.id === o.id)!
    const captured = s.kind === "icymi" ? null : loadPages(s.id)
    const run: StoryRun = { id: o.id, kind: o.kind, end: o.end, status: o.end === "review" ? "designing" : "held", reason: o.reason, frames: o.frames, caption: o.caption, media: o.media, history: o.history, calls: [], ms: o.seconds * 1000, ...(o.roundup ? { roundup: o.roundup } : {}), ...(captured ? { story: storyOf(s, captured) } : {}) }
    const safety = o.end === "review" ? { ...safetyOf(run), factErrors: o.safety?.factErrors ?? null } : null
    const kinds = o.end === "review" ? [] : holdKinds(o.reason ?? "", o.end)
    return { run, safety, pass: !!safety && passes(run, safety), holdKinds: kinds, v9Hold: o.end === "review" ? null : kinds.some(k => SAFETY_HOLDS.includes(k as never) || k === "error"), observed: s.observed }
  })
  const result = summarize({ ...old.meta, rescored: new Date().toISOString() } as Meta, scored)
  result.tokens = old.tokens
  result.stories.forEach((r, i) => { r.calls = old.stories[i].calls; r.inputTokens = old.stories[i].inputTokens; r.outputTokens = old.stories[i].outputTokens })
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(file.replace(/\.json$/, ".md"), markdown(result))
  console.log(`rescored: ${result.score.pass} of ${result.score.stories} pass (${result.score.reachedReview} reached the Canva step)`)
}

async function main() {
  if (arg("--rescore")) return rescore(arg("--rescore")!)
  checkCredential()
  const label = arg("--label") ?? `run-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const only = arg("--only")?.split(","), seedsFile = arg("--seeds") ?? process.env.REPLAY_SEEDS, doFacts = !process.argv.includes("--no-fact-check")
  const seeds = seedsFile ? JSON.parse(readFileSync(seedsFile, "utf8")) as McuSeeds : null
  if (!seeds) console.warn("No seeds given (--seeds or REPLAY_SEEDS): the writer gets no brand direction. Production loads them from Firestore.")
  const set = loadStories(), stories = set.stories.filter(s => !only || only.includes(s.id))
  const searchTools = { web_search: gateway.tools.parallelSearch({ mode: "agentic", maxResults: 10 }) }
  const before = await gateway.getCredits()
  const started = new Date().toISOString(), scored: Scored[] = []
  for (const s of stories) {
    const captured = s.kind === "icymi" ? null : loadPages(s.id)
    const deps: ReplayDeps = {
      ai: onCall => createMcuAi({ models: PIPELINE_MODELS, searchTools, readTools: { web_search: gateway.tools.parallelSearch({ mode: "one-shot", maxResults: 5, excerpts: { maxCharsPerResult: 20_000 } }) }, onCall }),
      seeds, fetchPage: pageFetcher(captured?.pages ?? {}), fetchImage: imageFetcher,
      searchCommons: q => cached("commons", q, () => searchCommons(q)),
      searchMore: q => cached("archives", q, async () => (await Promise.all([searchOpenverse(q).catch(() => []), searchNasa(q).catch(() => [])])).flat()),
    }
    process.stdout.write(`${s.id} … `)
    let run: StoryRun
    try { run = await replayStory(s, captured, deps) } catch (err) {
      run = { id: s.id, kind: s.kind, end: "failed", status: "failed", reason: `replay error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 400), frames: [], caption: null, media: [], history: [], calls: [], ms: 0 }
    }
    let safety: Safety | null = null
    if (run.end === "review") {
      const facts = doFacts && run.story ? await factCheck({ story: run.story, frames: run.frames, caption: run.caption ?? "", onCall: c => run.calls.push({ ...c, step: "write", model: `${c.model} (fact check)` }) }).catch(err => [`fact check failed: ${err instanceof Error ? err.message : err}`]) : null
      safety = { ...safetyOf(run), factErrors: facts }
    }
    const kinds = run.end === "review" ? [] : holdKinds(run.reason ?? "", run.end)
    const pass = !!safety && passes(run, safety)
    scored.push({ run, safety, pass, holdKinds: kinds, v9Hold: run.end === "review" ? null : kinds.some(k => SAFETY_HOLDS.includes(k as never) || k === "error"), observed: s.observed })
    console.log(`${pass ? "PASS" : run.end === "review" ? "UNSAFE" : run.end.toUpperCase()}${run.reason ? ` — ${run.reason.slice(0, 160)}` : ""}${safety && !pass ? ` — ${[...safety.limits, ...safety.unsourced.map(n => `unsourced ${n}`), ...(safety.factErrors ?? []), ...safety.rights.filter(r => r === "missing").map(() => "photo missing")].join("; ").slice(0, 200)}` : ""}`)
  }
  // The Gateway's total used moves a little after the last call settles.
  await new Promise(r => setTimeout(r, 20_000))
  const after = await gateway.getCredits()
  const cost = Number(after.totalUsed) - Number(before.totalUsed)
  const commit = (() => { try { return execSync("git rev-parse --short HEAD", { cwd: REPLAY_DIR }).toString().trim() } catch { return "unknown" } })()
  const result = summarize({ label, started, finished: new Date().toISOString(), rules: BRAND.rulesVersion, models: PIPELINE_MODELS, factModel: doFacts ? FACT_MODEL : null, seeds: seedsFile ? { file: seedsFile.split("/").pop(), sha256: createHash("sha256").update(readFileSync(seedsFile)).digest("hex").slice(0, 16), snapshot: seeds?.snapshot ?? null } : null, head: commit, costUsd: Math.round(cost * 10_000) / 10_000 }, scored)
  mkdirSync(RESULTS, { recursive: true })
  writeFileSync(join(RESULTS, `${label}.json`), `${JSON.stringify(result, null, 2)}\n`)
  writeFileSync(join(RESULTS, `${label}.md`), markdown(result))
  console.log(`\n${result.score.pass} of ${result.score.stories} pass (${result.score.reachedReview} reached the Canva step). Cost $${result.meta.costUsd}. Written: results/${label}.json, .md`)
}

type Meta = { rescored?: string; label: string; started: string; finished: string; rules: string; models: Record<string, string>; factModel: string | null; seeds: { file?: string; sha256: string; snapshot: string | null } | null; head: string; costUsd: number }
function summarize(meta: Meta, scored: Scored[]) {
  const tokens: Record<string, { calls: number; input: number; output: number }> = {}
  for (const s of scored) for (const c of s.run.calls) { const t = tokens[`${c.step}:${c.model}`] ??= { calls: 0, input: 0, output: 0 }; t.calls++; t.input += c.inputTokens ?? 0; t.output += c.outputTokens ?? 0 }
  const count = (f: (s: Scored) => boolean) => scored.filter(f).length
  const byKind: Record<string, number> = {}
  for (const s of scored) for (const k of s.holdKinds) byKind[k] = (byKind[k] ?? 0) + 1
  return {
    meta,
    score: { stories: scored.length, pass: count(s => s.pass), reachedReview: count(s => s.run.end === "review"), unsafeAtReview: count(s => s.run.end === "review" && !s.pass), held: count(s => s.run.end === "held"), failed: count(s => s.run.end === "failed"), noDraft: count(s => s.run.end === "none"), heldForStyleOnly: count(s => s.v9Hold === false), holdKinds: byKind },
    tokens,
    stories: scored.map(s => ({ id: s.run.id, kind: s.run.kind, end: s.run.end, pass: s.pass, reason: s.run.reason, holdKinds: s.holdKinds, v9WouldHold: s.v9Hold, safety: s.safety, frames: s.run.frames, caption: s.run.caption, media: s.run.media, roundup: s.run.roundup, history: s.run.history, calls: s.run.calls.length, inputTokens: s.run.calls.reduce((n, c) => n + (c.inputTokens ?? 0), 0), outputTokens: s.run.calls.reduce((n, c) => n + (c.outputTokens ?? 0), 0), seconds: Math.round(s.run.ms / 1000), observed: s.observed.map(o => `round ${o.round} (${o.models}): ${o.outcome} — ${o.reason}`) })),
  }
}
function markdown(r: ReturnType<typeof summarize>): string {
  const cell = (v: string) => v.replace(/\|/g, "\\|").replace(/\n/g, " / ")
  const rows = r.stories.map(s => `| ${s.id} | ${s.kind} | ${s.pass ? "**pass**" : s.end === "review" ? "reached, unsafe" : s.end} | ${cell(s.pass ? "" : s.end === "review" ? [...(s.safety?.limits ?? []), ...(s.safety?.unsourced ?? []).map(n => `unsourced ${n}`), ...(s.safety?.clipped ?? []).map(w => `cut-off word ${w}`), ...(s.safety?.factErrors ?? []), ...(s.safety?.rights.includes("missing") ? ["photo missing"] : [])].join("; ") : `${s.holdKinds.join(", ")}: ${s.reason ?? ""}`).slice(0, 300)} | ${cell(s.frames.map(f => Object.entries(f.fields).filter(([k]) => !["date", "image_context", "counter", "story_numbers"].includes(k)).map(([, v]) => v).join(" · ")).join(" ‖ ").slice(0, 160))} | ${cell(s.observed.map(o => o.replace(/ — .*/, "")).join("; "))} |`)
  return [
    `# Content pipeline replay: ${r.meta.label}`, "",
    `Rules ${r.meta.rules} · head ${r.meta.head} · ${r.meta.started} → ${r.meta.finished}${r.meta.rescored ? ` · rescored ${r.meta.rescored} (code checks again, no model called)` : ""}`,
    `Models: ${Object.entries(r.meta.models).map(([k, v]) => `${k} ${v}`).join(", ")}${r.meta.factModel ? ` · fact check ${r.meta.factModel}` : " · no fact check"} · seeds ${r.meta.seeds ? `${r.meta.seeds.file} (${r.meta.seeds.sha256})` : "none"}`, "",
    `**Score: ${r.score.pass} of ${r.score.stories} pass** (reach Review safe and within limits). Reached the Canva step: ${r.score.reachedReview}; of those unsafe: ${r.score.unsafeAtReview}. Held: ${r.score.held} (${r.score.heldForStyleOnly} for reasons v9 no longer holds for). Failed: ${r.score.failed}. No draft: ${r.score.noDraft}.`,
    `Hold reasons: ${Object.entries(r.score.holdKinds).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}.`,
    `**Cost: $${r.meta.costUsd.toFixed(4)}** (Gateway credits, total used before and after).`, "",
    "Not scored offline: the Canva fill, the artwork check and the rendered layout (the replay stops before the fill).", "",
    "| Story | Series | Replay | Why | Card copy | Gate rounds |", "|---|---|---|---|---|---|", ...rows, "",
    "## Tokens", "", "| Step : model | Calls | Input | Output |", "|---|---|---|---|",
    ...Object.entries(r.tokens).map(([k, t]) => `| ${k} | ${t.calls} | ${t.input} | ${t.output} |`), "",
  ].join("\n")
}

void main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1 })
