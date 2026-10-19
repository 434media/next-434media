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
    canvaExport: async () => { throw new Error("not used") }, canvaCreate: async () => { throw new Error("not used") }, canvaFields: async () => ({}),
    randomId: () => `run-${++n}`, now: () => NOW, ...over }
}
const PRINCIPAL = { email: "marcos@434media.com" }
// Same call shape the MCP route uses: tool name, arguments, authenticated principal.
// The tool body as these tests read it (the operation returns Record<string, unknown>).
interface ToolBody { error: string; slackText: string; results: { status: string; evidence: string; remoteId?: string; permalink?: string; doNotRepeat: boolean }[]; [k: string]: unknown }
const call = async (d: ToolDeps, body: { action: string } & Record<string, unknown>) => { const { action, ...args } = body; const r = await runOwnedMetaTool(action.replace(/-/g, "_") as ToolName, args, PRINCIPAL, d); return { status: r.status, json: async () => r.body as ToolBody } }
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
  assert.deepEqual(body.results.map(r => [r.evidence, r.remoteId, r.permalink]), [["api_verified", "101", "https://www.instagram.com/p/verified"], ["api_verified", "2_202", "https://www.facebook.com/p/verified"]])
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
import { verifyConnectorToken, loadConnectorConfig, remoteJwks, type OAuthDeps } from "../owned-meta-oauth"
import { CONNECTOR_TOOLS, principalOf, TOOL_SCOPE } from "../owned-meta-connector"
import { canvaAccessToken, completeConnect, exportDesignJpg, seal, unseal, type CanvaDeps, type CanvaTokenRecord, type CanvaTokenStore } from "../canva-export"
import { startCanvaConnect, finishCanvaConnect, connectFailureCode, type ConnectDeps } from "../canva-connect"
import { generateKeyPairSync, sign as rsaSign, createHash as sha256 } from "node:crypto"
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
    findByCanvaDesignId: async id => [...posts, ...created].find(p => p.canva_design_id === id && !p.archived) ?? null,
    createPost: async data => { const p = { ...data, id: `new-${++n}xxxxxx`, created_at: NOW, updated_at: NOW } as ContentPost; created.push(p); return p },
    setAssets: async (id, assets, record) => { assetsSet.push({ id, assets }); const p = posts.find(x => x.id === id) as ContentPost; Object.assign(p, { assets, ...record }); return { ...p } },
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

// ── Connector authorization: Polí's Auth0 design + existing admin gate ─────────
const ISSUER = "https://434media.us.auth0.com/", AUDIENCE = "https://www.434media.com/api/owned-meta/mcp", CLIENT = "chatgptClient01", SUB = "google-oauth2|1234567890"
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const other = generateKeyPairSync("rsa", { modulusLength: 2048 })
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "k1", use: "sig", alg: "RS256" }
function jwt(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid: "k1", typ: "JWT" }, key = privateKey) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const data = `${enc(header)}.${enc(claims)}`
  return `${data}.${rsaSign("RSA-SHA256", Buffer.from(data), key).toString("base64url")}`
}
const NOW_S = 2_000_000_000
const good = { iss: ISSUER, aud: [AUDIENCE, "https://434media.us.auth0.com/userinfo"], azp: CLIENT, sub: SUB, iat: NOW_S - 10, exp: NOW_S + 600, scope: "openid owned-meta:read owned-meta:write" }
function oauth(over: Partial<OAuthDeps> = {}) {
  const refused: string[] = []
  const deps: OAuthDeps = {
    config: { issuer: ISSUER, audience: AUDIENCE, clientId: CLIENT, jwksUrl: `${ISSUER}.well-known/jwks.json`, callers: [{ subject: SUB, email: "marcos@434media.com" }, { subject: "auth0|staff", email: "staff@434media.com" }] },
    jwks: async () => [JWK],
    authorize: async email => email === "marcos@434media.com" ? { authorized: true, role: "crm_super_admin" } : { authorized: true, role: "crm_only" },
    sendCapable: async (_e, role) => role === "crm_super_admin" || role === "full_admin",
    nowSeconds: () => NOW_S, onRefuse: r => { refused.push(r) }, ...over,
  }
  return { deps, refused }
}

