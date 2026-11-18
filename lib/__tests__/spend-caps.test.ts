/**
 * Offline. The monthly caps on the paid AI paths (lib/spend-caps.ts, founder 2026-11-18): the caps and their
 * overrides, which cost records count against which path, the refusal at or over the cap and when the spend cannot be
 * read (fails closed), the meter's words, the exam's estimate and the image and video click estimates. No model is called.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { ASSET_COST_KIND, EXAM_CONFIRM_OVER_USD, EXAM_COST_KIND, INTAKE_COST_KIND, SMOKE_COST_KIND, capDecision, capMessage, monthLine, monthlyCapUsd, spendOf } from "../spend-caps"
import { EXAM_DEFAULT_MODEL, examEstimateUsd } from "../engine/exam-estimate"
import { parsePriceTable } from "../engine/cost"
import { IMAGE_FALLBACK_USD, VIDEO_FALLBACK_PER_SECOND_USD, assetCostFor, assetEstimateUsd, isVideoModel } from "../ai-gateway-models"

test("the caps are $5 for exams, $10 for image and video, $5 for intake; only a positive override moves one", () => {
  assert.equal(monthlyCapUsd("engine-exam", {}), 5)
  assert.equal(monthlyCapUsd("asset-generate", {}), 10)
  assert.equal(monthlyCapUsd("intake", {}), 5)
  assert.equal(monthlyCapUsd("engine-exam", { ENGINE_EXAM_MONTHLY_CAP_USD: "8" }), 8)
  for (const bad of ["", "five", "0", "-1", "Infinity"]) {
    assert.equal(monthlyCapUsd("asset-generate", { ASSET_GENERATE_MONTHLY_CAP_USD: bad }), 10)
    assert.equal(monthlyCapUsd("intake", { INTAKE_MONTHLY_CAP_USD: bad }), 5)
  }
})

test("each path counts only its own kinds, from the month's start, finite figures only", () => {
  const since = "2026-11-01T00:00:00.000Z"
  const records = [
    { kind: EXAM_COST_KIND, at: "2026-11-02T00:00:00.000Z", usd: 1.5 },
    { kind: SMOKE_COST_KIND, at: "2026-11-03T00:00:00.000Z", usd: 0.25 },
    { kind: EXAM_COST_KIND, at: "2026-10-31T23:59:59.000Z", usd: 9 },
    { kind: ASSET_COST_KIND, at: "2026-11-04T00:00:00.000Z", usd: 3.2 },
    { kind: ASSET_COST_KIND, at: "2026-11-04T00:00:00.000Z", usd: Number.NaN },
    { kind: INTAKE_COST_KIND, at: "2026-11-05T00:00:00.000Z", usd: 0.4 },
    { kind: "skill:admin-ask", at: "2026-11-05T00:00:00.000Z", usd: 2 },
    { kind: "untracked", at: "2026-11-05T00:00:00.000Z", usd: 4 },
  ]
  assert.equal(spendOf(records, "engine-exam", since), 1.75)
  assert.equal(spendOf(records, "asset-generate", since), 3.2)
  assert.equal(spendOf(records, "intake", since), 0.4)
})

test("intake's kind is the one its runs are recorded under", () => {
  // lib/agent/intake.ts records its runs as `skill:${INTAKE_SKILL}`.
  assert.equal(INTAKE_COST_KIND, "skill:434-intake-qualification")
})

test("under the cap goes ahead; at or over refuses; a spend that cannot be read refuses (fails closed)", () => {
  assert.deepEqual(capDecision("engine-exam", 4.99, 5), { ok: true, spentUsd: 4.99, capUsd: 5 })
  const at = capDecision("engine-exam", 5, 5)
  assert.equal(at.ok === false && at.code, "monthly-cap")
  assert.equal(at.ok === false && at.message, "Engine exams reached this month's $5 limit; it resumes on the 1st.")
  assert.equal(capDecision("asset-generate", 12, 10).ok, false)
  const unread = capDecision("intake", null, 5)
  assert.equal(unread.ok === false && unread.code, "cap-unreadable")
  assert.equal(capDecision("intake", Number.NaN, 5).ok, false)
})

test("the meter reads 'This month: $x of $cap'", () => {
  assert.equal(monthLine(1.2, 5), "This month: $1.20 of $5")
  assert.equal(monthLine(0, 10), "This month: $0.00 of $10")
  assert.equal(monthLine(null, 10), "This month: unavailable of $10")
  assert.equal(capMessage("asset-generate", 10), "Image and video reached this month's $10 limit; it resumes on the 1st.")
})

const PRICES = parsePriceTable(
  {
    data: [
      { id: "anthropic/claude-haiku-5.5", pricing: { input: "0.0000001", output: "0.0000005", input_tiers: [{ cost: "0.0000001", min: 0, max: 100001 }, { cost: "0.0000005", min: 100001 }], output_tiers: [{ cost: "0.0000005", min: 0, max: 100001 }, { cost: "0.0000025", min: 100001 }] } },
      { id: "anthropic/claude-sonnet-5.5", pricing: { input: "0.000002", output: "0.00001" } },
      { id: "anthropic/claude-opus-5.5", pricing: { input: "0.000004", output: "0.00002" } },
    ],
  },
  "2026-11-18T00:00:00.000Z",
)

test("the exam defaults to Haiku and its 10-case estimate is cents; Sonnet and Opus are over $1 and ask twice", () => {
  assert.equal(EXAM_DEFAULT_MODEL, "anthropic/claude-haiku-5.5")
  const haiku = examEstimateUsd(PRICES.prices.get("anthropic/claude-haiku-5.5"), 10)
  const sonnet = examEstimateUsd(PRICES.prices.get("anthropic/claude-sonnet-5.5"), 10)
  const opus = examEstimateUsd(PRICES.prices.get("anthropic/claude-opus-5.5"), 10)
  assert.equal(haiku, 0.23)
  assert.ok(haiku! <= EXAM_CONFIRM_OVER_USD)
  // Above the measured runs ($2.62–$2.73 on Sonnet, $5.37 on Opus), on purpose.
  assert.equal(sonnet, 4.56)
  assert.equal(opus, 9.12)
  assert.ok(sonnet! > EXAM_CONFIRM_OVER_USD && opus! > EXAM_CONFIRM_OVER_USD)
  assert.equal(examEstimateUsd(undefined, 10), null)
  assert.equal(examEstimateUsd(PRICES.prices.get("anthropic/claude-haiku-5.5"), 0), 0)
})

test("an image click costs its listed price, else a high stand-in", () => {
  assert.deepEqual(assetCostFor({ image: "0.035" }, "image"), { usd: 0.035, per: "image", fallback: false })
  assert.deepEqual(assetCostFor({ image_dimension_quality_pricing: [{ size: "1K", cost: "0.034" }, { size: "default", cost: "0.034" }] }, "image"), { usd: 0.034, per: "image", fallback: false })
  assert.deepEqual(assetCostFor({}, "image"), { usd: IMAGE_FALLBACK_USD, per: "image", fallback: true })
  assert.deepEqual(assetCostFor(undefined, "image"), { usd: IMAGE_FALLBACK_USD, per: "image", fallback: true })
  assert.equal(assetEstimateUsd({ usd: 0.034, per: "image", fallback: false }), 0.03)
})

test("a video click is the highest per-second price times the clip; Veo and any video slug count as video", () => {
  const veo = assetCostFor({ video_duration_pricing: [{ cost_per_second: "0.2" }, { cost_per_second: "0.4" }, { cost_per_second: "0.6" }] }, "video")
  assert.deepEqual(veo, { usd: 0.6, per: "second", fallback: false })
  assert.equal(assetEstimateUsd(veo, 8), 4.8)
  assert.deepEqual(assetCostFor({ video: "1.5" }, "video"), { usd: 1.5, per: "video", fallback: false })
  const unknown = assetCostFor({}, "video")
  assert.deepEqual(unknown, { usd: VIDEO_FALLBACK_PER_SECOND_USD, per: "second", fallback: true })
  assert.equal(assetEstimateUsd(unknown, 5), 2.5)
  assert.equal(isVideoModel("google/veo-3.1-generate-001"), true)
  assert.equal(isVideoModel("bytedance/seedance-2.5"), true)
  assert.equal(isVideoModel("someone/new-video-model"), true)
  assert.equal(isVideoModel("google/gemini-3.1-flash-lite-image"), false)
})
