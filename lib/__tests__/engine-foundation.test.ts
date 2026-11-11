/**
 * Foundation A (434 build sequence V1 item 2): the model allow-list and the budget in the guard, cost per task, the
 * tool allow-list by autonomy level, protected config and the blank-config block, and the queue-age alerts. Runs on the
 * SDK's mock model and the invented skill fixture; nothing reaches the Gateway or Firestore.
 * Run: tsx --test lib/__tests__/engine-foundation.test.ts
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { join } from "node:path"
import { generateText, tool, wrapLanguageModel } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { z } from "zod"
import { ENGINE_LANGUAGE_MODELS, ModelNotAllowedError, assertModelAllowed, modelAllowed } from "../engine/models"
import { BudgetExceededError, DEFAULT_DAILY_CAP_USD, assertWithinBudget, capsFromEnv } from "../engine/budget"
import { billedCostUsd, listCostUsd, parsePriceTable, tokensOf } from "../engine/cost"
import { guardMiddleware } from "../engine/guard"
import type { CallCostRecord } from "../engine/cost-ledger"
import { withTask } from "../engine/task-context"
import { admitTools, effectiveLevel, refusal, type ToolDeclarations } from "../engine/tool-policy"
import { blankOrTemplate, checkRunConfig, isProtectedTarget, sha256 } from "../engine/protected-config"
import { RunRefused, startSkillRun } from "../engine/run"
import { fingerprint, parseSkill, readSkillFolder, skillAgent } from "../skills/loader"
import { QUEUES, heartbeatDue, overdueQueues, readQueue, timeOf } from "../queue-age"

const usage = { inputTokens: { total: 1000, noCache: 600, cacheRead: 400, cacheWrite: undefined }, outputTokens: { total: 50, text: 30, reasoning: 20 } }
const textModel = (modelId: string, onCall?: () => void) =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: async () => {
      onCall?.()
      return { content: [{ type: "text" as const, text: "ok" }], finishReason: { unified: "stop" as const, raw: undefined }, usage, warnings: [], providerMetadata: { gateway: { cost: "0.00123", routing: { finalProvider: "anthropic" } } } }
    },
  })

// ── models ──
test("the allow-list: every listed model is dated; an unlisted one is refused by name", () => {
  for (const [slug, m] of Object.entries(ENGINE_LANGUAGE_MODELS)) {
    assert.match(slug, /^[a-z0-9-]+\/[A-Za-z0-9._-]+$/)
    assert.match(m.checked, /^\d{4}-\d{2}-\d{2}$/)
  }
  assert.ok(modelAllowed("anthropic/claude-haiku-5.5"))
  assert.ok(!modelAllowed("openai/gpt-4o-mini-search-preview"))
  assert.throws(() => assertModelAllowed("anthropic/some-new-model"), ModelNotAllowedError)
})

// ── the guard ──
test("the guard refuses an unlisted model before the call is made", async () => {
  let called = 0
  const records: CallCostRecord[] = []
  const model = wrapLanguageModel({ model: textModel("x-ai/not-chosen", () => called++), middleware: guardMiddleware({ record: async r => { records.push(r) }, prices: async () => null }) })
  await assert.rejects(generateText({ model, prompt: "hi" }), /not on the engine's allow-list/)
  assert.equal(called, 0)
  assert.equal(records.length, 0)
})

test("the guard records each call against its task, billed and list figures apart", async () => {
  const records: CallCostRecord[] = []
  const prices = parsePriceTable({ data: [{ id: "anthropic/claude-haiku-5.5", pricing: { input: "0.0000001", output: "0.0000005", input_cache_read: "0.00000001" } }] }, "2026-11-11T12:00:00.000Z")
  const model = wrapLanguageModel({ model: textModel("anthropic/claude-haiku-5.5"), middleware: guardMiddleware({ record: async r => { records.push(r) }, prices: async () => prices, now: () => new Date("2026-11-11T12:30:00Z") }) })
  const r = await withTask({ task: "draft:abc", kind: "content-pipeline", property: "milcity" }, () => generateText({ model, prompt: "hi" }))
  assert.equal(r.text, "ok")
  assert.equal(records.length, 1)
  const rec = records[0]
  assert.equal(rec.task, "draft:abc")
  assert.equal(rec.property, "milcity")
  assert.equal(rec.model, "anthropic/claude-haiku-5.5")
  assert.equal(rec.provider, "anthropic")
  assert.equal(rec.billedUsd, 0.00123)
  assert.equal(rec.usd, 0.00123)
  // 600 plain input × 1e-7 + 400 cache reads × 1e-8 + 50 output × 5e-7
  assert.equal(rec.listUsd, 0.000089)
  assert.equal(rec.priceCheckedAt, "2026-11-11T12:00:00.000Z")
  assert.deepEqual(rec.tokens, { input: 1000, cacheRead: 400, output: 50, reasoning: 20 })
})

test("a call outside any task is still recorded, as untracked", async () => {
  const records: CallCostRecord[] = []
  const model = wrapLanguageModel({ model: textModel("anthropic/claude-sonnet-5.5"), middleware: guardMiddleware({ record: async r => { records.push(r) }, prices: async () => null }) })
  await generateText({ model, prompt: "hi" })
  assert.equal(records[0].task, "untracked")
  assert.equal(records[0].listUsd, undefined)
})

test("the guard refuses a call once the day's global or property cap is reached", async () => {
  let called = 0
  const mk = (spend: { totalUsd: number; byProperty: Record<string, number> }) =>
    wrapLanguageModel({ model: textModel("anthropic/claude-haiku-5.5", () => called++), middleware: guardMiddleware({ readSpend: async () => spend, record: async () => {}, prices: async () => null, env: {} }) })
  await assert.rejects(generateText({ model: mk({ totalUsd: DEFAULT_DAILY_CAP_USD, byProperty: {} }), prompt: "hi" }), BudgetExceededError)
  await assert.rejects(withTask({ task: "t", kind: "k", property: "milcity" }, () => generateText({ model: mk({ totalUsd: 1, byProperty: { milcity: 50 } }), prompt: "hi" })), /budget for milcity/)
  assert.equal(called, 0)
  await withTask({ task: "t", kind: "k", property: "txmx" }, () => generateText({ model: mk({ totalUsd: 1, byProperty: { milcity: 50 } }), prompt: "hi" }))
  assert.equal(called, 1)
})

test("a budget that cannot be read refuses the call (fails closed)", async () => {
  const model = wrapLanguageModel({ model: textModel("anthropic/claude-haiku-5.5"), middleware: guardMiddleware({ readSpend: async () => { throw new Error("firestore down") }, record: async () => {}, prices: async () => null }) })
  await assert.rejects(generateText({ model, prompt: "hi" }), /firestore down/)
})

// ── budget and cost ──
test("caps: env overrides only with a positive number", () => {
  assert.deepEqual(capsFromEnv({}), { dailyUsd: 25, propertyDailyUsd: 20 })
  assert.deepEqual(capsFromEnv({ AI_DAILY_CAP_USD: "40", AI_PROPERTY_DAILY_CAP_USD: "abc" }), { dailyUsd: 40, propertyDailyUsd: 20 })
  assert.deepEqual(capsFromEnv({ AI_DAILY_CAP_USD: "-1", AI_PROPERTY_DAILY_CAP_USD: "0" }), { dailyUsd: 25, propertyDailyUsd: 20 })
  assert.doesNotThrow(() => assertWithinBudget({ totalUsd: 24.99, byProperty: { a: 19.99 } }, { dailyUsd: 25, propertyDailyUsd: 20 }, "a"))
})

test("list price: tiers by input size, cache rates, and the two usage shapes", () => {
  const t = parsePriceTable({ data: [{ id: "m", pricing: { input: "0.0000001", output: "0.0000005", input_tiers: [{ cost: "0.0000001", min: 0, max: 100001 }, { cost: "0.0000005", min: 100001 }], output_tiers: [{ cost: "0.0000005", min: 0, max: 100001 }, { cost: "0.0000025", min: 100001 }] } }, { id: "free" }] }, "x")
  assert.ok(!t.prices.has("free"))
  assert.equal(listCostUsd(t.prices.get("m"), { input: 1000, output: 100 }), 0.00015)
  assert.equal(listCostUsd(t.prices.get("m"), { input: 200_000, output: 100 }), 0.10025)
  assert.equal(listCostUsd(undefined, { input: 1 }), undefined)
  assert.equal(billedCostUsd({ gateway: { cost: "0.5" } }), 0.5)
  assert.equal(billedCostUsd({}), undefined)
  assert.deepEqual(tokensOf({ inputTokens: 10, outputTokens: 5, inputTokenDetails: { cacheReadTokens: 3 }, outputTokenDetails: { reasoningTokens: 2 } }), { input: 10, cacheRead: 3, output: 5, reasoning: 2 })
})

// ── tool allow-lists ──
const decls: ToolDeclarations = {
  lookup: { class: "read" },
  propose_reply: { class: "draft" },
  save_record: { class: "write", writes: ["crm_leads"] },
  send_email: { class: "send" },
  queue_send: { class: "send", gate: "approval" },
  post_now: { class: "publish", neverAutonomous: true },
  edit_profile: { class: "write", writes: ["brand_profiles"] },
}
const all = Object.fromEntries(Object.keys(decls).concat("undeclared").map(k => [k, k]))

test("a draft run has no write, send or publish tool", () => {
  const { admitted, refused } = admitTools(all, decls, "draft", t => isProtectedTarget(t))
  assert.deepEqual(Object.keys(admitted).sort(), ["lookup", "propose_reply"])
  assert.equal(refused.length, 6)
  assert.ok(refused.some(r => r.startsWith("undeclared: no tool declaration")))
})

test("an approval run sends only through an approval-gated tool; protected targets are never admitted", () => {
  const { admitted } = admitTools(all, decls, "approval", t => isProtectedTarget(t))
  assert.deepEqual(Object.keys(admitted).sort(), ["lookup", "propose_reply", "queue_send", "save_record"])
  const auto = admitTools(all, decls, "autonomous", t => isProtectedTarget(t))
  assert.ok(!("post_now" in auto.admitted), "never-autonomous and not gated")
  assert.ok(!("edit_profile" in auto.admitted), "writes brand_profiles")
  assert.ok("send_email" in auto.admitted)
})

test("the level is the lower of requested and ceiling; unknown counts as draft", () => {
  assert.equal(effectiveLevel("autonomous", "approval"), "approval")
  assert.equal(effectiveLevel("draft", "autonomous"), "draft")
  assert.equal(effectiveLevel("everything", "autonomous"), "draft")
  assert.equal(effectiveLevel("approval", undefined), "draft")
  assert.match(refusal("x", { class: "launch" as never }, "autonomous", () => false)!, /unknown tool class/)
})

test("the loader applies the level: the fixture's lookup tool, declared send, is left out of a draft run", async () => {
  const files = await readSkillFolder(join(__dirname, "fixtures/skills/sample-greeter"))
  const lookup_visitor = tool({ inputSchema: z.object({ id: z.string() }), execute: async () => ({ name: "Ana" }) })
  const model = textModel("anthropic/claude-haiku-5.5")
  const draft = skillAgent({ files, model, tools: { lookup_visitor }, autonomy: { level: "draft", declarations: { lookup_visitor: { class: "send" } } } })
  assert.equal(draft.level, "draft")
  assert.equal(draft.refused.length, 1)
  const read = skillAgent({ files, model, tools: { lookup_visitor }, autonomy: { level: "draft", declarations: { lookup_visitor: { class: "read" } } } })
  assert.deepEqual(read.refused, [])
})

// ── protected config ──
test("blank and template rule files are refused; merge tags and format placeholders are not templates", () => {
  assert.match(blankOrTemplate("---\nname: x\n---\n# Heading\n<!-- note -->\n")!, /blank/)
  assert.match(blankOrTemplate("<!-- TEMPLATE -->\n# Rules\nSome text")!, /template/)
  assert.match(blankOrTemplate("# Rules\n- Owner: TODO\n")!, /TODO/)
  assert.equal(blankOrTemplate("Close with {{unsubscribe}} on <YYYY-MM-DD>.\n"), null)
  assert.match(blankOrTemplate("# T\n<!-- a --> <!-- b <!-- c -->\n<!-- unclosed rule text")!, /blank/)
  assert.equal(blankOrTemplate("<!-- a -->Real rule.\n"), null)
})

test("the run-start check: pinned, unchanged, all pinned, none blank; no pins is a refusal", () => {
  const files = { "policy.md": "Rule one.\n" }
  assert.ok(checkRunConfig(files, { "policy.md": sha256("Rule one.\n") }).ok)
  assert.match(checkRunConfig(files, { "policy.md": "0".repeat(64) }).problems[0], /changed since it was pinned/)
  assert.match(checkRunConfig(files, {}).problems.join(" "), /no pins/)
  assert.match(checkRunConfig({ ...files, "extra.md": "x" }, { "policy.md": sha256("Rule one.\n") }).problems[0], /not pinned/)
  assert.match(checkRunConfig({}, { "gone.md": "a" }).problems[0], /pinned but not supplied/)
})

test("protected targets: rule files, policies, skill definitions and brand profiles", () => {
  for (const t of ["brand_profiles", "06 Standards/Intake_Qualification_SOP.md", ".claude/skills/x/SKILL.md", "CLAUDE.md", "lib/engine/models.ts"]) assert.ok(isProtectedTarget(t), t)
  for (const t of ["crm_leads", "crm_content_posts", "CLAUDE.md.bak"]) assert.ok(!isProtectedTarget(t), t)
})

test("the loader's blank-config block: a SKILL.md whose body is only headings is refused", () => {
  const r = parseSkill({ "SKILL.md": "---\nname: x\ndescription: d\n---\n\n# Title\n\n## Steps\n" })
  assert.ok(!r.ok && r.problems.some(p => /blank/.test(p)))
})

test("startSkillRun refuses a changed rule file and runs at the lower of level and ceiling", async () => {
  const files = await readSkillFolder(join(__dirname, "fixtures/skills/sample-greeter"))
  const lookup_visitor = tool({ inputSchema: z.object({ id: z.string() }), execute: async () => ({ name: "Ana" }) })
  const base = { skill: { files, folder: "sample-greeter", sha256: fingerprint(files) }, tools: { lookup_visitor }, declarations: { lookup_visitor: { class: "write" as const } }, model: textModel("anthropic/claude-haiku-5.5"), task: { task: "t1", kind: "test" } }
  assert.throws(() => startSkillRun({ ...base, level: "draft", ceiling: "draft", rules: { files: { "p.md": "A" }, pins: { "p.md": sha256("B") } } }), RunRefused)
  assert.throws(() => startSkillRun({ ...base, skill: { ...base.skill, sha256: "0".repeat(64) }, level: "draft", ceiling: "draft" }), /not the pinned version/)
  const run = startSkillRun({ ...base, level: "autonomous", ceiling: "draft" })
  assert.equal(run.level, "draft")
  assert.equal(run.refused.length, 1)
  const ok = startSkillRun({ ...base, level: "approval", ceiling: "autonomous" })
  assert.equal(ok.level, "approval")
  assert.deepEqual(ok.refused, [])
})

// ── queue age and the heartbeat ──
test("queue age: the oldest item past its queue's limit is reported; timestamps of every stored shape are read", () => {
  const now = new Date("2026-11-11T12:00:00Z")
  const review = QUEUES.find(q => q.name === "founder-review")!
  const r = readQueue(review, [{ updated_at: { seconds: Date.parse("2026-11-10T06:00:00Z") / 1000 } }, { updated_at: "2026-11-11T11:00:00Z" }, {}])
  assert.equal(r.waiting, 3)
  const alerts = overdueQueues([r], now)
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].ageHours, 30)
  assert.equal(overdueQueues([readQueue(review, [{ updated_at: "2026-11-11T11:00:00Z" }])], now).length, 0)
  assert.equal(timeOf({ toMillis: () => 5 }), 5)
  assert.equal(timeOf("not a date"), null)
})

test("the heartbeat goes once a day, on the first run at or after 13:00 UTC", () => {
  assert.equal(heartbeatDue(new Date("2026-11-11T12:30:00Z"), null), false)
  assert.equal(heartbeatDue(new Date("2026-11-11T13:30:00Z"), null), true)
  assert.equal(heartbeatDue(new Date("2026-11-11T14:30:00Z"), "2026-11-11T13:30:00.000Z"), false)
  assert.equal(heartbeatDue(new Date("2026-11-12T13:30:00Z"), "2026-11-11T13:30:00.000Z"), true)
})