test("connector tokens follow Polí's Auth0 rules, map identity by subject only, then pass the existing admin gate", async () => {
  const ok = oauth()
  const info = await verifyConnectorToken(jwt(good), ok.deps)
  assert.deepEqual(info?.scopes, ["owned-meta:read", "owned-meta:write"]); assert.deepEqual(info?.extra, { email: "marcos@434media.com", role: "crm_super_admin", subject: SUB })
  const cases: [string, string, string][] = [
    ["wrong issuer", jwt({ ...good, iss: "https://evil.auth0.com/" }), "iss"],
    ["wrong audience", jwt({ ...good, aud: "https://other.example/api" }), "aud"],
    ["expired (zero tolerance)", jwt({ ...good, exp: NOW_S }), "exp"],
    ["not yet valid", jwt({ ...good, nbf: NOW_S + 1 }), "nbf"],
    ["missing iat", jwt({ ...good, iat: undefined }), "claims"],
    ["other client", jwt({ ...good, azp: "someoneElse01" }), "client"],
    ["client_id mismatch", jwt({ ...good, client_id: "someoneElse01" }), "client"],
    ["no publisher scope", jwt({ ...good, scope: "openid profile email" }), "scope"],
    ["unmapped subject even with our email", jwt({ ...good, sub: "auth0|attacker", email: "marcos@434media.com" }), "subject_not_mapped"],
    ["draft-only role", jwt({ ...good, sub: "auth0|staff" }), "admin_gate"],
    ["HS256 confusion", jwt(good, { alg: "HS256", kid: "k1" }), "alg"],
    ["alg none", jwt(good, { alg: "none", kid: "k1" }), "alg"],
    ["unknown kid", jwt(good, { alg: "RS256", kid: "k2" }), "kid"],
    ["forged signature", jwt(good, undefined, other.privateKey), "signature"],
  ]
  for (const [why, token, reason] of cases) { const o = oauth(); assert.equal(await verifyConnectorToken(token, o.deps), undefined, why); assert.deepEqual(o.refused, [reason], why) }
  const tampered = jwt(good).split("."); tampered[1] = Buffer.from(JSON.stringify({ ...good, scope: "owned-meta:publish" })).toString("base64url")
  assert.equal(await verifyConnectorToken(tampered.join("."), oauth().deps), undefined)
  assert.equal(await verifyConnectorToken(undefined, oauth().deps), undefined)
  assert.equal(await verifyConnectorToken(jwt(good), oauth({ jwks: async () => { throw new Error("down") } }).deps), undefined)
})

// Design creation from brand templates serves only the shared Slack app (owned-meta-service), not this connector.
const SLACK_ONLY = ["canva_template_fields", "canva_create_design", "canva_preview"]
test("per-tool scopes: read cannot write, write cannot publish", async () => {
  const read = await verifyConnectorToken(jwt({ ...good, scope: "owned-meta:read" }), oauth().deps)
  assert.ok(principalOf(read, "status")); assert.equal(principalOf(read, "create_post"), undefined); assert.equal(principalOf(read, "execute"), undefined)
  const write = await verifyConnectorToken(jwt(good), oauth().deps)
  assert.ok(principalOf(write, "attach_canva_design")); assert.equal(principalOf(write, "execute"), undefined)
  const publish = await verifyConnectorToken(jwt({ ...good, scope: "owned-meta:publish" }), oauth().deps)
  assert.ok(principalOf(publish, "execute")); assert.equal(principalOf(publish, "status"), undefined)
  assert.deepEqual(Object.keys(TOOL_SCOPE).sort(), Object.keys(toolInput).filter(t => !SLACK_ONLY.includes(t)).sort())
})

test("connector configuration fails closed and names problems without values", () => {
  const env = { OWNED_META_CONNECTOR_ISSUER: ISSUER, OWNED_META_CONNECTOR_AUDIENCE: AUDIENCE, OWNED_META_CONNECTOR_CLIENT_ID: CLIENT, OWNED_META_CONNECTOR_JWKS_URL: `${ISSUER}.well-known/jwks.json`, OWNED_META_CONNECTOR_CALLERS: JSON.stringify([{ subject: SUB, email: "Marcos@434media.com" }]) }
  assert.deepEqual(loadConnectorConfig(env).config?.callers, [{ subject: SUB, email: "marcos@434media.com" }])
  assert.deepEqual(loadConnectorConfig({ ...env, OWNED_META_CONNECTOR_JWKS_URL: "https://evil.example/jwks.json" }).problems, ["OWNED_META_CONNECTOR_JWKS_URL"])
  assert.deepEqual(loadConnectorConfig({ ...env, OWNED_META_CONNECTOR_CALLERS: JSON.stringify([{ subject: SUB, email: "x@gmail.com" }]) }).problems, ["OWNED_META_CONNECTOR_CALLERS"])
  assert.deepEqual(loadConnectorConfig({}).problems, ["OWNED_META_CONNECTOR_ISSUER", "OWNED_META_CONNECTOR_AUDIENCE", "OWNED_META_CONNECTOR_CLIENT_ID", "OWNED_META_CONNECTOR_JWKS_URL", "OWNED_META_CONNECTOR_CALLERS"])
})

