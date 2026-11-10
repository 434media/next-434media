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
import { generateGatewayText, generateGatewayToolCall, withInstructions, type GatewayUsage } from "../ai-gateway-text"
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
