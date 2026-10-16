/** Offline only. Run with tsx --test; Canva, Blob, Firestore and Meta are all injected fakes. */
import { test } from "node:test"
import assert from "node:assert/strict"
import { generateKeyPairSync, createSign } from "node:crypto"
import type { ContentPost } from "../../components/crm/types"
import { createCanvaClient, CanvaBlocked, type CanvaTokenSet, type CanvaTokenStore } from "../canva-connect"
import { stageCanvaExport, exportFingerprint, describeStagedAssets } from "../content-exports"
import { matchContentRecords, findReusableRecord, normalizeTitle } from "../content-records"
import { createContentAuthVerifier, verifyJwt, scopesFromClaims, type ContentAuth } from "../content-mcp-auth"
import { createContentTools, batchView, type ContentToolDeps } from "../content-mcp-tools"
import { assetDigest } from "../owned-meta-assets"
import { draftBatch, type MetaManifest, type MetaBatch } from "../owned-meta-publisher"
import { checkReviewedFormat, hasAiCaptionDisclosure } from "../owned-meta-formats"
import { createMetaProvider, type MetaPublishingEvidence } from "../instagram-publishing"
import { OwnedMetaActionError } from "../owned-meta-actions"

// Minimal baseline JPEG: SOI, SOF0 (1080×1350), EOI. Enough for measureExport.
const jpeg = (w = 1080, h = 1350, tail = 0) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00, 0xff, 0xd9]), Buffer.alloc(tail, tail)])
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 4, 56, 0, 0, 5, 70])
const ORIGIN = "https://approved.public.blob.vercel-storage.com"

class MemoryTokens implements CanvaTokenStore { value: CanvaTokenSet | null; writes: CanvaTokenSet[] = []; constructor(v: CanvaTokenSet | null) { this.value = v } async read() { return this.value } async write(n: CanvaTokenSet) { this.writes.push(n); this.value = n } }
const post = (over: Partial<ContentPost> = {}): ContentPost => ({ id: "p1", user: "Marcos", date_created: "2026-10-16", status: "to_do", title: "MCU Army carousel", links: [], assets: [], social_platforms: ["instagram", "facebook"], created_at: "", updated_at: "", ...over })

test("Canva: refresh rotates and persists the new refresh token before the export runs", async () => {
  const store = new MemoryTokens({ accessToken: "old", refreshToken: "r1", expiresAt: "2000-01-01T00:00:00Z" })
  const seen: string[] = []
  const fetcher = (async (url: unknown, init?: RequestInit) => {
    const u = String(url); seen.push(`${init?.method ?? "GET"} ${new URL(u).pathname}`)
    if (u.endsWith("/oauth/token")) { assert.match(String(init?.headers && (init.headers as Record<string, string>).authorization), /^Basic /); return Response.json({ access_token: "new", refresh_token: "r2", expires_in: 14400 }) }
    if (u.endsWith("/exports")) { assert.equal((init?.headers as Record<string, string>).authorization, "Bearer new"); return Response.json({ job: { id: "job1", status: "in_progress" } }) }
    if (u.endsWith("/exports/job1")) return Response.json({ job: { id: "job1", status: "success", urls: ["https://export-download.canva.com/a.jpg", "https://export-download.canva.com/b.jpg"] } })
    throw new Error(`unexpected ${u}`)
  }) as typeof fetch
  const canva = createCanvaClient({ clientId: "id", clientSecret: "secret", store, fetcher })
  const result = await canva.exportJpg("DAFabc123", { pollMs: 1 })
  assert.deepEqual(result, { jobId: "job1", urls: ["https://export-download.canva.com/a.jpg", "https://export-download.canva.com/b.jpg"] })
  assert.equal(store.writes[0].refreshToken, "r2")
  assert.equal(seen[0], "POST /rest/v1/oauth/token")
  const health = await canva.health(); assert.equal(health.connected, true); assert.ok(!("accessToken" in health) && !("refreshToken" in health))
})
test("Canva: failed job and missing connection are explicit, non-retrying errors", async () => {
  const fail = createCanvaClient({ clientId: "id", clientSecret: "s", store: new MemoryTokens({ accessToken: "a", refreshToken: "r", expiresAt: "2999-01-01T00:00:00Z" }), fetcher: (async () => Response.json({ job: { id: "j", status: "failed", error: { code: "license_required" } } })) as typeof fetch })
  await assert.rejects(fail.exportJpg("DAFabc123"), (e: CanvaBlocked) => e.code === "license_required")
  const none = createCanvaClient({ clientId: "id", clientSecret: "s", store: new MemoryTokens(null), fetcher: (async () => { throw new Error("must not call") }) as typeof fetch })
  await assert.rejects(none.exportJpg("DAFabc123"), (e: CanvaBlocked) => e.code === "not_connected")
  await assert.rejects(none.exportJpg("bad id!"), /Invalid/)
})

