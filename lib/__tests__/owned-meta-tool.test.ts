/** Offline only. Run with tsx --test. No Meta, Slack, Blob or Firestore access: every transport is faked. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { draftBatch, runOwnedMeta, MetaBlocked, MetaPermissionError, type MetaDestination, type MetaManifest, type MetaProvider, type MetaRecord, type MetaStore } from "../owned-meta-publisher"
import { assetDigest } from "../owned-meta-assets"
import { createMetaProvider, type MetaPublishingEvidence } from "../instagram-publishing"
import { credentialState, needsContinuation, noticesFor, parseApprovers, recordExternalPublication, slackApprovalFrom } from "../owned-meta-tool"
import { continueOwnedMeta, runOwnedMetaTool, type ToolDeps, type ToolName } from "../owned-meta-tool-handler"
import type { IntakeDeps } from "../owned-meta-intake"
import { postSlackNotice, readSlackMessage } from "../owned-meta-slack"

const FOUNDER = "U08LKLE5H3M", NOW = "2026-10-16T12:00:00.000Z"
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
    env: { OWNED_META_APPROVER_SLACK_IDS: `${FOUNDER}:marcos@434media.com` },
    store, intake: {} as IntakeDeps, brandEnabled: async () => true,
    prepare: async () => store.read().then(r => r.batch),
    decide: async (_id, _rev, hash, email) => { decided.push(email); await store.update("p", r => { r.batch.approval = { by: email, at: NOW, hash }; return { next: r, result: null } }).catch(() => {}); return (await store.read()).batch },
    execute: a => runOwnedMeta({ id: a.id, runId: a.runId, store: a.store, provider: p, enabled: async () => true, resolveAssets: async b => b.manifest.assets.map(x => x.url), now: () => NOW, ...(a.only ? { only: a.only } : {}) }),
    recordFailure: async a => { failures.push(a.error); return { message: a.error instanceof Error ? a.error.message : "failed", status: a.error instanceof MetaPermissionError ? 403 : a.error instanceof MetaBlocked ? 409 : 500 } },
    exclude: async (id, input) => { assert.equal(input.by, "marcos@434media.com"); excluded.push(id) },
    health: async () => ({ ok: true }),
    readSlackMessage: async () => undefined,
    randomId: () => `run-${++n}`, now: () => NOW, ...over }
}
const PRINCIPAL = { email: "marcos@434media.com" }
// Same call shape the MCP route uses: tool name, arguments, authenticated principal.
const call = async (d: ToolDeps, body: { action: string } & Record<string, unknown>) => { const { action, ...args } = body; const r = await runOwnedMetaTool(action.replace(/-/g, "_") as ToolName, args, PRINCIPAL, d); return { status: r.status, json: async () => r.body } }
const exec = (s: Store) => ({ action: "execute", postId: "p", batchId: s.value.batch.id, hash: s.value.batch.hash })

test("unknown or malformed operations are refused before any read; no reset, release or recovery verbs exist", async () => {
  const no = () => { throw new Error("must not be reached") }
  const d = { env: {}, store: { read: no, update: no, event: no }, intake: {} as IntakeDeps, brandEnabled: no, prepare: no, decide: no, execute: no, recordFailure: no, exclude: no, health: no, readSlackMessage: no, randomId: () => "r", now: () => NOW } as unknown as ToolDeps
  for (const name of ["reset_preparation", "release_preparation", "recover_facebook", "confirm_stopped_run", "manual_confirm"]) assert.equal((await runOwnedMetaTool(name as ToolName, { postId: "p" }, PRINCIPAL, d)).status, 400)
  assert.equal((await runOwnedMetaTool("status", { postId: "../x" }, PRINCIPAL, d)).status, 400)
  assert.equal((await runOwnedMetaTool("approve", { postId: "p", revision: 1, hash: "short", approval: { channel: "C", ts: "1" } }, PRINCIPAL, d)).status, 400)
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
  const ext = { action: "record-external", postId: "p", batchId: s.value.batch.id, hash: s.value.batch.hash, destination: "instagram", permalink: "https://www.instagram.com/milcityusa/p/DejVYUvFYIj/?igsh=x", evidence: "Founder published manually; observed on the public profile 2026-10-16." }
  assert.equal((await call(d, { ...ext, batchId: "stale" })).status, 409)
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
  const body = { action: "exclude", postId: "Opb3LOHpfZPFoxdQ720F", evidence: "Owner-reported manual publication on 2026-10-16; seen on both public pages.", links: ["https://www.instagram.com/milcityusa/p/DejVYUvFYIj/", "https://www.facebook.com/milcityusa/posts/pfbid02AGQKTX783QEUkV1RhVzjQFnN6ticZTKSne8vftuFeRvVuNZkUfeEx6hpGZwHpxKql"] }
  assert.equal((await call(d, { ...body, links: ["https://example.com/x"] })).status, 409)
  const ok = await call(d, body); assert.equal(ok.status, 200); assert.deepEqual(d.excluded, ["Opb3LOHpfZPFoxdQ720F"])
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

test("an approval for an earlier asset revision cannot approve the current files", async () => {
  // Revision 1 was shown in Slack; the export then changed, producing revision 2 with new bytes.
  const old = record(manifest(), false), changed = manifest(); changed.revision = 2; changed.assets[1] = { ...changed.assets[1], sha256: "f".repeat(64), size: 9 }
  const current = { ...record(changed, false), revision: 2 }; current.batch.id = "batch-2"
  assert.notEqual(old.batch.hash, current.batch.hash)
  const s = new Store(current)
  const oldMessage = async () => ({ ts: "1792145804.228509", user: FOUNDER, text: `approve ${old.batch.hash.slice(0, 12)}` })
  const approval = { channel: "C0C9RQE54SG", ts: "1792145804.228509" }
  // Caller replays the old revision/hash: refused before Slack is even read.
  const replay = deps(s, provider(), { readSlackMessage: async () => { throw new Error("must not read") } })
  const r1 = await call(replay, { action: "approve", postId: "p", revision: 1, hash: old.batch.hash, approval }); assert.equal(r1.status, 409); assert.deepEqual(replay.decided, [])
  // Caller names the current revision, but the founder's message quotes the old hash: refused.
  const mismatch = deps(s, provider(), { readSlackMessage: oldMessage })
  const r2 = await call(mismatch, { action: "approve", postId: "p", revision: 2, hash: current.batch.hash, approval }); assert.equal(r2.status, 409); assert.match((await r2.json()).error, /hash/); assert.deepEqual(mismatch.decided, [])
  // Unapproved current revision never publishes.
  const p = provider(), d = deps(s, p)
  assert.equal((await call(d, exec(s))).status, 409); assert.deepEqual(p.calls, [])
})

test("continuation selects only approved, unclaimed, processing destinations without a final intent", () => {
  const base = () => { const r = record(); r.batch.jobs.instagram.status = "processing"; return r }
  assert.deepEqual(needsContinuation(base()), ["instagram"])
  const cases: [string, (r: MetaRecord) => void][] = [
    ["unapproved", r => { delete r.batch.approval }],
    ["revoked", r => { r.batch.revoked = true }],
    ["archived", r => { r.archived = true }],
    ["excluded", r => { r.excluded = true }],
    ["claimed by a live run", r => { r.batch.claim = "other-run" }],
    ["final intent recorded", r => { r.batch.jobs.instagram.finalIntent = { id: "x:instagram", at: NOW } }],
    ["recovery attempt pending", r => { r.batch.jobs.instagram.retry = { id: "x", priorIntentId: "y", by: "a", at: NOW, evidence: "e", approvedHash: r.batch.hash, duplicateRiskAccepted: true } }],
  ]
  for (const [why, change] of cases) { const r = base(); change(r); assert.deepEqual(needsContinuation(r), [], why) }
  for (const status of ["ready", "final_started", "verified", "operator_confirmed", "manual_required", "needs_reconciliation"] as const) { const r = record(); r.batch.jobs.instagram.status = status; r.batch.jobs.facebook.status = status; assert.deepEqual(needsContinuation(r), [], status) }
})

// ── Intake: lookup, idempotent creation, export attachment ─────────────────────
import type { Asset, ContentPost } from "../../components/crm/types"
import { findPosts, createPost, attachExports, summarizePost } from "../owned-meta-intake"
import { assertApprovedBlobUrl } from "../owned-meta-assets"
import { isExcludedPostId, OWNED_META_EXCLUDED_POST_IDS } from "../owned-meta-publisher"
import { verifyConnectorToken, connectorClientIds, type OAuthDeps } from "../owned-meta-oauth"
import { CONNECTOR_TOOLS, principalOf } from "../owned-meta-connector"
import { toolInput } from "../owned-meta-tool-handler"

const ARMY = "Opb3LOHpfZPFoxdQ720F"
const jpg = (w: number, h: number) => Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9])
const pngOf = (w: number, h: number) => { const b = Buffer.alloc(24); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b); b.writeUInt32BE(13, 8); b.write("IHDR", 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b }
function post(over: Partial<ContentPost> = {}): ContentPost { return { id: "post-1234567", user: "", date_created: "2026-10-16", status: "in_progress", title: "Army backs nine software vendors", links: [], assets: [], social_platforms: ["instagram", "facebook"], created_at: NOW, updated_at: NOW, ...over } as ContentPost }
function intake(posts: ContentPost[], files: Record<string, Buffer> = {}) {
  const created: ContentPost[] = [], stored: { filename: string; contentType: string }[] = [], fetched: string[] = [], assetsSet: { id: string; assets: Asset[] }[] = []
  let n = 0
  const deps: IntakeDeps = {
    listPosts: async () => [...posts, ...created],
    getPost: async id => [...posts, ...created].find(p => p.id === id) ?? null,
    findByRequestId: async rid => created.find(p => p.intake?.requestId === rid) ?? null,
    createPost: async data => { const p = { ...data, id: `new-${++n}xxxxxx`, created_at: NOW, updated_at: NOW } as ContentPost; created.push(p); return p },
    setAssets: async (id, assets) => { assetsSet.push({ id, assets }); return { ...(posts.find(p => p.id === id) as ContentPost), assets } },
    fetchExport: async url => { fetched.push(url); const f = files[url]; if (!f) throw new Error("404"); return { bytes: f, contentType: "application/octet-stream" } },
    storeExport: async (_b, filename, contentType) => { stored.push({ filename, contentType }); return `https://approved.public.blob.vercel-storage.com/${filename}` },
    now: () => NOW,
  }
  return { deps, created, stored, fetched, assetsSet }
}
let uuidN = 0
const uuid = () => `12345678-1234-1234-1234-${String(++uuidN).padStart(12, "0")}`

test("find_posts: exact id first, then title/caption matches; archived hidden; Army record marked excluded", async () => {
  const { deps } = intake([post({ id: ARMY, title: "Army backs nine software vendors", status: "posted" }), post({ id: "other-12345", title: "DARPA quantum", social_copy: "army adjacent" }), post({ id: "arch-123456", title: "Army old", archived: true })])
  const byId = await findPosts(deps, { query: ARMY })
  assert.equal(byId[0].id, ARMY); assert.equal(byId[0].excluded, true)
  assert.deepEqual((await findPosts(deps, { query: "army" })).map(p => p.id), [ARMY, "other-12345"])
  assert.deepEqual((await findPosts(deps, { query: "army", includeArchived: true })).map(p => p.id), [ARMY, "other-12345", "arch-123456"])
  await assert.rejects(findPosts(deps, { query: "  " }), /Search text/)
})

test("create_post is idempotent on requestId and never creates a second post for a repeated request", async () => {
  const { deps, created } = intake([post({ id: ARMY })])
  const input = { requestId: "slack:C0C9RQE54SG:1792145804.228509", title: "Army backs nine software vendors", brand: "milcity" as const, caption: "Nine named vendors.", dateToPost: "2026-10-17" }
  const first = await createPost(deps, PRINCIPAL, input)
  assert.equal(first.created, true); assert.deepEqual(first.similar.map(p => p.id), [ARMY]) // a same-title post is reported, not reused or duplicated silently
  const again = await createPost(deps, PRINCIPAL, input)
  assert.equal(again.created, false); assert.equal(again.post.id, first.post.id); assert.equal(created.length, 1)
  assert.equal(created[0].platform, ""); assert.equal(created[0].intake?.metaBrand, "milcity"); assert.equal(created[0].intake?.requestedBy, "marcos@434media.com")
  assert.equal(created[0].status, "in_progress"); assert.deepEqual(created[0].social_platforms, ["instagram", "facebook"])
  assert.equal((await createPost(deps, PRINCIPAL, { ...input, requestId: "x2", brand: "txmx" }).catch(e => e.message)), "A stable requestId (8–128 characters) is required so a repeated request cannot create a second post")
  assert.equal((await createPost(deps, PRINCIPAL, { ...input, requestId: "req-txmx-0001", brand: "txmx" })).created, true)
  assert.equal(created[1].platform, "TXMX Boxing")
  await assert.rejects(createPost(deps, PRINCIPAL, { ...input, requestId: "req-bad-date-1", dateToPost: "Oct 17" }), /YYYY-MM-DD/)
})

test("attach_exports stores measured files in order under the approved Blob convention and reports Instagram holds", async () => {
  const urls = ["https://export-download.canva.com/a/1.jpg?sig=x", "https://export-download.canva.com/a/2.jpg?sig=y"]
  const { deps, stored, assetsSet } = intake([post()], { [urls[0]]: jpg(1080, 1350), [urls[1]]: jpg(1080, 1350) })
  const r = await attachExports(deps, { postId: "post-1234567", items: [{ url: urls[0], label: "Lead card" }, { url: urls[1] }], randomId: uuid })
  assert.deepEqual(r.holds, [])
  assert.deepEqual(r.assets.map(a => [a.mime, a.width, a.height]), [["image/jpeg", 1080, 1350], ["image/jpeg", 1080, 1350]])
  assert.match(stored[0].filename, /^content-posts\/[0-9a-f-]{36}-01-lead-card\.jpg$/); assert.match(stored[1].filename, /-02-export-2\.jpg$/)
  for (const a of assetsSet[0].assets) assert.equal(assertApprovedBlobUrl(a.url, ["https://approved.public.blob.vercel-storage.com"]), a.url) // prepare will accept these
  assert.deepEqual(assetsSet[0].assets.map(a => a.kind), ["image", "image"])
  // PNG exports are stored but flagged before approval; mixed aspects are flagged.
  const png = intake([post()], { "https://x.test/p.png": pngOf(1080, 1350), "https://x.test/s.jpg": jpg(1080, 1080) })
  const held = await attachExports(png.deps, { postId: "post-1234567", items: [{ url: "https://x.test/p.png" }, { url: "https://x.test/s.jpg" }], randomId: uuid })
  assert.equal(held.holds.length, 2); assert.match(held.holds[0], /JPEG/); assert.match(held.holds[1], /aspect/)
})

test("attach_exports refuses the Army record, posted posts, bad files and partial sets without storing anything", async () => {
  const good = "https://x.test/ok.jpg"
  const { deps, stored, fetched, assetsSet } = intake([post({ id: ARMY }), post({ id: "posted-12345", status: "posted" }), post()], { [good]: jpg(1080, 1350), "https://x.test/html": Buffer.from("<html>") })
  await assert.rejects(attachExports(deps, { postId: ARMY, items: [{ url: good }], randomId: uuid }), /excluded/)
  await assert.rejects(attachExports(deps, { postId: "posted-12345", items: [{ url: good }], randomId: uuid }), /published/)
  assert.deepEqual(fetched, []) // refused before any download
  await assert.rejects(attachExports(deps, { postId: "post-1234567", items: [{ url: good }, { url: "https://x.test/missing.jpg" }], randomId: uuid }), /Export 2/)
  await assert.rejects(attachExports(deps, { postId: "post-1234567", items: [{ url: "https://x.test/html" }], randomId: uuid }), /Unsupported|JPEG/)
  await assert.rejects(attachExports(deps, { postId: "post-1234567", items: Array.from({ length: 11 }, () => ({ url: good })), randomId: uuid }), /1–10/)
  assert.deepEqual(stored, []); assert.deepEqual(assetsSet, [])
})

test("the Army carousel record is excluded in code and by every path that could publish it", async () => {
  assert.deepEqual(OWNED_META_EXCLUDED_POST_IDS, [ARMY]); assert.equal(isExcludedPostId(ARMY), true); assert.equal(isExcludedPostId("other"), false)
  assert.equal(summarizePost(post({ id: ARMY })).excluded, true)
  // Even with an approved draft, the store's excluded flag stops execute before any Meta call.
  const s = new Store({ ...record(), excluded: true }), p = provider()
  assert.equal((await call(deps(s, p), { ...exec(s) })).status, 409); assert.deepEqual(p.calls, [])
  assert.deepEqual(needsContinuation({ ...record(), excluded: true }), [])
  const { readFileSync } = await import("node:fs")
  const crm = readFileSync("lib/firestore-crm.ts", "utf8"), exe = readFileSync("lib/owned-meta-execution.ts", "utf8")
  assert.equal((crm.match(/isExcludedPostId\(id\)/g) || []).length, 3) // store read, store update, new draft
  assert.match(exe, /post\.owned_meta_external \|\| isExcludedPostId\(id\)/) // prepare
})

// ── Connector authorization (OAuth through Google, existing admin gate) ────────
function oauth(info: Record<string, unknown> | null, over: Partial<OAuthDeps> = {}) {
  const seen: { url: string; body: string }[] = []
  const deps: OAuthDeps = {
    clientIds: ["123-abc.apps.googleusercontent.com"],
    fetcher: (async (u: URL, init?: RequestInit) => { seen.push({ url: u.toString(), body: String(init?.body) }); return info ? Response.json(info) : new Response("bad", { status: 400 }) }) as typeof fetch,
    authorize: async email => email === "marcos@434media.com" ? { authorized: true, role: "crm_super_admin" } : email === "staff@434media.com" ? { authorized: true, role: "crm_only" } : { authorized: false, reason: "not_on_roster" },
    sendCapable: async (_e, role) => role === "crm_super_admin" || role === "full_admin",
    nowSeconds: () => 1_000, ...over,
  }
  return { deps, seen }
}
const goodInfo = { aud: "123-abc.apps.googleusercontent.com", azp: "123-abc.apps.googleusercontent.com", email: "Marcos@434media.com", email_verified: "true", expires_in: "3599", scope: "openid https://www.googleapis.com/auth/userinfo.email" }

test("connector tokens must be Google-issued to our client, verified, unexpired, and pass the existing admin send gate", async () => {
  const ok = oauth(goodInfo)
  const info = await verifyConnectorToken("ya29.token", ok.deps)
  assert.deepEqual(info?.extra, { email: "marcos@434media.com", role: "crm_super_admin" }); assert.equal(info?.expiresAt, 4599)
  assert.equal(ok.seen[0].url, "https://oauth2.googleapis.com/tokeninfo"); assert.equal(ok.seen[0].body, "access_token=ya29.token") // token in POST body, never the URL
  for (const [why, bad] of [
    ["token for another app", { ...goodInfo, aud: "999-other.apps.googleusercontent.com", azp: "999-other.apps.googleusercontent.com" }],
    ["azp mismatch", { ...goodInfo, azp: "999-other.apps.googleusercontent.com" }],
    ["audience mismatch without azp", { ...goodInfo, aud: "999-other.apps.googleusercontent.com", azp: undefined }],
    ["unverified email", { ...goodInfo, email_verified: "false" }],
    ["expired", { ...goodInfo, expires_in: "0" }],
    ["no email scope", { ...goodInfo, scope: "openid" }],
    ["not on roster", { ...goodInfo, email: "someone@gmail.com" }],
    ["draft-only role", { ...goodInfo, email: "staff@434media.com" }],
  ] as const) assert.equal(await verifyConnectorToken("ya29.token", oauth(bad).deps), undefined, why)
  assert.equal(await verifyConnectorToken("ya29.token", oauth(null).deps), undefined)
  const none = oauth(goodInfo, { clientIds: [] }); assert.equal(await verifyConnectorToken("ya29.token", none.deps), undefined); assert.equal(none.seen.length, 0)
  assert.equal(await verifyConnectorToken(undefined, ok.deps), undefined)
  assert.deepEqual(connectorClientIds(" 123-abc.apps.googleusercontent.com, nonsense ,https://evil"), ["123-abc.apps.googleusercontent.com"])
  assert.deepEqual(principalOf(info), { email: "marcos@434media.com" }); assert.equal(principalOf(undefined), undefined)
})

test("connector catalog exposes exactly the operations, with read-only ones annotated", () => {
  assert.deepEqual(CONNECTOR_TOOLS.map(t => t.name).sort(), Object.keys(toolInput).sort())
  assert.deepEqual(CONNECTOR_TOOLS.filter(t => t.readOnly).map(t => t.name).sort(), ["find_posts", "health", "status"])
})

test("MCP route: previews refuse before auth; production without a token gets 401 pointing at resource metadata", async () => {
  const previous = process.env
  try {
    process.env = { ...previous, NODE_ENV: "test", VERCEL_ENV: "preview" }
    const route = await import("../../app/api/owned-meta/mcp/route")
    const init = { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }
    assert.equal((await route.POST(new Request("https://www.434media.com/api/owned-meta/mcp", init))).status, 423)
    process.env = { ...previous, NODE_ENV: "test", VERCEL_ENV: "production", OWNED_META_CONNECTOR_GOOGLE_CLIENT_IDS: "123-abc.apps.googleusercontent.com" }
    const r = await route.POST(new Request("https://www.434media.com/api/owned-meta/mcp", init))
    assert.equal(r.status, 401)
    assert.match(r.headers.get("www-authenticate") || "", /resource_metadata="https:\/\/www\.434media\.com\/api\/owned-meta\/oauth-protected-resource"/)
    const prm = await import("../../app/api/owned-meta/oauth-protected-resource/route")
    const meta = await prm.GET(new Request("https://www.434media.com/api/owned-meta/oauth-protected-resource")).json()
    assert.equal(meta.resource, "https://www.434media.com/api/owned-meta/mcp"); assert.deepEqual(meta.authorization_servers, ["https://accounts.google.com"])
  } finally { process.env = previous }
})
