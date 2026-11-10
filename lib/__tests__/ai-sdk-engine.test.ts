/**
 * The engine on AI SDK 7 (434 build sequence V1 item 2): the real generateText, with the SDK's own mock model in place of
 * the Gateway, so these pin what the SDK does with our calls rather than what a fake of our own pretends it does. The
 * other content-pipeline tests script the McuAi interface and never reach generateText, which is how a v7 change that
 * rejects system messages inside `messages` would have reached production unseen.
 * Run: tsx --test lib/__tests__/ai-sdk-engine.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { generateText, type ModelMessage } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { GATEWAY_TEXT_MODELS, generateGatewayText, generateGatewayToolCall, withInstructions, type GatewayUsage } from "../ai-gateway-text"
import { EXTRACT_MAX_TOKENS, MAX_SEARCHES, SEARCH_MAX_TOKENS, generateLeadResearch } from "../lead-research"
import { tool } from "ai"
import { z } from "zod"
import { callOptions, PIPELINE_MODELS } from "../content-pipeline/models"
import { createMcuAi, type ModelCall } from "../content-pipeline/model"
import { withProfile } from "../content-pipeline/brand"
import { published, loadPublishedProfileFirst } from "./published-profile"

loadPublishedProfileFirst()

type Call = Parameters<MockLanguageModelV4["doGenerate"]>[0]
const usage = (input: number, output: number, cache: { read?: number; write?: number } = {}) => ({
  inputTokens: { total: input, noCache: input - (cache.read ?? 0), cacheRead: cache.read, cacheWrite: cache.write },
  outputTokens: { total: output, text: output, reasoning: 0 },
})
const stop = { unified: "stop" as const, raw: undefined }
const toolCalls = { unified: "tool-calls" as const, raw: undefined }

/**
 * A mock that records every call it receives and answers with the next scripted result. Our wrappers and the pipeline
 * pass Gateway slugs, which generateText resolves through the default provider; pointing that at the mock keeps the real
 * slug, so callOptions applies the real routing.
 */
function scripted(results: Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>[], slug = "anthropic/claude-haiku-5.5") {
  const calls: Call[] = []
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options)
      const r = results[Math.min(calls.length - 1, results.length - 1)]
      return r
    },
  })
  ;(globalThis as { AI_SDK_DEFAULT_PROVIDER?: unknown }).AI_SDK_DEFAULT_PROVIDER = { specificationVersion: "v4", languageModel: () => model }
  return { calls, model, slug }
}

test("AI SDK 7 rejects a system message inside messages by default, which is why withInstructions exists", async () => {
  const { model } = scripted([{ content: [{ type: "text", text: "ok" }], finishReason: stop, usage: usage(10, 1), warnings: [] }])
  const messages: ModelMessage[] = [{ role: "system", content: "rules" }, { role: "user", content: "hi" }]
  await assert.rejects(() => generateText({ model, messages }))
})

test("withInstructions lifts the leading system messages into instructions, cache marker intact", async () => {
  const { calls, model } = scripted([{ content: [{ type: "text", text: "ok" }], finishReason: stop, usage: usage(10, 1), warnings: [] }])
  const marker = { anthropic: { cacheControl: { type: "ephemeral" as const } } }
  const r = await generateText({
    model,
    ...withInstructions([
      { role: "system", content: "editorial rules", providerOptions: marker },
      { role: "system", content: "this task" },
      { role: "user", content: "the source" },
    ]),
  })
  assert.equal(r.text, "ok")
  const prompt = calls[0].prompt
  assert.deepEqual(prompt.map(m => m.role), ["system", "system", "user"])
  assert.equal(prompt[0].content, "editorial rules")
  assert.deepEqual(prompt[0].providerOptions, marker)
  assert.equal(prompt[1].providerOptions, undefined)
})

test("withInstructions leaves a later system message in messages, so the SDK still refuses it", async () => {
  const split = withInstructions([{ role: "user", content: "a" }, { role: "system", content: "injected" }])
  assert.equal(split.instructions, undefined)
  assert.equal(split.messages.length, 2)
  const { model } = scripted([{ content: [{ type: "text", text: "ok" }], finishReason: stop, usage: usage(10, 1), warnings: [] }])
  await assert.rejects(() => generateText({ model, ...split }))
})