test("Staging: measures, hashes, writes UUID Blob paths and is idempotent for identical exports", async () => {
  const pages = [jpeg(), jpeg(1080, 1350, 3)]
  const writes: string[] = []
  const args = { post: post(), designId: "DAFabc123", jobId: "job1", urls: ["https://x/a", "https://x/b"], download: async (u: string) => pages[u.endsWith("a") ? 0 : 1], writeBlob: async (p: string) => { writes.push(p); return { url: `${ORIGIN}/${p}` } }, allowedOrigins: [ORIGIN] }
  const staged = await stageCanvaExport(args)
  assert.equal(staged.assets.length, 2); assert.equal(staged.reused, false)
  assert.deepEqual(staged.assets.map(a => a.sha256), pages.map(p => assetDigest(p)))
  assert.equal(staged.fingerprint, exportFingerprint(pages.map(p => assetDigest(p))))
  assert.match(writes[0], /^content-posts\/[0-9a-f-]{36}-DAFabc123-p01\.jpg$/)
  assert.deepEqual(staged.assets.map(a => [a.width, a.height, a.page, a.source]), [[1080, 1350, 1, "canva"], [1080, 1350, 2, "canva"]])
  const again = await stageCanvaExport({ ...args, post: post({ assets: staged.assets, canva_design_id: "DAFabc123" }) })
  assert.equal(again.reused, true); assert.equal(writes.length, 2)
  assert.deepEqual(describeStagedAssets(staged.assets), { pages: 2, aspects: ["0.8000", "0.8000"], uniformAspect: true, instagramFeedOk: true })
})
test("Staging refuses non-JPEG, started batches, a different bound design and a foreign Blob origin", async () => {
  const base = { designId: "DAFabc123", jobId: "j", urls: ["https://x/a"], download: async () => jpeg(), writeBlob: async (p: string) => ({ url: `${ORIGIN}/${p}` }), allowedOrigins: [ORIGIN] }
  await assert.rejects(stageCanvaExport({ ...base, post: post(), download: async () => png }), /JPEG/)
  await assert.rejects(stageCanvaExport({ ...base, post: post({ owned_meta: { batchId: "b", hash: "h", started: true } }) }), /already started/)
  await assert.rejects(stageCanvaExport({ ...base, post: post({ canva_design_id: "DAFother1" }) }), /bound to Canva design/)
  await assert.rejects(stageCanvaExport({ ...base, post: post(), writeBlob: async (p: string) => ({ url: `https://other.public.blob.vercel-storage.com/${p}` }) }), /OWNED_META_SOURCE_ORIGINS/)
})