test("JWKS is cached for ten minutes; an unknown kid refetches at most every 30 seconds", async () => {
  let calls = 0, now = 0
  const get = remoteJwks(`${ISSUER}.well-known/jwks.json`, (async () => { calls++; return Response.json({ keys: [JWK] }) }) as typeof fetch, () => now)
  await get("k1"); now = 599_000; await get("k1"); assert.equal(calls, 1); now = 600_001; await get("k1"); assert.equal(calls, 2)
  now += 10_000; await get("rotated"); assert.equal(calls, 2) // inside the cooldown: no refetch
  now += 20_000; await get("rotated"); assert.equal(calls, 3) // after 30 s: one refetch for the new key
  await get("rotated"); assert.equal(calls, 3)
})

test("connector catalog exposes exactly the operations, with read-only ones annotated", () => {
  assert.deepEqual(CONNECTOR_TOOLS.map(t => t.name).sort(), Object.keys(toolInput).filter(t => !SLACK_ONLY.includes(t)).sort())
  assert.deepEqual(CONNECTOR_TOOLS.filter(t => t.readOnly).map(t => t.name).sort(), ["find_posts", "health", "status"])
})

test("MCP route: previews refuse; unconfigured fails closed; production without a token gets 401 to resource metadata", async () => {
  const previous = process.env
  const env = { OWNED_META_CONNECTOR_ISSUER: ISSUER, OWNED_META_CONNECTOR_AUDIENCE: AUDIENCE, OWNED_META_CONNECTOR_CLIENT_ID: CLIENT, OWNED_META_CONNECTOR_JWKS_URL: `${ISSUER}.well-known/jwks.json`, OWNED_META_CONNECTOR_CALLERS: JSON.stringify([{ subject: SUB, email: "marcos@434media.com" }]) }
  try {
    const route = await import("../../app/api/owned-meta/mcp/route")
    const prm = await import("../../app/api/owned-meta/oauth-protected-resource/route")
    const init = { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }
    const req = () => new Request("https://www.434media.com/api/owned-meta/mcp", init)
    process.env = { ...previous, NODE_ENV: "test", VERCEL_ENV: "preview", ...env }
    assert.equal((await route.POST(req())).status, 423)
    process.env = { ...previous, NODE_ENV: "test", VERCEL_ENV: "production" }
    assert.equal((await route.POST(req())).status, 503); assert.equal(prm.GET().status, 503)
    process.env = { ...previous, NODE_ENV: "test", VERCEL_ENV: "production", ...env }
    const r = await route.POST(req())
    assert.equal(r.status, 401)
    assert.match(r.headers.get("www-authenticate") || "", /resource_metadata="https:\/\/www\.434media\.com\/api\/owned-meta\/oauth-protected-resource"/)
    const meta = await prm.GET().json()
    assert.equal(meta.resource, AUDIENCE); assert.deepEqual(meta.authorization_servers, [ISSUER]); assert.deepEqual(meta.scopes_supported, ["owned-meta:read", "owned-meta:write", "owned-meta:publish"])
  } finally { process.env = previous }
})

// ── Canva Connect: one-time connect, rotating tokens, export ───────────────────
const KEY = Buffer.alloc(32, 7)
class TokenStore implements CanvaTokenStore {
  record: CanvaTokenRecord | null = null; writes = 0
  async read() { return this.record ? { ...this.record } : null }
  async write(expected: number | null, record: CanvaTokenRecord) { if ((this.record?.version ?? null) !== expected) return false; this.record = { ...record }; this.writes++; return true }
}
function canva(handler: (url: string, init: RequestInit) => Response | Promise<Response>, store = new TokenStore(), now = { ms: 1_000_000 }) {
  const calls: { url: string; init: RequestInit }[] = []
  const deps: CanvaDeps = { client: { clientId: "cid", clientSecret: "csecret", redirectUri: "https://www.434media.com/api/admin/owned-meta/canva/callback", tokenKey: KEY }, store, fetcher: (async (u: URL, init: RequestInit) => { calls.push({ url: u.toString(), init }); return handler(u.toString(), init) }) as typeof fetch, nowMs: () => now.ms, sleep: async ms => { now.ms += ms } }
  return { deps, store, calls, now }
}
const tokenResponse = (n: number) => Response.json({ access_token: `at-${n}`, refresh_token: `rt-${n}`, token_type: "Bearer", expires_in: 14400 })

