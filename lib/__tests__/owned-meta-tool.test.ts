/** Offline only. Run with tsx --test. No Meta, Slack, Blob or Firestore access: every transport is faked. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftBatch, runOwnedMeta, MetaBlocked, MetaPermissionError, type MetaDestination, type MetaManifest, type MetaProvider, type MetaRecord, type MetaStore } from "../owned-meta-publisher"
import { assetDigest } from "../owned-meta-assets"
import { createMetaProvider, type MetaPublishingEvidence } from "../instagram-publishing"
import { credentialState, needsContinuation, noticesFor, parseApprovers, recordExternalPublication, slackApprovalFrom, toolAuthorized } from "../owned-meta-tool"
import { continueOwnedMeta, handleOwnedMetaTool, type ToolDeps } from "../owned-meta-tool-handler"
import { postSlackNotice, readSlackMessage } from "../owned-meta-slack"

const SECRET = "s".repeat(40), FOUNDER = "U08LKLE5H3M", NOW = "2026-10-16T12:00:00.000Z"
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
function manifest(format: MetaManifest["format"] = "carousel", ai = false): MetaManifest {
  const asset = { name: "a", url: "https://approved.public.blob.vercel-storage.com/content-posts/12345678-1234-1234-1234-123456789abc.jpg", sha256: assetDigest(jpeg), size: jpeg.length, mime: "image/jpeg" as const, width: 1080, height: 1350, provenance: { source: "canva", templateRevision: "v1", generator: "none", metadata: "unverified" as const } }
  return { schema: 1, revision: 1, brand: "milcity", format, assets: format === "carousel" ? [asset, { ...asset, name: "b" }] : format === "video" ? [{ ...asset, mime: "video/mp4", duration: 5, width: 1080, height: 1920 }] : [asset], captions: { instagram: "IG", facebook: "FB" }, destinations: { appId: "1", pageId: "2", instagramId: "3", apiVersion: "v26.0" }, placements: { instagram: format === "video" ? "reels" : "feed", facebook: format === "video" ? "reels" : "feed" }, instagramShareToFeed: false, aiGenerated: ai, publicHostingApproved: true }
}
function record(m = manifest(), approved = true): MetaRecord { const batch = draftBatch("batch-1", m); if (approved) batch.approval = { by: "marcos@434media.com", at: NOW, hash: batch.hash }; return { archived: false, revision: 1, batch } }
class Store implements MetaStore {
  value: MetaRecord; version = 0
  constructor(r = record()) { this.value = structuredClone(r) }
  async read() { return structuredClone(this.value) }
  async update<T>(_id: string, fn: (r: MetaRecord) => { next?: MetaRecord; result: T }): Promise<T> { for (;;) { const v = this.version, { next, result } = fn(structuredClone(this.value)); await new Promise(r => setImmediate(r)); if (v !== this.version) continue; if (next) { this.value = next; this.version++ } return result } }
  async event() {}
}
function provider(o: { failFinal?: MetaDestination; notReady?: Set<MetaDestination>; permission?: boolean; prepareFails?: MetaDestination } = {}): MetaProvider & { calls: string[] } {
  const calls: string[] = []
  return { calls, preflight: () => null,
    prepare: async (_m, d, _u, p, save) => { calls.push(`prepare:${d}`); if (o.permission) throw new MetaPermissionError({ destination: d, operation: "prepare", at: NOW, httpStatus: 401, code: 190 }); if (o.prepareFails === d) throw new MetaBlocked("prep failed"); if (!p.container) await save("container", d === "instagram" ? "11" : "22"); return { ready: !o.notReady?.has(d), preparation: { ...p, container: d === "instagram" ? "11" : "22" } } },
    publish: async (_m, d) => { calls.push(`publish:${d}`); if (d === o.failFinal) throw new Error("lost response"); return d === "instagram" ? "101" : "2_202" },
    verify: async (_m, d) => ({ verified: true, permalink: `https://www.${d}.com/p/verified` }) }
}
function deps(store: Store, p: MetaProvider, over: Partial<ToolDeps> = {}): ToolDeps & { decided: string[]; failures: unknown[]; excluded: string[] } {
  const decided: string[] = [], failures: unknown[] = [], excluded: string[] = []
  let n = 0
  return { decided, failures, excluded,
    env: { VERCEL_ENV: "production", OWNED_META_TOOL_SECRET: SECRET, OWNED_META_APPROVER_SLACK_IDS: `${FOUNDER}:marcos@434media.com` },
    store, brandEnabled: async () => true,
    prepare: async () => store.read().then(r => r.batch),
    decide: async (_id, _rev, hash, email) => { decided.push(email); await store.update("p", r => { r.batch.approval = { by: email, at: NOW, hash }; return { next: r, result: null } }).catch(() => {}); return (await store.read()).batch },
    execute: a => runOwnedMeta({ id: a.id, runId: a.runId, store: a.store, provider: p, enabled: async () => true, resolveAssets: async b => b.manifest.assets.map(x => x.url), now: () => NOW, ...(a.only ? { only: a.only } : {}) }),
    recordFailure: async a => { failures.push(a.error); return { message: a.error instanceof Error ? a.error.message : "failed", status: a.error instanceof MetaPermissionError ? 403 : a.error instanceof MetaBlocked ? 409 : 500 } },
    exclude: async (id) => { excluded.push(id) },
    health: async () => ({ ok: true }),
    readSlackMessage: async () => undefined,
    randomId: () => `run-${++n}`, now: () => NOW, ...over }
}
const call = (d: ToolDeps, body: unknown, auth = `Bearer ${SECRET}`) => handleOwnedMetaTool(new Request("https://434media.com/api/owned-meta/tool", { method: "POST", headers: { authorization: auth }, body: JSON.stringify(body) }), d)
const exec = (s: Store) => ({ action: "execute", postId: "p", batchId: s.value.batch.id, hash: s.value.batch.hash })
function untouchable(): ToolDeps { const no = () => { throw new Error("must not be reached") }; return { env: { VERCEL_ENV: "production", OWNED_META_TOOL_SECRET: SECRET }, store: { read: no, update: no, event: no }, brandEnabled: no, prepare: no, decide: no, execute: no, recordFailure: no, exclude: no, health: no, readSlackMessage: no, randomId: () => "r", now: () => NOW } }

test("tool rejects previews, unconfigured secret, bad bearer and bad input before any read", async () => {
  const d = untouchable()
  assert.equal((await call({ ...d, env: { ...d.env, VERCEL_ENV: "preview" } }, { action: "status", postId: "p" })).status, 423)
  assert.equal((await call({ ...d, env: { VERCEL_ENV: "production" } }, { action: "status", postId: "p" })).status, 503)
  assert.equal((await call(d, { action: "status", postId: "p" }, "Bearer wrong")).status, 401)
  assert.equal((await call(d, { action: "status", postId: "p" }, "")).status, 401)
  assert.equal((await call(d, { action: "reset-preparation", postId: "p" })).status, 400) // no reset, release or recovery verbs exist
  assert.equal((await call(d, { action: "status", postId: "../x" })).status, 400)
  assert.equal(toolAuthorized(`Bearer ${"x".repeat(10)}`, "x".repeat(10)), false) // short secrets disable the tool
})

test("duplicate execute requests publish each destination once", async () => {
  const s = new Store(), p = provider(), d = deps(s, p)
  const [a, b] = await Promise.all([call(d, exec(s)), call(d, exec(s))])
  assert.deepEqual([a.status, b.status].sort(), [200, 409])
  assert.deepEqual(p.calls.filter(c => c.startsWith("publish")), ["publish:instagram", "publish:facebook"])
  const third = await call(d, exec(s)), body = await third.json()
  assert.equal(third.status, 200)
  assert.equal(p.calls.filter(c => c.startsWith("publish")).length, 2)
  assert.deepEqual(body.results.map((r: { evidence: string; remoteId: string; permalink: string }) => [r.evidence, r.remoteId, r.permalink]), [["api_verified", "101", "https://www.instagram.com/p/verified"], ["api_verified", "2_202", "https://www.facebook.com/p/verified"]])
  assert.match(body.slackText, /API verified/)
})

test("uncertain final outcome is never repeated by execute or continuation", async () => {
  const s = new Store(), p = provider({ failFinal: "facebook" }), d = deps(s, p)
  const first = await (await call(d, exec(s))).json()
  assert.equal(first.results[1].status, "needs_reconciliation"); assert.equal(first.results[1].doNotRepeat, true)
  await call(d, exec(s))
  assert.equal(p.calls.filter(c => c === "publish:facebook").length, 1)
  assert.deepEqual(needsContinuation(s.value), [])
  const tick = await continueOwnedMeta({ ...d, deploymentEnabled: async () => true, listIds: async () => ["p"], notify: async () => {} })
  assert.equal(tick.detail.resumed, 0)
  assert.equal(p.calls.filter(c => c === "publish:facebook").length, 1)
})

test("expired credential stops with 403, records the failure and never reaches final publish", async () => {
  const s = new Store(), p = provider({ permission: true }), d = deps(s, p)
  const response = await call(d, exec(s))
  assert.equal(response.status, 403)
  assert.ok(d.failures[0] instanceof MetaPermissionError)
  assert.ok(!p.calls.some(c => c.startsWith("publish")))
  assert.equal(credentialState({ identity: { outcome: "failed", error: { destination: "facebook", operation: "connection", at: NOW, httpStatus: 401, code: 190 } }, relationship: { outcome: "unavailable" }, facebook: { outcome: "unavailable" }, instagram: { outcome: "unavailable" } }), "expired_or_invalid")
  assert.equal(credentialState({ identity: { outcome: "readable", matchesConfigured: true }, relationship: { outcome: "readable", matchesConfigured: true }, facebook: { outcome: "failed", error: { destination: "facebook", operation: "connection", at: NOW, httpStatus: 403, code: 200 } }, instagram: { outcome: "readable" } }), "permission_error")
  assert.equal(credentialState({ identity: { outcome: "readable" }, relationship: { outcome: "readable", matchesConfigured: true }, facebook: { outcome: "readable" }, instagram: { outcome: "readable" } }), "readable")
  // A real provider maps Graph code 190 to the permission path without echoing the token.
  const real = createMetaProvider({ accessToken: "secret-token", evidence: { verifiedAt: NOW, credentialKind: "system_user_page", appId: "1", pageId: "2", instagramId: "3" } as MetaPublishingEvidence, beforeMutation: async () => {}, fetcher: (async () => Response.json({ error: { code: 190, message: "secret-token expired" } }, { status: 401 })) as typeof fetch })
  await assert.rejects(real.verify(manifest("still"), "instagram", "101"), (e: unknown) => e instanceof MetaPermissionError && !JSON.stringify(e.detail).includes("secret-token"))
})

test("continuation resumes only processing destinations, once, and never a failed preparation", async () => {
  const notReady = new Set<MetaDestination>(["instagram"])
  const s = new Store(), p = provider({ notReady, prepareFails: "facebook" }), d = deps(s, p), notes: string[] = []
  await call(d, exec(s))
  assert.equal(s.value.batch.jobs.instagram.status, "processing"); assert.equal(s.value.batch.jobs.facebook.status, "manual_required")
  assert.deepEqual(needsContinuation(s.value), ["instagram"])
  const cron = { ...d, deploymentEnabled: async () => true, listIds: async () => ["p"], notify: async (t: string) => { notes.push(t) } }
  await continueOwnedMeta(cron) // still processing at Meta
  assert.equal(p.calls.filter(c => c === "prepare:facebook").length, 1) // failed preparation is not retried by the cron
  notReady.clear()
  const tick = await continueOwnedMeta(cron)
  assert.equal(tick.detail.resumed, 1)
  assert.equal(s.value.batch.jobs.instagram.status, "verified")
  assert.equal(p.calls.filter(c => c === "publish:instagram").length, 1)
  assert.equal(p.calls.filter(c => c === "prepare:facebook").length, 1)
  assert.match(notes.at(-1)!, /Instagram: verified/)
  await continueOwnedMeta(cron)
  assert.equal(p.calls.filter(c => c === "publish:instagram").length, 1)
  assert.deepEqual(await continueOwnedMeta({ ...cron, deploymentEnabled: async () => false, listIds: async () => { throw new Error("must not list") } }), { message: "Publisher disabled; nothing resumed", detail: { scanned: 0, resumed: 0 } })
})

test("approval is read from the exact Slack message, bound to the hash, and never relayed by the caller", async () => {
  const s = new Store(record(manifest(), false)), hash = s.value.batch.hash
  const msg = (over: object) => async () => ({ ts: "1792145804.228509", user: FOUNDER, text: `approve ${hash.slice(0, 12)}`, ...over })
  const body = { action: "approve", postId: "p", revision: 1, hash, approval: { channel: "C0C9RQE54SG", ts: "1792145804.228509" } }
  for (const [over, why] of [[{ user: "U0C9RM2A9TN" }, /not an authorized/], [{ bot_id: "B1" }, /person/], [{ text: "approve it" }, /hash/], [{ text: `looks good ${hash.slice(0, 12)}` }, /approve/]] as const) {
    const d = deps(s, provider(), { readSlackMessage: msg(over) })
    const r = await call(d, body); assert.equal(r.status, 409); assert.match((await r.json()).error, why); assert.deepEqual(d.decided, [])
  }
  const missing = deps(s, provider())
  assert.equal((await call(missing, body)).status, 409); assert.deepEqual(missing.decided, [])
  const stale = deps(s, provider(), { readSlackMessage: msg({}) })
  assert.equal((await call(stale, { ...body, hash: "0".repeat(64) })).status, 409); assert.deepEqual(stale.decided, [])
  const ok = deps(s, provider(), { readSlackMessage: msg({}) })
  assert.equal((await call(ok, body)).status, 200); assert.deepEqual(ok.decided, ["marcos@434media.com"])
  assert.deepEqual([...parseApprovers(`${FOUNDER}:Marcos@434media.com, bad:x@gmail.com,U1:`)], [[FOUNDER, "marcos@434media.com"]])
  assert.throws(() => slackApprovalFrom({ user: FOUNDER, subtype: "message_changed", text: `approve ${hash.slice(0, 12)}` }, parseApprovers(`${FOUNDER}:marcos@434media.com`), hash), /person/)
})

test("owner-reported external post blocks that destination; the other still publishes", async () => {
  const s = new Store(), p = provider(), d = deps(s, p)
  const ext = { action: "record-external", postId: "p", batchId: s.value.batch.id, hash: s.value.batch.hash, destination: "instagram", permalink: "https://www.instagram.com/milcityusa/p/DejVYUvFYIj/?igsh=x", evidence: "Founder published manually; observed on the public profile 2026-10-16.", requestedBy: FOUNDER }
  assert.equal((await call(d, { ...ext, requestedBy: "U0C9RM2A9TN" })).status, 409)
  const recorded = await (await call(d, ext)).json()
  assert.equal(recorded.results[0].evidence, "owner_reported"); assert.equal(recorded.results[0].permalink, "https://www.instagram.com/milcityusa/p/DejVYUvFYIj/")
  await call(d, exec(s))
  assert.deepEqual(p.calls.filter(c => c.startsWith("publish")), ["publish:facebook"])
  // A destination with a final intent cannot be relabelled as external.
  const r = record(); r.batch.jobs.facebook = { status: "needs_reconciliation", preparation: {}, finalIntent: { id: "x:facebook", at: NOW } }
  assert.throws(() => recordExternalPublication(r, "facebook", { permalink: "https://www.facebook.com/x", actor: "a", evidence: "x".repeat(30), at: NOW }), /attempt/)
  assert.throws(() => recordExternalPublication(record(), "facebook", { permalink: "https://evil.example/x", actor: "a", evidence: "x".repeat(30), at: NOW }), /permalink/)
})

test("excluded post (Army carousel case) cannot execute; exclusion takes only platform links", async () => {
  const s = new Store({ ...record(), excluded: true }), p = provider(), d = deps(s, p)
  assert.equal((await call(d, exec(s))).status, 409)
  assert.deepEqual(p.calls, [])
  const body = { action: "exclude", postId: "army", evidence: "Owner-reported manual publication on 2026-10-16; seen on both public pages.", requestedBy: FOUNDER, links: ["https://www.instagram.com/milcityusa/p/DejVYUvFYIj/", "https://www.facebook.com/milcityusa/posts/pfbid02AGQKTX783QEUkV1RhVzjQFnN6ticZTKSne8vftuFeRvVuNZkUfeEx6hpGZwHpxKql"] }
  assert.equal((await call(d, { ...body, links: ["https://example.com/x"] })).status, 409)
  const ok = await call(d, body); assert.equal(ok.status, 200); assert.deepEqual(d.excluded, ["army"])
})

test("AI stills: Instagram carries and reads back the label; Facebook publishes unlabeled with a notice", async () => {
  const m = manifest("still", true), calls: { path: string; body?: URLSearchParams }[] = []
  const fetcher = (async (u: URL, init?: RequestInit) => {
    const path = u.pathname.replace("/v26.0/", ""); calls.push({ path, body: init?.body as URLSearchParams })
    if (path === "3/media" && init?.method === "GET") return Response.json({ data: [{ id: "101", permalink: "https://www.instagram.com/p/x" }] })
    if (path === "2/published_posts") return Response.json({ data: [{ id: "2_202", permalink_url: "https://www.facebook.com/p/y" }] })
    if (path === "101") return Response.json({ id: "101", is_ai_generated: true })
    return Response.json({ id: "2_202", post_id: "2_202" })
  }) as typeof fetch
  const p = createMetaProvider({ accessToken: "t", evidence: { verifiedAt: NOW, credentialKind: "system_user_page", appId: "1", pageId: "2", instagramId: "3" }, beforeMutation: async () => {}, fetcher })
  assert.equal(p.preflight(m, "facebook"), null)
  await p.publish(m, "facebook", [m.assets[0].url], {})
  assert.equal(calls.at(-1)!.body!.get("is_ai_generated"), null)
  assert.deepEqual(await p.verify(m, "facebook", "2_202"), { verified: true, permalink: "https://www.facebook.com/p/y" })
  assert.ok(!calls.some(c => c.path === "2_202")) // no label readback where none can be sent
  assert.equal((await p.verify(m, "instagram", "101")).verified, true)
  assert.deepEqual(noticesFor(m).map(n => n.feature), ["account_tagging", "stories", "facebook_ai_label"])
  assert.deepEqual(noticesFor(manifest("still", false)).map(n => n.feature), ["account_tagging", "stories"])
})

test("Slack reader is GET-only, exact-ts, token-safe; webhook accepts only Slack hooks", async () => {
  const seen: { url: string; method?: string }[] = []
  const fetcher = (async (u: URL, init?: RequestInit) => { seen.push({ url: u.toString(), method: init?.method }); return Response.json({ ok: true, messages: [{ ts: "1792098806.826029", user: "U1", text: "parent" }, { ts: "1792145804.228509", user: FOUNDER, text: "approve" }] }) }) as typeof fetch
  assert.equal((await readSlackMessage("C0C9RQE54SG", "1792145804.228509", "xoxb-test", fetcher))?.user, FOUNDER)
  assert.equal(await readSlackMessage("C0C9RQE54SG", "1792145804.000000", "xoxb-test", fetcher), undefined)
  assert.equal(await readSlackMessage("C0C9RQE54SG", "1792145804.228509", undefined, fetcher), undefined)
  assert.equal(await readSlackMessage("../x", "1", "xoxb-test", fetcher), undefined)
  assert.ok(seen.every(s => s.method === "GET" && !s.url.includes("xoxb")))
  assert.equal(seen.length, 2)
  assert.equal(await postSlackNotice("x", undefined, fetcher), "skipped")
  assert.equal(await postSlackNotice("x", "https://evil.example/services/x", fetcher), "skipped")
})