test("Records: exact, bounded matching and the reuse rule never hands back a near-miss", () => {
  const posts = [post({ id: "a", title: "MCU Army carousel", canva_design_id: "DAFabc123", status: "posted" }), post({ id: "b", title: "mcu army CAROUSEL" }), post({ id: "c", title: "MCU Army carousel v2" }), post({ id: "d", title: "x", archived: true })]
  assert.equal(normalizeTitle("MCU — Army carousel!"), "mcu army carousel")
  assert.deepEqual(matchContentRecords(posts, { title: "MCU Army Carousel" }).map(p => p.id), ["a", "b"])
  assert.deepEqual(matchContentRecords(posts, {}).map(p => p.id), [])
  assert.equal(findReusableRecord(posts, { canvaDesignId: "DAFabc123", title: "anything" })?.id, "a")
  assert.equal(findReusableRecord(posts, { canvaDesignId: "DAFnew", title: "MCU Army carousel" })?.id, "b")
  assert.equal(findReusableRecord(posts, { canvaDesignId: "DAFnew", title: "Different" }), null)
})

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string }
function jwt(payload: Record<string, unknown>, kid = "k1"): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const signed = `${enc({ alg: "RS256", typ: "JWT", kid })}.${enc(payload)}`
  const sig = createSign("sha256").update(signed).sign(privateKey).toString("base64url")
  return `${signed}.${sig}`
}
const jwtConfig = { issuer: "https://issuer.example/", audience: "https://434media.com/api/content/mcp" }
const getKey = async () => ({ kty: "RSA", kid: "k1", n: jwk.n, e: jwk.e })
const now = () => 1_800_000_000_000
test("Auth: RS256 JWT is verified for issuer, audience and expiry; scopes and email come from claims", async () => {
  const good = jwt({ iss: jwtConfig.issuer, aud: [jwtConfig.audience], exp: 1_800_000_600, scope: "content:read meta:publish openid", email: "Marcos@434media.com", azp: "chatgpt" })
  const claims = await verifyJwt(good, jwtConfig, getKey, now)
  assert.ok(claims); assert.deepEqual(scopesFromClaims(claims!), ["content:read", "meta:publish"])
  assert.equal(await verifyJwt(jwt({ iss: jwtConfig.issuer, aud: "https://other", exp: 1_800_000_600 }), jwtConfig, getKey, now), null)
  assert.equal(await verifyJwt(jwt({ iss: jwtConfig.issuer, aud: jwtConfig.audience, exp: 1_700_000_000 }), jwtConfig, getKey, now), null)
  assert.equal(await verifyJwt(jwt({ iss: "https://evil/", aud: jwtConfig.audience, exp: 1_800_000_600 }), jwtConfig, getKey, now), null)
  assert.equal(await verifyJwt(good.slice(0, -4) + "AAAA", jwtConfig, getKey, now), null)
  const verify = createContentAuthVerifier({ jwt: jwtConfig, staticInternalToken: "static-secret", fetcher: (async () => Response.json({ keys: [await getKey()] })) as typeof fetch, now })
  const oauth = await verify(good); assert.equal(oauth?.kind, "oauth"); assert.equal(oauth?.email, "marcos@434media.com"); assert.equal(oauth?.clientId, "chatgpt")
  const stat = await verify("static-secret"); assert.deepEqual(stat, { clientId: "sor-internal", email: null, scopes: ["content:read", "meta:read"], kind: "static" })
  assert.equal(await verify("static-secre"), undefined); assert.equal(await verify(undefined), undefined)
  assert.equal(await verify(jwt({ iss: jwtConfig.issuer, aud: jwtConfig.audience, exp: 1_800_000_600, scope: "openid" })), undefined, "a token with no content scope is rejected outright")
})