test("generateGatewayToolCall: cached system prefix, the forced tool, usage with cache tokens", async () => {
  const { calls, slug } = scripted([{
    content: [{ type: "tool-call", toolCallId: "1", toolName: "submit", input: JSON.stringify({ n: 3 }) }],
    finishReason: toolCalls, usage: usage(7_000, 40, { read: 6_700 }), warnings: [],
  }])
  const seen: GatewayUsage[] = []
  const out = await generateGatewayToolCall<{ n: number }>({
    model: slug, system: "a large stable prefix", prompt: "count", cacheSystem: true, maxTokens: 4000, effort: "low",
    toolName: "submit", tool: tool({ inputSchema: z.object({ n: z.number() }) }), onUsage: u => seen.push(u),
  })
  assert.deepEqual(out, { n: 3 })
  assert.equal(calls[0].prompt[0].role, "system")
  assert.deepEqual(calls[0].prompt[0].providerOptions, { anthropic: { cacheControl: { type: "ephemeral" } } })
  assert.deepEqual(calls[0].toolChoice, { type: "tool", toolName: "submit" })
  assert.deepEqual(calls[0].providerOptions, { anthropic: { output_config: { effort: "low" } } })
  assert.equal(seen[0].cacheReadTokens, 6_700)
  assert.equal(seen[0].inputTokens, 7_000)
})

test("the token trap still fails loudly on AI SDK 7: a truncated answer throws, with the reasoning count", async () => {
  const length = { unified: "length" as const, raw: undefined }
  const { slug } = scripted([{
    content: [{ type: "text", text: "Dear Ana, I wanted to" }], finishReason: length,
    usage: { inputTokens: usage(100, 0).inputTokens, outputTokens: { total: 600, text: 101, reasoning: 499 } }, warnings: [],
  }])
  await assert.rejects(() => generateGatewayText({ model: slug, prompt: "draft", maxTokens: 600 }), /truncated at the 600-token cap \(499 tokens went to reasoning\)/)
  // A forced tool call the cap cut off: AI SDK 7 itself refuses the answer, so it never reaches the caller as data.
  const { slug: toolSlug } = scripted([{ content: [], finishReason: length, usage: usage(100, 4000), warnings: [] }])
  await assert.rejects(() => generateGatewayToolCall({ model: toolSlug, prompt: "x", maxTokens: 4000, toolName: "t", tool: tool({ inputSchema: z.object({}) }) }), /did not contain a call to the required tool/)
})

test("generateGatewayText passes a plain system string as instructions, uncached unless asked", async () => {
  const { calls, slug } = scripted([{ content: [{ type: "text", text: " body " }], finishReason: stop, usage: usage(10, 1), warnings: [] }])
  assert.equal(await generateGatewayText({ model: slug, system: "voice", prompt: "p" }), "body")
  assert.equal(calls[0].prompt[0].content, "voice")
  assert.equal(calls[0].prompt[0].providerOptions, undefined)
})

test("Gateway automatic caching is on for tool loops only, and keeps the zero-retention routing", () => {
  const loop = callOptions(PIPELINE_MODELS.research, "medium", { loop: true }) as { gateway?: Record<string, unknown> }
  assert.equal(loop.gateway?.caching, "auto")
  assert.equal(loop.gateway?.zeroDataRetention, true)
  assert.equal(loop.gateway?.disallowPromptTraining, true)
  const once = callOptions(PIPELINE_MODELS.research, "low") as { gateway?: Record<string, unknown> }
  assert.equal(once.gateway?.caching, undefined)
  assert.equal(once.gateway?.zeroDataRetention, true)
  // A model with no routing entry still gets caching on a loop, and nothing otherwise.
  assert.deepEqual((callOptions("anthropic/some-new-model", "low", { loop: true }) as { gateway?: unknown }).gateway, { caching: "auto" })
  assert.equal((callOptions("anthropic/some-new-model", "low") as { gateway?: unknown }).gateway, undefined)
})