test("Canva tokens are sealed at rest and never stored or returned in plain text", async () => {
  const c = canva(() => tokenResponse(1))
  await completeConnect(c.deps, { code: "code-1", verifier: "v".repeat(64), by: "marcos@434media.com" })
  assert.ok(!c.store.record!.sealed.includes("rt-1") && !c.store.record!.sealed.includes("at-1"))
  assert.equal(unseal(KEY, c.store.record!.sealed).refreshToken, "rt-1")
  assert.throws(() => unseal(Buffer.alloc(32, 8), c.store.record!.sealed))
  const body = new URLSearchParams(String(c.calls[0].init.body))
  assert.equal(body.get("grant_type"), "authorization_code"); assert.equal(body.get("code_verifier"), "v".repeat(64))
  assert.equal((c.calls[0].init.headers as Record<string, string>).authorization, `Basic ${Buffer.from("cid:csecret").toString("base64")}`)
})

test("Canva refresh rotates the single-use token once, and a lost race reuses the winner instead of refreshing twice", async () => {
  let n = 1
  const c = canva(url => url.endsWith("/oauth/token") ? tokenResponse(++n) : new Response("", { status: 500 }))
  c.store.record = { version: 1, sealed: seal(KEY, { accessToken: "at-1", refreshToken: "rt-1", expiresAt: c.now.ms + 3_600_000 }), connectedBy: "m", connectedAt: "t" }
  assert.equal(await canvaAccessToken(c.deps), "at-1"); assert.equal(c.calls.length, 0) // still valid
  c.now.ms += 3_600_000 - 30_000 // inside the 60 s refresh window
  assert.equal(await canvaAccessToken(c.deps), "at-2")
  assert.equal(new URLSearchParams(String(c.calls[0].init.body)).get("refresh_token"), "rt-1")
  assert.equal(unseal(KEY, c.store.record.sealed).refreshToken, "rt-2"); assert.equal(c.store.record.version, 2)
  // Race: our refresh is rejected because another instance already used rt-2 and stored rt-3.
  const race = canva(() => { race.store.record = { version: 3, sealed: seal(KEY, { accessToken: "at-3", refreshToken: "rt-3", expiresAt: 99_000_000 }), connectedBy: "m", connectedAt: "t" }; return Response.json({ code: "invalid_grant" }, { status: 400 }) })
  race.store.record = { version: 2, sealed: seal(KEY, { accessToken: "at-2", refreshToken: "rt-2", expiresAt: 0 }), connectedBy: "m", connectedAt: "t" }
  assert.equal(await canvaAccessToken(race.deps), "at-3"); assert.equal(race.calls.length, 1)
  // Not connected, or revoked with no newer token: clear errors, no secrets.
  await assert.rejects(canvaAccessToken(canva(() => tokenResponse(9)).deps), /not connected/)
  const revoked = canva(() => Response.json({ code: "invalid_grant", message: "rt-2 is revoked" }, { status: 400 }))
  revoked.store.record = { version: 2, sealed: seal(KEY, { accessToken: "x", refreshToken: "rt-2", expiresAt: 0 }), connectedBy: "m", connectedAt: "t" }
  await assert.rejects(canvaAccessToken(revoked.deps), (e: Error) => /reconnect Canva/.test(e.message) && !e.message.includes("rt-2"))
})

test("Canva export polls to success and returns page URLs in order; failures and timeouts are explicit", async () => {
  const live = { version: 1, sealed: seal(KEY, { accessToken: "at-live", refreshToken: "rt", expiresAt: 99_000_000_000 }), connectedBy: "m", connectedAt: "t" }
  let polls = 0
  const c = canva((url, init) => {
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer at-live")
    if (init.method === "POST") { assert.deepEqual(JSON.parse(String(init.body)), { design_id: "DAGabc123", format: { type: "jpg", quality: 95, pages: [2, 3] } }); return Response.json({ job: { id: "job-1", status: "in_progress" } }) }
    return ++polls < 3 ? Response.json({ job: { id: "job-1", status: "in_progress" } }) : Response.json({ job: { id: "job-1", status: "success", urls: ["https://export-download.canva.com/p2.jpg", "https://export-download.canva.com/p3.jpg"] } })
  }); c.store.record = live
  assert.deepEqual(await exportDesignJpg(c.deps, { designId: "DAGabc123", pages: [2, 3] }), ["https://export-download.canva.com/p2.jpg", "https://export-download.canva.com/p3.jpg"])
  assert.equal(c.calls[1].url, "https://api.canva.com/rest/v1/exports/job-1")
  const failed = canva(url => Response.json({ job: { id: "j", status: url.endsWith("/exports") ? "in_progress" : "failed", error: { code: "license_required" } } })); failed.store.record = live
  await assert.rejects(exportDesignJpg(failed.deps, { designId: "DAGabc123" }), (e: Error & { code?: string }) => e.code === "license_required")
  const slow = canva(() => Response.json({ job: { id: "j", status: "in_progress" } })); slow.store.record = live
  await assert.rejects(exportDesignJpg(slow.deps, { designId: "DAGabc123" }, { polls: 3, intervalMs: 1 }), /still running/)
  const short = canva(url => Response.json({ job: { id: "j", status: url.endsWith("/exports") ? "in_progress" : "success", ...(url.endsWith("/exports") ? {} : { urls: ["https://export-download.canva.com/1.jpg"] }) } })); short.store.record = live
  await assert.rejects(exportDesignJpg(short.deps, { designId: "DAGabc123", pages: [1, 2] }, { polls: 2, intervalMs: 1 }), /different number of pages/)
  await assert.rejects(exportDesignJpg(c.deps, { designId: "../x" }), /Invalid Canva design id/)
})