function manifest(format: MetaManifest["format"] = "carousel", ai = false, fb = "FB exact"): MetaManifest {
  const asset = { name: "a", url: `${ORIGIN}/content-posts/12345678-1234-1234-1234-123456789abc.jpg`, sha256: assetDigest(jpeg()), size: jpeg().length, mime: "image/jpeg" as const, width: 1080, height: 1350, provenance: { source: "canva", templateRevision: "v1", generator: "none", metadata: "unverified" as const } }
  return { schema: 1, revision: 1, brand: "milcity", format, assets: format === "carousel" ? [asset, { ...asset, name: "b" }] : [asset], captions: { instagram: "IG", facebook: fb }, destinations: { appId: "1", pageId: "2", instagramId: "3", apiVersion: "v26.0" }, placements: { instagram: "feed", facebook: "feed" }, instagramShareToFeed: false, aiGenerated: ai, publicHostingApproved: true }
}
test("Facebook AI disclosure: caption disclosure replaces the blanket manual block; verify reads back no flag there", async () => {
  assert.match(checkReviewedFormat(manifest("still", true), "facebook")!, /explicit AI disclosure/)
  assert.equal(checkReviewedFormat(manifest("still", true, "Made with AI. FB caption"), "facebook"), null)
  assert.equal(checkReviewedFormat(manifest("carousel", false), "facebook"), null)
  assert.equal(hasAiCaptionDisclosure("This image is AI-generated"), true); assert.equal(hasAiCaptionDisclosure("plain"), false)
  const m = manifest("still", true, "Made with AI")
  const evidence: MetaPublishingEvidence = { verifiedAt: "2026-10-09T00:00:00Z", credentialKind: "system_user_page", appId: "1", pageId: "2", instagramId: "3" }
  const paths: string[] = []
  const provider = createMetaProvider({ accessToken: "fake", evidence, beforeMutation: async () => {}, fetcher: (async (url: unknown) => { const p = new URL(String(url)).pathname; paths.push(p); if (p.endsWith("/published_posts")) return Response.json({ data: [{ id: "2_9", permalink_url: "https://www.facebook.com/2/posts/9" }] }); return Response.json({ id: "2_9" }) }) as typeof fetch })
  const v = await provider.verify(m, "facebook", "2_9")
  assert.deepEqual(v, { verified: true, permalink: "https://www.facebook.com/2/posts/9" })
  assert.ok(!paths.some(p => p === "/v26.0/2_9"), "no is_ai_generated readback on a caption-disclosed Facebook photo")
})

function deps(over: Partial<ContentToolDeps> = {}, posts: ContentPost[] = []): ContentToolDeps & { created: ContentPost[]; actions: string[] } {
  const created: ContentPost[] = [], actions: string[] = []
  const approved = (): MetaBatch => { const b = draftBatch("batch-1", manifest()); b.approval = { by: "marcos@434media.com", at: "2026-10-16T00:00:00Z", hash: b.hash }; return b }
  return {
    created, actions,
    listPosts: async () => [...posts, ...created], getPost: async (id) => [...posts, ...created].find(p => p.id === id) ?? null,
    findByDesign: async (d) => [...posts, ...created].find(p => p.canva_design_id === d && !p.archived) ?? null,
    createPost: async (input) => { const p = { ...input, id: `new-${created.length + 1}`, created_at: "", updated_at: "" } as ContentPost; created.push(p); return p },
    attachStaged: async (id, designId, staged) => { const p = [...posts, ...created].find(x => x.id === id)!; Object.assign(p, { assets: staged.assets, canva_design_id: designId, export_fingerprint: staged.fingerprint }); return p },
    canva: () => null, writeBlob: async (p) => ({ url: `${ORIGIN}/${p}` }), fetcher: fetch, isSuperAdmin: async (e) => e === "marcos@434media.com",
    decide: async (_id, rev, hash, decision) => { actions.push(`decide:${decision}:${rev}:${hash.slice(0, 6)}`); return approved() },
    runAction: async (_id, body) => { actions.push(body.action); const b = approved(); if (body.action === "execute") { b.jobs.instagram = { status: "verified", preparation: { container: "11" }, remoteId: "101", permalink: "https://www.instagram.com/p/x/", finalIntent: { id: "r:instagram", at: "t" } }; b.jobs.facebook = { status: "manual_required", preparation: {}, blocker: "unsupported here" } } return b },
    status: async () => ({ enabled: true, batch: approved(), archived: false, canRecover: false }),
    connection: async () => { throw new OwnedMetaActionError("Batch changed during connection check; reload", 409) },
    credentialHealth: async (brand) => ({ brand, configured: false, reason: "Publishing credentials are production-only", runtime: { production: false, globalEnabled: false, brandEnabled: false, permissionBlocked: null } }),
    allowedOrigins: () => [ORIGIN],
    ...over,
  }
}
const founder: ContentAuth = { clientId: "chatgpt", email: "marcos@434media.com", scopes: ["content:read", "content:write", "content:approve", "meta:read", "meta:publish"], kind: "oauth" }
const reader: ContentAuth = { clientId: "sor-internal", email: null, scopes: ["content:read", "meta:read"], kind: "static" }

