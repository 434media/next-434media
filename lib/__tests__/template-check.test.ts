/**
 * Offline. The template check (pre-run, founder 2026-10-29): every template a published profile binds, read from Canva
 * and compared with the profile; the Create row's message when Canva refuses a fill with media; and the test fill that
 * catches what a dataset read cannot. Runs on the brand profile set by ./published-profile.ts. No network, no Firestore.
 */
import { test } from "node:test"
import assert from "node:assert/strict"
import { published, loadPublishedProfileFirst } from "./published-profile"
import { checkTemplates, templateProblems, DATASET_LIMIT } from "../content-pipeline/template-check"
import { brokenFrameError } from "../content-pipeline/create-run"
import { failedJobReason, probeTemplateMedia, profileTemplateIds, PROBE_TITLE } from "../canva-create"
import { seal, CanvaError, type CanvaDeps, type CanvaTokenRecord, type CanvaTokenStore } from "../canva-export"
import type { ProfileSeries } from "../content-pipeline/profile"

loadPublishedProfileFirst()

/** A dataset that holds everything a series asks for: its fields as text (server-filled ones too) and its photo frame. */
function goodDataset(s: ProfileSeries, format: "feed" | "reels"): Record<string, string> {
  return { ...Object.fromEntries(s.fields.map(f => [f.name, "text"])), ...(s.media[format] ? { [s.media[format]!]: "image" } : {}) }
}
const anyMediaSeries = () => Object.values(published.milcity.series).find(s => s?.templates.feed && s.media.feed)!

test("a template that lists the profile's photo frame and every card field passes", async () => {
  const p = published.milcity
  const byId = new Map<string, Record<string, string>>()
  for (const s of Object.values(p.series)) for (const f of ["feed", "reels"] as const) if (s?.templates[f]) byId.set(s.templates[f], goodDataset(s, f))
  const reads: string[] = []
  const rows = await checkTemplates(p, async id => { reads.push(id); return byId.get(id)! })
  assert.ok(rows.length > 0)
  assert.deepEqual(rows.filter(r => r.problems.length), [])
  assert.equal(reads.length, new Set(reads).size, "each template is read once")
  for (const r of rows) assert.match(r.label, /(4:5|9:16)$/)
})

test("a missing photo frame, or one that is not an image field, is named", () => {
  const s = anyMediaSeries(), field = s.media.feed!
  const without = goodDataset(s, "feed"); delete without[field]
  assert.deepEqual(templateProblems(s, "feed", without, { aliases: true }).filter(p => p.includes(field)), [`The photo frame "${field}" is missing: Canva lists no field by that name`])
  assert.match(templateProblems(s, "feed", { ...goodDataset(s, "feed"), [field]: "text" }, { aliases: true }).join(), new RegExp(`"${field}" is a text field in Canva, not a photo frame`))
})

test("a written card field the template lacks is named; server-filled fields and dates are optional", () => {
  const s = anyMediaSeries()
  const written = s.fields.filter(f => !f.serverFilled && !f.date)
  const last = written[written.length - 1]
  const d = goodDataset(s, "feed"); delete d[last.name]
  for (const f of s.fields.filter(f => f.serverFilled || f.date)) delete d[f.name]
  const problems = templateProblems(s, "feed", d, { aliases: true })
  assert.equal(problems.length, 1); assert.match(problems[0], new RegExp(`No text field "${last.name}"`))
})

test("the first two written fields may sit under headline and deck, as the fill puts them; not on a roundup cover", () => {
  const s: Pick<ProfileSeries, "fields" | "media"> = { fields: [{ name: "benefit_headline", label: "Hook" }, { name: "subject_identifier", label: "Subject" }], media: { feed: "media", reels: null } }
  assert.deepEqual(templateProblems(s, "feed", { headline: "text", deck: "text", media: "image" }, { aliases: true }), [])
  assert.equal(templateProblems(s, "feed", { headline: "text", deck: "text", media: "image" }, { aliases: false }).length, 2)
})

test("a template Canva lists no fields for can't be filled, and says so", () => {
  assert.match(templateProblems(anyMediaSeries(), "feed", {}, { aliases: true })[0], /lists no autofill fields/)
})