test("Canva connect: super-admin only, state is single-use, unexpired and bound to the admin who started it", async () => {
  const states = new Map<string, { verifier: string; by: string; expiresAtMs: number }>()
  let email: string | null = "marcos@434media.com"
  const c = canva(() => tokenResponse(1))
  const d: ConnectDeps = { canva: c.deps, session: async () => email ? { email } : null, isSuperAdmin: async e => e === "marcos@434media.com" || e === "second-owner@434media.com",
    saveState: async (h, verifier, by, expiresAtMs) => { states.set(h, { verifier, by, expiresAtMs }) },
    takeState: async (h, now) => { const s = states.get(h); states.delete(h); return s && s.expiresAtMs > now ? s : null } }
  email = null; assert.equal((await startCanvaConnect(d)).status, 401)
  email = "staff@434media.com"; assert.equal((await startCanvaConnect(d)).status, 403)
  email = "marcos@434media.com"
  const start = await startCanvaConnect(d), u = new URL(start.location!)
  assert.equal(u.origin + u.pathname, "https://www.canva.com/api/oauth/authorize"); assert.equal(u.searchParams.get("code_challenge_method"), "S256")
  const state = u.searchParams.get("state")!, saved = [...states.values()][0]
  assert.equal(u.searchParams.get("code_challenge"), sha256("sha256").update(saved.verifier).digest("base64url"))
  assert.ok(!start.location!.includes(saved.verifier)) // verifier never leaves the server
  email = "staff@434media.com"; assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state, code: "c" }))).status, 403)
  email = "marcos@434media.com"
  const other = new URL((await startCanvaConnect(d)).location!).searchParams.get("state")!
  email = "second-owner@434media.com"; assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state: other, code: "c" }))).status, 400) // another super-admin cannot finish it
  email = "marcos@434media.com"
  assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state, code: "c" }))).location, "/admin/content?canva=connected")
  assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state, code: "c" }))).status, 400) // replay refused
  const again = new URL((await startCanvaConnect(d)).location!).searchParams.get("state")!
  c.now.ms += 600_001
  assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state: again, code: "c" }))).status, 400) // expired
  assert.equal((await finishCanvaConnect(d, new URLSearchParams({ error: "access_denied", state: again }))).status, 400)
})

test("attach_canva_design exports through Canva and attaches pages in order; Canva errors stop before anything is stored", async () => {
  const urls = ["https://export-download.canva.com/p1.jpg", "https://export-download.canva.com/p2.jpg"]
  const i = intake([post()], { [urls[0]]: jpg(1080, 1350), [urls[1]]: jpg(1080, 1350) })
  const s = new Store()
  const d = deps(s, provider(), { intake: i.deps, canvaExport: async (id, pages) => { assert.equal(id, "DAGabc123"); assert.deepEqual(pages, [1, 2]); return urls } })
  const r = await runOwnedMetaTool("attach_canva_design", { postId: "post-1234567", designId: "DAGabc123", pages: [1, 2] }, PRINCIPAL, d)
  assert.equal(r.status, 200); assert.deepEqual(i.fetched, urls); assert.match(i.stored[0].filename, /-01-page-1\.jpg$/); assert.match(i.stored[1].filename, /-02-page-2\.jpg$/)
  const army = intake([post({ id: ARMY })])
  let exported = 0
  const blocked = await runOwnedMetaTool("attach_canva_design", { postId: ARMY, designId: "DAGabc123" }, PRINCIPAL, deps(s, provider(), { intake: army.deps, canvaExport: async () => { exported++; return urls } }))
  assert.equal(blocked.status, 409); assert.deepEqual(army.stored, [])
  const e = Object.assign(new Error("Canva is not connected; an admin must connect it once"), { name: "CanvaError" })
  const none = await runOwnedMetaTool("attach_canva_design", { postId: "post-1234567", designId: "DAGabc123" }, PRINCIPAL, deps(s, provider(), { intake: intake([post()]).deps, canvaExport: async () => { throw e } }))
  assert.equal(none.status, 409); assert.match(String(none.body.error), /not connected/)
  assert.equal(exported, 0) // the Army record is refused before Canva is even asked to export
})