test("Tools: scopes and identity gate every write; the static token is read-only", async () => {
  const t = createContentTools(deps())
  for (const r of [await t.create_content_record(reader, { title: "x", canva_design_id: "DAFabc123", user: "m", social_platforms: ["instagram"] }), await t.publish_meta_batch(reader, { content_post_id: "p1", batch_id: "b", hash: "h".repeat(64) }), await t.approve_meta_batch(reader, { content_post_id: "p1", expected_revision: 1, expected_hash: "h".repeat(64), decision: "approved" }), await t.find_content_records(undefined, {})]) assert.equal((r as { code?: string }).code, "not_authorized")
  const anon: ContentAuth = { ...founder, email: null }
  assert.equal((await t.publish_meta_batch(anon, { content_post_id: "p1", batch_id: "b", hash: "h".repeat(64) }) as { code?: string }).code, "not_authorized")
  const nonAdmin: ContentAuth = { ...founder, email: "intern@434media.com" }
  assert.equal((await t.approve_meta_batch(nonAdmin, { content_post_id: "p1", expected_revision: 1, expected_hash: "h".repeat(64), decision: "approved" }) as { code?: string }).code, "not_authorized")
})
test("Tools: create dedupes on design id and unposted title; a posted record is reused, never replaced", async () => {
  const live = post({ id: "army", title: "MCU Army carousel", canva_design_id: "DAFarmy001", status: "posted", published_url: "https://www.instagram.com/p/live/" })
  const d = deps({}, [live]); const t = createContentTools(d)
  const r1 = await t.create_content_record(founder, { title: "Totally different", canva_design_id: "DAFarmy001", user: "m", social_platforms: ["instagram"] }) as unknown as { reused: boolean; record: { id: string }; note: string }
  assert.equal(r1.reused, true); assert.equal(r1.record.id, "army"); assert.match(r1.note, /already posted/)
  const r2 = await t.create_content_record(founder, { title: "MCU asset 7", canva_design_id: "DAFseven07", user: "m", social_platforms: ["instagram"] }) as unknown as { reused: boolean; record: { id: string } }
  assert.equal(r2.reused, false); assert.equal(d.created.length, 1)
  const r3 = await t.create_content_record(founder, { title: "mcu asset 7", canva_design_id: "DAFseven07", user: "m", social_platforms: ["instagram"] }) as unknown as { reused: boolean }
  assert.equal(r3.reused, true); assert.equal(d.created.length, 1)
  for (const r of [await t.stage_canva_export(founder, { content_post_id: "army", canva_design_id: "DAFarmy001" }), await t.prepare_meta_batch(founder, { content_post_id: "army", expected_fingerprint: "f".repeat(64), brand: "milcity", format: "carousel", captions: { instagram: "a", facebook: "b" }, ai_generated: false }), await t.publish_meta_batch(founder, { content_post_id: "army", batch_id: "b", hash: "h".repeat(64) })]) assert.equal((r as { code?: string }).code, "blocked", "posted record is excluded from staging, review and publishing")
  assert.deepEqual(d.actions, [])
})
test("Tools: stage → prepare binds the approval to the staged fingerprint; publish reports partial support without blocking", async () => {
  const pages = [jpeg(), jpeg(1080, 1350, 2)]
  const target = post({ id: "p7", title: "MCU asset 7" })
  const canva = { exportJpg: async () => ({ jobId: "job7", urls: ["https://x/1", "https://x/2"] }), health: async () => ({ connected: true }), designTitle: async () => null, exchangeCode: async () => { throw new Error("n/a") } } as unknown as ReturnType<ContentToolDeps["canva"]>
  const d = deps({ canva: () => canva, fetcher: (async (u: unknown) => new Response(pages[String(u).endsWith("1") ? 0 : 1])) as typeof fetch }, [target]); const t = createContentTools(d)
  const staged = await t.stage_canva_export(founder, { content_post_id: "p7", canva_design_id: "DAFseven07" }) as { ok: boolean; export_fingerprint: string; pages: number; reused: boolean }
  assert.equal(staged.ok, true); assert.equal(staged.pages, 2); assert.equal(staged.reused, false); assert.equal(target.export_fingerprint, staged.export_fingerprint)
  const wrong = await t.prepare_meta_batch(founder, { content_post_id: "p7", expected_fingerprint: "0".repeat(64), brand: "milcity", format: "carousel", captions: { instagram: "a", facebook: "b" }, ai_generated: false }) as { code?: string }
  assert.equal(wrong.code, "blocked"); assert.deepEqual(d.actions, [])
  const ai = await t.prepare_meta_batch(founder, { content_post_id: "p7", expected_fingerprint: staged.export_fingerprint, brand: "milcity", format: "carousel", captions: { instagram: "a", facebook: "no disclosure" }, ai_generated: true }) as { code?: string; message: string }
  assert.equal(ai.code, "blocked"); assert.match(ai.message, /AI disclosure/)
  const prepared = await t.prepare_meta_batch(founder, { content_post_id: "p7", expected_fingerprint: staged.export_fingerprint, brand: "milcity", format: "carousel", captions: { instagram: "a", facebook: "b" }, ai_generated: false }) as { ok: boolean; batch: ReturnType<typeof batchView>; preflight: Record<string, string | null> }
  assert.equal(prepared.ok, true); assert.equal(prepared.batch.approved, true); assert.deepEqual(prepared.preflight, { instagram: null, facebook: null })
  const approved = await t.approve_meta_batch(founder, { content_post_id: "p7", expected_revision: 1, expected_hash: prepared.batch.hash, decision: "approved" }) as { ok: boolean }
  assert.equal(approved.ok, true)
  target.owned_meta = { batchId: prepared.batch.batchId, hash: prepared.batch.hash, started: false }
  const published = await t.publish_meta_batch(founder, { content_post_id: "p7", batch_id: prepared.batch.batchId, hash: prepared.batch.hash }) as { ok: boolean; publication: string; unsupported: { destination: string; reason: string }[]; batch: ReturnType<typeof batchView> }
  assert.equal(published.ok, true); assert.equal(published.publication, "partial")
  assert.deepEqual(published.unsupported, [{ destination: "facebook", reason: "unsupported here" }])
  assert.equal(published.batch.jobs.instagram.permalink, "https://www.instagram.com/p/x/"); assert.equal(published.batch.jobs.instagram.uncertain, false)
  assert.deepEqual(d.actions, ["prepare", `decide:approved:1:${prepared.batch.hash.slice(0, 6)}`, "execute"])
})
test("Tools: an unknown final outcome is reported as uncertain, never as success or failure", async () => {
  const b = draftBatch("batch-1", manifest()); b.approval = { by: "x", at: "t", hash: b.hash }
  b.jobs.facebook = { status: "needs_reconciliation", preparation: { photo_0: "1" }, finalIntent: { id: "r:facebook", at: "t" }, blocker: "Final publication may have happened; do not repeat" }
  const target = post({ id: "p9", owned_meta: { batchId: "batch-1", hash: b.hash, started: true } })
  const t = createContentTools(deps({ runAction: async () => b }, [target]))
  const r = await t.publish_meta_batch(founder, { content_post_id: "p9", batch_id: "batch-1", hash: b.hash }) as { ok: boolean; publication: string; note: string; batch: ReturnType<typeof batchView> }
  assert.equal(r.ok, true); assert.equal(r.publication, "uncertain"); assert.equal(r.batch.jobs.facebook.uncertain, true); assert.match(r.note, /Do not retry/)
  const err = createContentTools(deps({ runAction: async () => { throw new OwnedMetaActionError("Publisher disabled", 423) } }, [target]))
  assert.equal((await err.publish_meta_batch(founder, { content_post_id: "p9", batch_id: "batch-1", hash: b.hash }) as { code?: string }).code, "unavailable")
})