test("one template Canva can't read is a problem on its row only; Canva's own text never shows", async () => {
  const p = published.milcity, s = anyMediaSeries()
  const rows = await checkTemplates(p, async id => {
    if (id === s.templates.feed) throw new CanvaError("Canva refused this action; reconnect Canva with the design-creation permissions", "http_403", "Canva's own words")
    const hit = Object.values(p.series).find(x => x?.templates.feed === id || x?.templates.reels === id)!
    return goodDataset(hit, hit.templates.feed === id ? "feed" : "reels")
  })
  const bad = rows.filter(r => r.problems.length)
  assert.ok(bad.every(r => r.templateId === s.templates.feed))
  assert.match(bad[0].problems[0], /^Could not read the template from Canva: Canva refused/)
  assert.doesNotMatch(bad[0].problems.join(), /own words/)
})

test("2026-10-29: a frame that became the background while the dataset still lists it passes the read (the stated limit)", async () => {
  const s = anyMediaSeries()
  // What Canva returned that day: the dataset unchanged, `media: image`. The read cannot tell; only a test fill can.
  assert.deepEqual(templateProblems(s, "feed", goodDataset(s, "feed"), { aliases: true }), [])
  assert.match(DATASET_LIMIT, /test fill/)
})

// ── the row's message when Canva refuses a fill that had media ──
test("autofill_error on a photo row says the photo frame may be broken and to tell the coordinator", () => {
  const err = new CanvaError(failedJobReason("/autofills", "autofill_error"), "autofill_error", "Canva's words")
  const out = brokenFrameError(err, "feed", { kind: "image", field: "media" }) as CanvaError
  assert.ok(out instanceof CanvaError)
  assert.match(out.message, /^Canva could not fill the .* template with this row's photo \(autofill_error\)/)
  assert.match(out.message, /photo frame "media" may be broken in Canva; tell the coordinator/)
  assert.doesNotMatch(out.message, /try a photo instead/, "a photo row isn't told to try a photo")
  assert.equal(out.code, "autofill_error"); assert.equal(out.detail, "Canva's words", "the route still logs Canva's text")
})

test("on a video row it keeps failedJobReason's advice and adds the frame; other failures pass through untouched", () => {
  const err = new CanvaError(failedJobReason("/autofills", "autofill_error"), "autofill_error")
  const out = brokenFrameError(err, "reels", { kind: "video", field: "media" }) as CanvaError
  assert.ok(out.message.startsWith(err.message)); assert.match(out.message, /may be broken in Canva; tell the coordinator/)
  const quota = new CanvaError(failedJobReason("/autofills", "trial_quota_exceeded"), "trial_quota_exceeded")
  assert.equal(brokenFrameError(quota, "feed", { kind: "image", field: "media" }), quota)
  const other = new Error("boom")
  assert.equal(brokenFrameError(other, "feed", { kind: "image", field: "media" }), other)
})

// ── the test fill (canva-create.ts probeTemplateMedia) ──
const KEY = Buffer.alloc(32, 7), TPL = "FXtpl05fe"
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
class Store implements CanvaTokenStore {
  record: CanvaTokenRecord | null = { version: 1, sealed: seal(KEY, { accessToken: "at", refreshToken: "rt", expiresAt: 9e15 }), connectedBy: "m", connectedAt: "t" }
  async read() { return this.record }
  async write() { return true }
}
function probeSetup(autofill: "success" | "failed", over: (url: string, init: RequestInit) => Response | null = () => null) {
  const calls: { url: string; method: string; body?: string }[] = []
  const canva: CanvaDeps = { client: { clientId: "c", clientSecret: "s", redirectUri: "https://x", tokenKey: KEY }, store: new Store(), nowMs: () => 1_000, sleep: async () => {}, fetcher: (async (u: URL, init: RequestInit) => {
    const url = u.toString(), method = init.method ?? "GET"
    calls.push({ url, method, body: typeof init.body === "string" ? init.body : undefined })
    const o = over(url, init); if (o) return o
    if (url.endsWith(`/brand-templates/${TPL}/dataset`)) return Response.json({ dataset: { headline: { type: "text" }, deck: { type: "text" }, media: { type: "image" } } })
    if (url.endsWith("/asset-uploads") && method === "POST") return Response.json({ job: { id: "up1", status: "in_progress" } })
    if (url.endsWith("/asset-uploads/up1")) return Response.json({ job: { id: "up1", status: "success", asset: { id: "MAtest01" } } })
    if (url.endsWith("/autofills") && method === "POST") return Response.json({ job: { id: "af1", status: "in_progress" } })
    if (url.endsWith("/autofills/af1")) return Response.json(autofill === "success" ? { job: { id: "af1", status: "success", result: { design: { id: "DAHprobe01", title: PROBE_TITLE } } } } : { job: { id: "af1", status: "failed", error: { code: "autofill_error", message: "element missing" } } })
    if (url.endsWith("/folders") && method === "POST") return Response.json({ folder: { id: "FAFprobe01", name: PROBE_TITLE } })
    if (url.endsWith("/folders/move")) return new Response(null, { status: 204 })
    if (url.endsWith("/folders/FAFprobe01") && method === "DELETE") return new Response(null, { status: 204 })
    if (url.endsWith("/assets/MAtest01") && method === "DELETE") return new Response(null, { status: 204 })
    return Response.json({ code: "unexpected" }, { status: 500 })
  }) as typeof fetch }
  return { deps: { canva, allowedTemplates: profileTemplateIds([{ series: { x: { templates: { feed: TPL } } } }]) }, calls }
}
const LIMITS = { polls: 3, intervalMs: 1 }

test("a test fill that takes the photo says so, and moves the design and the test image to Canva's Trash", async () => {
  const s = probeSetup("success")
  const r = await probeTemplateMedia(s.deps, { templateId: TPL, mediaField: "media", image: PNG }, LIMITS)
  assert.equal(r.outcome, "filled"); assert.deepEqual(r.cleanup, [])
  const fill = JSON.parse(s.calls.find(c => c.url.endsWith("/autofills") && c.method === "POST")!.body!)
  assert.equal(fill.title, PROBE_TITLE)
  assert.deepEqual(fill.data, { headline: { type: "text", text: "TEMPLATE CHECK" }, deck: { type: "text", text: "TEMPLATE CHECK" }, media: { type: "image", asset_id: "MAtest01" } })
  const order = s.calls.map(c => `${c.method} ${c.url.replace(/^.*rest\/v1/, "")}`)
  const at = (x: string) => order.indexOf(x)
  assert.ok(at("POST /folders") < at("POST /folders/move") && at("POST /folders/move") < at("DELETE /folders/FAFprobe01"))
  assert.equal(JSON.parse(s.calls.find(c => c.url.endsWith("/folders/move"))!.body!).item_id, "DAHprobe01")
  assert.ok(at("DELETE /assets/MAtest01") > 0)
})

test("a test fill Canva refuses with autofill_error reports a broken frame; the test image still goes to Trash", async () => {
  const s = probeSetup("failed")
  const r = await probeTemplateMedia(s.deps, { templateId: TPL, mediaField: "media", image: PNG }, LIMITS)
  assert.equal(r.outcome, "autofill_error"); assert.match(r.reason, /photo frame is most likely broken/)
  assert.doesNotMatch(r.reason, /element missing/)
  assert.ok(s.calls.some(c => c.method === "DELETE" && c.url.endsWith("/assets/MAtest01")))
  assert.ok(!s.calls.some(c => c.url.endsWith("/folders") && c.method === "POST"), "no design was made, so nothing to trash")
})

test("a clean-up that fails is reported, so nobody thinks the account is clean", async () => {
  const s = probeSetup("success", (url, init) => url.endsWith("/folders/move") && init.method === "POST" ? Response.json({ code: "not_found" }, { status: 404 }) : null)
  const r = await probeTemplateMedia(s.deps, { templateId: TPL, mediaField: "media", image: PNG }, LIMITS)
  assert.equal(r.outcome, "filled")
  assert.equal(r.cleanup.length, 1); assert.match(r.cleanup[0], /still in the connected Canva account's Projects \(not_found\); delete it by hand/)
  assert.ok(s.calls.some(c => c.method === "DELETE" && c.url.endsWith("/folders/FAFprobe01")), "the empty folder is removed anyway")
})

test("a test fill that couldn't run says nothing is known; a frame the dataset lacks fails before any upload", async () => {
  const quota = probeSetup("success", (url, init) => url.endsWith("/autofills") && init.method === "POST" ? Response.json({ job: { id: "af1", status: "failed", error: { code: "trial_quota_exceeded" } } }) : null)
  const r = await probeTemplateMedia(quota.deps, { templateId: TPL, mediaField: "media", image: PNG }, LIMITS)
  assert.equal(r.outcome, "error"); assert.match(r.reason, /nothing is known/)
  const s = probeSetup("success")
  const missing = await probeTemplateMedia(s.deps, { templateId: TPL, mediaField: "photo", image: PNG }, LIMITS)
  assert.equal(missing.outcome, "autofill_error")
  assert.ok(!s.calls.some(c => c.url.includes("asset-uploads")))
})