// ── AI disclosure: only Meta's cited requirement is enforced; captions are never changed ──
import { META_AI_DISCLOSURE_RULE, aiDisclosureRequired } from "../owned-meta-formats"
import { validateManifest } from "../owned-meta-publisher"

function graphFake(m: MetaManifest, readback: boolean | undefined) {
  const calls: { path: string; method?: string; body?: URLSearchParams }[] = []
  const fetcher = (async (u: URL, init?: RequestInit) => {
    const path = u.pathname.replace("/v26.0/", ""); calls.push({ path, method: init?.method, body: init?.body as URLSearchParams })
    if (path === "3/media" && init?.method === "GET") return Response.json({ data: [{ id: "101", permalink: "https://www.instagram.com/p/x" }] })
    if (path === "2/published_posts") return Response.json({ data: [{ id: "2_202", permalink_url: "https://www.facebook.com/p/y" }] })
    if (path === "101") return Response.json({ id: "101", ...(readback === undefined ? {} : { is_ai_generated: readback }) })
    return Response.json({ id: "2_202", post_id: "2_202" })
  }) as typeof fetch
  return { calls, p: createMetaProvider({ accessToken: "t", evidence: { verifiedAt: NOW, credentialKind: "system_user_page", appId: "1", pageId: "2", instagramId: "3" }, beforeMutation: async () => {}, fetcher }) }
}