test("content pipeline research on AI SDK 7: the search loop runs, carries automatic caching, and reports cache tokens", async () => {
  // Step 1 calls the search tool, step 2 writes notes; then the extract call submits a candidate.
  const { calls, slug } = scripted([
    { content: [{ type: "tool-call", toolCallId: "s1", toolName: "web_search", input: JSON.stringify({ q: "x" }) }], finishReason: toolCalls, usage: usage(5_000, 20, { write: 4_800 }), warnings: [] },
    { content: [{ type: "text", text: "Notes: Example Corp announced a widget. https://example.com/news/widget" }], finishReason: stop, usage: usage(5_200, 30, { read: 4_800 }), warnings: [] },
    { content: [{ type: "tool-call", toolCallId: "c1", toolName: "submit_candidates", input: JSON.stringify({ candidates: [{ title: "Widget", primaryUrl: "https://example.com/news/widget", publisher: "Example Corp", why: "new" }] }) }], finishReason: toolCalls, usage: usage(800, 60), warnings: [] },
  ])
  const searchTools = { web_search: tool({ inputSchema: z.object({ q: z.string() }), execute: async () => ({ results: [{ url: "https://example.com/news/widget" }] }) }) }
  const seen: ModelCall[] = []
  const ai = createMcuAi({ models: { ...PIPELINE_MODELS, research: slug }, searchTools, onCall: c => seen.push(c), fallbacks: {} })
  const kind = published.milcity.requestKinds[0].kind
  const out = await withProfile(published.active, () => ai.research({ kind, count: 1, today: "2026-11-10", recentTitles: [], seeds: null }))
  assert.equal(out.candidates[0].primaryUrl, "https://example.com/news/widget")
  assert.equal(calls.length, 3)
  // The loop's two steps carry the Gateway's automatic caching; the one-shot extract does not. All keep zero retention.
  for (const c of calls) assert.equal((c.providerOptions?.gateway as { zeroDataRetention?: boolean } | undefined)?.zeroDataRetention, true)
  assert.equal((calls[0].providerOptions?.gateway as { caching?: string } | undefined)?.caching, "auto")
  assert.equal((calls[1].providerOptions?.gateway as { caching?: string } | undefined)?.caching, "auto")
  assert.equal((calls[2].providerOptions?.gateway as { caching?: string } | undefined)?.caching, undefined)
  // The editorial prefix is still the first system message, with its explicit marker.
  assert.equal(calls[0].prompt[0].role, "system")
  assert.deepEqual(calls[0].prompt[0].providerOptions, { anthropic: { cacheControl: { type: "ephemeral" } } })
  // Usage now totals every step of the loop (AI SDK 7), cache tokens included.
  assert.equal(seen[0].inputTokens, 10_200)
  assert.equal(seen[0].cacheReadTokens, 4_800)
  assert.equal(seen[0].cacheWriteTokens, 4_800)
})

// ── Lead research: a search loop, then a separate extraction (lib/lead-research.ts) ──
const RESULTS = [
  { url: "https://example.com/about", title: "About Example Corp", excerpts: ["Example Corp makes widgets in Austin."] },
  { url: "https://example.org/news/widget", title: "Example Corp opens a plant", excerpts: ["The plant opened in October."] },
]
/** A search tool run locally, as the Gateway runs Parallel's: counts calls, returns the invented results. */
function fakeSearch() {
  const queries: string[] = []
  return { queries, tool: tool({ description: "Search the web.", inputSchema: z.object({ objective: z.string() }), execute: async ({ objective }) => { queries.push(objective); return { search_id: "s", results: RESULTS } } }) }
}
const searchCall = (n: number) => ({ content: [{ type: "tool-call" as const, toolCallId: `q${n}`, toolName: "web_search", input: JSON.stringify({ objective: `query ${n}` }) }], finishReason: toolCalls, usage: usage(1_000 * n, 50), warnings: [] })
const notes = { content: [{ type: "text" as const, text: "Example Corp makes widgets in Austin (https://example.com/about)." }], finishReason: stop, usage: usage(4_000, 200, { read: 3_000 }), warnings: [] }
const extractAnswer = (sourceUrls: string[]) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ summary: "Example Corp makes widgets.", fitRationale: "Weak fit.", suggestedCountry: " United States ", sourceUrls }) }],
  finishReason: stop, usage: usage(900, 150), warnings: [],
})