test("Meta's AI requirement is identified by source and applies only to declared photorealistic video or realistic audio", () => {
  assert.match(META_AI_DISCLOSURE_RULE.appliesTo, /photorealistic video or realistic-sounding audio/)
  assert.ok(META_AI_DISCLOSURE_RULE.sources.every(u => /^https:\/\/(transparency\.meta\.com|about\.fb\.com)\//.test(u)))
  assert.equal(aiDisclosureRequired(manifest("still", true)), false)
  assert.equal(aiDisclosureRequired(manifest("carousel", true)), false)
  const v = manifest("video", true)
  assert.throws(() => validateManifest(v), /photorealistic/) // an AI video must say whether the rule applies
  v.aiRealisticMedia = false; validateManifest(v); assert.equal(aiDisclosureRequired(v), false)
  v.aiRealisticMedia = true; validateManifest(v); assert.equal(aiDisclosureRequired(v), true)
  const still = manifest("still", true); still.aiRealisticMedia = true
  assert.throws(() => validateManifest(still), /video only/)
})

test("AI stills publish on Facebook with the approved caption byte-for-byte and a notice, never a block", async () => {
  const m = manifest("still", true); m.captions.facebook = "Nine named vendors. About $93.6 million."
  const { p, calls } = graphFake(m, true)
  assert.equal(p.preflight(m, "facebook"), null); assert.equal(p.preflight(m, "instagram"), null)
  await p.publish(m, "facebook", [m.assets[0].url], {})
  const sent = calls.find(c => c.path === "2/photos")!.body!
  assert.equal(sent.get("caption"), "Nine named vendors. About $93.6 million."); assert.equal(sent.get("is_ai_generated"), null)
  assert.deepEqual(noticesFor(m).filter(n => n.feature.endsWith("ai_label")).map(n => [n.feature, n.status]), [["facebook_ai_label", "not_applied"]])
  const { readFileSync } = await import("node:fs")
  for (const f of ["lib/owned-meta-formats.ts", "lib/instagram-publishing.ts", "lib/owned-meta-tool.ts", "lib/owned-meta-publisher.ts"]) assert.doesNotMatch(readFileSync(f, "utf8"), /hasAiCaptionDisclosure|AI_CAPTION_DISCLOSURE|Made with AI/) // no caption gate or caption addition exists
})

test("a label that does not read back is a notice unless Meta's rule applies; the post is never republished", async () => {
  const still = manifest("still", true)
  assert.deepEqual(await graphFake(still, false).p.verify(still, "instagram", "101"), { verified: true, permalink: "https://www.instagram.com/p/x", notice: "AI label was sent but did not read back; the post is live and unchanged" })
  const real = manifest("video", true); real.aiRealisticMedia = true
  const r = await graphFake(real, false).p.verify(real, "instagram", "101")
  assert.equal(r.verified, false); assert.match(r.blocker!, /transparency\.meta\.com/); assert.match(r.blocker!, /do not republish/)
  // Through the state machine: a non-blocking notice is kept on the job and the job is verified.
  const s = new Store(record(still)), prov = provider(); prov.verify = async (_m, d) => ({ verified: true, permalink: `https://www.${d}.com/p/v`, ...(d === "instagram" ? { notice: "AI label was sent but did not read back; the post is live and unchanged" } : {}) })
  await call(deps(s, prov), exec(s))
  assert.equal(s.value.batch.jobs.instagram.status, "verified"); assert.match(s.value.batch.jobs.instagram.notice!, /did not read back/)
  assert.equal(prov.calls.filter(c => c === "publish:instagram").length, 1)
})

// ── Carried over from draft #186: design binding, export fingerprint, idempotent re-attach ──
test("Canva design binding, export fingerprint and identical re-attach reuse", async () => {
  const urls = ["https://export-download.canva.com/p1.jpg", "https://export-download.canva.com/p2.jpg"]
  const i = intake([post()], { [urls[0]]: jpg(1080, 1350), [urls[1]]: jpg(1080, 1350) })
  const first = await attachExports(i.deps, { postId: "post-1234567", items: urls.map(url => ({ url })), randomId: uuid, canva: { designId: "DAGabc123" } })
  assert.equal(first.reused, false); assert.match(first.fingerprint, /^[a-f0-9]{64}$/)
  assert.deepEqual(i.assetsSet[0].assets.map(a => [a.source, a.canvaDesignId, a.page, a.sha256?.length]), [["canva", "DAGabc123", 1, 64], ["canva", "DAGabc123", 2, 64]])
  assert.equal(first.post.canvaDesignId, "DAGabc123"); assert.equal(first.post.exportFingerprint, first.fingerprint)
  const again = await attachExports(i.deps, { postId: "post-1234567", items: urls.map(url => ({ url })), randomId: uuid, canva: { designId: "DAGabc123" } })
  assert.equal(again.reused, true); assert.equal(again.fingerprint, first.fingerprint); assert.equal(i.stored.length, 2); assert.equal(i.assetsSet.length, 1) // no new upload, draft untouched
  await assert.rejects(attachExports(i.deps, { postId: "post-1234567", items: [{ url: urls[0] }], randomId: uuid, canva: { designId: "DAGother99" } }), /bound to Canva design DAGabc123/)
  assert.deepEqual((await findPosts(i.deps, { canvaDesignId: "DAGabc123" })).map(p => p.id), ["post-1234567"])
  const created = await createPost(i.deps, PRINCIPAL, { requestId: "req-design-0001", title: "Anything", brand: "milcity", caption: "x", canvaDesignId: "DAGabc123" })
  assert.equal(created.created, false); assert.equal(created.post.id, "post-1234567"); assert.equal(i.created.length, 0) // one design, one record
})

test("a failed Canva connect logs only Canva's short error code or the failing stage, never secrets", async () => {
  const c = canva(() => Response.json({ code: "invalid_client", message: "client secret csecret is wrong" }, { status: 401 }))
  const states = new Map<string, { verifier: string; by: string }>()
  const d: ConnectDeps = { canva: c.deps, session: async () => ({ email: "marcos@434media.com" }), isSuperAdmin: async () => true,
    saveState: async (h, verifier, by) => { states.set(h, { verifier, by }) }, takeState: async h => { const s = states.get(h); states.delete(h); return s ?? null } }
  const state = new URL((await startCanvaConnect(d)).location!).searchParams.get("state")!
  const logged: unknown[][] = [], original = console.error
  console.error = (...a: unknown[]) => { logged.push(a) }
  try { assert.equal((await finishCanvaConnect(d, new URLSearchParams({ state, code: "secret-code" }))).status, 502) } finally { console.error = original }
  assert.deepEqual(logged, [["[canva] connect failed:", "token:invalid_client"]])
  assert.ok(!JSON.stringify(logged).includes("csecret") && !JSON.stringify(logged).includes("secret-code"))
  const canvaError = (await import("../canva-export")).CanvaError
  assert.equal(connectFailureCode(new canvaError("x", "http_400")), "token:http_400")
  assert.equal(connectFailureCode(new canvaError("x", "has spaces and a secret")), "token:unrecognized")
  assert.equal(connectFailureCode(new canvaError("concurrent")), "store_conflict")
  assert.equal(connectFailureCode(Object.assign(new Error("firestore"), { name: "FirebaseError" })), "store:FirebaseError")
})

// ── Security review findings 3 and 4 (2026-10-18) ──
import { PIPELINE_KEY_PREFIX, PIPELINE_SOURCE, adoptablePost, pipelineMarked, reservedRequestId } from "../content-pipeline/ownership"
import { KEY_PREFIX } from "../content-pipeline/worker"
import { outcomeStatusRefusal } from "../content-post-guards"

test("finding 3: the pipeline's admin: request ids are reserved; create_post and canva_create_design refuse them", async () => {
  assert.equal(PIPELINE_KEY_PREFIX, KEY_PREFIX) // one prefix: the one the worker keys its ledgers with
  for (const id of ["admin:MCU-NEWS-20261018-03:v1", "ADMIN:MCU-NEWS-20261018-03:v1", " admin:x1234567"]) assert.equal(reservedRequestId(id), true, id)
  assert.equal(reservedRequestId("slack:C0C9RQE54SG:1792145804.228509"), false)
  const { deps: d, created } = intake([])
  const input = { requestId: "admin:MCU-NEWS-20261018-03:v1", title: "Planted", brand: "milcity" as const, caption: "Not the pipeline's caption." }
  await assert.rejects(createPost(d, PRINCIPAL, input), /requestIds starting with "admin:" are reserved for the content pipeline/)
  assert.equal(created.length, 0)
  assert.equal((await createPost(d, PRINCIPAL, { ...input, requestId: "slack:C0C9RQE54SG:1792145804.228509" })).created, true)
  // The Canva ledger: a reserved id never reaches Canva; any other id does.
  const asked: string[] = []
  const tools = deps(new Store(), provider(), { canvaCreate: async i => { asked.push(i.requestId); return { design: { designId: "DAGnew1234", editUrl: "e", viewUrl: "v", previewUrls: [] }, reused: false } as never } })
  const fill = { templateId: "FXtpl01fe", title: "Card", text: { headline: "X" } }
  const refused = await runOwnedMetaTool("canva_create_design", { requestId: "admin:MCU-NEWS-20261018-03:v1:f1", ...fill }, PRINCIPAL, tools)
  assert.equal(refused.status, 409); assert.match(String(refused.body.error), /reserved for the content pipeline/)
  assert.equal((await runOwnedMetaTool("canva_create_design", { requestId: "slack:C1:1792145804.1:f1", ...fill }, PRINCIPAL, tools)).status, 200)
  assert.deepEqual(asked, ["slack:C1:1792145804.1:f1"])
})

test("finding 3: the pipeline adopts an existing post for its request id only when it created it", () => {
  const intakeOf = (source?: string) => ({ requestId: "admin:MCU-NEWS-20261018-03:v1", metaBrand: "milcity", requestedBy: "x@434media.com", at: NOW, ...(source ? { source } : {}) }) as ContentPost["intake"]
  assert.equal(adoptablePost(null), null)
  const ours = post({ id: "ours-1234567", intake: intakeOf(PIPELINE_SOURCE) })
  assert.equal(adoptablePost(ours), ours)
  // A post planted under the pipeline's request id (by another caller, before the prefix was reserved) is refused.
  assert.throws(() => adoptablePost(post({ id: "planted-12345", intake: intakeOf() })), /Post planted-12345 already holds this draft's request id but was not created by the content pipeline/)
  assert.throws(() => adoptablePost(post({ id: "planted-12345", intake: intakeOf("slack") })), /not created by the content pipeline/)
  // What run.ts writes carries the marker; nothing else about the post changes.
  const fields = post({ intake: { requestId: "admin:x1234567", metaBrand: "milcity", requestedBy: "a@b.c", at: NOW } })
  assert.deepEqual(pipelineMarked(fields), { ...fields, intake: { ...fields.intake!, source: PIPELINE_SOURCE } })
})

test("finding 4: a no-content card's status never changes through the generic update or Mark as posted", () => {
  const notice = post({ status: "needs_approval", pipeline_outcome: { kind: "no_new_content", job_id: "job-1", reason: "nothing qualified", tried: [] } })
  for (const next of ["approved", "scheduled", "posted", "rejected", "in_progress"]) assert.match(outcomeStatusRefusal(notice, next) ?? "", /no new content was found, so its status can't change; close it with Confirm no new content/, next)
  // Saving other fields (status unchanged or absent) still works, and ordinary posts are untouched.
  assert.equal(outcomeStatusRefusal(notice, "needs_approval"), null)
  assert.equal(outcomeStatusRefusal(notice, undefined), null)
  assert.equal(outcomeStatusRefusal(post({ status: "approved" }), "posted"), null)
  assert.equal(outcomeStatusRefusal(null, "approved"), null)
})