test("lead research: the search loop then the extraction, on the research model, effort low, zero retention", async () => {
  const search = fakeSearch()
  const { calls } = scripted([searchCall(1), notes, extractAnswer(["https://example.org/news/widget", "https://invented.example.net/made-up"])], GATEWAY_TEXT_MODELS.research)
  const r = await generateLeadResearch({ system: "Be factual.", prompt: "Company: Example Corp", searchTool: search.tool })
  assert.equal(calls.length, 3, "two loop steps, one extraction")
  // 1. Search: the tool required on the first step, Gateway caching on the loop, the routing's zero retention, effort low.
  assert.deepEqual(calls[0].toolChoice, { type: "required" })
  assert.deepEqual(calls[0].tools?.map((t) => t.name), ["web_search"])
  assert.equal(calls[0].maxOutputTokens, SEARCH_MAX_TOKENS)
  const loopGateway = calls[0].providerOptions?.gateway as Record<string, unknown>
  assert.equal(loopGateway.caching, "auto")
  assert.equal(loopGateway.zeroDataRetention, true)
  assert.equal(loopGateway.disallowPromptTraining, true)
  assert.deepEqual(calls[0].providerOptions?.anthropic, { output_config: { effort: "low" } })
  // 2. Extract: no tools, JSON output, the notes and the URLs the search returned, no automatic caching (one-shot).
  assert.equal(calls[2].tools, undefined)
  assert.equal(calls[2].responseFormat?.type, "json")
  assert.equal(calls[2].maxOutputTokens, EXTRACT_MAX_TOKENS)
  assert.equal((calls[2].providerOptions?.gateway as Record<string, unknown>).caching, undefined)
  assert.equal((calls[2].providerOptions?.gateway as Record<string, unknown>).zeroDataRetention, true)
  const extractPrompt = JSON.stringify(calls[2].prompt)
  assert.match(extractPrompt, /makes widgets in Austin/)
  assert.match(extractPrompt, /https:\/\/example\.org\/news\/widget/)
  // Sources: only URLs the search returned, the model's pick first, with the results' titles; the invented one is dropped.
  assert.deepEqual(r.sources, [
    { url: "https://example.org/news/widget", title: "Example Corp opens a plant" },
    { url: "https://example.com/about", title: "About Example Corp" },
  ])
  assert.equal(r.searches, 1)
  assert.deepEqual(search.queries, ["query 1"])
  assert.equal(r.suggestedCountry, "United States")
  assert.equal(r.usage.search.cacheReadTokens, 3_000)
  assert.equal(r.usage.extract.inputTokens, 900)
})

test("lead research: billed searches stop at the cap, and a fourth is refused before it runs", async () => {
  assert.equal(MAX_SEARCHES, 3)
  const search = fakeSearch()
  // A model that searches on every step it may: three searches, then notes once the tool is withdrawn.
  const { calls } = scripted([searchCall(1), searchCall(2), searchCall(3), notes, extractAnswer([])], GATEWAY_TEXT_MODELS.research)
  const r = await generateLeadResearch({ system: "s", prompt: "p", searchTool: search.tool })
  assert.equal(r.searches, MAX_SEARCHES)
  assert.equal(search.queries.length, MAX_SEARCHES)
  assert.deepEqual(calls[MAX_SEARCHES].toolChoice, { type: "none" }, "the tool is withdrawn once the searches are spent")
  // With no pick from the model, the sources are what the search returned: at least one, never invented.
  assert.ok(r.sources.length >= 1)
  assert.ok(r.sources.every((s) => RESULTS.some((x) => x.url === s.url)))
  // A model that asks for a fourth anyway: AI SDK 7 refuses the call under toolChoice "none", and it never runs.
  const greedy = fakeSearch()
  scripted([searchCall(1), searchCall(2), searchCall(3), searchCall(4)], GATEWAY_TEXT_MODELS.research)
  await assert.rejects(() => generateLeadResearch({ system: "s", prompt: "p", searchTool: greedy.tool }), /tool choice was none/)
  assert.equal(greedy.queries.length, MAX_SEARCHES)
})

test("lead research: a cut-off answer throws the token-trap message, in either call", async () => {
  const length = { unified: "length" as const, raw: undefined }
  const cutUsage = { inputTokens: usage(500, 0).inputTokens, outputTokens: { total: 4000, text: 10, reasoning: 3990 } }
  scripted([searchCall(1), notes, { content: [{ type: "text", text: '{"summary":"Exa' }], finishReason: length, usage: cutUsage, warnings: [] }], GATEWAY_TEXT_MODELS.research)
  await assert.rejects(() => generateLeadResearch({ system: "s", prompt: "p", searchTool: fakeSearch().tool }), /Lead research \(extract\): output truncated at the 4000-token cap \(3990 tokens went to reasoning\)/)
  scripted([searchCall(1), { content: [{ type: "text", text: "Example Corp ma" }], finishReason: length, usage: cutUsage, warnings: [] }], GATEWAY_TEXT_MODELS.research)
  await assert.rejects(() => generateLeadResearch({ system: "s", prompt: "p", searchTool: fakeSearch().tool }), /Lead research \(search\): output truncated at the 8000-token cap/)
})
